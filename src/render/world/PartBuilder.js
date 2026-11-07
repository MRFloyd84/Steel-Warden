import * as THREE from 'three';
import { colored, merge } from '../cockpit/geometry.js';
import { propEntry } from '../../world/PropLibrary.js';
import { MATERIAL_GROUPS } from '../../data/textures.js';

const DEG = Math.PI / 180;
const euler = new THREE.Euler();
const hsvTmp = {};

/**
 * Material group of a procedural part (detail texture): explicit `mat`, the
 * blueprint's default, or guessed from the part colour.
 */
export function partGroup(p, fallback = null) {
  if (p.glow) return 'none';
  if (p.mat) return p.mat;
  if (fallback) return fallback;
  new THREE.Color(p.color ?? '#777').getHSL(hsvTmp);
  const { h, s, l } = hsvTmp;
  const deg = h * 360;
  if (s > 0.2 && deg >= 230 && deg <= 320) return 'crystal';
  if (s > 0.45 && deg >= 35 && deg <= 65) return 'accent';
  if (s < 0.14 && l > 0.45) return 'concrete';
  if (s > 0.3 && deg >= 12 && deg <= 40 && l < 0.45) return 'wood';
  return 'metal';
}

function withGroup(g, group) {
  const n = g.attributes.position.count;
  g.setAttribute('mat', new THREE.BufferAttribute(new Float32Array(n).fill(Math.max(0, MATERIAL_GROUPS.indexOf(group))), 1));
  return g;
}

/** Geometry of one blueprint part, centred at its origin (not yet placed). */
function partGeometry(p) {
  if (p.prop) {
    const g = propEntry(p.prop).geometry.clone();
    if (p.scale) g.scale(...(Array.isArray(p.scale) ? p.scale : [p.scale, p.scale, p.scale]));
    return g;
  }
  if (p.box) return new THREE.BoxGeometry(p.box[0], p.box[1], p.box[2]);
  if (p.cyl) {
    const [r, h, seg = 8] = p.cyl;
    if (p.half) return new THREE.CylinderGeometry(r, r, h, seg, 1, false, Math.PI / 2, Math.PI);
    return new THREE.CylinderGeometry(p.rtop ?? r, r, h, seg);
  }
  if (p.cone) {
    const [r, h, seg = 6] = p.cone;
    return new THREE.ConeGeometry(r, h, seg);
  }
  if (p.ring) {
    const [r, tube, seg = 10] = p.ring;
    return new THREE.TorusGeometry(r, tube, 4, seg).rotateX(Math.PI / 2);
  }
  throw new Error('Part without shape');
}

/** Local transform of a part (rotation in degrees around its centre, then position). */
export function partMatrix(p, out = new THREE.Matrix4()) {
  euler.set((p.rot?.[0] ?? 0) * DEG, (p.rot?.[1] ?? 0) * DEG, (p.rot?.[2] ?? 0) * DEG);
  out.makeRotationFromEuler(euler);
  out.setPosition(p.at[0], p.at[1], p.at[2]);
  return out;
}

/**
 * Builds a blueprint: one merged, vertex-coloured, flat-shaded geometry for
 * the lit parts, one for the self-lit (glow) parts, and an oriented hit box
 * per part ({ zone, matrix, inverse, half }).
 * tint: optional colour multiplier (damaged stage), squash: flatten factor.
 */
