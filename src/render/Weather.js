import * as THREE from 'three';
import { makeCanvas, canvasTexture } from './cockpit/canvasKit.js';

const VERT = `
attribute float alpha;
varying float vAlpha;
uniform float scale;
uniform float size;
void main() {
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * scale / max(0.5, -mv.z), 1.0, 256.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 color;
uniform float soft;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  gl_FragColor = vec4(color, vAlpha * mix(1.0, 1.0 - d * 4.0, soft));
}`;

/**
 * Weather around the camera: particles in a box that wraps around the
 * viewer (snow, sand, ash, mist, rain as streaks), driven by wind with
 * gusts; particles collecting on the canopy glass (cockpit scene); wind
 * noise. Fog and sky tint are applied by the Environment.
 */
export class Weather {
  constructor(scene, preset, { box = [140, 60, 140] } = {}) {
    this.scene = scene;
    this.preset = preset;
    this.box = box;
    this.time = 0;
    this.gust = 0;
    const p = preset.particles;
    this.wind = new THREE.Vector3(...(p?.wind ?? [0, 0, 0]));
    if (!p) return;
    const n = p.count;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    this.phase = new Float32Array(n);
    const [bx, by, bz] = box;
    const low = p.low;
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * bx;
      this.pos[i * 3 + 1] = low ? Math.random() * low : (Math.random() - 0.3) * by;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * bz;
      this.alpha[i] = p.alpha * (0.5 + Math.random() * 0.5);
      this.phase[i] = Math.random() * 100;
    }
    this.origin = new THREE.Vector3();
    if (p.kind === 'rain') {
      // Streaks: two vertices per drop
      this.lineGeo = new THREE.BufferGeometry();
      this.linePos = new Float32Array(n * 6);
      this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage));
      this.object = new THREE.LineSegments(this.lineGeo, new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: p.alpha, depthWrite: false }));
    } else {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      this.material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { scale: { value: 300 }, size: { value: p.size }, color: { value: new THREE.Color(p.color) }, soft: { value: p.kind === 'mist' ? 1 : 0.4 } },
        transparent: true,
        depthWrite: false,
      });
      this.object = new THREE.Points(g, this.material);
    }
    this.object.frustumCulled = false;
    this.object.renderOrder = 7;
    scene.add(this.object);
  }

  setViewportHeight(px) {
    if (this.material) this.material.uniforms.scale.value = px * 0.6;
  }

  /** Current wind (m/s) including gusts. */
  get windNow() {
    return this.wind.length() * (1 + this.gust);
  }

  update(dt, cameraPos, ground = null) {
    this.time += dt;
    const p = this.preset.particles;
    if (!p) return;
    // Gusts: slow random swell
    this.gust = (p.gust ?? 0) * (0.5 + 0.5 * Math.sin(this.time * 0.37) * Math.sin(this.time * 0.91 + 1.3));
    const k = 1 + this.gust;
    const wx = this.wind.x * k;
    const wy = this.wind.y * k - p.fall;
    const wz = this.wind.z * k;
    const [bx, by, bz] = this.box;
    const pos = this.pos;
    const cx = cameraPos.x;
    const cy = p.low && ground !== null ? ground : cameraPos.y;
    const cz = cameraPos.z;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      const flutter = p.kind === 'snow' || p.kind === 'ash' ? Math.sin(this.time * 2 + this.phase[i]) * 0.8 : 0;
      let x = pos[i3] + (wx + flutter) * dt;
      let y = pos[i3 + 1] + wy * dt;
      let z = pos[i3 + 2] + (wz + flutter * 0.6) * dt;
      // Wrap around the box centred on the camera (positions are absolute)
      x = wrap(x - cx, bx) + cx;
      z = wrap(z - cz, bz) + cz;
      if (p.low) y = wrap(y - cy, p.low * 2) + cy + p.low * 0.5;
      else y = wrap(y - cy, by) + cy;
      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
    }
    if (this.linePos) {
      const s = (p.streak ?? 1) * 0.04;
      for (let i = 0; i < this.n; i++) {
        const i3 = i * 3;
        const o = i * 6;
        this.linePos[o] = pos[i3];
        this.linePos[o + 1] = pos[i3 + 1];
        this.linePos[o + 2] = pos[i3 + 2];
        this.linePos[o + 3] = pos[i3] - wx * s;
        this.linePos[o + 4] = pos[i3 + 1] - wy * s;
        this.linePos[o + 5] = pos[i3 + 2] - wz * s;
      }
      this.lineGeo.attributes.position.needsUpdate = true;
    } else {
      this.object.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    if (!this.object) return;
    this.scene.remove(this.object);
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}

