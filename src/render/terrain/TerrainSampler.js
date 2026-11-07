import { fbm, ridged, hash2 } from '../../util/noise.js';
import { smoothstep, lerp } from '../../util/math.js';
import { FeatureField } from '../../world/FeatureField.js';

/**
 * Pure height function for a theater. Both the chunk meshes and the
 * simulation (ground contact, later AI and projectiles) sample this, so
 * what you see is exactly what you walk on.
 */
export class TerrainSampler {
  /**
   * @param terrain    theater.terrain parameters
   * @param seed       mission seed
   * @param gridStep   LOD0 vertex spacing — heightAt() matches that mesh exactly
   * @param flatZones  [{x, z, radius, falloff, minHeight?}] areas levelled for bases/starts
   * @param hills      [{x, z, radius, height}] extra mounds from the mission (cover)
   * @param extra      { features: [...] (theater + mission), surface: theater ground mask }
   */
  constructor(terrain, seed, gridStep, flatZones = [], hills = [], extra = {}) {
    this.p = terrain;
    this.hills = hills;
    this.surfaceMask = extra.surface ?? { base: 'hard' };
    this.fluidOut = { kind: null, level: 0 };
    this.seed = seed | 0;
    this.gridStep = gridStep;
    this.invScale = 1 / terrain.scale;
    this.flatZones = [];
    this.features = new FeatureField(extra.features ?? [], seed | 0, (x, z) => this.baseShape(x, z));
    this.flatZones = flatZones.map((z) => ({
      ...z,
      height: Math.max(this.shapeHeight(z.x, z.z), z.minHeight ?? -Infinity),
    }));
  }

  /** Unflattened shape including features and mission hills. */
  shapeHeight(x, z) {
    let h = this.features.height(x, z, this.baseShape(x, z));
    for (const hill of this.hills) {
      const d = Math.hypot(x - hill.x, z - hill.z) / hill.radius;
      if (d < 1) h += hill.height * (0.5 + 0.5 * Math.cos(Math.PI * d));
    }
    return h;
  }

  /** Procedural noise shape before features. */
  baseShape(x, z) {
    const p = this.p;
    const s = this.invScale;
    const seed = this.seed;
    let h = fbm(x * s, z * s, seed, p.octaves) * p.amplitude;

    if (p.ridgeAmplitude) {
      const maskNoise = fbm(x * s * 0.35 + 31.7, z * s * 0.35 - 12.1, seed + 7, 2) * 0.5 + 0.5;
      const mask = smoothstep(p.ridgeMaskLow, p.ridgeMaskHigh, maskNoise);
      if (mask > 0) h += ridged(x * s * 0.8, z * s * 0.8, seed + 13, 4) * p.ridgeAmplitude * mask;
    }

    if (p.terraceStep) {
      const t = h / p.terraceStep;
      const f = Math.floor(t);
      h = (f + smoothstep(0.3, 0.7, t - f)) * p.terraceStep;
    }

    if (p.craters) h += this.craterOffset(x, z, p.craters);
    return h + (p.baseHeight ?? 0);
  }

  /** Sum of bowl-shaped craters with raised rims from a jittered cell grid. */
  craterOffset(x, z, c) {
    const cx = Math.floor(x / c.cell);
    const cz = Math.floor(z / c.cell);
    let offset = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i;
        const gz = cz + j;
        const seed = this.seed + 101;
        if (hash2(gx, gz, seed) > c.chance) continue;
        const px = (gx + hash2(gx, gz, seed + 1)) * c.cell;
        const pz = (gz + hash2(gx, gz, seed + 2)) * c.cell;
        const r = lerp(c.minRadius, c.maxRadius, hash2(gx, gz, seed + 3) ** 2);
        const dx = x - px;
        const dz = z - pz;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > r * 2) continue;
        const q = d / r;
        if (q < 1) offset -= r * c.depth * (1 - q * q);
        const rimT = (d - r) / (r * 0.35);
        offset += r * c.rim * Math.exp(-rimT * rimT);
      }
    }
    return offset;
  }

  /** Height used for mesh vertices. */
  rawHeight(x, z) {
    let h = this.shapeHeight(x, z);
    for (const zone of this.flatZones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const w = smoothstep(zone.radius, zone.radius + zone.falloff, d);
      h = lerp(zone.height, h, w);
    }
    return h;
  }

  /**
   * Ground height at any point, interpolated on the LOD0 triangles
   * (diagonal from (0,0) to (1,1) in each grid cell, same as ChunkBuilder).
   */
  heightAt(x, z) {
    const s = this.gridStep;
    const gx = Math.floor(x / s);
    const gz = Math.floor(z / s);
    const fx = x / s - gx;
    const fz = z / s - gz;
    const x0 = gx * s;
    const z0 = gz * s;
    const h00 = this.rawHeight(x0, z0);
    const h11 = this.rawHeight(x0 + s, z0 + s);
    if (fx > fz) {
      const h10 = this.rawHeight(x0 + s, z0);
      return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    }
    const h01 = this.rawHeight(x0, z0 + s);
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }

  /** How much the flat zones (start pad, sites) dominate here, 0..1. */
  flatWeight(x, z) {
    let w = 0;
    for (const zone of this.flatZones) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      w = Math.max(w, 1 - smoothstep(zone.radius, zone.radius + zone.falloff, d));
    }
    return w;
  }

  /** Feature info at a point (surface override, fluid, tint); fluids vanish on levelled zones. */
  infoAt(x, z) {
    const info = this.features.info(x, z);
    if ((info.fluid || info.surface) && this.flatZones.length && this.flatWeight(x, z) > 0.5) {
      info.fluid = null;
      info.surface = null;
    }
    return info;
  }

  /**
   * Ground type: 'hard' | 'soft' | 'water' | 'lava' | 'thinIce' | 'hot'
   * (data/surfaces.js). Fluids first, then feature masks, then the theater mask.
   */
  surfaceAt(x, z) {
    return this.classify(this.infoAt(x, z), x, z);
  }

  /** Ground type from feature info (h: known ground height, saves a lookup). */
  classify(info, x, z, h = null) {
    if (info.fluid && (info.fluid.kind === 'water' || info.fluid.kind === 'lava')) {
      // Only where the fluid actually covers the ground
      if ((h ?? this.heightAt(x, z)) < info.fluid.level - 0.15) return info.fluid.kind;
    }
    if (info.surface) return info.surface;
    const m = this.surfaceMask;
    if (m.soft) {
      const n = fbm(x / m.soft.scale, z / m.soft.scale, this.seed + 404, 3);
      if (n > m.soft.threshold) return 'soft';
    }
    if (m.hot) {
      const n = fbm(x / m.hot.scale, z / m.hot.scale, this.seed + 505, 3);
      if (n > m.hot.threshold) return 'hot';
    }
    return m.base ?? 'hard';
  }

  /** Water/lava level (or glow veins) at a point, or null. Returned object is reused. */
  fluidAt(x, z) {
    const f = this.infoAt(x, z).fluid;
    if (!f) return null;
    this.fluidOut.kind = f.kind;
    this.fluidOut.level = f.level;
    return this.fluidOut;
  }

  /** Approximate surface normal y-component (1 = flat, 0 = vertical). */
  slopeAt(x, z) {
    const e = this.gridStep;
    const dx = this.rawHeight(x + e, z) - this.rawHeight(x - e, z);
    const dz = this.rawHeight(x, z + e) - this.rawHeight(x, z - e);
    const nx = -dx;
    const nz = -dz;
    const ny = 2 * e;
    return ny / Math.sqrt(nx * nx + ny * ny + nz * nz);
  }
}
