import * as THREE from 'three';
import { makeCanvas, canvasTexture, MONO_FONT } from './canvasKit.js';
import { colored, merge } from './geometry.js';
import { drawBoot } from './displays/BootScreen.js';

const ON = { mode: 'on' };

export const PHOSPHORS = {
  amber: { rgb: [255, 176, 58], bg: [10, 6, 2] },
  green: { rgb: [96, 255, 130], bg: [2, 9, 4] },
  color: { rgb: [200, 235, 210], bg: [4, 7, 8] },
};

/**
 * One cockpit CRT: a slightly bulged screen with bezel, drawn from a
 * display module into a persistent "phosphor" canvas (old frames fade
 * instead of clearing → afterglow), then composited with scanlines and
 * vignette into the texture. Redraws at a fixed low rate.
 *
 * Power comes from data.monitorStatus(id): 'off' lets the picture fade to
 * black, 'boot' runs the power-on sequence, 'on' draws the display page.
 */
export class CrtScreen {
  constructor({ id, width, display, phosphor = 'amber', resolution = [320, 240], refreshHz = 15, phaseOffset = 0, bezel = true }) {
    const [rw, rh] = resolution;
    this.id = id;
    this.flicker = false; // set from outside (e.g. reactor ignition)
    this.extraFlicker = 0; // 0..1 short disturbance from hits, decays
    this.display = display;
    this.override = null; // display module shown instead (missile camera)
    this.p = PHOSPHORS[phosphor] ?? PHOSPHORS.amber;
    this.interval = 1 / refreshHz;
    this.timer = phaseOffset * this.interval;
    this.persistence = display.persistence ?? 0.55;

    this.phosphor = makeCanvas(rw, rh);
    this.pctx = this.phosphor.getContext('2d');
    this.out = makeCanvas(rw, rh);
    this.octx = this.out.getContext('2d');
    this.overlay = buildOverlay(rw, rh);
    this.texture = canvasTexture(this.out, { mipmaps: false });
    this.painter = new Painter(this.pctx, rw, rh, this.p);
    this.pctx.fillStyle = `rgb(${this.p.bg.join(',')})`;
    this.pctx.fillRect(0, 0, rw, rh);

    const height = width * (rh / rw);
    this.object = new THREE.Group();
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.screen = new THREE.Mesh(bulgedPlane(width, height, 0.006), this.screenMat);
    this.screen.position.z = 0.004;
    this.bezelMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.bezel = new THREE.Mesh(bezelGeometry(width, height), this.bezelMat);
    // Without bezel the screen sits in a frame of the cockpit model
    this.bezel.visible = bezel;
    this.object.add(this.bezel, this.screen);
    this.pickables = [this.screen];
  }

