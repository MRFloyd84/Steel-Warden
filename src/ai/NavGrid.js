/**
 * Coarse navigation grid over the terrain for ground units.
 *
 * A square of `size` m around a centre, cells of `cell` m. Each cell's cost
 * is worked out on first use and kept: slope (blocked above maxGrade), water
 * (expensive), lava (blocked), thin ice (blocked for heavy walkers — a
 * separate class), soft ground (a bit more expensive), buildings and big
 * scatter rocks (blocked). A* with 8 neighbours and a node budget, then the
 * path is smoothed by skipping waypoints with a free straight line.
 * safeZone { x, z, r }: the start's safe radius — blocked for patrol paths
 * (avoidSafe), open for fights.
 */
const SQRT2 = Math.SQRT2;
const BLOCKED = 255;

export class NavGrid {
  constructor({ sampler, objects, center = { x: 0, z: 0 }, size = 3200, cell = 12, maxGrade = 0.6 }) {
    this.sampler = sampler;
    this.objects = objects;
    this.cell = cell;
    this.n = Math.ceil(size / cell);
    this.x0 = center.x - (this.n * cell) / 2;
    this.z0 = center.z - (this.n * cell) / 2;
    this.maxGrade = maxGrade;
    // Two cost layers: light (thin ice walkable) and heavy (thin ice blocked); 0 = not yet computed
    this.costLight = new Uint8Array(this.n * this.n);
    this.costHeavy = new Uint8Array(this.n * this.n);
    this.searches = 0;
    this.expanded = 0;
    // Search scratch (reused)
    const N = this.n * this.n;
    this.g = new Float32Array(N);
    this.from = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.run = 0;
    this.heap = new BinaryHeap(N);
  }

  index(cx, cz) {
    return cz * this.n + cx;
  }

