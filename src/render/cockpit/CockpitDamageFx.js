import * as THREE from 'three';
import { ParticlePool } from '../fx/ParticlePool.js';
import { rng } from './canvasKit.js';

/** Cockpit-space directions of the four hit sides (torso-local: -Z forward). */
export const SIDE_DIR = {
  front: new THREE.Vector3(0, 0, -1),
  rear: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
};
// Where sparks burst from on each side (a panel edge on that side)
const SPARK_AT = {
  front: [[-0.25, -0.22, -0.62], [0.25, -0.22, -0.62], [0, -0.32, -0.58]],
  left: [[-0.48, -0.28, -0.32], [-0.52, -0.1, -0.4]],
  right: [[0.48, -0.28, -0.32], [0.52, -0.1, -0.4]],
  rear: [[-0.25, 0.22, 0.05], [0.25, 0.22, 0.05], [0, 0.26, -0.1]],
};
// Where the shield glow shows: inside the forward field of view, toward the hit side
const GLOW_AT = {
  front: new THREE.Vector3(0, 0.05, -1.4),
  left: new THREE.Vector3(-1.05, 0.05, -0.95),
  right: new THREE.Vector3(1.05, 0.05, -0.95),
  rear: new THREE.Vector3(0, 0.95, -0.55),
};
const SPARK = new THREE.Color('#ffd27a');
const SPARK_HOT = new THREE.Color('#fff2c0');
const tmp = new THREE.Vector3();
const vel = new THREE.Vector3();

/**
 * Hit effects inside the cockpit scene: shield glow from the hit side
 * (light + tinted canopy glass), sparks from a panel, cracks growing in the
 * canopy glass, smoke haze (fog + drifting particles) and the red
 * emergency light for critical damage.
 */
