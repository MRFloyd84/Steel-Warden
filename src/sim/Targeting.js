import * as THREE from 'three';
import { COMBAT } from '../data/combat.js';
import { COMPONENTS } from './DamageModel.js';

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
    this.inCone = false; // inside the lock cone right now (semi-active guidance)
    this.component = 'torso'; // aim/homing component chosen with the target pod
    this.los = null; // (eye, point) → true if the sight line is free (terrain, buildings)
    this.hiddenFor = 0;
    this.rate = 1; // weather: lock builds up slower
  }

  /** Units that may be locked, with their angle off the torso axis. */
  candidates(units, eye, aimDir, rangeFactor) {
    const out = [];
    const maxRange = COMBAT.targeting.maxRange * rangeFactor;
    for (const u of units) {
      if (u.side !== 'enemy' || u.wreck?.kind === 'reactor') continue; // not the player, not its wingmen
      u.volumes.componentCenter('torso', to).sub(eye);
      const dist = to.length();
      if (dist > maxRange) continue;
      const angle = Math.acos(Math.min(1, to.dot(aimDir) / dist)) / DEG;
      if (angle <= COMBAT.targeting.coneDeg && (!this.los || this.los(eye, u.volumes.componentCenter('torso', end)))) out.push({ unit: u, dist, angle });
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
    if (unit !== this.target) {
      this.lockTime = 0;
      this.hiddenFor = 0;
      this.inCone = false;
      this.component = 'torso';
    }
    this.target = unit;
    return unit;
  }

  /** Tab with the target pod: next component of the target that still exists. */
  cycleComponent() {
    const t = this.target;
    if (!t) return null;
    const order = COMPONENTS.filter((c) => t.volumes.hasComponent(c));
    this.component = order[(order.indexOf(this.component) + 1) % order.length] ?? 'torso';
    return this.component;
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
    // Out of sight (behind a hill or building): no lock progress, lost after a while
    const visible = !this.los || this.los(eye, t.volumes.componentCenter('torso', end));
    this.hiddenFor = visible ? 0 : this.hiddenFor + dt;
    if (this.hiddenFor > COMBAT.targeting.hiddenGrace) {
      this.setTarget(null);
      return;
    }
    this.inCone = angle <= COMBAT.targeting.coneDeg && visible;
    if (this.inCone) this.lockTime += dt * this.rate;
    if (!t.volumes.hasComponent(this.component)) this.component = 'torso';
  }
}
