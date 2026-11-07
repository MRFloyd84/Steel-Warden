import * as THREE from 'three';
import { STRUCTURES, SITES, getStructure } from '../data/structures.js';
import { buildParts, buildRubble } from '../render/world/PartBuilder.js';
import { hash2 } from '../util/noise.js';

const CELL = 64;
const DEG = Math.PI / 180;
const DAMAGED_TINT = new THREE.Color(0.55, 0.52, 0.48);
const litMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const ray = new THREE.Ray();
const hitP = new THREE.Vector3();
const blueprintCache = new Map();

function blueprint(type) {
  if (!blueprintCache.has(type)) {
    const def = getStructure(type);
    const intact = buildParts(def.parts);
    const damaged = buildParts(def.parts, { tint: DAMAGED_TINT, tilt: 0.18 });
    const box = new THREE.Box3();
    for (const p of intact.boxes) box.union(p.box.clone().applyMatrix4(p.matrix));
    const size = box.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z);
    blueprintCache.set(type, { def, intact, damaged, rubble: buildRubble(def.parts, footprint * 0.85, type.length), bounds: box, radius: Math.hypot(size.x, size.z) / 2, height: size.y });
  }
  return blueprintCache.get(type);
}

/**
 * All buildings of a mission: placed from mission sites and from the
 * theater's placement rules (generated per terrain chunk as the walker
 * explores). Gives walker collision, segment tests for projectiles and
 * sight lines, and damage with the stages intact → damaged → rubble.
 * Scatter objects (rocks, columns …) from ScatterField take part in
 * collision and blocking through the same queries.
 *
 * Events: 'world:structure' { id, type, name, stage } on every stage change.
 */
export class WorldObjects {
  constructor({ scene, sampler, mission, theater, bus, scatter = null, seed = 0, chunkSize = 160 }) {
    this.scene = scene;
    this.sampler = sampler;
    this.bus = bus;
    this.scatter = scatter;
    this.seed = seed;
    this.chunkSize = chunkSize;
    this.group = new THREE.Group();
    this.group.name = 'structures';
    scene.add(this.group);
    this.structures = [];
    this.grid = new Map();
    this.rules = theater.structureRules ?? [];
    this.rulesDone = new Set();
    this.fx = null; // CombatFx, set by the combat code (smoke/fire on damage)
    this.audio = null;
    this.keepClear = [
      { x: mission.playerStart.x, z: mission.playerStart.z, r: 150 },
      ...(mission.spawns ?? []).map((s) => ({ x: s.at[0], z: s.at[1], r: 40 })),
      ...(mission.navPoints ?? []).map((n) => ({ x: n.x, z: n.z, r: 30 })),
      ...(mission.sites ?? []).map((s) => ({ x: s.at[0], z: s.at[1], r: SITES[s.type].flatten.radius + 40 })),
    ];
    for (const site of mission.sites ?? []) this.placeSite(site);
    for (const item of mission.structures ?? []) this.add(item.type, item.at[0], item.at[1], item.rotation ?? 0, item.id);
  }

  placeSite(site) {
    const def = SITES[site.type];
    const rot = (site.rotation ?? 0) * DEG;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    def.items.forEach((it, i) => {
      const x = site.at[0] + it.at[0] * c + it.at[1] * s;
      const z = site.at[1] - it.at[0] * s + it.at[1] * c;
      this.add(it.s, x, z, (it.rot ?? 0) * DEG + rot, `${site.id ?? site.type}-${i}`);
    });
  }

