/**
 * Phase 2.1 (docs/VALIDATION-0.5.0.md): energy split on acceleration, drive overload heat,
 * recoil under sustained fire. Headless, deterministic, real WalkerMotion / WalkerSystems.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALKERS, WALKER_ORDER } from '../src/data/walkers.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ENERGY_PRESETS, DRIVE_ENERGY, driveEnergyFactor, driveAccelFactor } from '../src/data/systems.js';
import { recoilImpulse } from '../src/sim/MachineCondition.js';
import { makeMotion, measure, scenario, limitsOf } from './motionMetrics.mjs';

const DT = 1 / 60;
const DEG = Math.PI / 180;
const throttle = (v) => ({ throttleRate: 0, throttleAbs: v, turn: 0 });

// ---- 1. energy split: acceleration ----

test('drive energy acts more on acceleration than on top speed', () => {
  const k = DRIVE_ENERGY;
  for (const name of Object.keys(ENERGY_PRESETS)) {
    const s = driveEnergyFactor(ENERGY_PRESETS[name]);
    const a = driveAccelFactor(ENERGY_PRESETS[name]);
    assert.ok(s >= k.min && s <= k.max, `${name} speed ${s}`);
    assert.ok(a >= k.accel.min && a <= k.accel.max, `${name} accel ${a}`);
    assert.ok(Math.abs(a - 1) >= Math.abs(s - 1), `${name}: accel ${a} moves at least as far as speed ${s}`);
  }
  assert.equal(driveAccelFactor(ENERGY_PRESETS.AUSGL), 1);
});

test('time to 90 % top speed now follows the energy split (all six walkers)', () => {
  for (const id of WALKER_ORDER) {
    const t = Object.fromEntries(['SCHILD', 'AUSGL', 'ANTRIEB'].map((p) => [p, measure(id, limitsOf(scenario(id, p).cond)).accelTime]));
    assert.ok(t.ANTRIEB < t.AUSGL - 0.3, `${id}: ANTRIEB ${t.ANTRIEB} < AUSGL ${t.AUSGL}`);
    assert.ok(t.SCHILD > t.AUSGL + 0.3, `${id}: SCHILD ${t.SCHILD} > AUSGL ${t.AUSGL}`);
  }
});

test('braking does not depend on the energy split', () => {
  for (const id of ['kestrel', 'koloss']) {
    const decel = (preset) => {
      const lim = limitsOf(scenario(id, preset).cond);
      const m = makeMotion(id, lim);
      for (let i = 0; i < 20 * 60; i++) m.update(DT, throttle(1));
      const v0 = m.speed;
      for (let i = 0; i < 30; i++) m.update(DT, throttle(0));
      return (v0 - m.speed) / (30 * DT);
    };
    const a = decel('SCHILD');
    const b = decel('ANTRIEB');
    assert.ok(Math.abs(a - b) < 1e-9, `${id}: ${a} vs ${b}`);
  }
});

// ---- 2. drive overload heat ----

/** Hot player + motion driven together like MissionState (SystemsLink sets the overload). */
function drive(id, preset, throttleOf, seconds) {
  const { p } = scenario(id, preset);
  const m = makeMotion(id);
  let overload = 0;
  for (let i = 0; i < seconds * 60; i++) {
    p.systems.setDriveOverload(m.driveOverload);
    p.systems.update(DT);
    Object.assign(m.limits, p.systems.drive, limitsOf(p.unit.condition.evaluate()));
    m.update(DT, throttle(throttleOf(i * DT)));
    overload += m.driveOverload;
  }
  return { p, m, overload: overload / (seconds * 60), r: p.systems.s.reactor };
}

test('no drive heat from the switch position alone: standing or nominal pace with ANTRIEB', () => {
  for (const id of ['kestrel', 'bastion', 'koloss']) {
    const ref = drive(id, 'AUSGL', () => 0, 60);
    const stand = drive(id, 'ANTRIEB', () => 0, 60);
    assert.equal(stand.overload, 0, `${id} standing`);
    assert.equal(stand.r.driveRate, 0);
    assert.equal(stand.r.temp, ref.r.temp, `${id}: same temperature as AUSGL`);
    // walking at 80 % of the nominal top speed: no overload once it has reached its pace
    const walk = drive(id, 'ANTRIEB', () => 0.8 * driveEnergyFactor(ENERGY_PRESETS.AUSGL) / driveEnergyFactor(ENERGY_PRESETS.ANTRIEB), 30);
    assert.equal(walk.m.driveOverload, 0, `${id} walking`);
    // AUSGL never overloads, even at full throttle
    assert.equal(drive(id, 'AUSGL', () => 1, 30).overload, 0, `${id} AUSGL full`);
  }
});