function wrap(v, size) {
  const h = size / 2;
  return ((((v + h) % size) + size) % size) - h;
}

/**
 * Particles collecting on the canopy glass: an overlay mesh over the glass
 * (same geometry and UVs) with a canvas that is redrawn at a low rate.
 * Snow and ash stick and melt/blow off, sand pits and streaks sideways,
 * drops run down the glass.
 */
export class CanopyWeather {
  constructor(cockpit, preset) {
    this.cfg = preset.canopy;
    if (!this.cfg) return;
    const glass = cockpit.shell.group.getObjectByName('canopyGlass');
    if (!glass) return;
    this.canvas = makeCanvas(512, 512);
    this.ctx = this.canvas.getContext('2d');
    this.texture = canvasTexture(this.canvas, { mipmaps: false });
    this.texture.wrapS = THREE.RepeatWrapping;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(glass.geometry, this.material);
    this.mesh.renderOrder = 11;
    this.mesh.userData.noPick = true;
    this.mesh.raycast = () => {};
    glass.parent.add(this.mesh);
    this.parts = [];
    this.timer = 0;
    this.acc = 0;
  }

  update(dt, speed = 0) {
    if (!this.cfg) return;
    const c = this.cfg;
    // More hits on the glass when walking into the weather
    this.acc += dt * c.rate * (1 + Math.min(1.5, speed / 15));
    while (this.acc >= 1) {
      this.acc -= 1;
      this.parts.push({
        u: Math.random(), v: 0.15 + Math.random() * 0.85, age: 0, life: c.life * (0.6 + Math.random() * 0.8),
        size: c.kind === 'drops' ? 3 + Math.random() * 6 : c.kind === 'sand' ? 1 + Math.random() * 1.5 : 2 + Math.random() * 4,
        run: 0,
      });
    }
    for (const p of this.parts) {
      p.age += dt;
      if (c.kind === 'drops' && p.age > 0.8) p.run += dt * (c.streak ?? 1) * 0.06 * p.size / 5;
      if (c.kind === 'sand') p.u += dt * 0.08;
    }
    this.parts = this.parts.filter((p) => p.age < p.life && p.v - p.run > 0);
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    this.timer += dt;
    if (this.timer < 1 / 15) return;
    this.timer = 0;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const kind = this.cfg.kind;
    for (const p of this.parts) {
      const fade = Math.min(1, p.age * 4) * (1 - p.age / p.life);
      const x = (p.u % 1) * W;
      const y = (1 - p.v + p.run) * H;
      if (kind === 'drops') {
        ctx.fillStyle = `rgba(210,225,235,${0.35 * fade})`;
        ctx.beginPath();
        ctx.ellipse(x, y, p.size * 0.6, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.run > 0) {
          ctx.strokeStyle = `rgba(200,215,225,${0.18 * fade})`;
          ctx.lineWidth = p.size * 0.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - p.run * H);
          ctx.stroke();
        }
      } else if (kind === 'snow') {
        ctx.fillStyle = `rgba(245,248,252,${0.7 * fade})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'ash') {
        ctx.fillStyle = `rgba(60,55,52,${0.75 * fade})`;
        ctx.fillRect(x, y, p.size, p.size * 0.7);
      } else {
        ctx.fillStyle = `rgba(200,160,110,${0.55 * fade})`;
        ctx.fillRect(x, y, p.size * 2.5, p.size * 0.6);
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.parent?.remove(this.mesh);
    this.texture.dispose();
    this.material.dispose();
  }
}