export function buildParts(parts, { tint = null, tilt = 0, seed = 1, mat = null } = {}) {
  const lit = [];
  const glow = [];
  const boxes = [];
  const c = new THREE.Color();
  parts.forEach((p, i) => {
    const g = partGeometry(p);
    g.computeBoundingBox();
    const m = partMatrix(p);
    if (tilt) {
      // Damaged: parts lean and sag a little (deterministic per part)
      const r = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
      const f = r - Math.floor(r);
      m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((f - 0.5) * tilt, 0, (0.5 - f) * tilt * 0.8)));
    }
    // External models: one hit box per prop box (scaled with the part)
    const own = p.prop ? propEntry(p.prop).boxes.map((b) => {
      const sc = p.scale ? (Array.isArray(p.scale) ? p.scale : [p.scale, p.scale, p.scale]) : [1, 1, 1];
      return new THREE.Box3(b.min.clone().multiply(new THREE.Vector3(...sc)), b.max.clone().multiply(new THREE.Vector3(...sc)));
    }) : [g.boundingBox];
    for (const box of own) {
      boxes.push({
        zone: p.zone ?? 'main',
        matrix: m.clone(),
        inverse: m.clone().invert(),
        box: box.clone(),
      });
    }
    g.applyMatrix4(m);
    if (p.prop) {
      // keeps its brightness and palette groups; damaged: darker
      if (tint) {
        const col = g.attributes.color;
        for (let k = 0; k < col.count; k++) col.setXYZ(k, col.getX(k) * tint.r, col.getY(k) * tint.g, col.getZ(k) * tint.b);
      }
      g.computeVertexNormals();
      lit.push(g);
      return;
    }
    c.set(p.color ?? '#777');
    if (tint) c.multiply(tint);
    (p.glow && !tint ? glow : lit).push(withGroup(colored(g, c), p.glow && !tint ? 'none' : partGroup(p, mat)));
  });
  return {
    geometry: lit.length ? merge(lit) : null,
    glowGeometry: glow.length ? merge(glow) : null,
    boxes,
  };
}

/** Rubble: low, broken slabs in the blueprint's colours within its footprint. */
export function buildRubble(parts, footprint, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pieces = [];
  const n = Math.min(26, 8 + parts.length * 2);
  for (let i = 0; i < n; i++) {
    const p = parts[i % parts.length];
    const w = 1 + rnd() * footprint * 0.25;
    const base = p.prop ? '#5a5a55' : (p.color ?? '#555');
    const h = 0.4 + rnd() * 2.2;
    const g = new THREE.BoxGeometry(w, h, w * (0.4 + rnd()));
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((rnd() - 0.5) * 0.8, rnd() * 6, (rnd() - 0.5) * 0.8)));
    g.translate((rnd() - 0.5) * footprint, h * 0.3, (rnd() - 0.5) * footprint);
    pieces.push(withGroup(colored(g, new THREE.Color(base).multiplyScalar(0.45 + rnd() * 0.2)), p.prop ? 'concrete' : partGroup({ ...p, glow: false })));
  }
  return merge(pieces);
}

/** Far-LOD stand-in: one box over the bounds, in the average colour. */
export function buildProxy(parts) {
  const all = new THREE.Box3();
  const c = new THREE.Color(0, 0, 0);
  const tmp = new THREE.Color();
  let group = null;
  for (const p of parts) {
    const g = partGeometry(p);
    g.applyMatrix4(partMatrix(p));
    g.computeBoundingBox();
    all.union(g.boundingBox);
    g.dispose();
    c.add(tmp.set(p.prop ? '#cfcfcf' : (p.color ?? '#777')));
    group ??= p.prop ? null : partGroup(p);
  }
  c.multiplyScalar(1 / parts.length);
  const size = all.getSize(new THREE.Vector3());
  const center = all.getCenter(new THREE.Vector3());
  const g = new THREE.BoxGeometry(size.x * 0.8, size.y * 0.9, size.z * 0.8).translate(center.x, center.y - size.y * 0.05, center.z);
  // far stand-in of an external model: palette-tinted in its main group
  const propOnly = parts.every((p) => p.prop);
  const mainGroup = propOnly ? dominantGroup(parts[0].prop) : (group ?? 'metal');
  const out = withGroup(colored(g, c), 'none');
  out.attributes.mat.array.fill(MATERIAL_GROUPS.indexOf(mainGroup) + (propOnly ? 16 : 0));
  return out;
}

/** Most frequent material group of a prop (far proxy colour). */
function dominantGroup(id) {
  const mat = propEntry(id).geometry.attributes.mat.array;
  const counts = new Map();
  for (let i = 0; i < mat.length; i += 3) counts.set(mat[i], (counts.get(mat[i]) ?? 0) + 1);
  let best = 16 + 1;
  let n = -1;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return MATERIAL_GROUPS[Math.max(0, best - 16)] ?? 'metal';
}