test('extra drive power actually used heats the reactor on its own channel, bounded', () => {
  const k = WALKERS.kestrel;
  const ref = drive('kestrel', 'AUSGL', () => 1, 180);
  const hot = drive('kestrel', 'ANTRIEB', () => 1, 180);
  assert.ok(hot.m.speed > k.maxSpeed, 'faster than nominal');
  assert.equal(hot.m.driveOverload, 1);
  assert.equal(hot.r.driveRate, hot.p.systems.cfg.reactor.driveOverloadHeat);
  assert.ok(hot.r.temp > ref.r.temp + 15, `${hot.r.temp} vs ${ref.r.temp}`);
  assert.ok(hot.r.temp < hot.p.systems.cfg.reactor.warnTemp, 'drive alone does not reach the heat warning');
  // not weapon heat: weapon channels and display untouched
  assert.equal(hot.r.pendingHeat, 0);
  assert.equal(hot.r.weaponHeatRate, 0);
});

test('drive heat is counted once: one step adds exactly driveRate × dt', () => {
  const a = scenario('bastion', 'ANTRIEB').p;
  const b = scenario('bastion', 'ANTRIEB').p;
  for (let i = 0; i < 600; i++) {
    a.systems.update(DT);
    b.systems.update(DT);
  }
  const t0 = a.systems.s.reactor.temp;
  assert.equal(t0, b.systems.s.reactor.temp);
  a.systems.setDriveOverload(1);
  b.systems.setDriveOverload(0);
  a.systems.update(DT);
  b.systems.update(DT);
  const diff = a.systems.s.reactor.temp - b.systems.s.reactor.temp;
  assert.ok(Math.abs(diff - a.systems.cfg.reactor.driveOverloadHeat * DT) < 1e-9, `diff ${diff}`);
  // weapon heat still arrives through its own channel on top
  a.systems.addWeaponHeat(1);
  b.systems.addWeaponHeat(1);
  a.systems.update(DT);
  b.systems.update(DT);
  assert.ok(a.systems.s.reactor.weaponHeatRate === b.systems.s.reactor.weaponHeatRate);
});

// ---- 3. recoil under sustained fire ----

function fire(id, weapon, preset, seconds = 20, after = 5) {
  const cond = scenario(id, preset).cond;
  const lim = limitsOf(cond);
  const m = makeMotion(id, lim);
  const def = WEAPONS[weapon];
  const imp = recoilImpulse(def, WALKERS[id].tonnage, cond.weaponStabilization);
  const trace = [];
  let next = 0;
  for (let i = 0; i < seconds * 60; i++) {
    if (i * DT >= next) {
      m.recoil(imp, cond.weaponStabilization);
      next += 1 / def.fireRate;
    }
    m.update(DT, throttle(0));
    trace.push(m.pitchSpring.value / DEG);
  }
  const fired = trace.length;
  for (let i = 0; i < after * 60; i++) {
    m.update(DT, throttle(0));
    trace.push(m.pitchSpring.value / DEG);
  }
  const span = (a, b) => trace.slice(a * 60, b * 60);
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const peak = (xs) => Math.max(...xs.map(Math.abs));
  return { trace, fired, mean, peak, span, end: trace[trace.length - 1] };
}

test('sustained fire (RK-30, AK-20): bounded, no build-up, no lasting torso pitch with gyro', () => {
  for (const [id, wpn] of [['koloss', 'rk-30'], ['bastion', 'rk-30'], ['kestrel', 'ak-20']]) {
    const r = fire(id, wpn, 'AUSGL');
    const first = r.peak(r.span(0, 10));
    const last = r.peak(r.span(10, 20));
    assert.ok(last <= first * 1.05, `${id} ${wpn}: no build-up (${last} vs ${first})`);
    assert.ok(first < 0.5, `${id} ${wpn}: bounded ${first}°`);
    assert.ok(Math.abs(r.mean(r.span(15, 20))) < 0.05, `${id} ${wpn}: mean offset ${r.mean(r.span(15, 20))}°`);
    assert.ok(Math.abs(r.end) < 0.005, `${id} ${wpn}: back to neutral ${r.end}°`);
  }
});

test('without gyro the stabiliser holds only part of the recoil; it still returns to neutral', () => {
  const on = fire('bastion', 'rk-30', 'AUSGL');
  const off = fire('bastion', 'rk-30', 'AUSGL+gyroOff');
  const mOn = Math.abs(on.mean(on.span(15, 20)));
  const mOff = off.mean(off.span(15, 20));
  assert.ok(mOff > mOn && mOff > 0.1 && mOff < 0.35, `gyro off mean ${mOff}°`);
  assert.ok(Math.abs(off.end) < 0.01, `back to neutral ${off.end}°`);
});

test('single heavy shots still kick the torso (stabiliser only acts on sustained fire)', () => {
  const r = fire('goliath', 'sr-3', 'AUSGL', 8, 4);
  assert.ok(r.peak(r.trace) > 0.4, `SR-3 kick ${r.peak(r.trace)}°`);
  assert.ok(Math.abs(r.end) < 0.005);
});
