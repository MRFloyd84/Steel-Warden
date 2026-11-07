import * as THREE from 'three';
import { getWalkerModel } from '../../data/walkerModels.js';
import { buildWalkerParts } from './WalkerBuilder.js';
import { solveTwoBone, orientSegment } from '../../util/ik.js';

const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/**
 * A walker in the world, posed every frame from its (interpolated) motion
 * pose. Pelvis and torso follow the pose; the legs are solved with two-bone
 * IK onto feet that plant on the terrain (WalkerGait).
 *
 * Meshes carry userData.component (torso/armL/armR/sensors/legs) for hit zones.
 */
export class WalkerModel {
  constructor(walker, sampler, feel) {
    this.walker = walker;
    this.plan = getWalkerModel(walker.geometry);
    this.sampler = sampler;
    const { geometries, hardpointMounts } = buildWalkerParts(this.plan, walker);
    this.geometries = geometries;

    this.root = new THREE.Group();
    this.root.name = `walker:${walker.id}`;
    this.torso = new THREE.Group();
    this.torso.position.y = this.plan.torso.pivot - this.plan.legs.hipHeight;
    this.root.add(this.torso);

    const mesh = (geo, component, parent) => {
      if (!geo) return null;
      const m = new THREE.Mesh(geo, material);
      m.userData.component = component;
      parent.add(m);
      return m;
    };
    mesh(geometries.pelvis, 'legs', this.root);
    mesh(geometries.torso, 'torso', this.torso);
    mesh(geometries.sensors, 'sensors', this.torso);
    this.parts = { torso: this.torso };
    for (const [key, side] of [['armL', -1], ['armR', 1]]) {
      const g = new THREE.Group();
      const s = this.plan.arms.shoulder;
      g.position.set(s[0] * side, s[1], s[2]);
      mesh(geometries[key], key, g);
      this.torso.add(g);
      this.parts[key] = g;
    }

    // Legs live in world space (IK writes world transforms directly)
    this.legGroup = new THREE.Group();
    this.legs = [-1, 1].map((side) => ({
      side,
      thigh: mesh(geometries.legs.thigh, 'legs', this.legGroup),
      shin: mesh(geometries.legs.shin, 'legs', this.legGroup),
      foot: mesh(geometries.legs.foot, 'legs', this.legGroup),
      hip: new THREE.Vector3(),
      knee: new THREE.Vector3(),
      ankle: new THREE.Vector3(),
    }));

    this.hardpointMounts = hardpointMounts;
    this.gait = new WalkerGait(this.plan, sampler, feel.strideBase + walker.tonnage * feel.stridePerTon);
    this.eyeLocalY = walker.cockpit.eyeHeight - this.plan.torso.pivot;
    this.tmp = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), pole: new THREE.Vector3(), target: new THREE.Vector3() };
  }

  addTo(scene) {
    scene.add(this.root, this.legGroup);
  }

  setVisible(on) {
    this.root.visible = on;
    this.legGroup.visible = on;
  }

  /** Hardpoint position in model space at rest (for the hangar / weapon step). */
  hardpointLocal(id, out = new THREE.Vector3()) {
    const m = this.hardpointMounts[id];
    out.copy(m.local);
    this.root.updateMatrixWorld(true);
    this.parts[m.part].localToWorld(out);
    return this.root.worldToLocal(out);
  }

  /** @param pose interpolated WalkerMotion pose */
  update(pose, dt) {
    const plan = this.plan;
    const { fwd, right, pole, target } = this.tmp;
    const torsoY = pose.y - this.eyeLocalY;
    const hipY = torsoY - (plan.torso.pivot - plan.legs.hipHeight);

    this.root.position.set(pose.x, hipY, pose.z);
    this.root.rotation.set(0, pose.legYaw, 0);
    this.torso.rotation.set(pose.pitch, pose.yaw - pose.legYaw, pose.roll, 'YXZ');
    this.root.updateMatrixWorld(true);

    fwd.set(-Math.sin(pose.legYaw), 0, -Math.cos(pose.legYaw));
    right.set(Math.cos(pose.legYaw), 0, -Math.sin(pose.legYaw));
    pole.copy(fwd).multiplyScalar(plan.legs.style === 'digitigrade' ? -1 : 1);
    pole.y += 0.1;

    this.gait.update(pose, dt, fwd, right);
    const L = plan.legs;
    const footH = L.foot[1];
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      leg.hip.set(leg.side * L.hipWidth, 0, 0);
      this.root.localToWorld(leg.hip);
      target.copy(this.gait.feet[i].pos);
      target.y += footH;
      solveTwoBone(leg.hip, target, L.thigh, L.shin, pole, leg.knee, leg.ankle);
      orientSegment(leg.thigh, leg.hip, leg.knee, right);
      orientSegment(leg.shin, leg.knee, leg.ankle, right);
      leg.foot.position.copy(leg.ankle);
      leg.foot.rotation.set(0, pose.legYaw, 0);
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.legGroup.removeFromParent();
    for (const g of Object.values(this.geometries)) {
      if (!g) continue;
      if (g.isBufferGeometry) g.dispose();
      else for (const sub of Object.values(g)) sub.dispose();
    }
  }
}

/**
 * Foot placement. The motion's step phase drives the cycle: each foot
 * swings during its half of the cycle and stays planted (no sliding) during
 * the other half. Swing target: neutral foot spot plus half a stride ahead.
 */
export class WalkerGait {
  constructor(plan, sampler, stride) {
    this.plan = plan;
    this.sampler = sampler;
    this.stride = stride;
    this.feet = [0, 1].map(() => ({ pos: new THREE.Vector3(), start: new THREE.Vector3(), swinging: false, placed: false }));
    this.rest = new THREE.Vector3();
  }

  update(pose, dt, fwd, right) {
    const L = this.plan.legs;
    const dir = Math.sign(pose.speed) || 1;
    const motion = pose.motionAmount;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const side = i === 0 ? -1 : 1;
      this.rest.set(pose.x, 0, pose.z).addScaledVector(right, side * L.hipWidth * 1.05);
      if (!f.placed) {
        f.pos.copy(this.rest);
        f.placed = true;
      }
      const cycle = (((pose.stepPhase / Math.PI - i) % 2) + 2) % 2;
      const swinging = cycle < 1 && motion > 0.03;
      if (swinging) {
        if (!f.swinging) {
          f.start.copy(f.pos);
          f.swinging = true;
        }
        const e = cycle * cycle * (3 - 2 * cycle);
        const reach = this.stride * 0.5 * dir * Math.min(1, motion * 1.2);
        f.pos.copy(f.start).lerp(this.rest.addScaledVector(fwd, reach), e);
        f.pos.y = this.sampler.heightAt(f.pos.x, f.pos.z) - (pose.sink ?? 0) + Math.sin(Math.PI * cycle) * L.lift * motion;
      } else {
        f.swinging = false;
        if (motion <= 0.03) f.pos.lerp(this.rest, 1 - Math.exp(-3 * dt));
        f.pos.y = this.sampler.heightAt(f.pos.x, f.pos.z) - (pose.sink ?? 0);
      }
    }
  }
}
