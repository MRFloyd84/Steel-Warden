import * as THREE from 'three';
import { HitVolumes } from '../../sim/HitVolumes.js';
import { DamageModel } from '../../sim/DamageModel.js';
import { WeaponMounts } from '../../render/walker/WeaponModels.js';
import { WeaponSystem } from '../../sim/WeaponSystem.js';
import { getWalkerModel } from '../../data/walkerModels.js';
import { COMBAT } from '../../data/combat.js';

const DESTROYED = COMBAT.stages.length - 1;
const MEDIUM = 2;
const HEAVY = 3;
const wreckMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: '#3c3833' });
const tmp = new THREE.Vector3();

/**
 * Adds combat state to every walker of the mission (player and spawned
 * units): hit volumes, damage model, mounted weapons (factory loadout) and
 * for the player the weapon system. Applies the consequences of component
 * damage to model, motion and weapons.
 *
 * unit.wreck = { kind: 'legs' | 'reactor', time } once it is out of action;
 * droppedWeapons collects weapons lying on the ground ('weaponMount').
 */
export class CombatUnits {
  constructor({ entities, fx, audio, bus, sampler }) {
    this.fx = fx;
    this.audio = audio;
    this.bus = bus;
    this.sampler = sampler;
    this.droppedWeapons = [];
    this.kills = 0;
    this.time = 0;

    const prep = (u, isPlayer) => {
      const w = u.walker;
      u.isPlayer = isPlayer;
      const ws = new WeaponSystem(w, { loadout: w.defaultLoadout, groups: w.defaultGroups, chains: w.defaultChains });
      u.mounts = new WeaponMounts(u.model, [...ws.slots, ...ws.equipment]);
      u.emitting = !!u.spawnEmitting; // radar emitting (A4 sets this from the radar mode)
      if (isPlayer) u.weapons = ws;
      u.volumes = new HitVolumes(u.model);
      u.damage = new DamageModel(w);
      if (!isPlayer) u.damage.fillShields();
      u.wreck = null;
      u.immobile = false;
      u.lostArms = new Set();
      return u;
    };
    this.player = prep(entities.player, true);
    this.player.id = 'player';
    this.units = [this.player, ...entities.units.map((u) => prep(u, false))];
  }

  /** Units that projectiles can hit. */
  get all() {
    return this.units;
  }

  get enemies() {
    return this.units.filter((u) => !u.isPlayer);
  }

  /** Applies stage changes from a hit. */
  apply(unit, changes) {
    for (const ch of changes) {
      this.bus.emit('combat:stage', { unit: unit.id, component: ch.component, from: ch.from, to: ch.to });
      if (ch.to >= MEDIUM) this.addDamageFx(unit, ch.component, ch.to);
      if (ch.to !== DESTROYED) continue;
      if (ch.component === 'armL' || ch.component === 'armR') this.loseArm(unit, ch.component);
      if (ch.component === 'legs') this.loseLegs(unit);
      if (ch.component === 'torso') this.explode(unit);
    }
  }

  addDamageFx(unit, component, stage) {
    const v = unit.volumes.volumes.find((x) => x.component === component);
    if (!v) return;
    const local = v.box.getCenter(new THREE.Vector3());
    this.fx.addEmitter(v.mesh, local, 'smoke', stage >= HEAVY ? 3 : 1.2);
    if (stage >= HEAVY) this.fx.addEmitter(v.mesh, local, 'sparks', 5);
  }

  /** Arm shot off: its weapons fail, the arm falls, the weapon stays on the ground as a marker. */
  loseArm(unit, key) {
    if (unit.lostArms.has(key)) return;
    unit.lostArms.add(key);
    unit.weapons?.disableLocation(key);
    const weaponIds = unit.walker.hardpoints.filter((hp) => hp.location === key).map((hp) => unit.walker.defaultLoadout[hp.id]).filter(Boolean);
    unit.volumes.removeComponent(key);
    const arm = unit.model.parts[key];
    this.fx.dropPart(arm, this.sampler, (pos) => {
      this.fx.addMarker(pos);
      this.droppedWeapons.push({ unit: unit.id, weapons: weaponIds, position: pos, kind: 'weaponMount' });
      this.audio.at('impact.partFall', pos);
    });
    this.fx.blast(arm.getWorldPosition(tmp), 3, 'blast');
    this.audio.at('impact.blast', tmp);
    this.bus.emit('combat:armLost', { unit: unit.id, arm: key, weapons: weaponIds });
  }

  /** Legs destroyed: the walker kneels down and can't move — full salvage value. */
  loseLegs(unit) {
    if (unit.immobile) return;
    unit.immobile = true;
    const plan = getWalkerModel(unit.walker.geometry);
    unit.motion.setStanceRange(plan.legs.hipHeight * COMBAT.consequences.kneelDrop, COMBAT.consequences.kneelPitch);
    unit.motion.limits.stance = 0;
    unit.motion.limits.canMove = false;
    if (!unit.wreck) this.setWreck(unit, 'legs');
  }

  /** Torso destroyed: the reactor goes up. Burnt-out wreck, ~10 % salvage. */
  explode(unit) {
    if (unit.wreck?.kind === 'reactor') return;
    this.loseLegs(unit);
    this.setWreck(unit, 'reactor');
    const center = unit.volumes.componentCenter('torso', new THREE.Vector3());
    this.fx.explosion(center, unit.walker.cockpit.eyeHeight * 0.6);
    this.audio.at('impact.explosion', center);
    for (const o of [unit.model.root, unit.model.legGroup]) {
      o.traverse((m) => {
        if (m.isMesh && !m.userData.fx) m.material = wreckMaterial;
      });
    }
    const torsoVol = unit.volumes.volumes.find((v) => v.component === 'torso');
    if (torsoVol) {
      const local = torsoVol.box.getCenter(new THREE.Vector3());
      local.y = torsoVol.box.max.y;
      this.fx.addEmitter(torsoVol.mesh, local, 'fire', 8);
      this.fx.addEmitter(torsoVol.mesh, local, 'smoke', 4);
    }
    // Blast damage on walkers nearby
    const ex = COMBAT.explosion;
    for (const other of this.units) {
      if (other === unit || other.wreck?.kind === 'reactor') continue;
      const d = other.volumes.center(tmp).distanceTo(center);
      if (d < ex.radius) this.apply(other, other.damage.applyRaw('torso', ex.damage * (1 - d / ex.radius)));
    }
  }

  setWreck(unit, kind) {
    const first = !unit.wreck;
    unit.wreck = { kind, time: this.time, salvage: COMBAT.salvage[kind] };
    if (first && !unit.isPlayer) this.kills++;
    this.bus.emit('combat:wreck', { unit: unit.id, kind });
  }

  /** Movement limits from damage (call after SystemsLink set the system limits). */
  applyLimits(unit) {
    const lim = unit.motion.limits;
    if (!unit.isPlayer) lim.speedFactor = 1; // the player's base comes from SystemsLink each step
    if (unit.damage.stage('legs') >= HEAVY) lim.speedFactor *= COMBAT.consequences.legsHeavySpeed;
    if (unit.immobile) {
      lim.canMove = false;
      lim.stance = 0;
    }
  }

  update(dt, playerShield) {
    this.time += dt;
    for (const u of this.units) {
      if (u.isPlayer) u.damage.updateShields(dt, playerShield.enabled, playerShield.rate);
      else u.damage.updateShields(dt, u.wreck?.kind !== 'reactor', 1);
      if (!u.isPlayer) this.applyLimits(u);
    }
  }
}
