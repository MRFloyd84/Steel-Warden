import * as THREE from 'three';
import { hash2 } from '../../util/noise.js';

/**
 * Builds flat-shaded, per-face coloured chunk geometry. Non-indexed so every
 * triangle gets its own normal and colour — the classic untextured look.
 */
export class ChunkBuilder {
  constructor(sampler, theater, config, seed) {
    this.sampler = sampler;
    this.size = config.chunkSize;
    this.skirtDepth = config.skirtDepth;
    this.seed = seed;
    const pal = theater.palette;
    this.bands = pal.bands.map((b) => ({ max: b.max, color: new THREE.Color(b.color) }));
    this.rock = new THREE.Color(pal.rock);
    this.rockSlope = pal.rockSlope;
    this.variation = pal.variation;
    this.tmp = new THREE.Color();
    // Ground types and feature tints (soft ground, ice, hot ground, river beds, roads, veins)
    const col = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, new THREE.Color(v)]));
    this.surfaceColors = col(pal.surfaces);
    this.tints = col(pal.tints);
    this.useFeatures = !sampler.features.empty || !!theater.surface?.soft || !!theater.surface?.hot;
  }

  build(cx, cz, segments) {
    const size = this.size;
    const step = size / segments;
    const ox = cx * size;
    const oz = cz * size;
    const n = segments + 1;

    const heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        heights[j * n + i] = this.sampler.rawHeight(ox + i * step, oz + j * step);
      }
    }

    const triCount = segments * segments * 2 + segments * 16;
    const out = new GeometryWriter(triCount);
    const H = (i, j) => heights[j * n + i];

    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const x0 = i * step;
        const x1 = x0 + step;
        const z0 = j * step;
        const z1 = z0 + step;
        const h00 = H(i, j);
        const h10 = H(i + 1, j);
        const h01 = H(i, j + 1);
        const h11 = H(i + 1, j + 1);
        // Diagonal 00-11 — must match TerrainSampler.heightAt().
        this.face(out, x0, h00, z0, x0, h01, z1, x1, h11, z1, ox, oz);
        this.face(out, x0, h00, z0, x1, h11, z1, x1, h10, z0, ox, oz);
      }
    }

    this.skirts(out, heights, n, step, ox, oz);
    return out.toGeometry();
  }

  face(out, ax, ay, az, bx, by, bz, cx, cy, cz, ox, oz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    const avgH = (ay + by + cy) / 3;
    const wx = ox + (ax + bx + cx) / 3;
    const wz = oz + (az + bz + cz) / 3;
    const color = this.colorFor(avgH, ny, wx, wz);
    out.tri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, color);
  }

  colorFor(height, normalY, wx, wz) {
    const c = this.tmp;
    if (normalY < this.rockSlope) {
      c.copy(this.rock);
    } else {
      let band = this.bands[this.bands.length - 1];
      for (const b of this.bands) {
        if (height <= b.max) { band = b; break; }
      }
      c.copy(band.color);
      if (this.useFeatures) {
        const info = this.sampler.infoAt(wx, wz);
        const tint = info.tint && this.tints[info.tint];
        if (tint) c.copy(tint);
        else {
          const surf = this.sampler.classify(info, wx, wz, height);
          const sc = this.surfaceColors[surf === 'water' || surf === 'lava' ? `${surf}Bed` : surf];
          if (sc) c.lerp(sc, 0.85);
        }
      }
    }
    const jitter = (hash2(Math.floor(wx * 0.5), Math.floor(wz * 0.5), this.seed + 55) - 0.5) * 2;
    return c.multiplyScalar(1 + jitter * this.variation);
  }

  /** Vertical strips below each chunk edge, both windings, to hide LOD cracks. */
  skirts(out, heights, n, step, ox, oz) {
    const seg = n - 1;
    const d = this.skirtDepth;
    const H = (i, j) => heights[j * n + i];
    const edge = (x0, z0, h0, x1, z1, h1) => {
      const c = this.colorFor((h0 + h1) / 2, 1, ox + x0, oz + z0).multiplyScalar(0.8);
      out.quadBothSides(x0, h0, z0, x1, h1, z1, d, c);
    };
    for (let k = 0; k < seg; k++) {
      const a = k * step;
      const b = a + step;
      edge(a, 0, H(k, 0), b, 0, H(k + 1, 0));
      edge(a, seg * step, H(k, seg), b, seg * step, H(k + 1, seg));
      edge(0, a, H(0, k), 0, b, H(0, k + 1));
      edge(seg * step, a, H(seg, k), seg * step, b, H(seg, k + 1));
    }
  }
}

class GeometryWriter {
  constructor(triCount) {
    this.pos = new Float32Array(triCount * 9);
    this.nor = new Float32Array(triCount * 9);
    this.col = new Float32Array(triCount * 9);
    this.o = 0;
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, color) {
    const { pos, nor, col } = this;
    let o = this.o;
    pos[o] = ax; pos[o + 1] = ay; pos[o + 2] = az;
    pos[o + 3] = bx; pos[o + 4] = by; pos[o + 5] = bz;
    pos[o + 6] = cx; pos[o + 7] = cy; pos[o + 8] = cz;
    for (let k = 0; k < 9; k += 3) {
      nor[o + k] = nx; nor[o + k + 1] = ny; nor[o + k + 2] = nz;
      col[o + k] = color.r; col[o + k + 1] = color.g; col[o + k + 2] = color.b;
    }
    this.o = o + 9;
  }

  quadBothSides(x0, h0, z0, x1, h1, z1, depth, color) {
    const l0 = h0 - depth;
    const l1 = h1 - depth;
    this.tri(x0, h0, z0, x1, h1, z1, x1, l1, z1, 0, 1, 0, color);
    this.tri(x0, h0, z0, x1, l1, z1, x0, l0, z0, 0, 1, 0, color);
    this.tri(x0, h0, z0, x1, l1, z1, x1, h1, z1, 0, 1, 0, color);
    this.tri(x0, h0, z0, x0, l0, z0, x1, l1, z1, 0, 1, 0, color);
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.o), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.subarray(0, this.o), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.o), 3));
    g.computeBoundingSphere();
    return g;
  }
}