  toCell(x, z) {
    return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)];
  }

  center(cx, cz) {
    return [this.x0 + (cx + 0.5) * this.cell, this.z0 + (cz + 0.5) * this.cell];
  }

  inside(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.n && cz < this.n;
  }

  /** Cost of a cell (1 = easy … 254, BLOCKED = 255). */
  cost(cx, cz, heavy) {
    if (!this.inside(cx, cz)) return BLOCKED;
    const i = this.index(cx, cz);
    const layer = heavy ? this.costHeavy : this.costLight;
    if (!layer[i]) this.evaluate(cx, cz, i);
    return layer[i];
  }

  evaluate(cx, cz, i) {
    const s = this.sampler;
    const [x, z] = this.center(cx, cz);
    const h = this.cell / 2;
    const hx0 = s.heightAt(x - h, z);
    const hx1 = s.heightAt(x + h, z);
    const hz0 = s.heightAt(x, z - h);
    const hz1 = s.heightAt(x, z + h);
    const grade = Math.max(Math.abs(hx1 - hx0), Math.abs(hz1 - hz0)) / this.cell;
    let light = 1 + Math.round(grade * 12);
    if (grade > this.maxGrade) light = BLOCKED;
    const surf = s.surfaceAt ? s.surfaceAt(x, z) : 'hard';
    let heavy = light;
    if (light !== BLOCKED) {
      if (surf === 'lava') light = heavy = BLOCKED;
      else if (surf === 'water') light = heavy = Math.min(254, light * 3 + 4);
      else if (surf === 'soft') {
        light = Math.min(254, Math.round(light * 1.3) + 1);
        heavy = Math.min(254, Math.round(heavy * 1.6) + 2);
      } else if (surf === 'thinIce') heavy = BLOCKED;
      else if (surf === 'hot') light = heavy = light + 3;
    }
    // Buildings and big rocks
    if (light !== BLOCKED || heavy !== BLOCKED) {
      const probe = { x, z };
      if (this.objects?.resolveWalker({ ...probe }, this.cell * 0.45)) {
        light = BLOCKED;
        heavy = BLOCKED;
      }
    }
    this.costLight[i] = light;
    this.costHeavy[i] = heavy;
  }

  /** Forget cached costs around a point (a building turned to rubble). */
  invalidate(x, z, radius) {
    const [c0x, c0z] = this.toCell(x - radius, z - radius);
    const [c1x, c1z] = this.toCell(x + radius, z + radius);
    for (let cz = Math.max(0, c0z); cz <= Math.min(this.n - 1, c1z); cz++) {
      for (let cx = Math.max(0, c0x); cx <= Math.min(this.n - 1, c1x); cx++) {
        const i = this.index(cx, cz);
        this.costLight[i] = 0;
        this.costHeavy[i] = 0;
      }
    }
  }

  /** Nearest walkable cell to a cell (spiral search), or null. */
  nearestOpen(cx, cz, heavy, radius = 6) {
    if (this.cost(cx, cz, heavy) < BLOCKED) return [cx, cz];
    for (let r = 1; r <= radius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.cost(cx + dx, cz + dz, heavy) < BLOCKED) return [cx + dx, cz + dz];
        }
      }
    }
    return null;
  }

  /**
   * Path from (x0, z0) to (x1, z1) as world points [[x, z], …] (start
   * excluded), or null. heavy: walker ≥ 50 t (thin ice blocked).
   */
  findPath(x0, z0, x1, z1, { heavy = false, maxNodes = 4000, avoidSafe = false } = {}) {
    this.searches++;
    // Patrols keep out of the start's safe zone (fights may enter); not if they are already inside
    const avoid = avoidSafe && this.safeZone && !this.inSafeXZ(x0, z0) ? this.safeZone : null;
    let [sx, sz] = this.toCell(x0, z0);
    let [gx, gz] = this.toCell(x1, z1);
    const s = this.nearestOpen(sx, sz, heavy, 3) ?? [sx, sz];
    const g = this.nearestOpen(gx, gz, heavy, 8);
    if (!g || !this.inside(s[0], s[1])) return null;
    [sx, sz] = s;
    [gx, gz] = g;
    const run = ++this.run;
    const start = this.index(sx, sz);
    const goal = this.index(gx, gz);
    const heap = this.heap;
    heap.clear();
    this.g[start] = 0;
    this.from[start] = -1;
    this.stamp[start] = run;
    heap.push(start, this.h(sx, sz, gx, gz));
    let best = start;
    let bestH = Infinity;
    let nodes = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      if (cur === goal) {
        best = cur;
        break;
      }
      const cx = cur % this.n;
      const cz = (cur / this.n) | 0;
      const hh = this.h(cx, cz, gx, gz);
      if (hh < bestH) {
        bestH = hh;
        best = cur;
      }
      if (++nodes > maxNodes) break;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          const c = this.cost(nx, nz, heavy);
          if (c >= BLOCKED) continue;
          if (avoid && this.inSafe(nx, nz)) continue;
          // No corner cutting past blocked cells
          if (dx && dz && (this.cost(cx + dx, cz, heavy) >= BLOCKED || this.cost(cx, cz + dz, heavy) >= BLOCKED)) continue;
          const ni = this.index(nx, nz);
          if (this.closed[ni] === run) continue;
          const ng = this.g[cur] + c * (dx && dz ? SQRT2 : 1);
          if (this.stamp[ni] === run && ng >= this.g[ni]) continue;
          this.stamp[ni] = run;
          this.g[ni] = ng;
          this.from[ni] = cur;
          heap.push(ni, ng + this.h(nx, nz, gx, gz));
        }
      }
    }
    this.expanded += nodes;
    // Walk back (to the goal, or the closest cell reached)
    const cells = [];
    for (let i = best; i !== -1 && i !== start; i = this.from[i]) cells.push(i);
    cells.reverse();
    if (!cells.length) return best === start && start === goal ? [[x1, z1]] : null;
    return this.smooth(sx, sz, cells, heavy, best === goal ? [x1, z1] : null, !!avoid);
  }

  h(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return (dx + dz + (SQRT2 - 2) * Math.min(dx, dz)) * 1.0;
  }

  /** Drops waypoints that a straight walkable line can skip. */
  smooth(sx, sz, cells, heavy, exactGoal, avoidSafe = false) {
    const pts = cells.map((i) => [i % this.n, (i / this.n) | 0]);
    const out = [];
    let ax = sx;
    let az = sz;
    let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) {
        if (this.lineFree(ax, az, pts[j][0], pts[j][1], heavy, avoidSafe)) {
          far = j;
          break;
        }
      }
      const [cx, cz] = pts[far];
      out.push(this.center(cx, cz));
      ax = cx;
      az = cz;
      k = far + 1;
    }
    if (exactGoal) out[out.length - 1] = exactGoal;
    return out;
  }

  /** Walkable straight line between two cells (and not much more costly). */
  lineFree(ax, az, bx, bz, heavy, avoidSafe = false) {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
    for (let i = 1; i <= steps; i++) {
      const cx = Math.round(ax + ((bx - ax) * i) / steps);
      const cz = Math.round(az + ((bz - az) * i) / steps);
      if (this.cost(cx, cz, heavy) > 12) return false;
      if (avoidSafe && this.safeZone && this.inSafe(cx, cz)) return false;
    }
    return true;
  }

  /** Cell inside the start's safe zone (patrols route around it). */
  inSafe(cx, cz) {
    const [x, z] = this.center(cx, cz);
    return this.inSafeXZ(x, z);
  }

  inSafeXZ(x, z) {
    const sz = this.safeZone;
    return !!sz && Math.hypot(x - sz.x, z - sz.z) < sz.r;
  }

  /** Is the point on a walkable cell? */
  walkable(x, z, heavy = false) {
    const [cx, cz] = this.toCell(x, z);
    return this.cost(cx, cz, heavy) < BLOCKED;
  }
}

/** Min-heap of (index, priority) with typed arrays. */
class BinaryHeap {
  constructor(capacity) {
    this.idx = new Int32Array(capacity * 2);
    this.pri = new Float32Array(capacity * 2);
    this.size = 0;
  }

  clear() {
    this.size = 0;
  }

  push(i, p) {
    if (this.size >= this.idx.length) return;
    let k = this.size++;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.idx[k] = this.idx[parent];
      this.pri[k] = this.pri[parent];
      k = parent;
    }
    this.idx[k] = i;
    this.pri[k] = p;
  }

  pop() {
    const top = this.idx[0];
    const lastI = this.idx[--this.size];
    const lastP = this.pri[this.size];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lastP) break;
      this.idx[k] = this.idx[c];
      this.pri[k] = this.pri[c];
      k = c;
    }
    this.idx[k] = lastI;
    this.pri[k] = lastP;
    return top;
  }
}

export { BLOCKED };
