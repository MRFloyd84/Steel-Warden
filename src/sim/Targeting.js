import * as THREE from 'three';
import { COMBAT } from '../data/combat.js';

const DEG = Math.PI / 180;
const to = new THREE.Vector3();
const end = new THREE.Vector3();

/**
 * Target lock for the player: only units inside the torso cone can be
 * locked. The lock holds while the target stays inside a slightly wider
 * cone and in sensor range; lockTime counts how long it has been held
 * (tracking missiles need their weapon's lockTime).
 */
export class Targeting {
  constructor() {
    this.target = null;
    this.lockTime = 0;
  }

  /** Units that may be locked, with their angle off the torso axis. */
  candidates(units, eye, aimDir, rangeFactor) {
    const out = [];
    const maxRange = COMBAT.targeting.maxRange * rangeFactor;
    for (const u of units) {
      if (u.isPlayer || u.wreck?.kind === 'reactor') continue;
      u.volumes.componentCenter('torso', to).sub(eye);
      const dist = to.length();
      if (dist > maxRange) continue;
      const angle = Math.acos(Math.min(1, to.dot(aimDir) / dist)) / DEG;
      if (angle <= COMBAT.targeting.coneDeg) out.push({ unit: u, dist, angle });
    }
    return out;
  }

  /** T: the unit under the crosshair, otherwise the one closest to the torso axis. */
  select(units, eye, aimDir, rangeFactor) {
    const list = this.candidates(units, eye, aimDir, rangeFactor);
    end.copy(eye).addScaledVector(aimDir, COMBAT.targeting.maxRange * rangeFactor);
    let best = null;
    for (const c of list) {
      const hit = c.unit.volumes.intersectSegment(eye, end, 1.5);
      if (hit && (!best || hit.t < best.t)) best = { unit: c.unit, t: hit.t };
    }
    const pick = best?.unit ?? list.sort((a, b) => a.angle - b.angle)[0]?.unit ?? null;
    this.setTarget(pick);
    return pick;
  }

  /** Shift+T: next candidate by angle. */
  cycle(units, eye, aimDir, rangeFactor) {
    const list = this.candidates(units, eye, aimDir, rangeFactor).sort((a, b) => a.angle - b.angle);
    if (!list.length) return this.setTarget(null);
    const i = list.findIndex((c) => c.unit === this.target);
    return this.setTarget(list[(i + 1) % list.length].unit);
  }

  setTarget(unit) {
    if (unit !== this.target) this.lockTime = 0;
    this.target = unit;
    return unit;
  }

  update(dt, eye, aimDir, rangeFactor) {
    const t = this.target;
    if (!t) return;
    if (t.wreck?.kind === 'reactor') {
      this.setTarget(null);
      return;
    }
    t.volumes.componentCenter('torso', to).sub(eye);
    const dist = to.length();
    const angle = Math.acos(Math.min(1, to.dot(aimDir) / dist)) / DEG;
    if (dist > COMBAT.targeting.maxRange * rangeFactor || angle > COMBAT.targeting.keepConeDeg) {
      this.setTarget(null);
      return;
    }
    this.distance = dist;
    if (angle <= COMBAT.targeting.coneDeg) this.lockTime += dt;
  }
}
