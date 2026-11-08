import { COMBAT, stageIndex } from '../data/combat.js';
import { CONFIG } from '../data/config.js';

const HEAVY = 3;
const DESTROYED = COMBAT.stages.length - 1;
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);

/**
 * Translates the state that already exists — damage (DamageModel), machinery (WalkerSystems,
 * player only), wreck/immobile/lost arms (CombatUnits) — into one set of functional values
 * 0..1. It reads, never writes: there is still exactly one damage simulation (DamageModel)
 * and one machinery simulation (WalkerSystems). Deterministic: no random numbers, no clock;
 * the only time is the damage model's own (disruption).
 *
 * Consumers (docs/AUDIT-0.5.0.md): motion limits (CombatUnits.applyLimits), weapons and
 * shields of the player (MissionCombat), target range and radar (sensorPerformance),
 * cockpit reactor stage and the critical alarm (CockpitHits).
 *
 * @param state {
 *   damage      DamageModel
 *   systems     WalkerSystems | null   (null: AI unit — machinery assumed running)
 *   wreck       { kind } | null
 *   immobile    bool                    (legs destroyed)
 *   lostArms    Set of 'armL' | 'armR'
 *   hardpoints  walker.hardpoints       (for weaponAvailability)
 * }
 */
export function evaluateCondition({ damage, systems = null, wreck = null, immobile = false, lostArms = null, hardpoints = [] }) {
  const parts = damage.parts;
  const torso = parts.torso;
  const reactorIntegrity = torso.maxInternal > 0 ? clamp01(torso.internal / torso.maxInternal) : 0;
  const reactorStage = torso.internal <= 0 ? DESTROYED : stageIndex(reactorIntegrity);
  const reactorAvailable = wreck?.kind === 'reactor' || torso.internal <= 0 ? 0 : 1;

  // Machinery (player); AI units have no cockpit and count as running
  let power = 1;
  let hydraulic = 1;
  let gyro = 1;
  let sensorLevel = 1;
  let systemsCanFire = true;
  let shieldsReady = true;
  let canMoveSys = true;
  let canTwistSys = true;
  let legsReleased = true;
  if (systems) {
    const s = systems.s;
    const cfg = systems.cfg;
    power = clamp01(s.reactor.power / cfg.reactor.fullPower);
    hydraulic = clamp01(s.hydraulics.pressure / cfg.hydraulics.readyPressure);
    gyro = clamp01(s.gyro.align);
    sensorLevel = s.power.bus ? clamp01(s.sensors.level) : 0;
    systemsCanFire = systems.canFire;
    shieldsReady = !!systems.flags.shieldsReady;
    const drive = systems.drive;
    canMoveSys = drive.canMove;
    canTwistSys = drive.canTwist;
    legsReleased = !drive.throttleLocked;
  }

  const legsStage = parts.legs.stage;
  const legsSpeed = legsStage >= HEAVY ? COMBAT.consequences.legsHeavySpeed : 1;
  const disrupted = damage.time < damage.disruptedUntil;
  const reactorOutput = power * reactorAvailable;
  const canMove = canMoveSys && !immobile && reactorAvailable > 0;

  const k = COMBAT.condition;
  const sensorDamage = COMBAT.consequences.sensorRange[parts.sensors.stage] ?? 0;
  const sensorPerformance = sensorDamage * sensorLevel * (disrupted ? COMBAT.consequences.disruptSensor : 1) * reactorAvailable;

  // Share of weapon hardpoints that are still on the walker
  const weaponHps = hardpoints.length;
  const lost = weaponHps ? hardpoints.filter((hp) => lostArms?.has(hp.location)).length : 0;

  return Object.freeze({
    reactorIntegrity,
    reactorStage,
    reactorAvailable,
    reactorOutput,
    drivePower: canMove ? reactorOutput * legsSpeed : 0,
    legsSpeed,
    hydraulicPower: immobile ? 0 : hydraulic,
    movementStability: immobile ? 0 : (k.legsStability[legsStage] ?? 0) * hydraulic * (1 - k.stabilityGyroShare + k.stabilityGyroShare * gyro),
    weaponStabilization: reactorAvailable * (1 - k.stabilizationGyroShare + k.stabilizationGyroShare * gyro),
    sensorPerformance,
    disrupted,
    weaponsOnline: systemsCanFire && reactorAvailable > 0,
    shieldsOnline: shieldsReady && reactorAvailable > 0,
    weaponAvailability: weaponHps ? (weaponHps - lost) / weaponHps : 0,
    canMove,
    canTwist: canTwistSys && reactorAvailable > 0,
    legsReleased,
    critical: reactorAvailable > 0 && reactorIntegrity <= CONFIG.hitFeedback.critical.torsoInternal,
  });
}

/** Condition of one combat unit (CombatUnits.prep); the player gets its WalkerSystems. */
export class MachineCondition {
  constructor(unit, systems = null) {
    this.unit = unit;
    this.systems = systems;
  }

  evaluate() {
    const u = this.unit;
    return evaluateCondition({
      damage: u.damage,
      systems: this.systems,
      wreck: u.wreck,
      immobile: u.immobile,
      lostArms: u.lostArms,
      hardpoints: u.walker.hardpoints,
    });
  }

  /** One line for the debug overlay. */
  debugLine() {
    const c = this.evaluate();
    const p = (v) => `${Math.round(v * 100)}`;
    return `Zustand: Reaktor ${p(c.reactorIntegrity)}% ${c.reactorAvailable ? 'verfügbar' : 'ZERSTÖRT'} Ausgang ${p(c.reactorOutput)}  Antrieb ${p(c.drivePower)}  Hydraulik ${p(c.hydraulicPower)}  `
      + `Stabil ${p(c.movementStability)}  Waffenstab ${p(c.weaponStabilization)}  Sensoren ${p(c.sensorPerformance)}${c.disrupted ? ' GESTÖRT' : ''}  `
      + `Waffen ${c.weaponsOnline ? 'an' : 'aus'} (${p(c.weaponAvailability)}%)  Schilde ${c.shieldsOnline ? 'an' : 'aus'}${c.critical ? '  KRITISCH' : ''}`;
  }
}
