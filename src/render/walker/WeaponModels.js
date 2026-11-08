import * as THREE from 'three';
import { colored, merge } from '../cockpit/geometry.js';
import { patchObjectMaterial } from '../DetailTextures.js';

const material = patchObjectMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { group: 'metal' });
const DEG = Math.PI / 180;
const DARK = '#25271f';
const METAL = '#6f736a';
const BODY = '#4a4d43';

const box = (w, h, d, x, y, z, c) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
const cyl = (r, len, z, c, seg = 8, x = 0, y = 0) => colored(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(x, y, z), c);

/**
 * Procedural low-poly weapon models. Each builder returns { parts, length }:
 * geometry points along -Z from the mount face (z = 0), the muzzle sits at z = -length.
 */
const BUILDERS = {
  laser: () => ({ length: 1.4, parts: [
    box(0.26, 0.24, 0.5, 0, 0, -0.25, BODY), cyl(0.07, 0.95, -0.95, METAL, 6),
    ...[0.6, 0.75, 0.9].map((z) => box(0.3, 0.05, 0.05, 0, 0, -z, DARK)), cyl(0.09, 0.08, -1.38, '#8a2a20', 6),
  ] }),
  beam: () => ({ length: 1.5, parts: [
    box(0.5, 0.42, 0.9, 0, 0, -0.45, BODY), cyl(0.15, 0.55, -1.15, METAL, 8),
    cyl(0.22, 0.08, -1.46, '#b23a2a', 10), box(0.54, 0.08, 0.6, 0, 0.24, -0.45, DARK),
  ] }),
  particle: () => ({ length: 2.4, parts: [
    box(0.8, 0.75, 1.2, 0, 0, -0.6, BODY), cyl(0.2, 1.3, -1.85, METAL, 8),
    ...[1.35, 1.7, 2.05].map((z) => cyl(0.32, 0.12, -z, '#3a5e8a', 10)), cyl(0.26, 0.1, -2.4, '#7ab8ff', 10),
  ] }),
  autocannon: () => ({ length: 2.4, parts: [
    box(0.5, 0.46, 0.9, 0, 0, -0.45, BODY), cyl(0.3, 0.32, -0.45, DARK, 10, 0.38, -0.05),
    cyl(0.09, 1.6, -1.65, METAL, 6), cyl(0.15, 0.25, -2.32, DARK, 6),
  ] }),
  railgun: () => ({ length: 3.6, parts: [
    box(0.7, 0.55, 1.1, 0, 0, -0.55, BODY), box(0.14, 0.2, 2.8, -0.2, 0, -2.2, METAL), box(0.14, 0.2, 2.8, 0.2, 0, -2.2, METAL),
    ...[1.4, 2.0, 2.6, 3.2].map((z) => box(0.62, 0.08, 0.1, 0, 0.16, -z, '#3a5e8a')), box(0.5, 0.06, 2.6, 0, -0.14, -2.1, DARK),
  ] }),
  shotgun: () => ({ length: 1.0, parts: [
    box(0.36, 0.3, 0.55, 0, 0, -0.27, BODY), cyl(0.15, 0.45, -0.77, METAL, 8), cyl(0.17, 0.06, -0.99, DARK, 8),
  ] }),
  rocketPod: () => ({ length: 0.6, parts: [
    box(0.55, 0.55, 0.6, 0, 0, -0.3, BODY),
    ...[[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].map(([x, y]) => cyl(0.09, 0.04, -0.61, DARK, 6, x, y)),
  ] }),
  missileBox: () => ({ length: 0.8, parts: [
    box(0.9, 0.7, 0.8, 0, 0, -0.4, BODY), box(0.94, 0.08, 0.84, 0, 0.36, -0.4, '#b8962e'),
    ...[-0.32, -0.11, 0.11, 0.32].flatMap((x) => [-0.14, 0.14].map((y) => cyl(0.08, 0.04, -0.81, DARK, 6, x, y))),
  ] }),
  speer: () => ({ length: 2.8, parts: [
    box(0.8, 0.8, 1.0, 0, 0, -0.5, BODY), cyl(0.36, 2.0, -1.8, BODY, 10), cyl(0.3, 0.06, -2.8, DARK, 10),
    box(0.84, 0.1, 0.6, 0, 0.42, -0.5, '#b8962e'),
  ] }),
  // Target pod: sensor box with a lens and a small antenna
  pod: () => ({ length: 0.7, parts: [
    box(0.32, 0.3, 0.6, 0, 0, -0.3, BODY), cyl(0.11, 0.06, -0.63, '#1c2a2a', 10), cyl(0.07, 0.04, -0.67, '#9fd8ff', 8),
    box(0.03, 0.35, 0.03, 0.1, 0.32, -0.15, METAL),
  ] }),
  // Synthesis: angular crystal housings
  crystalGun: () => ({ length: 1.6, parts: [
    box(0.4, 0.34, 0.7, 0, 0, -0.35, '#2b2442'),
    colored(new THREE.ConeGeometry(0.16, 1.0, 4).rotateX(-Math.PI / 2).translate(0, 0, -1.1), '#5ef2e6'),
    box(0.06, 0.4, 0.5, 0.2, 0.05, -0.4, '#6b55a0'),
  ] }),
  crystalLance: () => ({ length: 2.4, parts: [
    box(0.55, 0.45, 1.0, 0, 0, -0.5, '#2b2442'),
    colored(new THREE.ConeGeometry(0.22, 1.6, 4).rotateX(-Math.PI / 2).translate(0, 0, -1.6), '#8f6ef0'),
    box(0.7, 0.06, 0.6, 0, 0.26, -0.6, '#5ef2e6'),
  ] }),
  crystalPod: () => ({ length: 0.9, parts: [
    box(0.8, 0.6, 0.9, 0, 0, -0.45, '#2b2442'),
    ...[-0.22, 0, 0.22].map((x) => colored(new THREE.ConeGeometry(0.1, 0.25, 4).rotateX(-Math.PI / 2).translate(x, 0.05, -0.95), '#b48cff')),
  ] }),
  mortar: () => ({ length: 2.2, parts: [
    box(1.0, 0.9, 1.2, 0, 0, -0.4, '#2b2442'),
    cyl(0.32, 1.6, -1.4, '#3a2f55', 6, 0, 0.1),
    cyl(0.4, 0.12, -2.2, '#5ef2e6', 6, 0, 0.1),
  ] }),
  emp: () => {
    const dish = colored(new THREE.ConeGeometry(0.5, 0.35, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -1.35), '#8fa6b8');
    return { length: 1.5, parts: [box(0.5, 0.45, 0.8, 0, 0, -0.4, BODY), cyl(0.1, 0.5, -1.0, METAL, 6), dish, cyl(0.06, 0.25, -1.45, '#9fd8ff', 6)] };
  },
};

const cache = new Map();

function geometryFor(model) {
  if (!cache.has(model)) {
    const b = (BUILDERS[model] ?? BUILDERS.laser)();
    cache.set(model, { geometry: merge(b.parts), length: b.length });
  }
  return cache.get(model);
}

/**
 * Mounts the loadout's weapons on a WalkerModel. Each mounted weapon has a
 * muzzle Object3D at its front. Arm weapons are aimed by turning the whole
 * arm within the hardpoint's arc; torso weapons stay fixed.
 */
export class WeaponMounts {
  constructor(model, slots) {
    this.model = model;
    this.mounts = new Map();
    for (const slot of slots) {
      const m = model.hardpointMounts[slot.id];
      if (m.modelled) {
        // Detailed model: the weapon is part of the hull — muzzles sit at its barrels and
        // take turns (twin guns, launcher tubes); no extra weapon model
        const muzzles = m.muzzles.map((p) => {
          const o = new THREE.Object3D();
          o.position.copy(p);
          model.parts[m.part].add(o);
          return o;
        });
        this.mounts.set(slot.id, { slot, mesh: null, muzzle: muzzles[0], muzzles, next: 0, part: m.part });
        continue;
      }
      const { geometry, length } = geometryFor(slot.def.visual.model);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(m.local);
      mesh.userData.component = m.part === 'torso' ? 'torso' : m.part;
      mesh.userData.noHit = true; // hit zones come from the walker body
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0, -length);
      mesh.add(muzzle);
      model.parts[m.part].add(mesh);
      this.mounts.set(slot.id, { slot, mesh, muzzle, muzzles: [muzzle], next: 0, part: m.part });
    }
    this.arms = ['armL', 'armR'].map((key) => ({
      key,
      group: model.parts[key],
      arc: model.walker.hardpoints.find((hp) => hp.location === key)?.arc ?? { yaw: [0, 0], pitch: [0, 0] },
      rest: model.parts[key].position.clone(),
    }));
    this.tmp = new THREE.Vector3();
  }

  /** World position of a weapon's muzzle; `fire` steps to the next barrel (twin guns, tubes). */
  muzzleWorld(slotId, out, fire = false) {
    const m = this.mounts.get(slotId);
    let muzzle = m.muzzle;
    if (fire && m.muzzles.length > 1) {
      muzzle = m.muzzles[m.next];
      m.next = (m.next + 1) % m.muzzles.length;
    }
    muzzle.updateWorldMatrix(true, false);
    return muzzle.getWorldPosition(out);
  }

  /** Turns the arms toward a world point (within their arcs). */
  aimArms(point) {
    const torso = this.model.torso;
    torso.updateWorldMatrix(true, false);
    for (const arm of this.arms) {
      if (arm.group.parent !== torso) continue; // shot off
      const v = torso.worldToLocal(this.tmp.copy(point)).sub(arm.rest);
      let yaw = Math.atan2(-v.x, -v.z) / DEG;
      let pitch = Math.atan2(v.y, Math.hypot(v.x, v.z)) / DEG;
      yaw = Math.max(arm.arc.yaw[0], Math.min(arm.arc.yaw[1], yaw));
      pitch = Math.max(arm.arc.pitch[0], Math.min(arm.arc.pitch[1], pitch));
      arm.group.rotation.set(pitch * DEG, yaw * DEG, 0, 'YXZ');
    }
  }
}
