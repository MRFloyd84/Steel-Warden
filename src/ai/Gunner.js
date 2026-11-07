import * as THREE from 'three';
import { WeaponSystem } from '../sim/WeaponSystem.js';
import { velocityOf } from './AIController.js';
import { wrap } from './Perception.js';

const DEG = Math.PI / 180;
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

/**
 * Gun on a building (Synthesis defence spike, human gun turret in enemy
 * hands): sees all around within its range, turns its head at its turn
 * rate, leads and spreads by difficulty, fires from its muzzles in turn.
 * Silent once the building is rubble.
 */
export class Gunner {
  constructor({ st, gun, director, difficulty, objects }) {
    this.st = st;
    this.gun = gun;
    this.d = director;
    this.diff = difficulty;
    this.owner = { id: st.id, side: 'enemy', structure: st, isGun: true, walker: { name: st.def.name } };
    this.weapons = new WeaponSystem(
      { name: st.def.name, reactorOutput: 300, hardpoints: [{ id: 'G', location: 'torso', size: 'L', type: 'universal' }] },
      { loadout: { G: gun.weapon }, groups: { G: 1 }, chains: [{ name: 'G', weapons: ['G'], mode: 'salvo' }] },
    );
    this.slot = this.weapons.slots[0];
    if (gun.head) objects.makeTurning(st, gun.head);
    this.yaw = 0; // relative to the building
    this.pitch = 0;
    this.muzzleIndex = 0;
    this.contact = null; // { target, pos, vel, time, visible }
    this.senseT = Math.random() * 0.4;
    this.time = 0;
    this.fireReadyAt = 0;
    this.aimErr = new THREE.Vector3();
    this.aimErrT = 0;
    this.aimPoint = new THREE.Vector3();
    this.yawErr = Math.PI;
    this.dead = false;
    this.state = 'Wache';
  }

  get worldYaw() {
    return this.st.rot + this.yaw;
  }

  /** Muzzle i in world space (head turned). */
  muzzle(i, out) {
    const [mx, my, mz] = this.gun.muzzles[i % this.gun.muzzles.length];
    const y = this.worldYaw;
    const c = Math.cos(y);
    const s = Math.sin(y);
    return out.set(this.st.x + mx * c + mz * s, this.st.y + my, this.st.z - mx * s + mz * c);
  }

  update(dt) {
    const st = this.st;
    this.time += dt;
    if (this.dead) return;
    if (st.stage === 'rubble') {
      this.dead = true;
      this.state = 'zerstört';
      return;
    }
    if (this.d.frozen) return;
    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.4 + Math.random() * 0.1;
      this.sense();
    }
    const c = this.contact;
    if (c && this.time - c.time > 15) this.contact = null;
    let dist = Infinity;
    if (this.contact) {
      const pos = c.visible ? c.target.volumes.componentCenter('torso', v1) : v1.copy(c.pos);
      const vel = c.visible ? velocityOf(c.target, v2) : v2.set(0, 0, 0);
      const base = this.muzzle(0, new THREE.Vector3());
      dist = base.distanceTo(pos);
      const speed = this.slot.def.projectileSpeed || Infinity;
      this.aimPoint.copy(pos).addScaledVector(vel, (dist / speed) * this.diff.lead);
      this.aimErrT -= dt;
      if (this.aimErrT <= 0) {
        this.aimErrT = this.diff.reaction;
        const ang = (Math.random() - 0.5) * 2 * this.diff.spread * (this.gun.spread ?? 1) * DEG;
        const a = Math.random() * Math.PI * 2;
        this.aimErr.set(Math.cos(a) * ang, Math.sin(a) * ang * 0.5, Math.sin(a) * ang);
      }
      this.aimPoint.addScaledVector(this.aimErr, dist);
      const want = Math.atan2(-(this.aimPoint.x - st.x), -(this.aimPoint.z - st.z)) - st.rot;
      const step = this.gun.turnRate * DEG * dt;
      const delta = wrap(want - this.yaw);
      this.yaw += Math.max(-step, Math.min(step, delta));
      this.yawErr = Math.abs(wrap(want - this.yaw));
      this.state = c.visible ? 'Feuer' : 'Ziel verloren';
    } else {
      this.state = 'Wache';
      this.yaw += dt * 0.15; // slow watch sweep
    }
    st.headYaw = this.yaw;
    if (st.movers?.[this.gun.head]) st.movers[this.gun.head].yaw = this.yaw;
    if (st.head) st.head.rotation.y = this.yaw;

    const visible = !!this.contact?.visible;
    // Bursts: fire for burst[0] s, pause burst[1] s (guns would otherwise saw through anything)
    const [on, off] = this.gun.burst ?? [2, 1.5];
    const inBurst = (this.time % (on + off)) < on;
    const fire = visible && inBurst && this.time >= this.fireReadyAt && this.yawErr < 2.5 * DEG && dist < this.slot.def.range && !this.d.holdFire;
    this.weapons.update(dt, {
      canFire: true,
      power: 1,
      weaponShare: 0.5,
      all: fire,
      fire: (s, i) => {
        const origin = this.muzzle(this.muzzleIndex++, new THREE.Vector3());
        this.d.combat.fireFrom(this.owner, s, i, this.aimPoint, { origin });
      },
      beam: () => {},
    });
  }

  sense() {
    const range = this.gun.sight.range;
    const eye = this.muzzle(0, new THREE.Vector3());
    for (const h of this.d.hostilesOf(this.owner)) {
      const res = this.d.perception.look(eye, this.worldYaw, { range, coneDeg: 360 }, range * 1.4, h, this.st);
      if (!res) {
        if (this.contact?.target === h) this.contact.visible = false;
        continue;
      }
      const was = this.contact?.target === h && this.contact.visible;
      this.contact = {
        target: h,
        pos: h.volumes.componentCenter('torso', new THREE.Vector3()),
        vel: new THREE.Vector3(),
        time: this.time,
        visible: res === 'seen',
      };
      if (this.contact.visible && !was) this.fireReadyAt = this.time + this.gun.reaction + this.diff.reaction * 0.5;
      return;
    }
  }

  get debug() {
    return { state: this.state, target: this.contact ? this.contact.target.id : '-', sightRange: this.gun.sight.range * this.d.perception.rangeFactor(this.d.player), coneDeg: 360 };
  }
}
