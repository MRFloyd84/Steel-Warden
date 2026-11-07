import * as THREE from 'three';
import { SCATTER_MODELS } from '../../data/structures.js';
import { buildParts, buildProxy } from './PartBuilder.js';
import { patchObjectMaterial } from '../DetailTextures.js';

const litMaterial = patchObjectMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();

/** Heights of the scatter models at scale 1 (for sight/projectile tests). */
export function scatterHeights() {
  const out = {};
  for (const [id, m] of Object.entries(SCATTER_MODELS)) {
    const box = new THREE.Box3();
    for (const b of buildParts(m.parts, { mat: m.mat }).boxes) box.union(b.box.clone().applyMatrix4(b.matrix));
    out[id] = box.max.y;
  }
  return out;
}

/**
 * Draws the scatter objects with one InstancedMesh per model and detail
 * level: full model up close, a one-box stand-in further out, nothing
 * beyond the view distance. Refilled when the focus has moved far enough.
 */
export class ScatterRenderer {
  constructor(scene, field, models, { nearDistance = 200, viewDistance = 520, capacity = 2500 } = {}) {
    this.scene = scene;
    this.field = field;
    this.nearDistance = nearDistance;
    this.viewDistance = viewDistance;
    this.group = new THREE.Group();
    this.group.name = 'scatter';
    scene.add(this.group);
    this.sets = new Map();
    for (const id of models) {
      const def = SCATTER_MODELS[id];
      const built = buildParts(def.parts, { mat: def.mat });
      const mk = (geometry, material) => {
        if (!geometry) return null;
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      };
      this.sets.set(id, {
        near: mk(built.geometry, litMaterial),
        nearGlow: mk(built.glowGeometry, glowMaterial),
        far: mk(buildProxy(def.parts), def.parts.some((p) => p.glow) ? glowMaterial : litMaterial),
      });
    }
    this.lastX = Infinity;
    this.lastZ = Infinity;
    this.visible = 0;
    this.total = 0;
  }

  update(x, z) {
    if (Math.hypot(x - this.lastX, z - this.lastZ) < 30) return;
    this.lastX = x;
    this.lastZ = z;
    for (const s of this.sets.values()) for (const m of [s.near, s.nearGlow, s.far]) if (m) m.count = 0;
    let visible = 0;
    const near2 = this.nearDistance ** 2;
    const view2 = this.viewDistance ** 2;
    for (const o of this.field.near(x, z, this.viewDistance)) {
      const d2 = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (d2 > view2) continue;
      const set = this.sets.get(o.model);
      if (!set) continue;
      m4.compose(pos.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.rot), scl.setScalar(o.scale));
      const list = d2 < near2 ? [set.near, set.nearGlow] : [set.far];
      for (const mesh of list) {
        if (!mesh || mesh.count >= mesh.instanceMatrix.count) continue;
        mesh.setMatrixAt(mesh.count++, m4);
      }
      visible++;
    }
    for (const s of this.sets.values()) for (const m of [s.near, s.nearGlow, s.far]) if (m) m.instanceMatrix.needsUpdate = true;
    this.visible = visible;
    this.total = this.field.generated;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const s of this.sets.values()) for (const m of [s.near, s.nearGlow, s.far]) m?.geometry.dispose();
  }
}
