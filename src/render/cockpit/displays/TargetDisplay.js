import * as THREE from 'three';
import { healthColor } from './DamageDisplay.js';

const STAGE_FRACTION = [1, 0.7, 0.45, 0.2, 0];
const STAGE_TEXT = ['INTAKT', 'LEICHT', 'MITTEL', 'SCHWER', 'ZERSTÖRT'];
const LABELS = { torso: 'TORSO', armL: 'ARM L', armR: 'ARM R', legs: 'BEINE', sensors: 'SENSOR' };
const WRECK = { legs: 'BEWEGUNGSUNFÄHIG', reactor: 'REAKTOR ZERSTÖRT' };
const EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const inv = new THREE.Matrix4();
const m = new THREE.Matrix4();
const corner = new THREE.Vector3();
const pts = Array.from({ length: 8 }, () => [0, 0]);

/**
 * Target page: slowly turning wireframe of the locked walker built from its
 * hit zones, coloured by damage stage, plus type, distance, lock progress,
 * shields and component stages. Idle acquisition pattern without a target.
 */
export const TargetDisplay = {
  persistence: 0.6,

  draw(p, d) {
    const { w, h } = p;
    p.text('ZIELMONITOR', 8, 12, { size: 11 });
    p.line(8, 22, w - 8, 22, 0.4);
    if (d.sensors < 1) {
      p.text('KEINE SENSORDATEN', w / 2, h / 2, { size: 13, align: 'center', alpha: 0.7 });
      return;
    }
    const t = d.target;
    if (!t) {
      idle(p, d);
      return;
    }

    p.text(t.name, w - 8, 12, { size: 11, align: 'right' });
    drawWireframe(p, t, d.time, 8, 28, w * 0.58, h - 70);

    // Component stages
    const tx = w * 0.62;
    let y = 40;
    for (const k of ['torso', 'armL', 'armR', 'legs', 'sensors']) {
      const st = t.stages[k];
      p.text(LABELS[k], tx, y, { size: 9, alpha: 0.75 });
      p.text(STAGE_TEXT[st], w - 8, y, { size: 9, align: 'right', color: healthColor(STAGE_FRACTION[st]) });
      y += 15;
    }
    const sh = t.shields;
    p.text(`SCHILD V${pct(sh.front)} H${pct(sh.rear)}`, tx, y + 4, { size: 9, alpha: 0.8 });
    p.text(`L${pct(sh.left)} R${pct(sh.right)}`, tx, y + 18, { size: 9, alpha: 0.8 });

    p.line(8, h - 40, w - 8, h - 40, 0.4);
    p.text(`${t.cls.toUpperCase()} ${t.tonnage} t`, 8, h - 28, { size: 11 });
    p.text(`${Math.round(t.distance)} m`, w - 8, h - 28, { size: 13, align: 'right' });
    if (t.wreck) {
      p.text(WRECK[t.wreck] ?? 'WRACK', w / 2, h - 11, { size: 11, align: 'center' });
    } else if (t.needLock > 0) {
      const f = Math.min(1, t.lockTime / t.needLock);
      p.text(f >= 1 ? 'AUFGESCHALTET' : 'AUFSCHALTUNG', 8, h - 11, { size: 10, alpha: f >= 1 ? 1 : 0.7 });
      p.rect(118, h - 15, w - 126, 8, 0.5);
      p.rect(119, h - 14, (w - 128) * f, 6, 0.9, true);
    } else {
      p.text('ERFASST', 8, h - 11, { size: 10 });
    }
  },
};

function drawWireframe(p, t, time, x0, y0, bw, bh) {
  const unit = t.unit;
  const model = unit.model;
  const h = unit.walker.cockpit.eyeHeight * 1.25;
  const scale = Math.min(bw, bh) / h;
  const cx = x0 + bw / 2;
  const base = y0 + bh - 4;
  const a = time * 0.5;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  inv.copy(model.root.matrixWorld).invert();
  const groundY = -model.root.position.y + unit.motion.pose.y - unit.walker.cockpit.eyeHeight; // hip → ground offset
  for (const v of unit.volumes.volumes) {
    const st = t.stages[v.component] ?? 0;
    const color = healthColor(STAGE_FRACTION[st]);
    m.multiplyMatrices(inv, v.mesh.matrixWorld);
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? v.box.max.x : v.box.min.x, i & 2 ? v.box.max.y : v.box.min.y, i & 4 ? v.box.max.z : v.box.min.z).applyMatrix4(m);
      const rx = corner.x * ca - corner.z * sa;
      pts[i][0] = cx + rx * scale;
      pts[i][1] = base - (corner.y - groundY) * scale;
    }
    for (const [i, j] of EDGES) p.line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], 0.9, color);
  }
}

function idle(p, d) {
  const { w, h } = p;
  const cx = w / 2;
  const cy = h * 0.48;
  const r = h * 0.3;
  const a = d.time * 0.8;
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 2;
    p.circle(cx, cy, r, 0.8, false, ang, ang + 0.5);
  }
  p.line(cx - 8, cy, cx + 8, cy, 0.6);
  p.line(cx, cy - 8, cx, cy + 8, 0.6);
  p.circle(cx, cy, r * 0.45, 0.25);
  const blink = Math.floor(d.time * 1.5) % 2 === 0;
  p.text('KEIN ZIEL', cx, h - 40, { size: 14, align: 'center', alpha: blink ? 1 : 0.55 });
  p.text('T: AUFSCHALTEN', cx, h - 20, { size: 10, align: 'center', alpha: 0.6 });
}

const pct = (f) => String(Math.round(f * 100)).padStart(3, ' ');
