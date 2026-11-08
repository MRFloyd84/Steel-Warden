import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildWalkerParts } from './WalkerBuilder.js';
import { findMuzzles } from './muzzleFinder.js';
import { WALKER_MESH_MOUNTS } from '../../data/walkerMeshes.js';

/**
 * Detailed walker models (assets/walkers/<geometry id>.glb, made by tools/import_walkers.py
 * from the Tripo exports): rigid segments with vertex colours plus the joints of the bind
 * pose. They are hung on the game's own rig — same groups, IK legs, torso twist and arm
 * aiming as the procedural models — so gait, hit zones, weapons and wrecks stay shared.
 *
 * A walker without a file (or with "Walker-Modelle: klassisch") keeps its procedural model.
 */
const FILES = import.meta.glob('../../../assets/walkers/*.glb', { query: '?inline', import: 'default', eager: true });

const library = new Map(); // geometry id → { segments: {name: geometry}, joints, tris }
const failed = [];
let readyPromise = null;
export const WALKER_MESH = { enabled: true };

function dataUrlToBuffer(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function loadWalkerMeshes() {
  readyPromise ??= Promise.all(Object.entries(FILES).map(async ([path, url]) => {
    const id = path.split('/').pop().replace('.glb', '');
    try {
      const gltf = await new Promise((res, rej) => new GLTFLoader().parse(dataUrlToBuffer(url), '', res, rej));
      const segments = {};
      let tris = 0;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        // COLOR_0 holds sRGB texture colours; the renderer works in linear
        const src = g.attributes.color;
        const col = new Float32Array(src.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < src.count; i++) {
          c.setRGB(src.getX(i), src.getY(i), src.getZ(i), THREE.SRGBColorSpace);
          col.set([c.r, c.g, c.b], i * 3);
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', g.attributes.position.clone());
        out.setAttribute('color', new THREE.BufferAttribute(col, 3));
        out.setIndex(g.index.clone());
        segments[o.name] = out;
        tris += g.index.count / 3;
      });
      const joints = Object.fromEntries(Object.entries(gltf.parser.json.scenes[0].extras.joints).map(([k, v]) => [k, new THREE.Vector3(...v)]));
      library.set(id, { segments, joints, tris });
    } catch (e) {
      failed.push(`${id} (${e.message ?? e})`);
    }
  })).then(() => {
    if (failed.length) console.warn('Walker-Modelle nicht geladen:', failed.join('; '));
  });
  return readyPromise;
}

export const WalkerMeshLibrary = {
  get failed() { return failed; },
  get loaded() { return library.size; },
  has: (id) => library.has(id),
  triangles: () => [...library.entries()].map(([id, e]) => [id, e.tris]).sort((a, b) => b[1] - a[1]),
};

/** Detailed model for a geometry id, or null (missing, not loaded, or switched off). */
export function walkerMesh(id) {
  return WALKER_MESH.enabled ? library.get(id) ?? null : null;
}

const avg = (a, b) => (a + b) / 2;

/**
 * Plan + geometries + mounts for a detailed model. `proc` is the procedural plan: its
 * mount layout is carried over (normalised within each part's bounds) so the weapon
 * hardpoints of data/walkers.js keep their meaning.
 */
