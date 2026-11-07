import { SCATTER_MODELS } from '../data/structures.js';
import { hash2 } from '../util/noise.js';

/**
 * Scatter objects (rocks, ice blocks, basalt columns, wrecks, containers,
 * pipes, crystals, reeds …) generated per terrain chunk from the theater's
 * rules: density per km², allowed slope, ground types, scale range, minimum
 * distance. Deterministic by seed; chunks are generated on demand and cached.
 * Instances with a radius collide with walkers and block projectiles/sight.
 */
export class ScatterField {
  constructor({ sampler, rules = [], seed = 0, chunkSize = 160, keepClear = [], heights = {} }) {
    this.sampler = sampler;
    this.rules = rules.filter((r) => SCATTER_MODELS[r.model]);
    this.seed = seed;
    this.size = chunkSize;
    this.keepClear = keepClear;
    this.heights = heights; // model → height at scale 1 (for sight/projectile tests)
    this.chunks = new Map();
    this.generated = 0;
  }

  chunk(cx, cz) {
    const key = `${cx},${cz}`;
    let list = this.chunks.get(key);
    if (!list) {
      list = this.generate(cx, cz);
      if (this.chunks.size > 600) this.chunks.clear();
      this.chunks.set(key, list);
    }
    return list;
  }

  generate(cx, cz) {
    const out = [];
    const size = this.size;
    const s = this.sampler;
    this.rules.forEach((rule, ri) => {
      const seed = this.seed + 6007 * (ri + 1);
      const count = (rule.density * size * size) / 1e6;
      const n = Math.floor(count) + (hash2(cx, cz, seed) < count % 1 ? 1 : 0);
      const model = SCATTER_MODELS[rule.model];
      for (let k = 0; k < n; k++) {
        const r = (q) => hash2(cx * 131 + k, cz * 71 + q, seed);
        // Clustered rules: offsets around a few cluster centres per chunk
        let x;
        let z;
        if (rule.cluster) {
          const c = Math.floor(r(9) * rule.cluster);
          const ccx = (cx + 0.2 + hash2(cx, cz * 3 + c, seed + 1) * 0.6) * size;
          const ccz = (cz + 0.2 + hash2(cx * 3 + c, cz, seed + 2) * 0.6) * size;
          const ang = r(1) * Math.PI * 2;
          const rad = Math.sqrt(r(2)) * (rule.clusterRadius ?? 30);
          x = ccx + Math.cos(ang) * rad;
          z = ccz + Math.sin(ang) * rad;
        } else {
          x = (cx + r(1)) * size;
          z = (cz + r(2)) * size;
        }
        const slope = s.slopeAt(x, z);
        const [smin, smax] = rule.slope ?? [0.75, 1];
        if (slope < smin || slope > smax) continue;
        const surf = s.surfaceAt(x, z);
        if (!(rule.surfaces ?? ['hard', 'soft', 'hot']).includes(surf)) continue;
        if (s.flatZones.length && s.flatWeight(x, z) > 0.2) continue;
        if (this.keepClear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
        const scale = (rule.scale?.[0] ?? 1) + r(3) * ((rule.scale?.[1] ?? 1) - (rule.scale?.[0] ?? 1));
        const radius = model.radius * scale;
        const minDist = rule.minDist ?? 0;
        if (minDist && out.some((o) => Math.hypot(o.x - x, o.z - z) < minDist + (o.model === rule.model ? 0 : -minDist / 2))) continue;
        out.push({
          model: rule.model, x, z, y: s.heightAt(x, z) - (rule.sink ?? 0.3) * scale,
          rot: r(4) * Math.PI * 2, scale, radius,
          height: (this.heights[rule.model] ?? 3) * scale,
          blocks: radius >= 1.4,
        });
        this.generated++;
      }
    });
    return out;
  }

  /** Instances in the chunks touching a circle. */
  *near(x, z, r) {
    const size = this.size;
    for (let cz = Math.floor((z - r) / size); cz <= Math.floor((z + r) / size); cz++) {
      for (let cx = Math.floor((x - r) / size); cx <= Math.floor((x + r) / size); cx++) {
        for (const o of this.chunk(cx, cz)) {
          if (Math.abs(o.x - x) < r + o.radius && Math.abs(o.z - z) < r + o.radius) yield o;
        }
      }
    }
  }

  /** Segment against blocking instances (vertical cylinders). Returns { t, point, normal, scatter } or null. */
  segment(p0, p1) {
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len2 = dx * dx + dz * dz;
    const mx = (p0.x + p1.x) / 2;
    const mz = (p0.z + p1.z) / 2;
    const reach = Math.sqrt(len2) / 2 + 8;
    if (reach > 900) return null; // very long rays: terrain test handles the rest
    let best = null;
    for (const o of this.near(mx, mz, reach)) {
      if (!o.blocks) continue;
      // Closest approach in the ground plane
      let t = len2 > 0 ? ((o.x - p0.x) * dx + (o.z - p0.z) * dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = p0.x + dx * t - o.x;
      const pz = p0.z + dz * t - o.z;
      const r = o.radius * 0.85;
      const d2 = px * px + pz * pz;
      if (d2 > r * r) continue;
      // Step back to the cylinder wall
      const back = len2 > 0 ? Math.sqrt(Math.max(0, r * r - d2) / len2) : 0;
      t = Math.max(0, t - back);
      const y = p0.y + (p1.y - p0.y) * t;
      if (y < o.y - 1 || y > o.y + o.height) continue;
      if (best && t >= best.t) continue;
      best = { t, scatter: o };
    }
    if (best) {
      best.point = { x: p0.x + dx * best.t, y: p0.y + (p1.y - p0.y) * best.t, z: p0.z + dz * best.t };
    }
    return best;
  }
}
