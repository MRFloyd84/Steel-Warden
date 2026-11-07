import * as THREE from 'three';

const MAX_SEGMENTS = 6000;
const DEG = Math.PI / 180;
const COLORS = {
  cone: new THREE.Color('#ffd23a'),
  coneGun: new THREE.Color('#ff8a3a'),
  path: new THREE.Color('#4cff7a'),
  goal: new THREE.Color('#9affb8'),
  last: new THREE.Color('#ff3a5a'),
  lock: new THREE.Color('#ff2a2a'),
};
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/**
 * Debug mode only: over every AI unit its state and target (HTML label),
 * its sight cone, its path and goal, and the last position it knows of the
 * player (red cross). One dynamic LineSegments mesh, rebuilt each frame.
 */
export class AIDebugView {
  constructor({ scene, container, renderer, director, sampler }) {
    this.director = director;
    this.renderer = renderer;
    this.sampler = sampler;
    this.positions = new Float32Array(MAX_SEGMENTS * 6);
    this.colors = new Float32Array(MAX_SEGMENTS * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.85, fog: false, toneMapped: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
    this.lines.visible = false;
    scene.add(this.lines);
    this.root = document.createElement('div');
    this.root.className = 'ai-debug';
    container.appendChild(this.root);
    this.labels = new Map();
    this.n = 0;
    this.visible = false;
  }

  setVisible(on) {
    this.visible = on;
    this.lines.visible = on;
    this.root.hidden = !on;
  }

  seg(a, b, color) {
    if (this.n >= MAX_SEGMENTS) return;
    const i = this.n * 6;
    this.positions[i] = a.x;
    this.positions[i + 1] = a.y;
    this.positions[i + 2] = a.z;
    this.positions[i + 3] = b.x;
    this.positions[i + 4] = b.y;
    this.positions[i + 5] = b.z;
    for (let k = 0; k < 6; k += 3) {
      this.colors[i + k] = color.r;
      this.colors[i + k + 1] = color.g;
      this.colors[i + k + 2] = color.b;
    }
    this.n++;
  }

  ground(x, z, lift = 2) {
    return new THREE.Vector3(x, this.sampler.heightAt(x, z) + lift, z);
  }

  /** Sight cone on the ground: two edges and an arc (full circle for 360°). */
  cone(x, z, yaw, range, coneDeg, color) {
    const half = Math.min(180, coneDeg / 2) * DEG;
    const steps = coneDeg >= 360 ? 24 : 10;
    const center = this.ground(x, z, 3);
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const a = yaw - half + (2 * half * i) / steps;
      const p = this.ground(x - Math.sin(a) * range, z - Math.cos(a) * range, 3);
      if (prev) this.seg(prev, p, color);
      if (coneDeg < 360 && (i === 0 || i === steps)) this.seg(center, p, color);
      prev = p;
    }
  }

  cross(p, size, color) {
    this.seg(tmp.set(p.x - size, p.y, p.z), tmp2.set(p.x + size, p.y, p.z), color);
    this.seg(tmp.set(p.x, p.y, p.z - size), tmp2.set(p.x, p.y, p.z + size), color);
    this.seg(tmp.set(p.x, p.y - size, p.z), tmp2.set(p.x, p.y + size, p.z), color);
  }

  label(key, world, text, warn) {
    let el = this.labels.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ai-label';
      this.root.appendChild(el);
      this.labels.set(key, el);
    }
    el.used = true;
    const p = this.renderer.project(world, tmp2);
    if (!p) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('warn', !!warn);
    el.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px) translate(-50%, -100%)`;
  }

  update() {
    if (!this.visible) return;
    this.n = 0;
    for (const el of this.labels.values()) el.used = false;
    const d = this.director;
    for (const c of d.controllers) {
      if (c.dead) continue;
      const m = c.unit.motion;
      const dbg = c.debug;
      this.cone(m.x, m.z, m.legYaw + m.twist, dbg.sightRange, dbg.coneDeg, dbg.locking ? COLORS.lock : COLORS.cone);
      if (dbg.path?.length) {
        let prev = this.ground(m.x, m.z, 1.5);
        for (const [x, z] of dbg.path) {
          const p = this.ground(x, z, 1.5);
          this.seg(prev, p, COLORS.path);
          prev = p;
        }
      } else if (dbg.goal) {
        this.seg(this.ground(m.x, m.z, 1.5), this.ground(dbg.goal.x, dbg.goal.z, 1.5), COLORS.goal);
      }
      if (dbg.goal) this.cross(this.ground(dbg.goal.x, dbg.goal.z, 2), 3, COLORS.goal);
      if (dbg.lastKnown) this.cross(dbg.lastKnown, 6, COLORS.last);
      const top = tmp.set(m.pose.x, m.pose.y + 4, m.pose.z);
      this.label(c.unit.id, top, `${c.unit.id} · ${dbg.state} · ${dbg.target}`, dbg.locking);
    }
    for (const g of d.gunners) {
      if (g.dead) continue;
      const st = g.st;
      const dbg = g.debug;
      this.cone(st.x, st.z, g.worldYaw, Math.min(dbg.sightRange, 600), 360, COLORS.coneGun);
      this.label(st.id, tmp.set(st.x, st.top + 3, st.z), `${st.def.name} · ${dbg.state} · ${dbg.target}`, false);
    }
    for (const [key, el] of this.labels) {
      if (!el.used) {
        el.remove();
        this.labels.delete(key);
      }
    }
    const geo = this.lines.geometry;
    geo.setDrawRange(0, this.n * 2);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.lines.removeFromParent();
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    this.root.remove();
  }
}
