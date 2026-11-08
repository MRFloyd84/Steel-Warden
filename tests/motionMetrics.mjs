/**
 * Reproducible motion measurements on flat, hard ground at 60 Hz (headless WalkerMotion).
 * Used by tests/motion.test.mjs and to fill the before/after tables in docs/MOTION-0.5.0.md:
 *   node tests/motionMetrics.mjs            → table for all six walkers
 *
 * limits: object merged into motion.limits every step (what SystemsLink + applyLimits set).
 */
import { WalkerMotion } from '../src/sim/WalkerMotion.js';
import { CONFIG } from '../src/data/config.js';
import { WALKERS, WALKER_ORDER } from '../src/data/walkers.js';
import { makePlayer, armourHit } from './helpers.mjs';

const DT = 1 / 60;
const FLAT = { heightAt: () => 0, surfaceAt: () => 'hard' };
const BUS = { emit() {} };
const DEG = Math.PI / 180;

export function makeMotion(id, limits = {}) {
  const m = new WalkerMotion(WALKERS[id], FLAT, CONFIG.feel, BUS);
  m.place(0, 0, 0);
  Object.assign(m.limits, limits);
  return m;
}

function step(m, input, limits) {
  Object.assign(m.limits, limits);
  m.update(DT, input);
}

/** Absolute throttle input (like a HOTAS axis). */
const throttle = (v) => ({ throttleRate: 0, throttleAbs: v, turn: 0 });

export function measure(id, limits = {}) {
  const w = WALKERS[id];
  const out = { id, tonnage: w.tonnage };
  // 1. full throttle from standstill: time to 90 % of the reachable speed
  let m = makeMotion(id, limits);
  let t = 0;
  let top = 0;
  for (; t < 30; t += DT) {
    step(m, throttle(1), limits);
    top = Math.max(top, m.speed);
  }
  out.topSpeed = top;
  m = makeMotion(id, limits);
  for (t = 0; t < 30 && m.speed < 0.9 * top; t += DT) step(m, throttle(1), limits);
  out.accelTime = t;
  // 2. from top speed to zero: stopping distance and time, torso pitch overshoot, settle time
  m = makeMotion(id, limits);
  for (t = 0; t < 30; t += DT) step(m, throttle(1), limits);
  const z0 = m.z;
  let stopT = 0;
  let maxPitch = 0;
  for (t = 0; m.speed > 0.01 && t < 30; t += DT) {
    step(m, throttle(0), limits);
    maxPitch = Math.max(maxPitch, Math.abs(m.pitchSpring.value));
  }
  stopT = t;
  out.stopTime = stopT;
  out.stopDistance = Math.abs(m.z - z0);
  let settle = 0;
  for (t = 0; t < 10; t += DT) {
    step(m, throttle(0), limits);
    maxPitch = Math.max(maxPitch, Math.abs(m.pitchSpring.value));
    if (Math.abs(m.pitchSpring.value) > 0.1 * DEG) settle = t;
  }
  out.brakePitchDeg = maxPitch / DEG;
  out.pitchSettle = settle;
  // 3. turning on the spot: time to 90 % of the turn rate, angle after 2 s
  m = makeMotion(id, limits);
  let prevYaw = m.legYaw;
  let reach = null;
  for (t = 0; t < 2; t += DT) {
    step(m, { throttleRate: 0, throttleAbs: null, turn: 1 }, limits);
    const rate = Math.abs(m.legYaw - prevYaw) / DT / DEG;
    prevYaw = m.legYaw;
    if (reach === null && rate >= 0.9 * w.turnRate * Math.min(1, m.limits.turnFactor ?? 1)) reach = t + DT;
  }
  out.turnResponse = reach ?? Infinity;
  out.turnAngle2s = Math.abs(m.legYaw) / DEG;
  // 4. cruising at full speed: roll sway and vertical head motion (unrest)
  m = makeMotion(id, limits);
  for (t = 0; t < 20; t += DT) step(m, throttle(1), limits);
  let roll = 0;
  let headY = 0;
  for (t = 0; t < 6; t += DT) {
    step(m, throttle(1), limits);
    roll = Math.max(roll, Math.abs(m.pose.roll));
    headY = Math.max(headY, Math.abs(m.pose.headY));
  }
  out.swayDeg = roll / DEG;
  out.headBob = headY;
  return out;
}

export function table(limits = {}, ids = WALKER_ORDER) {
  return ids.map((id) => measure(id, limits));
}

export function format(rows) {
  const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '∞');
  const head = '| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|';
  return [head, sep, ...rows.map((r) => `| ${r.id.toUpperCase()} | ${r.tonnage} | ${f(r.topSpeed)} | ${f(r.accelTime)} | ${f(r.stopDistance, 1)} | ${f(r.stopTime)} | ${f(r.brakePitchDeg)} | ${f(r.pitchSettle)} | ${f(r.turnResponse)} | ${f(r.turnAngle2s, 1)} | ${f(r.swayDeg)} | ${f(r.headBob, 3)} |`)].join('\n');
}

/** Motion limits as CombatUnits.applyLimits sets them (same fields, from the real condition). */
export function limitsOf(cond) {
  return { speedFactor: cond.drivePower, accelFactor: cond.driveAccel, stability: cond.movementStability, limp: cond.limp, canMove: cond.canMove };
}

/** Hot player in a named state → its machine condition (real WalkerSystems, DamageModel). */
export function scenario(id, name) {
  const p = makePlayer(id, { hot: true });
  const preset = { SCHILD: 0, AUSGL: 1, WAFFE: 2, ANTRIEB: 3 };
  const [energy, ...flags] = name.split('+');
  if (energy in preset) p.controls.setValue('energyPreset', preset[energy], 'system');
  if (flags.includes('gyroOff')) {
    p.systems.s.gyro.mode = 'off';
    p.systems.s.gyro.align = 0;
  }
  if (flags.includes('legsMedium') || flags.includes('legsHeavy')) {
    const l = p.unit.damage.parts.legs;
    p.unit.damage.applyHit(armourHit('legs', (l.maxArmor + l.maxInternal) * (flags.includes('legsHeavy') ? 0.8 : 0.5)));
  }
  for (let i = 0; i < 6; i++) p.systems.update(1 / 60);
  return { p, cond: p.unit.condition.evaluate() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2] ?? null;
  if (!name) console.log(format(table()));
  else console.log(format(WALKER_ORDER.map((id) => measure(id, limitsOf(scenario(id, name).cond)))));
}
