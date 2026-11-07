import * as THREE from 'three';
import { FLUIDS } from '../../data/surfaces.js';
import { hash2 } from '../../util/noise.js';

/**
 * Flat fluid surfaces per terrain chunk (water, lava, glowing veins): quads
 * on a coarse grid wherever the feature field reports a fluid, at its level.
 * Materials are shared and animated through a time uniform (gentle waves on
 * water, slow churning glow on lava, pulsing veins).
 */
export class FluidBuilder {
  constructor(sampler, chunkSize) {
    this.sampler = sampler;
    this.size = chunkSize;
    this.time = { value: 0 };
    this.materials = {};
    for (const [kind, f] of Object.entries(FLUIDS)) this.materials[kind] = this.makeMaterial(kind, f);
  }

  makeMaterial(kind, f) {
    const mat = f.glow
      ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: f.opacity < 1, opacity: f.opacity, toneMapped: false, depthWrite: f.opacity >= 1 })
      : new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: f.opacity, depthWrite: false });
    const time = this.time;
    const wave = f.wave;
    const pulse = kind === 'glow' ? 1 : kind === 'lava' ? 0.35 : 0;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vPulse;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp = modelMatrix * vec4(position, 1.0);
          transformed.y += ${wave.toFixed(3)} * (sin(wp.x * 0.11 + uTime * 1.3) + sin(wp.z * 0.13 - uTime * 1.1));
          vPulse = sin(wp.x * 0.05 + wp.z * 0.04 + uTime * ${kind === 'glow' ? '2.0' : '0.6'});`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vPulse;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= 1.0 + ${pulse.toFixed(2)} * vPulse;`);
    };
    mat.customProgramCacheKey = () => `fluid-${kind}`;
    return mat;
  }

  /** Returns [{ kind, geometry }] for one chunk (chunk-local coordinates). */
  build(cx, cz, step) {
    const s = this.sampler;
    const size = this.size;
    const ox = cx * size;
    const oz = cz * size;
    const n = Math.round(size / step);
    const out = new Map();
    const color = new THREE.Color();
    const hot = new THREE.Color();
    const base = new THREE.Color();
    const levelAt = (x, z, kind, fallback) => {
      const f = s.fluidAt(x, z);
      if (kind === 'glow') return s.heightAt(x, z) + FLUIDS.glow.offset;
      return f && f.kind === kind && f.level !== null ? f.level : fallback;
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = ox + i * step;
        const z0 = oz + j * step;
        const f = s.fluidAt(x0 + step / 2, z0 + step / 2);
        if (!f) continue;
        const kind = f.kind;
        const def = FLUIDS[kind];
        if (!def) continue;
        const center = kind === 'glow' ? null : f.level;
        if (kind !== 'glow' && s.heightAt(x0 + step / 2, z0 + step / 2) > center + 0.5) continue;
        let list = out.get(kind);
        if (!list) out.set(kind, (list = { pos: [], col: [] }));
        const corners = [[0, 0], [0, 1], [1, 1], [1, 0]].map(([a, b]) => {
          const x = x0 + a * step;
          const z = z0 + b * step;
          return [x - ox, levelAt(x, z, kind, center), z - oz, x, z];
        });
        base.set(def.color);
        if (def.hot) hot.set(def.hot);
        const vcol = (x, z) => {
          const k = hash2(Math.floor(x / 5), Math.floor(z / 5), 77);
          return def.hot ? color.copy(base).lerp(hot, k * k) : color.copy(base).multiplyScalar(0.9 + k * 0.2);
        };
        for (const tri of [[0, 1, 2], [0, 2, 3]]) {
          for (const v of tri) {
            const c = corners[v];
            list.pos.push(c[0], c[1], c[2]);
            const vc = vcol(c[3], c[4]);
            list.col.push(vc.r, vc.g, vc.b);
          }
        }
      }
    }
    const result = [];
    for (const [kind, list] of out) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(list.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(list.col, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      result.push({ kind, geometry: g });
    }
    return result;
  }

  dispose() {
    for (const m of Object.values(this.materials)) m.dispose();
  }
}
