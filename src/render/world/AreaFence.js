import * as THREE from 'three';

const VERT = `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform vec3 color;
uniform vec3 focus;
uniform float showDist;
uniform float time;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  float d = distance(vWorld.xz, focus.xz);
  float near = 1.0 - smoothstep(showDist * 0.35, showDist, d);
  if (near <= 0.0) discard;
  // Grid band: vertical posts, horizontal scan lines, fading toward the top
  float posts = smoothstep(0.92, 1.0, abs(fract(vUv.x / 6.0) * 2.0 - 1.0));
  float lines = smoothstep(0.8, 1.0, abs(fract(vUv.y * 6.0 - time * 0.35) * 2.0 - 1.0));
  float edge = smoothstep(0.08, 0.0, vUv.y) + smoothstep(0.92, 1.0, vUv.y) * 0.6;
  float fade = 1.0 - vUv.y * 0.75;
  float a = (0.12 + posts * 0.7 + lines * 0.3 + edge * 0.6) * fade * near;
  gl_FragColor = vec4(color, a);
}`;

/**
 * Holographic fence along the mission area border: a band that follows
 * the terrain, only visible within showDist of the walker (fades in).
 */
export class AreaFence {
  constructor(scene, sampler, poly, { height = 22, step = 12, color = '#5fe0c8', showDist = 200 } = {}) {
    this.scene = scene;
    const pos = [];
    const uv = [];
    const idx = [];
    let along = 0;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i];
      const [bx, bz] = poly[(i + 1) % poly.length];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = 0; k <= n; k++) {
        if (k === 0 && i > 0) continue; // shared corner
        const f = k / n;
        const x = ax + (bx - ax) * f;
        const z = az + (bz - az) * f;
        const y = sampler.heightAt(x, z) - 1;
        const u = along + len * f;
        pos.push(x, y, z, x, y + height, z);
        uv.push(u, 0, u, 1);
      }
      along += len;
    }
    const cols = pos.length / 6;
    for (let c = 0; c < cols - 1; c++) {
      const a = c * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.uniforms = {
      color: { value: new THREE.Color(color) },
      focus: { value: new THREE.Vector3() },
      showDist: { value: showDist },
      time: { value: 0 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }

  update(dt, focus, distToBorder) {
    this.uniforms.time.value += dt;
    this.uniforms.focus.value.set(focus.x, 0, focus.z);
    this.mesh.visible = distToBorder < this.uniforms.showDist.value;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