export function buildMeshWalker(mesh, proc, walker) {
  const id = walker.geometry;
  const J = mesh.joints;
  const S = mesh.segments;
  const hipBind = avg(J.hipL.y, J.hipR.y);
  const thigh = avg(J.hipL.distanceTo(J.kneeL), J.hipR.distanceTo(J.kneeR));
  const shin = avg(J.kneeL.distanceTo(J.ankleL), J.kneeR.distanceTo(J.ankleR));
  const footH = Math.max(0.15, avg(J.ankleL.y, J.ankleR.y));
  // keep the knees a little bent so the IK has a direction to fold
  const hipHeight = Math.min(hipBind, footH + (thigh + shin) * 0.96);
  // knee behind the hip–ankle line (game forward is -Z) → bird legs
  const kneeBack = ['L', 'R'].map((s) => {
    const h = J[`hip${s}`];
    const a = J[`ankle${s}`];
    const k = J[`knee${s}`];
    const t = (h.y - k.y) / Math.max(1e-3, h.y - a.y);
    return k.z - (h.z + (a.z - h.z) * t);
  });
  const style = avg(...kneeBack) > 0.05 * thigh ? 'digitigrade' : proc.legs.style === 'insect' ? 'insect' : 'straight';
  const pivotBind = J.pivot.y;
  const plan = {
    ...proc,
    mesh: true,
    legs: {
      ...proc.legs, style, hipHeight, thigh, shin,
      hipWidth: avg(Math.abs(J.hipL.x), Math.abs(J.hipR.x)),
      foot: [proc.legs.foot[0], footH, proc.legs.foot[2]],
    },
    torso: { ...proc.torso, pivot: hipHeight + (pivotBind - hipBind) },
    arms: { ...proc.arms, shoulderL: [J.shoulderL.x, J.shoulderL.y - pivotBind, J.shoulderL.z], shoulderR: [J.shoulderR.x, J.shoulderR.y - pivotBind, J.shoulderR.z] },
  };

  const take = (name, fn) => {
    const g = S[name];
    if (!g) return null;
    const out = g.clone();
    fn(out);
    out.computeVertexNormals();
    out.computeBoundingBox();
    return out;
  };
  const shift = (v) => (g) => g.translate(-v.x, -v.y, -v.z);
  const geometries = {};
  const pelvisOrigin = new THREE.Vector3(0, hipBind, 0);
  const torsoOrigin = new THREE.Vector3(0, pivotBind, 0);
  geometries.pelvis = take('pelvis', shift(pelvisOrigin));
  geometries.pelvisGlow = take('pelvisGlow', shift(pelvisOrigin));
  for (const k of ['torso', 'sensors']) {
    geometries[k] = take(k, shift(torsoOrigin));
    geometries[`${k}Glow`] = take(`${k}Glow`, shift(torsoOrigin));
  }
  for (const [k, s] of [['armL', J.shoulderL], ['armR', J.shoulderR]]) {
    geometries[k] = take(k, shift(s));
    geometries[`${k}Glow`] = take(`${k}Glow`, shift(s));
  }
  // Legs: thigh/shin hang along -Y from their upper joint (util/ik.js orientSegment)
  const segFrame = (from, to) => (g) => {
    const by = new THREE.Vector3().subVectors(from, to).normalize();
    const bx = new THREE.Vector3(1, 0, 0).addScaledVector(by, -by.x).normalize();
    const bz = new THREE.Vector3().crossVectors(bx, by);
    const m = new THREE.Matrix4().makeBasis(bx, by, bz).setPosition(from).invert();
    g.applyMatrix4(m);
  };
  const legSides = ['L', 'R'].map((s) => {
    const parts = {
      thigh: take(`thigh${s}`, segFrame(J[`hip${s}`], J[`knee${s}`])),
      shin: take(`shin${s}`, segFrame(J[`knee${s}`], J[`ankle${s}`])),
      foot: take(`foot${s}`, shift(J[`ankle${s}`])),
    };
    // glow on the legs (Synthesis) rides with its segment
    for (const k of ['thigh', 'shin', 'foot']) {
      const glow = S[`${k}${s}Glow`];
      if (glow) parts[`${k}Glow`] = take(`${k}${s}Glow`, k === 'foot' ? shift(J[`ankle${s}`]) : segFrame(...(k === 'thigh' ? [J[`hip${s}`], J[`knee${s}`]] : [J[`knee${s}`], J[`ankle${s}`]])));
    }
    return parts;
  });
  geometries.legSides = legSides;

  // Mounts: procedural mount positions, normalised into each part's bounds
  const procParts = buildWalkerParts(proc, walker);
  const hardpointMounts = {};
  const boxOf = (g) => {
    if (!g) return null;
    g.computeBoundingBox();
    return g.boundingBox;
  };
  // origin of each attach part in model space (part-local = model − origin)
  const partOrigin = {
    torso: torsoOrigin, sensors: torsoOrigin, pelvis: pelvisOrigin,
    armL: J.shoulderL, armR: J.shoulderR,
  };
  const specs = WALKER_MESH_MOUNTS[id] ?? {};
  for (const hp of walker.hardpoints) {
    const spec = specs[hp.id];
    const found = spec ? findMuzzles(S, spec) : null;
    if (found) {
      // the weapon is modelled: muzzles at its barrels, no extra weapon model
      const o = partOrigin[spec.attach];
      const local = new THREE.Vector3(...found.centre).sub(o);
      const muzzles = found.muzzles.map((m) => new THREE.Vector3(...m).sub(o));
      hardpointMounts[hp.id] = { part: spec.attach === 'sensors' ? 'torso' : spec.attach, local, muzzles, modelled: true };
      continue;
    }
    if (spec) console.warn(`${id}: Waffe ${hp.id} nicht im Modell gefunden — Lage aus dem Bauplan`);
    const pm = procParts.hardpointMounts[hp.id];
    const from = boxOf(procParts.geometries[pm.part]);
    const to = boxOf(geometries[pm.part]) ?? boxOf(geometries.torso);
    const n = pm.local.clone().sub(from.min).divide(from.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-3, 1e-3, 1e-3)));
    n.clampScalar(0, 1);
    const local = to.min.clone().add(n.multiply(to.getSize(new THREE.Vector3())));
    local.z = Math.min(local.z, to.min.z + 0.25 * (to.max.z - to.min.z)); // weapons sit at the front
    hardpointMounts[hp.id] = { part: pm.part, local };
  }
  for (const g of Object.values(procParts.geometries)) {
    if (g?.isBufferGeometry) g.dispose();
    else if (g) for (const sub of Object.values(g)) sub.dispose();
  }
  return { plan, geometries, hardpointMounts };
}
