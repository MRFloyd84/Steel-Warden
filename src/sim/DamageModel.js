import { COMBAT, stageIndex } from '../data/combat.js';

export const COMPONENTS = ['torso', 'armL', 'armR', 'legs', 'sensors'];
const SIDES = ['front', 'rear', 'left', 'right'];

/**
 * Armour, internal structure and shields of one walker; the damage pipeline.
 *
 *   hit → side (front/rear/left/right relative to the torso)
 *       → shield of that side absorbs damage × vsShield
 *       → the rest (converted back to raw damage) × vsArmor goes to the
 *         hit component's armour
 *       → with the armour gone, into the internal structure
 *         (torso: the reactor — torso destroyed = reactor explodes)
 *
 * Stage per component from the remaining share (data/combat.js).
 * Returns stage changes so the mission can apply consequences.
 */
export class DamageModel {
  constructor(walker) {
    this.walker = walker;
    const share = COMBAT.internalShare;
    this.parts = {};
    for (const c of COMPONENTS) {
      const armor = walker.armor[c];
      const internal = c === 'torso' ? walker.armor.reactor : armor * share;
      this.parts[c] = { armor, maxArmor: armor, internal, maxInternal: internal, stage: 0 };
    }
    const sh = walker.shields;
    this.designShare = sh.front / (sh.front + sh.rear);
    this.shiftLevel = 0;
    this.shields = { max: { ...sh }, value: { front: 0, rear: 0, left: 0, right: 0 } };
    delete this.shields.max.rechargeRate;
    this.rechargeRate = sh.rechargeRate;
    this.applyShift();
    this.lastHit = -Infinity;
    this.regenBlockedUntil = -Infinity;
    this.disruptedUntil = -Infinity;
    this.time = 0;
    this.stats = { hits: 0, shieldAbsorbed: 0, armorDamage: 0 };
  }

  /** Fills all shields (units that start powered). */
  fillShields() {
    for (const s of SIDES) this.shields.value[s] = this.shields.max[s];
  }

  get frontShare() {
    return Math.min(COMBAT.shields.maxShare, Math.max(COMBAT.shields.minShare, this.designShare + this.shiftLevel * COMBAT.shields.shiftStep));
  }

  /** Moves shield capacity between front and rear in steps; returns the new front share. */
  shiftShields(dir) {
    const max = COMBAT.shields.shiftSteps;
    this.shiftLevel = Math.max(-max, Math.min(max, this.shiftLevel + Math.sign(dir)));
    this.applyShift();
    return this.frontShare;
  }

  applyShift() {
    const sh = this.walker.shields;
    const total = sh.front + sh.rear;
    const v = this.shields.value;
    this.shields.max.front = total * this.frontShare;
    this.shields.max.rear = total * (1 - this.frontShare);
    v.front = Math.min(v.front, this.shields.max.front);
    v.rear = Math.min(v.rear, this.shields.max.rear);
  }

  /**
   * @param enabled  shields switched on and powered
   * @param rateFactor  recharge multiplier (reactor power × energy split)
   */
  updateShields(dt, enabled, rateFactor) {
    this.time += dt;
    const v = this.shields.value;
    const m = this.shields.max;
    if (!enabled) {
      for (const s of SIDES) v[s] = Math.max(0, v[s] - (m[s] / COMBAT.shields.offDecay) * dt);
      return;
    }
    if (this.time - this.lastHit < COMBAT.shields.regenDelay || this.time < this.regenBlockedUntil) return;
    const gain = this.rechargeRate * rateFactor * dt;
    for (const s of SIDES) v[s] = Math.min(m[s], v[s] + gain * (m[s] / m.front));
  }

  /**
   * hit: { component, side, damage, vsShield, vsArmor, effect }
   * Returns { shieldHit, armorHit, shieldDamage, armorDamage, changes: [{ component, from, to }] }
   */
  applyHit(hit) {
    const result = { shieldHit: false, armorHit: false, shieldDamage: 0, armorDamage: 0, changes: [] };
    this.lastHit = this.time;
    this.stats.hits++;
    // Practice option "Verwundbar: nein": hits flash on the shield, nothing is lost
    if (this.invulnerable) {
      result.shieldHit = true;
      return result;
    }

    if (hit.effect?.kind === 'emp') {
      for (const s of SIDES) this.shields.value[s] = 0;
      this.regenBlockedUntil = this.time + hit.effect.time;
      result.shieldHit = true;
      return result;
    }
    if (hit.effect?.kind === 'disrupt') this.disruptedUntil = this.time + hit.effect.time;

    let raw = hit.damage;
    if (raw <= 0) return result;
    const shield = this.shields.value[hit.side] ?? 0;
    if (shield > 0 && hit.vsShield > 0) {
      const eff = raw * hit.vsShield;
      const absorbed = Math.min(shield, eff);
      this.shields.value[hit.side] = shield - absorbed;
      this.stats.shieldAbsorbed += absorbed;
      result.shieldHit = true;
      result.shieldDamage = absorbed;
      raw = (eff - absorbed) / hit.vsShield;
    }
    if (raw <= 1e-6) return result;

    const part = this.parts[hit.component] ?? this.parts.torso;
    let dmg = raw * hit.vsArmor;
    this.stats.armorDamage += dmg;
    result.armorHit = true;
    result.armorDamage = dmg;
    const fromArmor = Math.min(part.armor, dmg);
    part.armor -= fromArmor;
    dmg -= fromArmor;
    if (dmg > 0) part.internal = Math.max(0, part.internal - dmg);
    this.restage(hit.component in this.parts ? hit.component : 'torso', result.changes);
    return result;
  }

  /** Direct damage to a component bypassing shields (blasts, explosions). */
  applyRaw(component, damage) {
    const changes = [];
    if (this.invulnerable) return changes;
    const part = this.parts[component];
    const fromArmor = Math.min(part.armor, damage);
    part.armor -= fromArmor;
    part.internal = Math.max(0, part.internal - (damage - fromArmor));
    this.restage(component, changes);
    return changes;
  }

  restage(component, changes) {
    const p = this.parts[component];
    const st = p.internal <= 0 ? COMBAT.stages.length - 1 : stageIndex(this.fraction(component));
    if (st !== p.stage) {
      changes.push({ component, from: p.stage, to: st });
      p.stage = st;
    }
  }

  fraction(component) {
    const p = this.parts[component];
    return (p.armor + p.internal) / (p.maxArmor + p.maxInternal);
  }

  stage(component) {
    return this.parts[component].stage;
  }

  isDestroyed(component) {
    return this.parts[component].stage === COMBAT.stages.length - 1;
  }

  shieldFraction(side) {
    const m = this.shields.max[side];
    return m > 0 ? this.shields.value[side] / m : 0;
  }
}

const DEG = Math.PI / 180;

/**
 * Which side of a walker a shot comes from.
 * @param torsoYaw  target torso yaw (rad), @param dir  shot travel direction (unit vector)
 */
export function hitSide(torsoYaw, dir) {
  // Vector from target towards the shooter = -dir, in the torso frame
  const fx = -Math.sin(torsoYaw);
  const fz = -Math.cos(torsoYaw);
  const rx = Math.cos(torsoYaw);
  const rz = -Math.sin(torsoYaw);
  const local = Math.atan2(-dir.x * rx - dir.z * rz, -dir.x * fx - dir.z * fz) / DEG;
  const lim = COMBAT.sideAngle;
  if (Math.abs(local) <= lim) return 'front';
  if (Math.abs(local) >= 180 - lim) return 'rear';
  return local > 0 ? 'right' : 'left';
}
