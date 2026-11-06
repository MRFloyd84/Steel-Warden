import * as THREE from 'three';

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
uniform float scale;
void main() {
  vAlpha = alpha;
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float soft = 1.0 - d * 4.0;
  gl_FragColor = vec4(vTint, vAlpha * soft);
}`;

/**
 * GPU point particles with per-particle colour, size and alpha; simulated on
 * the CPU with a fixed pool (no allocation while running).
 * spawn({ pos, vel, color, size, grow, life, gravity, drag, alpha })
 */
export class ParticlePool {
  constructor(scene, count, { additive = false } = {}) {
    this.count = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.c = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.life = new Float32Array(count);
    this.age = new Float32Array(count);
    this.size0 = new Float32Array(count);
    this.grow = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.a0 = new Float32Array(count);
    this.next = 0;
    this.active = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { scale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
    this.scene = scene;
  }

  setViewportHeight(px) {
    this.material.uniforms.scale.value = px * 0.6;
  }

  spawn({ pos, vel = null, color, size = 1, grow = 0, life = 0.5, gravity = 0, drag = 0, alpha = 1 }) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    const i3 = i * 3;
    this.p[i3] = pos.x; this.p[i3 + 1] = pos.y; this.p[i3 + 2] = pos.z;
    this.v[i3] = vel ? vel.x : 0; this.v[i3 + 1] = vel ? vel.y : 0; this.v[i3 + 2] = vel ? vel.z : 0;
    this.c[i3] = color.r; this.c[i3 + 1] = color.g; this.c[i3 + 2] = color.b;
    this.size0[i] = size;
    this.size[i] = size;
    this.grow[i] = grow;
    this.life[i] = life;
    this.age[i] = 0;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.a0[i] = alpha;
    this.alpha[i] = alpha;
  }

  update(dt) {
    let active = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      // A newborn particle is shown at least once, even if the frame is longer than its life.
      this.age[i] = this.age[i] === 0 ? 1e-6 : this.age[i] + dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      active++;
      const i3 = i * 3;
      const k = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= k; this.v[i3 + 1] = this.v[i3 + 1] * k - this.gravity[i] * dt; this.v[i3 + 2] *= k;
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
      const t = this.age[i] / this.life[i];
      this.size[i] = this.size0[i] + this.grow[i] * this.age[i];
      this.alpha[i] = this.a0[i] * (1 - t) * (1 - t * 0.3);
    }
    this.active = active;
    const a = this.geometry.attributes;
    a.position.needsUpdate = true;
    a.tint.needsUpdate = true;
    a.size.needsUpdate = true;
    a.alpha.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
