import { hash2, valueNoise } from '../util/noise.js';
import { smoothstep, lerp } from '../util/math.js';

/**
 * Terrain features on top of the height noise: ridges, basins, craters,
 * canyons and crevasses, plateaus (with ramps) and mesas, rivers and canals
 * (with dikes), lava rivers, lakes (water, lava, thin ice), glowing veins,
 * hot zones and a road grid.
 *
 * Generators work on a jittered cell grid: each cell decides by seed whether
 * it holds a feature and what it looks like, so any point can be evaluated
 * without stored state and the world is unbounded and deterministic.
 * Missions may add fixed features (`at` given) that are always evaluated.
 *
 *   height(x, z, h)  → h with all features applied
 *   info(x, z)       → { surface, fluid: { kind, level } | null, tint }
 *
 * baseHeight(x, z) is the terrain before features (used for water levels).
 */
export class FeatureField {
  constructor(defs = [], seed = 0, baseHeight = () => 0) {
    this.seed = seed;
    this.base = baseHeight;
    this.gens = [];
    this.fixed = [];
    this.cache = new Map();
    defs.forEach((def, i) => {
      const g = { ...def, index: i, seed: (seed + 7919 * (i + 1)) | 0 };
      if (def.at) {
        const inst = makeInstance(g, def.at[0], def.at[1], () => 0.5, this.base);
        if (inst) this.fixed.push(inst);
      } else if (KINDS[def.type]) {
        g.reach = Math.ceil((KINDS[def.type].extent(def) + def.cell * 0.5) / def.cell);
        this.gens.push(g);
      }
    });
    this.out = { surface: null, fluid: null, tint: null };
    this.fluid = { kind: null, level: 0 };
  }

  get empty() {
    return !this.gens.length && !this.fixed.length;
  }

  /** Feature instances near a point (cached per cell). */
  *near(x, z) {
    for (const g of this.gens) {
      if (g.type === 'roads') {
        yield roadInstance(g);
        continue;
      }
      const cx = Math.floor(x / g.cell);
      const cz = Math.floor(z / g.cell);
      for (let j = -g.reach; j <= g.reach; j++) {
        for (let i = -g.reach; i <= g.reach; i++) {
          const inst = this.instance(g, cx + i, cz + j);
          if (inst && Math.abs(x - inst.x) < inst.bound && Math.abs(z - inst.z) < inst.bound) yield inst;
        }
      }
    }
    for (const inst of this.fixed) {
      if (Math.abs(x - inst.x) < inst.bound && Math.abs(z - inst.z) < inst.bound) yield inst;
    }
  }

  /** The road grid (if this theater has one): { grid, width, offX, offZ }. */
  roadGrid() {
    const g = this.gens.find((x) => x.type === 'roads');
    if (!g) return null;
    const inst = roadInstance(g);
    return { grid: g.grid, width: g.width, offX: inst.offX, offZ: inst.offZ };
  }

  instance(g, cx, cz) {
    const key = `${g.index}:${cx}:${cz}`;
    let inst = this.cache.get(key);
    if (inst === undefined) {
      const r = (k) => hash2(cx, cz, g.seed + k * 131);
      inst = r(0) < (g.chance ?? 1) ? makeInstance(g, (cx + 0.15 + r(1) * 0.7) * g.cell, (cz + 0.15 + r(2) * 0.7) * g.cell, (k) => r(k + 3), this.base) : null;
      if (this.cache.size > 20000) this.cache.clear();
      this.cache.set(key, inst);
    }
    return inst;
  }

  height(x, z, h) {
    if (this.empty) return h;
    for (const inst of this.near(x, z)) h = KINDS[inst.type].height(inst, x, z, h);
    return h;
  }

  info(x, z) {
    const out = this.out;
    out.surface = null;
    out.fluid = null;
    out.tint = null;
    if (this.empty) return out;
    for (const inst of this.near(x, z)) KINDS[inst.type].info?.(inst, x, z, out, this.fluid);
    return out;
  }
}

