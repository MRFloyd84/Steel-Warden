import * as THREE from 'three';
import { panelMatrix, panelLocal } from './geometry.js';
import { makeCanvas, canvasTexture, fitText, rng } from './canvasKit.js';
import { rotaryAngle } from './ControlFactory.js';
import { THROTTLE_SWING, THROTTLE_ARM } from './Levers.js';

const SLAB = 0.03;
const INK = '#d9d4bf';
const INK_DIM = 'rgba(217,212,191,0.55)';

/**
 * Builds the panel slabs. Each panel gets one canvas texture with its
 * engraved labels, position markings, group frames and recesses, all
 * generated from the layout — so moving a switch in the data moves its
 * lettering too. Returns a frame (Object3D) per panel for mounting parts.
 */
export function buildPanels(variant, layout, ppm) {
  const group = new THREE.Group();
  const frames = new Map();
  const disposables = [];
  const sideMat = new THREE.MeshLambertMaterial({ color: variant.colors.panel, flatShading: true });
  disposables.push(sideMat);

  for (const [id, def] of Object.entries(variant.panels)) {
    const frame = new THREE.Group();
    frame.name = `panel:${id}`;
    frame.matrixAutoUpdate = false;
    frame.matrix.copy(panelMatrix(def));
    group.add(frame);
    frames.set(id, { frame, def });

    const items = layout.items.filter((it) => it.panel === id);
    const groups = (layout.groups ?? []).filter((g) => g.panel === id);
    const texture = paintPanel(def, items, groups, variant.colors.panel, ppm, id.length * 31);
    const faceMat = new THREE.MeshLambertMaterial({ map: texture });
    disposables.push(texture, faceMat);

    const geo = new THREE.BoxGeometry(def.size[0], def.size[1], SLAB).translate(0, 0, -SLAB / 2);
    // BoxGeometry material order: +x, -x, +y, -y, +z (face), -z
    const slab = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]);
    slab.name = `slab:${id}`;
    frame.add(slab);
    disposables.push(geo);
  }
  return { group, frames, disposables };
}

