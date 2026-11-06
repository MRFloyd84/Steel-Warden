import { fbm, ridged, hash2 } from '../../util/noise.js';
import { smoothstep, lerp } from '../../util/math.js';

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
   */
  constructor(terrain, seed, gridStep, flatZones = []) {
    this.p = terrain;
    this.seed = seed | 0;
    this.gridStep = gridStep;
    this.invScale = 1 / terrain.scale;
    this.flatZones = flatZones.map((z) => ({
      ...z,
      height: Math.max(this.shapeHeight(z.x, z.z), z.minHeight ?? -Infinity),
    }));
  }

  /** Unflattened procedural shape. */
  shapeHeight(x, z) {
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