  update(dt, data) {
    this.timer += dt;
    if (this.timer < this.interval) return;
    this.timer %= this.interval;
    const ctx = this.pctx;
    const [r, g, b] = this.p.bg;
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${r},${g},${b},${1 - this.persistence})`;
    ctx.fillRect(0, 0, this.phosphor.width, this.phosphor.height);
    const status = data.monitorStatus ? data.monitorStatus(this.id) : ON;
    let brightness = this.flicker ? 0.35 + Math.random() * 0.9 : 1;
    if (this.extraFlicker > 0) {
      brightness *= 1 - this.extraFlicker * Math.random() * 0.9;
      this.extraFlicker = Math.max(0, this.extraFlicker - this.interval * 3);
    }
    if (status.mode !== 'off') {
      this.painter.begin();
      if (status.mode === 'boot') {
        drawBoot(this.painter, this.id, status);
        if (status.noise) this.painter.static(0.22);
        if (status.t < status.timing.flickerTime) brightness = 0.3 + Math.random() * 1.2;
      } else if (status.mode === 'noise') {
        // Defective tube: static with rolling bars
        this.painter.static(0.55);
        const roll = (performance.now() * 0.05) % this.phosphor.height;
        this.painter.rect(0, roll, this.phosphor.width, 10, 0.25, true);
        brightness *= 0.6 + Math.random() * 0.5;
      } else {
        (this.override ?? this.display).draw(this.painter, data);
        if (this.extraFlicker > 0.3) this.painter.static(this.extraFlicker * 0.5);
      }
      this.painter.end();
    }
    this.screenMat.color.setScalar(brightness);

    this.octx.drawImage(this.phosphor, 0, 0);
    this.octx.drawImage(this.overlay, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.screenMat.dispose();
    this.bezelMat.dispose();
    this.screen.geometry.dispose();
    this.bezel.geometry.dispose();
  }
}

/** Drawing helpers handed to display modules. Colours are phosphor-relative. */
export class Painter {
  constructor(ctx, w, h, phosphor) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.rgb = phosphor.rgb;
  }

  begin() {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = this.c(0.9);
    ctx.shadowBlur = 3;
    ctx.lineWidth = 1.5;
    ctx.textBaseline = 'middle';
  }

  end() {
    this.ctx.restore();
  }

  /** Phosphor colour at a given intensity 0..1 (or an explicit CSS colour). */
  c(alpha = 1) {
    return `rgba(${this.rgb[0]},${this.rgb[1]},${this.rgb[2]},${alpha})`;
  }

  text(str, x, y, { size = 12, align = 'left', alpha = 1, color = null, bold = true } = {}) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${MONO_FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = color ?? this.c(alpha);
    ctx.fillText(str, x, y);
  }

  line(x0, y0, x1, y1, alpha = 1, color = null) {
    const ctx = this.ctx;
    ctx.strokeStyle = color ?? this.c(alpha);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  rect(x, y, w, h, alpha = 1, fill = false, color = null) {
    const ctx = this.ctx;
    if (fill) {
      ctx.fillStyle = color ?? this.c(alpha);
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeStyle = color ?? this.c(alpha);
      ctx.strokeRect(x, y, w, h);
    }
  }

  circle(x, y, r, alpha = 1, fill = false, from = 0, to = Math.PI * 2, color = null) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, from, to);
    if (fill) {
      ctx.fillStyle = color ?? this.c(alpha);
      ctx.fill();
    } else {
      ctx.strokeStyle = color ?? this.c(alpha);
      ctx.stroke();
    }
  }

  /** A monochrome picture (grey canvas) tinted in the phosphor colour, scaled into a box. */
  image(canvas, x, y, w, h, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(canvas, x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = this.c(1);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /** Snow: random noise over the whole screen at the given strength. */
  static(strength = 1) {
    const ctx = this.ctx;
    const n = noiseCanvas();
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.min(1, strength);
    ctx.globalCompositeOperation = strength >= 0.5 ? 'source-over' : 'lighter';
    ctx.imageSmoothingEnabled = false;
    const ox = Math.random() * 40;
    const oy = Math.random() * 30;
    ctx.drawImage(n, -ox, -oy, this.w + 40, this.h + 30);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.c(1);
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  poly(points, alpha = 1, fill = false, color = null) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = color ?? this.c(alpha);
      ctx.fill();
    } else {
      ctx.strokeStyle = color ?? this.c(alpha);
      ctx.stroke();
    }
  }
}

/** Shared random-noise canvas, regenerated at most once per 50 ms. */
let noise = null;
let noiseAt = 0;
function noiseCanvas() {
  const now = performance.now();
  if (!noise) noise = makeCanvas(120, 90);
  if (now - noiseAt > 50) {
    noiseAt = now;
    const ctx = noise.getContext('2d');
    const img = ctx.createImageData(noise.width, noise.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() < 0.5 ? Math.random() * 90 : 120 + Math.random() * 135;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  return noise;
}

/** Scanlines + vignette, pre-rendered once. */
function buildOverlay(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  for (let y = 1; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function bulgedPlane(w, h, bulge) {
  const g = new THREE.PlaneGeometry(w, h, 8, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = (2 * pos.getX(i)) / w;
    const ny = (2 * pos.getY(i)) / h;
    pos.setZ(i, bulge * (1 - nx * nx) * (1 - ny * ny));
  }
  g.computeVertexNormals();
  return g;
}

function bezelGeometry(w, h) {
  const b = 0.012;
  const d = 0.016;
  const dark = '#121311';
  const parts = [
    new THREE.BoxGeometry(w + 2 * b, b, d).translate(0, h / 2 + b / 2, d / 2 - 0.006),
    new THREE.BoxGeometry(w + 2 * b, b, d).translate(0, -h / 2 - b / 2, d / 2 - 0.006),
    new THREE.BoxGeometry(b, h, d).translate(-w / 2 - b / 2, 0, d / 2 - 0.006),
    new THREE.BoxGeometry(b, h, d).translate(w / 2 + b / 2, 0, d / 2 - 0.006),
    new THREE.BoxGeometry(w, h, 0.004).translate(0, 0, -0.002),
  ];
  return merge(parts.map((g, i) => colored(g, i === 4 ? '#050605' : dark)));
}
