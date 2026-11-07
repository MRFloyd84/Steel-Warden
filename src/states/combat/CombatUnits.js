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

    this.player = this.prep(entities.player, true);
    this.player.id = 'player';
    this.units = [this.player];
    for (const u of entities.units) this.addUnit(u);
    entities.onAdd = (u) => this.addUnit(u);
    this.onAdd = null; // (unit) for later hooks (world obstacles, AI)
    this.onPlayerBlast = null; // (res, center) — cockpit reaction to a nearby reactor explosion
  }

  prep(u, isPlayer) {
    const w = u.walker;
    u.isPlayer = isPlayer;
    u.side = isPlayer ? 'player' : 'enemy';
    u.faction = w.faction ?? 'human';
    u.weapons = new WeaponSystem(w, { loadout: w.defaultLoadout, groups: w.defaultGroups, chains: w.defaultChains });
    u.mounts = new WeaponMounts(u.model, [...u.weapons.slots, ...u.weapons.equipment]);
    u.emitting = !!u.spawnEmitting; // radar emitting (player: SENSOREN switch; A4: radar mode)
    u.volumes = new HitVolumes(u.model);
    u.damage = new DamageModel(w);
    if (!isPlayer) u.damage.fillShields();
    u.wreck = null;
    u.immobile = false;
    u.lostArms = new Set();
    u.aimPoint = null; // AI: where the arms point
    return u;
  }

  /** Adds a (runtime) unit to combat. */
  addUnit(u) {
    if (this.units?.includes(u)) return u;
    this.prep(u, false);
    this.units.push(u);
    this.onAdd?.(u);
    return u;
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

  /**
   * Arm shot off: its weapons fail, the arm falls. The weapon survives on the
   * ground (marker, salvage) with the unit's weaponDropChance (human walkers: always).
   * blown: thrown off by the reactor explosion (flies further, survives half as often).
   */
  loseArm(unit, key, blown = false) {
    if (unit.lostArms.has(key)) return;
    unit.lostArms.add(key);
    unit.weapons?.disableLocation(key);
    const ids = unit.walker.hardpoints.filter((hp) => hp.location === key).map((hp) => unit.walker.defaultLoadout[hp.id]).filter(Boolean);
    const chance = (unit.walker.salvage?.weaponDropChance ?? 1) * (blown ? 0.5 : 1);
    const weaponIds = ids.filter(() => Math.random() < chance);
    unit.volumes.removeComponent(key);
    const arm = unit.model.parts[key];
    const vel = blown ? new THREE.Vector3((Math.random() - 0.5) * 24, 10 + Math.random() * 8, (Math.random() - 0.5) * 24) : null;
    this.fx.dropPart(arm, this.sampler, (pos) => {
      if (weaponIds.length) {
        this.fx.addMarker(pos);
        this.droppedWeapons.push({ unit: unit.id, weapons: weaponIds, position: pos, kind: 'weaponMount' });
      }
      this.audio.at('impact.partFall', pos);
    }, vel);
    this.fx.blast(arm.getWorldPosition(tmp), 3, 'blast');
    if (unit.faction === 'synth') this.fx.shards(tmp, 14);
    if (!blown) this.audio.at('impact.blast', tmp);
    this.bus.emit('combat:armLost', { unit: unit.id, arm: key, weapons: weaponIds });
  }

  /**
   * Legs destroyed: the walker slumps to its knees and can't move — an intact
   * wreck with full salvage value. Its weapons still work (AI fights on stationary).
   */
  loseLegs(unit) {
    if (unit.immobile) return;
    unit.immobile = true;
    const plan = getWalkerModel(unit.walker.geometry);
    unit.motion.setStanceRange(plan.legs.hipHeight * COMBAT.consequences.kneelDrop, COMBAT.consequences.kneelPitch);
    unit.motion.limits.stance = 0;
    unit.motion.limits.canMove = false;
    if (!unit.wreck) this.setWreck(unit, 'legs');
  }

  /**
   * Torso destroyed: the reactor goes up. Big explosion with blast damage to
   * every walker nearby (the player too), arms thrown off as debris, burnt-out
   * wreck with ~10 % salvage. Synthesis: crystal splinters.
   */
  explode(unit) {
    if (unit.wreck?.kind === 'reactor') return;
    this.loseLegs(unit);
    this.setWreck(unit, 'reactor');
    const center = unit.volumes.componentCenter('torso', new THREE.Vector3());
    const ex = COMBAT.explosion;
    const radius = ex.radius + unit.walker.tonnage * ex.radiusPerTon;
    const damage = ex.damage + unit.walker.tonnage * ex.damagePerTon;
    this.fx.explosion(center, unit.walker.cockpit.eyeHeight * 0.6);
    if (unit.faction === 'synth') this.fx.shards(center, 40, 2.2);
    this.audio.at('impact.explosion', center);
    this.onNoise?.(center, 1200, unit);
    for (const key of ['armL', 'armR']) if (unit.model.parts[key]?.parent === unit.model.torso) this.loseArm(unit, key, true);
    for (const o of [unit.model.root, unit.model.legGroup]) {
      o.traverse((m) => {
        if (m.isMesh && !m.userData.fx) m.material = wreckMaterial;
      });
    }
    unit.model.setGlow?.(0);
    const torsoVol = unit.volumes.volumes.find((v) => v.component === 'torso');
    if (torsoVol) {
      const local = torsoVol.box.getCenter(new THREE.Vector3());
      local.y = torsoVol.box.max.y;
      this.fx.addEmitter(torsoVol.mesh, local, 'fire', 8);
      this.fx.addEmitter(torsoVol.mesh, local, 'smoke', 4);
    }
    // Blast damage on walkers nearby (shields don't help against the shock wave)
    for (const other of this.units) {
      if (other === unit || other.wreck?.kind === 'reactor') continue;
      const d = other.volumes.center(tmp).distanceTo(center);
      if (d >= radius) continue;
      const amount = damage * (1 - d / radius);
      const changes = other.damage.applyRaw('torso', amount);
      this.apply(other, changes);
      if (other.isPlayer) this.onPlayerBlast?.({ shieldHit: false, armorHit: true, armorDamage: amount, changes }, center);
    }
    this.lastExplosion = { unit: unit.id, radius, damage, time: this.time };
  }

  setWreck(unit, kind) {
    const first = !unit.wreck;
    const scrap = Math.round((unit.walker.salvage?.scrap ?? unit.walker.tonnage * 4) * COMBAT.salvage[kind]);
    unit.wreck = { kind, time: this.time, salvage: COMBAT.salvage[kind], scrap };
    if (first && !unit.isPlayer) this.kills++;
    this.bus.emit('combat:wreck', { unit: unit.id, kind });
  }

  /** Wrecks for the debug overlay: id, kind, salvage value. */
  wreckLines() {
    return this.units.filter((u) => u.wreck && !u.isPlayer).map((u) => `${u.id} ${u.walker.name}: ${u.wreck.kind === 'legs' ? 'Beine' : 'Reaktor'} · Bergung ${Math.round(u.wreck.salvage * 100)} % = ${u.wreck.scrap} Schrott`);
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
      // Synthesis wrecks: the energy veins fade out slowly, splinters drop now and then
      if (u.wreck && u.faction === 'synth' && u.wreck.kind !== 'reactor') {
        const k = Math.max(0, 1 - (this.time - u.wreck.time) / COMBAT.synthGlowFade);
        if (k !== u.glowK) {
          u.glowK = k;
          u.model.setGlow?.(k);
          if (k > 0 && Math.random() < dt * 0.6 * k) this.fx.shards(u.volumes.center(tmp), 3, 0.6);
        }
      }
    }
  }
}