function paintPanel(def, items, groups, baseColor, ppm, seed) {
  const W = Math.min(1600, Math.round(def.size[0] * ppm));
  const H = Math.min(1600, Math.round(def.size[1] * ppm));
  const px = W / def.size[0]; // pixels per metre actually used
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = rng(seed);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);
  // Wear: faint noise blotches and scuffs
  for (let i = 0; i < (W * H) / 900; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.025)';
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 3);
  }
  // Edge bevel and corner screws
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = Math.max(2, px * 0.003);
  ctx.strokeRect(1, 1, W - 2, H - 2);
  const screw = px * 0.006;
  for (const [sx, sy] of [[screw * 2, screw * 2], [W - screw * 2, screw * 2], [screw * 2, H - screw * 2], [W - screw * 2, H - screw * 2]]) {
    ctx.fillStyle = '#5c6058';
    ctx.beginPath();
    ctx.arc(sx, sy, screw, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22241f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - screw * 0.7, sy);
    ctx.lineTo(sx + screw * 0.7, sy);
    ctx.stroke();
  }

  const toPx = (at) => [at[0] * W, at[1] * H];
  const mm = (m) => m * px;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const g of groups) {
    const [x0, y0, x1, y1] = [g.rect[0] * W, g.rect[1] * H, g.rect[2] * W, g.rect[3] * H];
    ctx.strokeStyle = INK_DIM;
    ctx.lineWidth = Math.max(1, mm(0.0015));
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.font = `bold ${mm(0.011)}px sans-serif`;
    const tw = ctx.measureText(g.label).width + mm(0.008);
    ctx.fillStyle = baseColor;
    ctx.fillRect((x0 + x1) / 2 - tw / 2, y0 - mm(0.007), tw, mm(0.014));
    ctx.fillStyle = INK;
    fitText(ctx, g.label, (x0 + x1) / 2, y0, x1 - x0 - mm(0.01), mm(0.011));
  }

  for (const it of items) {
    const [x, y] = toPx(it.at);
    ctx.fillStyle = INK;
    switch (it.type) {
      case 'toggle': {
        fitText(ctx, it.label, x, y - mm(it.guard ? 0.044 : 0.04), mm(0.075), mm(0.012));
        ctx.textAlign = 'left';
        const off = mm(it.guard ? 0.026 : 0.017);
        fitText(ctx, it.positions[1], x + off, y - mm(0.013), mm(0.04), mm(0.009));
        fitText(ctx, it.positions[0], x + off, y + mm(0.013), mm(0.04), mm(0.009));
        ctx.textAlign = 'center';
        if (it.guard) hatchFrame(ctx, x, y, mm(0.036), mm(0.058), it.guard, mm(0.003));
        break;
      }
      case 'rotary': {
        fitText(ctx, it.label, x, y - mm(0.054), mm(0.08), mm(0.012));
        const n = it.positions.length;
        it.positions.forEach((label, i) => {
          const a = rotaryAngle(i, n);
          const r = mm(0.028);
          const lx = x - Math.sin(a) * r;
          const ly = y - Math.cos(a) * r;
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(1, mm(0.0012));
          ctx.beginPath();
          ctx.moveTo(x - Math.sin(a) * mm(0.021), y - Math.cos(a) * mm(0.021));
          ctx.lineTo(x - Math.sin(a) * mm(0.024), y - Math.cos(a) * mm(0.024));
          ctx.stroke();
          fitText(ctx, label, lx - Math.sin(a) * mm(0.008), ly - Math.cos(a) * mm(0.004), mm(0.03), mm(0.0085));
        });
        break;
      }
      case 'button':
        fitText(ctx, it.label, x, y - mm(0.028), mm(0.07), mm(0.011));
        break;
      case 'monitor': {
        const w = mm(it.width + 0.024);
        const h = mm(it.width * 0.75 + 0.024);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case 'throttle':
        paintThrottleGate(ctx, x, y, mm);
        break;
      case 'stick':
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = mm(0.006);
        ctx.beginPath();
        ctx.arc(x, y, mm(0.045), 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        break;
    }
  }
  return canvasTexture(c);
}

/** Warning-striped frame around guarded switches. */
function hatchFrame(ctx, x, y, w, h, color, t) {
  const main = color === 'red' ? '#a3271c' : '#c79a1c';
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2 - t, y - h / 2 - t, w + 2 * t, h + 2 * t);
  ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.clip('evenodd');
  ctx.fillStyle = main;
  ctx.fillRect(x - w, y - h, w * 2, h * 2);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = t * 0.9;
  for (let k = -h; k < w + h; k += t * 2.4) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + k, y - h / 2 - t);
    ctx.lineTo(x - w / 2 + k - h, y + h / 2 + t);
    ctx.stroke();
  }
  ctx.restore();
}

function paintThrottleGate(ctx, x, y, mm) {
  const half = mm(0.085);
  ctx.fillStyle = '#0c0d0b';
  ctx.fillRect(x - mm(0.008), y - half, mm(0.016), half * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, mm(0.0015));
  ctx.textAlign = 'right';
  const marks = [[1, 'VOLL'], [0.5, '50'], [0, '0'], [-1, 'RÜCK']];
  for (const [t, label] of marks) {
    // Where the lever tip sits for throttle t (forward = toward the top edge).
    const yy = y - Math.sin(t * THROTTLE_SWING) * mm(THROTTLE_ARM);
    ctx.beginPath();
    ctx.moveTo(x - mm(0.012), yy);
    ctx.lineTo(x - mm(0.022), yy);
    ctx.stroke();
    fitText(ctx, label, x - mm(0.026), yy, mm(0.04), mm(0.009));
  }
  ctx.textAlign = 'center';
  // Detent notch at zero
  ctx.fillStyle = '#c79a1c';
  ctx.fillRect(x + mm(0.01), y - mm(0.002), mm(0.012), mm(0.004));
  fitText(ctx, 'SCHUB', x, y + half + mm(0.016), mm(0.06), mm(0.011));
}

/** Panel-local position helper re-exported for mounting parts. */
export { panelLocal };