// ---------------------------------------------------------------------------

const range = (v, r) => (Array.isArray(v) ? lerp(v[0], v[1], r) : v);
/** Line direction: fixed `angle` (deg, 0 = along +x) or from the seed. */
const dirOf = (d, r) => (d.angle !== undefined ? (d.angle * Math.PI) / 180 : r * Math.PI);

function makeInstance(g, x, z, r, base) {
  const kind = KINDS[g.type];
  if (!kind) return null;
  const inst = { type: g.type, def: g, x, z, seed: g.seed, baseFn: base };
  kind.make(inst, g, r, base);
  return inst;
}

function roadInstance(g) {
  if (!g.inst) g.inst = { type: 'roads', def: g, x: 0, z: 0, bound: Infinity, offX: hash2(1, 2, g.seed) * g.grid, offZ: hash2(3, 4, g.seed) * g.grid };
  return g.inst;
}

/** Distance from (x, z) to a polyline; returns { d, t } (t = 0..1 along the line). */
function polyDist(pts, x, z, out) {
  let best = Infinity;
  let bestT = 0;
  let acc = 0;
  const total = pts.total;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d = px * px + pz * pz;
    const segLen = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bestT = (acc + t * segLen) / total;
      out.cx = ax + dx * t;
      out.cz = az + dz * t;
    }
    acc += segLen;
  }
  out.d = Math.sqrt(best);
  out.t = bestT;
  return out;
}

/** A meandering line through (x, z): n points, total length L, direction a. */
function makeLine(inst, L, a, meander, n, r) {
  const pts = [];
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1) - 0.5) * L;
    const side = i === 0 || i === n - 1 ? 0 : (r(10 + i) - 0.5) * 2 * meander * L / n * 2;
    pts.push([inst.x + dx * s - dz * side, inst.z + dz * s + dx * side]);
  }
  // Real length of the polyline (meanders make it longer than L), so t stays within 0..1
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  pts.total = total || L;
  inst.pts = pts;
  inst.bound = L / 2 + meander * L + 80;
}

const pd = { d: 0, t: 0, cx: 0, cz: 0 };
const endFade = (t) => smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t);