  /** Places one structure (rot in radians). */
  add(type, x, z, rot = 0, id = null) {
    const bp = blueprint(type);
    const def = bp.def;
    // Sink into the ground on slopes: lowest point under the footprint
    let y = Infinity;
    const r = bp.radius * 0.6;
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) y = Math.min(y, this.sampler.heightAt(x + dx, z + dz));
    const st = {
      id: id ?? `${type}-${this.structures.length}`,
      type, def, x, y, z, rot, bp,
      hp: def.armor ?? Infinity,
      hpMax: def.armor ?? Infinity,
      core: def.structure ?? Infinity,
      stage: 'intact',
      destructible: def.destructible !== false,
      blocksSight: def.blocksSight !== false,
      emitting: !!def.emitting,
      isStructure: true,
    };
    st.matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    st.inverse = st.matrix.clone().invert();
    st.object = new THREE.Group();
    st.object.matrixAutoUpdate = false;
    st.object.matrix.copy(st.matrix);
    st.object.userData.structure = st;
    this.group.add(st.object);
    this.setView(st, 'intact');
    // World-space collision shapes
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    st.collide = (def.collide ?? []).map((sh) => ({
      ...sh,
      x: x + sh.at[0] * c + sh.at[1] * s,
      z: z - sh.at[0] * s + sh.at[1] * c,
      rot,
    }));
    st.radius = bp.radius;
    st.top = y + bp.height;
    // Minimal unit-like interface for homing missiles (anti-radar on emitters)
    st.wreck = null;
    st.volumes = {
      componentCenter: (c, out) => out.set(st.x, st.y + bp.height * 0.6, st.z),
      center: (out) => out.set(st.x, st.y + bp.height * 0.5, st.z),
    };
    this.structures.push(st);
    this.index(st);
    return st;
  }

  index(st) {
    const r = st.radius + 4;
    for (let cz = Math.floor((st.z - r) / CELL); cz <= Math.floor((st.z + r) / CELL); cz++) {
      for (let cx = Math.floor((st.x - r) / CELL); cx <= Math.floor((st.x + r) / CELL); cx++) {
        const key = `${cx},${cz}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(st);
      }
    }
  }

  setView(st, stage) {
    for (const child of [...st.object.children]) st.object.remove(child);
    const bp = st.bp;
    if (stage === 'rubble') {
      st.object.add(new THREE.Mesh(bp.rubble, litMaterial));
      return;
    }
    const set = stage === 'damaged' ? bp.damaged : bp.intact;
    if (set.geometry) st.object.add(new THREE.Mesh(set.geometry, litMaterial));
    if (set.glowGeometry) st.object.add(new THREE.Mesh(set.glowGeometry, glowMaterial));
  }

  // ---- placement rules (per terrain chunk) ----

  /** Generates rule-based structures for chunks around a point (once per chunk). */
  ensureAround(x, z, radiusChunks = 4) {
    if (!this.rules.length) return;
    const size = this.chunkSize;
    const ccx = Math.floor(x / size);
    const ccz = Math.floor(z / size);
    for (let j = -radiusChunks; j <= radiusChunks; j++) {
      for (let i = -radiusChunks; i <= radiusChunks; i++) this.ensureChunk(ccx + i, ccz + j);
    }
  }

  ensureChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.rulesDone.has(key)) return;
    this.rulesDone.add(key);
    const size = this.chunkSize;
    const roads = this.sampler.features.roadGrid();
    this.rules.forEach((rule, ri) => {
      const seed = this.seed + 3301 * (ri + 1);
      const n = rule.perChunk ?? 1;
      for (let k = 0; k < n; k++) {
        const r = (q) => hash2(cx * 7 + k, cz * 13 + q, seed);
        if (r(0) > rule.chance) continue;
        let x = (cx + 0.1 + r(1) * 0.8) * size;
        let z = (cz + 0.1 + r(2) * 0.8) * size;
        let rot = r(3) * Math.PI * 2;
        if (rule.align === 'blocks' && roads) {
          // Snap to the middle of a road block, square to the streets
          const g = roads.grid;
          x = roads.offX + (Math.floor((x - roads.offX) / g) + 0.5) * g + (r(4) - 0.5) * g * 0.25;
          z = roads.offZ + (Math.floor((z - roads.offZ) / g) + 0.5) * g + (r(5) - 0.5) * g * 0.25;
          rot = Math.floor(r(3) * 4) * Math.PI / 2;
        }
        if (!this.canPlace(rule, x, z)) continue;
        const types = Array.isArray(rule.type) ? rule.type : [rule.type];
        this.add(types[Math.floor(r(6) * types.length)], x, z, rot);
      }
    });
  }

  canPlace(rule, x, z) {
    const bp = blueprint(Array.isArray(rule.type) ? rule.type[0] : rule.type);
    for (const k of this.keepClear) if (Math.hypot(x - k.x, z - k.z) < k.r + bp.radius) return false;
    for (const s of this.near(x, z, bp.radius + 30)) if (Math.hypot(x - s.x, z - s.z) < s.radius + bp.radius + 8) return false;
    if (this.sampler.slopeAt(x, z) < (rule.minFlat ?? 0.9)) return false;
    const surf = this.sampler.surfaceAt(x, z);
    return surf !== 'water' && surf !== 'lava' && surf !== 'thinIce';
  }

  // ---- queries ----

  /** Structures whose grid cells touch a circle. */
  near(x, z, r = 0) {
    const out = new Set();
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
        for (const s of this.grid.get(`${cx},${cz}`) ?? []) out.add(s);
      }
    }
    return out;
  }

  /**
   * Pushes a walker (circle) out of buildings and big scatter objects.
   * Returns true if it collided (pos is corrected in place).
   */
  resolveWalker(pos, radius) {
    let hit = false;
    for (const s of this.near(pos.x, pos.z, radius + 30)) {
      if (s.stage === 'rubble') continue;
      for (const sh of s.collide) hit = pushOut(pos, radius, sh) || hit;
    }
    if (this.scatter) {
      for (const o of this.scatter.near(pos.x, pos.z, radius + 8)) {
        if (o.radius > 0) hit = pushOut(pos, radius, { circle: o.radius, x: o.x, z: o.z }) || hit;
      }
    }
    return hit;
  }

  /**
   * Segment p0→p1 against structures (and blocking scatter). Returns the
   * nearest { t, point, normal, structure | null, scatter | null, zone } or null.
   * sightOnly: only things that block sight (for lock/LOS).
   */
  segment(p0, p1, { sightOnly = false } = {}) {
    let best = null;
    const len = p0.distanceTo(p1);
    if (len < 1e-6) return null;
    const mx = (p0.x + p1.x) / 2;
    const mz = (p0.z + p1.z) / 2;
    const reach = len / 2 + 40;
    for (const s of this.nearSegment(p0, p1, reach, mx, mz)) {
      if (s.stage === 'rubble') continue;
      if (sightOnly && !s.blocksSight) continue;
      a.copy(p0).applyMatrix4(s.inverse);
      b.copy(p1).applyMatrix4(s.inverse);
      const boxes = s.stage === 'damaged' ? s.bp.damaged.boxes : s.bp.intact.boxes;
      for (const bx of boxes) {
        ray.origin.copy(a).applyMatrix4(bx.inverse);
        const end = b.clone().applyMatrix4(bx.inverse);
        ray.direction.subVectors(end, ray.origin);
        const segLen = ray.direction.length();
        if (segLen < 1e-6) continue;
        ray.direction.divideScalar(segLen);
        if (!ray.intersectBox(bx.box, hitP)) continue;
        const d = hitP.distanceTo(ray.origin);
        if (d > segLen) continue;
        const t = d / segLen;
        if (best && t >= best.t) continue;
        best = { t, structure: s, zone: bx.zone, localPoint: hitP.clone(), box: bx };
      }
    }
    if (this.scatter) {
      const hit = this.scatter.segment(p0, p1, sightOnly);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    if (best) {
      best.point = new THREE.Vector3().lerpVectors(p0, p1, best.t);
      best.normal = new THREE.Vector3().subVectors(p0, p1).normalize();
    }
    return best;
  }

  *nearSegment(p0, p1, reach, mx, mz) {
    // Long segments: walk the cells along the line instead of a huge circle
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    if (len < CELL * 2) {
      yield* this.near(mx, mz, reach);
      return;
    }
    const seen = new Set();
    const steps = Math.ceil(len / (CELL * 0.5));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      for (const s of this.near(p0.x + (p1.x - p0.x) * f, p0.z + (p1.z - p0.z) * f, CELL * 0.5 + 30)) {
        if (!seen.has(s)) {
          seen.add(s);
          yield s;
        }
      }
    }
  }

  /** Is the sight line between two points blocked by a building or big rock? */
  blocked(p0, p1) {
    return !!this.segment(p0, p1, { sightOnly: true });
  }

  // ---- damage ----

  /** Applies damage at a point; returns the stage change or null. */
  damage(st, amount) {
    if (!st.destructible || st.stage === 'rubble' || amount <= 0) return null;
    const from = st.stage;
    if (st.hp > 0) {
      const take = Math.min(st.hp, amount);
      st.hp -= take;
      amount -= take;
    }
    if (st.hp <= 0 && st.stage === 'intact') this.setStage(st, 'damaged');
    if (amount > 0) {
      st.core -= amount;
      if (st.core <= 0) this.setStage(st, 'rubble');
    }
    return st.stage !== from ? { from, to: st.stage } : null;
  }

  setStage(st, stage) {
    st.stage = stage;
    this.setView(st, stage);
    if (stage === 'rubble') {
      st.emitting = false;
      st.wreck = { kind: 'reactor' };
    }
    this.bus?.emit('world:structure', { id: st.id, type: st.type, name: st.def.name, stage });
    this.onStage?.(st, stage);
  }

  /** Hides far structures (cheap distance culling). */
  updateVisibility(x, z, maxDist) {
    let visible = 0;
    const m2 = maxDist * maxDist;
    for (const s of this.structures) {
      const dx = s.x - x;
      const dz = s.z - z;
      s.object.visible = dx * dx + dz * dz < (maxDist + s.radius) ** 2 || dx * dx + dz * dz < m2;
      if (s.object.visible) visible++;
    }
    this.visible = visible;
    return visible;
  }

  get stats() {
    return { total: this.structures.length, visible: this.visible ?? 0, rubble: this.structures.filter((s) => s.stage === 'rubble').length };
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

/** Pushes a circle (pos, radius) out of a box or circle shape. */
function pushOut(pos, radius, sh) {
  if (sh.circle !== undefined) {
    const dx = pos.x - sh.x;
    const dz = pos.z - sh.z;
    const d = Math.hypot(dx, dz);
    const min = sh.circle + radius;
    if (d >= min) return false;
    const k = d > 1e-4 ? (min - d) / d : 0;
    pos.x += d > 1e-4 ? dx * k : min;
    pos.z += dz * k;
    return true;
  }
  // Oriented box: to box space
  const c = Math.cos(sh.rot);
  const s = Math.sin(sh.rot);
  const dx = pos.x - sh.x;
  const dz = pos.z - sh.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const hx = sh.box[0] / 2;
  const hz = sh.box[1] / 2;
  const qx = Math.max(-hx, Math.min(hx, lx));
  const qz = Math.max(-hz, Math.min(hz, lz));
  let ox = lx - qx;
  let oz = lz - qz;
  let d = Math.hypot(ox, oz);
  if (d >= radius) return false;
  if (d < 1e-4) {
    // Centre inside the box: out through the nearest face
    const px = hx - Math.abs(lx);
    const pz = hz - Math.abs(lz);
    if (px < pz) {
      ox = Math.sign(lx) || 1;
      oz = 0;
      d = -px;
    } else {
      ox = 0;
      oz = Math.sign(lz) || 1;
      d = -pz;
    }
    const push = radius - d;
    const wx = ox * push;
    const wz = oz * push;
    pos.x += wx * c + wz * s;
    pos.z += -wx * s + wz * c;
    return true;
  }
  const push = (radius - d) / d;
  const wx = ox * push;
  const wz = oz * push;
  pos.x += wx * c + wz * s;
  pos.z += -wx * s + wz * c;
  return true;
}

export { STRUCTURES };