export class CockpitDamageFx {
  constructor(cockpit, cfg) {
    this.cockpit = cockpit;
    this.cfg = cfg;
    this.scene = cockpit.scene;
    this.glass = cockpit.shell.glassMaterial;
    this.glassBase = this.glass.color.clone();
    this.shieldColor = new THREE.Color(cfg.shieldFlash.color);

    this.shieldLight = new THREE.PointLight(this.shieldColor, 0, 2.5, 1.5);
    // Shield glow outside the canopy: a soft additive disc on the hit side
    this.glowMat = new THREE.MeshBasicMaterial({
      map: glowTexture(), color: this.shieldColor, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), this.glowMat);
    this.glow.renderOrder = 4;
    this.glow.visible = false;
    // Smoke haze: a sphere around the eye, drawn over everything
    this.hazeMat = new THREE.MeshBasicMaterial({ color: cfg.smoke.color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.BackSide });
    this.haze = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), this.hazeMat);
    this.haze.renderOrder = 20;
    this.haze.visible = false;
    for (const m of [this.glow, this.haze]) {
      m.raycast = () => {};
      m.userData.noPick = true;
    }
    this.scene.add(this.glow, this.haze);
    this.emergency = new THREE.PointLight(cfg.critical.lightColor, 0, 3, 1.5);
    this.emergency.position.set(0, 0.25, -0.2);
    this.scene.add(this.shieldLight, this.emergency);
    this.shieldT = 0;
    this.shieldTime = cfg.shieldFlash.time;

    this.sparks = new ParticlePool(this.scene, 160, { additive: true });
    this.smoke = new ParticlePool(this.scene, 120);
    this.smokeColor = new THREE.Color(cfg.smoke.color);
    this.smokeLevel = 0; // 0..1, follows the target level slowly
    this.smokeTarget = 0;
    this.fog = new THREE.Fog(this.smokeColor, cfg.smoke.fogNear, cfg.smoke.fogFarClear);
    this.critical = false;
    this.time = 0;

    // Cracks are drawn into the glass texture; keep a clean copy to start from
    this.glassCanvas = this.glass.map.image;
    this.cracks = 0;
    this.rand = rng(77);
  }

  setViewportHeight(px) {
    this.sparks.setViewportHeight(px);
    this.smoke.setViewportHeight(px);
  }

  /** Shield hit: blue glow from that side, glass tinted for a moment. */
  shieldHit(side, strength = 1) {
    this.shieldLight.position.copy(GLOW_AT[side]).multiplyScalar(0.6);
    this.shieldPeak = this.cfg.shieldFlash.intensity * Math.min(1.5, strength);
    this.shieldT = this.shieldTime;
    this.glow.position.copy(GLOW_AT[side]);
    this.glow.lookAt(0, 0, 0);
    this.glowPeak = Math.min(1, 0.45 + strength * 0.35);
  }

  /** Armour hit: sparks from a panel on the hit side. */
  sparkBurst(side, strength = 1) {
    const spots = SPARK_AT[side];
    const [x, y, z] = spots[Math.floor(Math.random() * spots.length)];
    const n = Math.round(this.cfg.sparks.count * Math.min(2, strength));
    const inward = SIDE_DIR[side];
    for (let i = 0; i < n; i++) {
      tmp.set(x + (Math.random() - 0.5) * 0.06, y + (Math.random() - 0.5) * 0.04, z + (Math.random() - 0.5) * 0.06);
      vel.copy(inward).multiplyScalar(-(0.6 + Math.random() * 1.2)).add({ x: (Math.random() - 0.5) * 1.4, y: 0.4 + Math.random() * 1.2, z: (Math.random() - 0.5) * 1.4 });
      this.sparks.spawn({ pos: tmp, vel, color: Math.random() < 0.3 ? SPARK_HOT : SPARK, size: 0.012 + Math.random() * 0.014, life: 0.35 + Math.random() * 0.5, gravity: 3.5, drag: 0.6 });
    }
  }

  /** Adds cracks to the canopy glass (heavy torso damage). */
  addCracks(count) {
    const max = this.cfg.maxCracks;
    const ctx = this.glassCanvas.getContext('2d');
    const size = this.glassCanvas.width;
    for (let i = 0; i < count && this.cracks < max; i++, this.cracks++) {
      const cx = size * (0.15 + this.rand() * 0.7);
      const cy = size * (0.1 + this.rand() * 0.6);
      drawCrack(ctx, cx, cy, size * (0.06 + this.rand() * 0.12), this.rand);
    }
    this.glass.map.needsUpdate = true;
  }

  /** 0..1 how smoky the cockpit should become. */
  setSmoke(level) {
    this.smokeTarget = level;
  }

  setCritical(on) {
    this.critical = on;
  }

  update(dt) {
    this.time += dt;
    const c = this.cfg;
    // Shield glow and glass tint
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    const k = this.shieldT / this.shieldTime;
    this.shieldLight.intensity = (this.shieldPeak ?? 0) * k * Math.sqrt(k);
    this.glass.color.copy(this.glassBase).lerp(this.shieldColor, c.shieldFlash.glassTint * k);
    this.glow.visible = k > 0.01;
    this.glowMat.opacity = (this.glowPeak ?? 0) * k;

    // Smoke builds up and clears slowly
    const rate = dt / c.smoke.buildTime;
    this.smokeLevel += Math.max(-rate, Math.min(rate, this.smokeTarget - this.smokeLevel));
    if (this.smokeLevel > 0.01) {
      this.scene.fog = this.fog;
      this.fog.far = c.smoke.fogFarClear + (c.smoke.fogFarHeavy - c.smoke.fogFarClear) * this.smokeLevel;
      if (Math.random() < dt * c.smoke.particles * 4 * this.smokeLevel) {
        tmp.set((Math.random() - 0.5) * 0.9, -0.35 + Math.random() * 0.2, -0.2 - Math.random() * 0.45);
        this.smoke.spawn({ pos: tmp, vel: vel.set((Math.random() - 0.5) * 0.05, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.05), color: this.smokeColor, size: 0.12, grow: 0.06, life: 5, alpha: 0.35 * this.smokeLevel, drag: 0.2 });
      }
    } else this.scene.fog = null;
    this.haze.visible = this.smokeLevel > 0.01;
    this.hazeMat.opacity = 0.42 * this.smokeLevel * (0.92 + 0.08 * Math.sin(this.time * 0.7));

    // Red emergency light pulses
    const pulse = 0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * c.critical.pulseHz);
    this.emergency.intensity = this.critical ? c.critical.lightIntensity * (0.35 + 0.65 * pulse) : 0;

    this.sparks.update(dt);
    this.smoke.update(dt);
  }

  dispose() {
    this.scene.remove(this.shieldLight, this.emergency, this.glow, this.haze);
    this.glowMat.map.dispose();
    this.sparks.dispose();
    this.smoke.dispose();
    this.scene.fog = null;
  }
}

/** Soft round glow with a faint hexagonal shield pattern. */
function glowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  const r = 9;
  for (let y = 0; y < size + r; y += r * 1.5) {
    for (let x = 0; x < size + r; x += r * Math.sqrt(3)) {
      const ox = (Math.round(y / (r * 1.5)) % 2) * r * Math.sqrt(3) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        ctx[i ? 'lineTo' : 'moveTo'](x + ox + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One impact: a small shatter ring with jagged radial cracks and branches. */
function drawCrack(ctx, cx, cy, len, rand) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(235,240,235,0.42)';
  ctx.fillStyle = 'rgba(230,235,230,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, len * 0.08, 0, Math.PI * 2);
  ctx.fill();
  const arms = 5 + Math.floor(rand() * 4);
  for (let a = 0; a < arms; a++) {
    let ang = (a / arms) * Math.PI * 2 + rand() * 0.6;
    let x = cx;
    let y = cy;
    const l = len * (0.5 + rand() * 0.7);
    const segs = 4 + Math.floor(rand() * 3);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segs; s++) {
      ang += (rand() - 0.5) * 0.7;
      x += Math.cos(ang) * (l / segs);
      y += Math.sin(ang) * (l / segs);
      ctx.lineTo(x, y);
      if (rand() < 0.35) {
        // Branch
        const ba = ang + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.6);
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ba) * l * 0.25, y + Math.sin(ba) * l * 0.25);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  // Concentric fracture arc
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(235,240,235,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, len * (0.25 + rand() * 0.15), rand() * 6, rand() * 6 + 2.5);
  ctx.stroke();
  ctx.restore();
}