export const KINDS = {
  // Long raised crest
  ridge: {
    extent: (d) => range(d.length, 1) / 2 + range(d.width, 1) * 3,
    make(inst, d, r) {
      inst.L = range(d.length, r(0));
      inst.H = range(d.height, r(1));
      inst.W = range(d.width, r(2));
      makeLine(inst, inst.L, dirOf(d, r(3)), 0.08, 4, r);
      inst.bound = inst.L / 2 + inst.W * 3;
    },
    height(inst, x, z, h) {
      polyDist(inst.pts, x, z, pd);
      const k = pd.d / inst.W;
      return h + inst.H * Math.exp(-k * k) * endFade(pd.t);
    },
  },

  // Round depression
  basin: {
    extent: (d) => range(d.radius, 1) * 1.4,
    make(inst, d, r) {
      inst.R = range(d.radius, r(0));
      inst.D = range(d.depth, r(1));
      inst.bound = inst.R * 1.4;
    },
    height(inst, x, z, h) {
      const q = Math.hypot(x - inst.x, z - inst.z) / (inst.R * 1.4);
      return q < 1 ? h - inst.D * (0.5 + 0.5 * Math.cos(Math.PI * q)) : h;
    },
    info(inst, x, z, out) {
      if (inst.def.surface && Math.hypot(x - inst.x, z - inst.z) < inst.R) out.surface = inst.def.surface;
    },
  },

  // Bowl with raised rim
  crater: {
    extent: (d) => range(d.radius, 1) * 2,
    make(inst, d, r) {
      inst.R = range(d.radius, r(0) ** 2);
      inst.bound = inst.R * 2;
    },
    height(inst, x, z, h) {
      const dd = Math.hypot(x - inst.x, z - inst.z);
      const q = dd / inst.R;
      const d = inst.def;
      if (q < 1) h -= inst.R * (d.depth ?? 0.3) * (1 - q * q);
      const rimT = (dd - inst.R) / (inst.R * 0.35);
      return h + inst.R * (d.rim ?? 0.12) * Math.exp(-rimT * rimT);
    },
  },

  // Gorge with steep walls and a flat floor (crevasse = narrow and deep)
  canyon: {
    extent: (d) => range(d.length, 1) / 2 + range(d.width, 1) + 120,
    make(inst, d, r) {
      inst.L = range(d.length, r(0));
      inst.W = range(d.width, r(1));
      inst.D = range(d.depth, r(2));
      inst.wall = d.wall ?? inst.W * 0.35;
      makeLine(inst, inst.L, dirOf(d, r(3)), d.meander ?? 0.18, 6, r);
    },
    height(inst, x, z, h) {
      polyDist(inst.pts, x, z, pd);
      const carve = 1 - smoothstep(inst.W / 2, inst.W / 2 + inst.wall, pd.d);
      if (carve <= 0) return h;
      const floor = this.floor(inst, pd);
      return lerp(h, Math.min(h, floor), carve * endFade(pd.t));
    },
    floor(inst, p) {
      // Floor follows the base terrain along the line, minus the depth
      return inst.floorRef - inst.D + (p.t - 0.5) * (inst.def.slope ?? 0) * inst.L;
    },
  },

  // Raised flat top with steep edges; ramp: one gentle way up
  plateau: {
    extent: (d) => range(d.radius, 1) * 2.2,
    make(inst, d, r, base) {
      inst.R = range(d.radius, r(0));
      inst.H = range(d.height, r(1));
      inst.top = base(inst.x, inst.z) + inst.H;
      inst.edge = d.edge ?? 10;
      inst.rampA = r(2) * Math.PI * 2;
      inst.rampLen = inst.H * 4.5;
      inst.rampW = d.rampWidth ?? 22;
      inst.wob = r(3) * 100;
      inst.bound = inst.R + inst.rampLen + inst.edge + 10;
    },
    height(inst, x, z, h) {
      const dx = x - inst.x;
      const dz = z - inst.z;
      const dist = Math.hypot(dx, dz);
      // Slightly irregular outline
      const R = inst.R * (1 + 0.12 * valueNoise(Math.atan2(dz, dx) * 2 + inst.wob, 0, inst.seed));
      let t = 1 - smoothstep(R, R + inst.edge, dist);
      if (inst.def.ramp) {
        const ax = Math.cos(inst.rampA);
        const az = Math.sin(inst.rampA);
        const along = dx * ax + dz * az;
        const across = Math.abs(-dx * az + dz * ax);
        if (along > R * 0.6 && across < inst.rampW / 2 + 6) {
          const rt = 1 - smoothstep(R, R + inst.rampLen, along);
          t = Math.max(t, rt * (1 - smoothstep(inst.rampW / 2, inst.rampW / 2 + 6, across)));
        }
      }
      return t > 0 ? Math.max(h, lerp(h, inst.top, t)) : h;
    },
  },

  // River or canal: channel with banks, water (or lava) level following the land
  river: {
    extent: (d) => range(d.length ?? 900, 1) / 2 + 200,
    make(inst, d, r) {
      inst.L = range(d.length ?? 900, r(0));
      inst.W = range(d.width, r(1));
      inst.bank = d.bank ?? inst.W * 0.6;
      inst.D = d.depth ?? 4;
      makeLine(inst, inst.L, dirOf(d, r(3)), d.meander ?? 0.25, d.straight ? 2 : 8, r);
      inst.bound += inst.W + inst.bank + (d.dikes ? 40 : 0);
    },
    level(inst, base) {
      return base - (inst.def.drop ?? 1.2);
    },
    height(inst, x, z, h) {
      polyDist(inst.pts, x, z, pd);
      const fade = endFade(pd.t);
      const ref = baseAtLine(inst, pd);
      const level = this.level(inst, ref);
      const bed = level - inst.D;
      const t = (1 - smoothstep(inst.W / 2, inst.W / 2 + inst.bank, pd.d)) * fade;
      if (t > 0) h = lerp(h, Math.min(h, bed + (pd.d / (inst.W / 2)) ** 2 * inst.D * 0.4), t);
      const dk = inst.def.dikes;
      if (dk) {
        const off = (pd.d - (inst.W / 2 + inst.bank + dk.width * 0.5)) / (dk.width * 0.55);
        if (Math.abs(off) < 2) h = Math.max(h, lerp(h, Math.max(h, level + dk.height), Math.exp(-off * off * off * off) * fade));
      }
      return h;
    },
    info(inst, x, z, out, fl) {
      polyDist(inst.pts, x, z, pd);
      const fade = endFade(pd.t);
      if (pd.d < inst.W / 2 + inst.bank * 0.7 && fade > 0.5) {
        fl.kind = inst.def.fluid ?? 'water';
        fl.level = this.level(inst, baseAtLine(inst, pd));
        out.fluid = fl;
      } else if (inst.def.shore && pd.d < inst.W / 2 + inst.bank * 2.2 && fade > 0.3) {
        out.surface = inst.def.shore;
      }
    },
  },

  // Lake: water, lava or thin ice (ice is walkable at its level)
  lake: {
    extent: (d) => range(d.radius, 1) * 1.5,
    make(inst, d, r, base) {
      inst.R = range(d.radius, r(0));
      inst.D = d.depth ?? 3;
      inst.level = base(inst.x, inst.z) - (d.drop ?? 1);
      inst.wob = r(1) * 100;
      inst.bound = inst.R * 1.5;
    },
    radius(inst, x, z) {
      return inst.R * (1 + 0.18 * valueNoise(Math.atan2(z - inst.z, x - inst.x) * 1.6 + inst.wob, 0.5, inst.seed));
    },
    height(inst, x, z, h) {
      const dist = Math.hypot(x - inst.x, z - inst.z);
      const R = this.radius(inst, x, z);
      const t = 1 - smoothstep(R, R * 1.35, dist);
      if (t <= 0) return h;
      const ice = inst.def.fluid === 'thinIce';
      const floor = ice ? inst.level : inst.level - inst.D * (1 - (dist / R) ** 2 * 0.6);
      return lerp(h, ice ? floor : Math.min(h, floor), t);
    },
    info(inst, x, z, out, fl) {
      const dist = Math.hypot(x - inst.x, z - inst.z);
      const R = this.radius(inst, x, z);
      if (inst.def.fluid === 'thinIce') {
        if (dist < R * 1.02) out.surface = 'thinIce';
        else if (inst.def.shore && dist < R * 1.5) out.surface = inst.def.shore;
        return;
      }
      if (dist < R * 1.12) {
        fl.kind = inst.def.fluid ?? 'water';
        fl.level = inst.level;
        out.fluid = fl;
      } else if (inst.def.shore && dist < R * 1.5) out.surface = inst.def.shore;
    },
  },

  // Patch of a surface (snow drifts, hot ground) as a blob mask
  zone: {
    extent: (d) => range(d.radius, 1) * 1.3,
    make(inst, d, r) {
      inst.R = range(d.radius, r(0));
      inst.wob = r(1) * 100;
      inst.bound = inst.R * 1.3;
    },
    height(inst, x, z, h) {
      const bump = inst.def.bump;
      if (!bump) return h;
      const q = Math.hypot(x - inst.x, z - inst.z) / inst.R;
      return q < 1 ? h + bump * (0.5 + 0.5 * Math.cos(Math.PI * q)) * (0.6 + 0.4 * valueNoise(x * 0.05, z * 0.05, inst.seed)) : h;
    },
    info(inst, x, z, out) {
      const q = Math.hypot(x - inst.x, z - inst.z) / inst.R + 0.25 * valueNoise(x * 0.03 + inst.wob, z * 0.03, inst.seed);
      if (q < 1) {
        out.surface = inst.def.surface;
        if (inst.def.tint) out.tint = inst.def.tint;
      }
    },
  },

  // Glowing veins in the ground (Synthesis world): thin meandering lines
  veins: {
    extent: (d) => d.cell * 0.9,
    make(inst, d, r) {
      makeLine(inst, d.cell * (0.8 + r(0) * 0.6), r(1) * Math.PI, 0.3, 7, r);
      inst.W = d.width ?? 3;
    },
    height(inst, x, z, h) {
      return h;
    },
    info(inst, x, z, out, fl) {
      polyDist(inst.pts, x, z, pd);
      if (pd.d < inst.W) {
        out.tint = 'vein';
        fl.kind = 'glow';
        fl.level = null; // follows the ground
        out.fluid = fl;
      }
    },
  },

  // Straight road grid (industrial): hard, levelled across, tinted
  roads: {
    extent: () => 0,
    make() {},
    height(inst, x, z, h) {
      return h;
    },
    info(inst, x, z, out) {
      const g = inst.def.grid;
      const w = inst.def.width / 2;
      const dx = Math.abs(((x - inst.offX) % g + g) % g - g / 2);
      const dz = Math.abs(((z - inst.offZ) % g + g) % g - g / 2);
      if (dx > g / 2 - w || dz > g / 2 - w) {
        out.surface = 'hard';
        out.tint = 'road';
      }
    },
  },

  // Rectangle with a fixed surface (and optional pool) — mission test fields
  patch: {
    extent: (d) => Math.max(...(d.size ?? [40, 40])),
    make(inst, d, r, base) {
      inst.w = d.size[0] / 2;
      inst.d = d.size[1] / 2;
      inst.level = (d.level ?? base(inst.x, inst.z)) - (d.drop ?? 0.6);
      inst.bound = Math.max(inst.w, inst.d) + 12;
    },
    inside(inst, x, z, pad = 0) {
      return Math.abs(x - inst.x) < inst.w + pad && Math.abs(z - inst.z) < inst.d + pad;
    },
    height(inst, x, z, h) {
      const f = inst.def.fluid;
      if (!f || f === 'thinIce') {
        if (f === 'thinIce' && this.inside(inst, x, z, 4)) return inst.level;
        return h;
      }
      if (this.inside(inst, x, z, 4)) return Math.min(h, inst.level - (inst.def.depth ?? 2));
      return h;
    },
    info(inst, x, z, out, fl) {
      if (!this.inside(inst, x, z)) return;
      const f = inst.def.fluid;
      if (f && f !== 'thinIce') {
        fl.kind = f;
        fl.level = inst.level;
        out.fluid = fl;
      } else out.surface = f === 'thinIce' ? 'thinIce' : inst.def.surface;
      if (inst.def.tint) out.tint = inst.def.tint;
    },
  },
};

// Mesas and crevasses are plateaus/canyons with other defaults
KINDS.mesa = { ...KINDS.plateau };
KINDS.crevasse = { ...KINDS.canyon };
for (const k of ['canyon', 'crevasse']) {
  const orig = KINDS[k].make;
  KINDS[k].make = function make(inst, d, r, base) {
    orig.call(this, inst, d, r, base);
    inst.floorRef = base(inst.x, inst.z);
  };
}

/** Base (pre-feature) height along a feature's line (64 cached samples, interpolated). */
function baseAtLine(inst, p) {
  const f = Math.min(64, Math.max(0, p.t * 64));
  const k = Math.min(63, Math.floor(f));
  return lerp(baseSample(inst, k), baseSample(inst, Math.min(64, k + 1)), f - k);
}

function baseSample(inst, k) {
  inst.refs ??= new Float64Array(65).fill(NaN);
  let v = inst.refs[k];
  if (Number.isNaN(v)) {
    const pts = inst.pts;
    const pos = (k / 64) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(pos));
    const f = pos - i;
    v = inst.baseFn(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f));
    inst.refs[k] = v;
  }
  return v;
}
