import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALKERS, WALKER_ORDER } from '../src/data/walkers.js';
import { COMBAT } from '../src/data/combat.js';
import { CONFIG } from '../src/data/config.js';
import { ENERGY_PRESETS, DRIVE_ENERGY, energySplitOf, driveEnergyFactor, driveAccelFactor } from '../src/data/systems.js';
import { WEAPONS } from '../src/data/weapons.js';
import { WeaponSystem } from '../src/sim/WeaponSystem.js';
import { DamageModel } from '../src/sim/DamageModel.js';
import { spreadFactor, recoilImpulse } from '../src/sim/MachineCondition.js';
import { measure, makeMotion, scenario, limitsOf } from './motionMetrics.mjs';
import { makeUnit, makePlayer, armourHit } from './helpers.mjs';

const DT = 1 / 60;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- 1. energy split ----

test('energy presets: shares sum to 1, drive factor follows the drive share within its limits', () => {
  for (const [name, p] of Object.entries(ENERGY_PRESETS)) {
    assert.ok(close(p.shields + p.weapons + p.drive, 1, 0.011), name);
    const f = driveEnergyFactor(p);
    assert.ok(f >= DRIVE_ENERGY.min && f <= DRIVE_ENERGY.max, `${name}: ${f}`);
  }
  assert.equal(driveEnergyFactor(ENERGY_PRESETS.AUSGL), 1, 'AUSGL keeps the old behaviour');
  assert.ok(driveEnergyFactor(ENERGY_PRESETS.SCHILD) < 1);
  assert.ok(driveEnergyFactor(ENERGY_PRESETS.WAFFE) < 1);
  assert.ok(driveEnergyFactor(ENERGY_PRESETS.ANTRIEB) > 1);
});

test('drive power = reactor output × legs factor × energy, counted once (all six walkers)', () => {
  for (const id of WALKER_ORDER) {
    for (const preset of ['SCHILD', 'AUSGL', 'WAFFE', 'ANTRIEB']) {
      const { cond } = scenario(id, preset);
      const expect = cond.reactorOutput * cond.legsSpeed * driveEnergyFactor(ENERGY_PRESETS[preset]);
      assert.ok(close(cond.drivePower, expect), `${id} ${preset}: ${cond.drivePower} vs ${expect}`);
      // Phase 2.1: acceleration has its own, stronger factor (was: driveAccel === driveEnergy)
      assert.equal(cond.driveAccel, driveAccelFactor(ENERGY_PRESETS[preset]));
    }
  }
});

test('top speed follows the energy split (measured, flat ground)', () => {
  for (const id of WALKER_ORDER) {
    const w = WALKERS[id];
    for (const preset of ['SCHILD', 'AUSGL', 'ANTRIEB']) {
      const m = measure(id, limitsOf(scenario(id, preset).cond));
      const want = w.maxSpeed * driveEnergyFactor(ENERGY_PRESETS[preset]);
      assert.ok(close(m.topSpeed, want, 1e-6), `${id} ${preset}: ${m.topSpeed} vs ${want}`);
    }
  }
});

test('extra drive energy cannot move a walker that is destroyed, kneeling or locked', () => {
  // reactor destroyed
  let { p } = scenario('bastion', 'ANTRIEB');
  p.unit.wreck = { kind: 'reactor' };
  p.unit.damage.parts.torso.internal = 0;
  let c = p.unit.condition.evaluate();
  assert.equal(c.drivePower, 0);
  assert.equal(c.driveAccel, 0);
  assert.equal(c.canMove, false);
  // legs destroyed (immobile)
  ({ p } = scenario('koloss', 'ANTRIEB'));
  p.unit.immobile = true;
  c = p.unit.condition.evaluate();
  assert.equal(c.drivePower, 0);
  assert.equal(c.canMove, false);
  // cold walker, leg lock engaged
  const cold = makePlayer('kestrel');
  cold.controls.setValue('energyPreset', 3, 'system');
  for (let i = 0; i < 60; i++) cold.systems.update(DT);
  c = cold.unit.condition.evaluate();
  assert.equal(c.drivePower, 0);
  assert.equal(c.canMove, false);
  // the motion itself stays put with these limits
  const m = makeMotion('kestrel');
  for (let i = 0; i < 300; i++) {
    Object.assign(m.limits, limitsOf(c), { throttleLocked: true });
    m.update(DT, { throttleRate: 0, throttleAbs: 1, turn: 0 });
  }
  assert.equal(m.speed, 0);
});

test('weapons and shields keep their share; the drive share does not touch them', () => {
  const w = WALKERS.bastion;
  const charge = (share) => {
    const ws = new WeaponSystem(w, { loadout: w.defaultLoadout, groups: w.defaultGroups, chains: w.defaultChains });
    ws.capacitor = 0;
    ws.update(1, { canFire: true, power: 1, weaponShare: share, fire() {}, beam() {} });
    return ws.capacitor;
  };
  const per = w.reactorOutput * COMBAT.energy.chargePerOutput;
  for (const [name, p] of Object.entries(ENERGY_PRESETS)) {
    assert.ok(close(charge(p.weapons), Math.min(w.reactorOutput * COMBAT.energy.capacitorPerOutput, per * p.weapons), 1e-9), name);
  }
  // shields: recharge per second at rate factor shields / 0.34 (as MissionCombat passes it)
  const regen = (p) => {
    const dm = new DamageModel(w);
    dm.time = 10;
    dm.lastHit = -10;
    dm.updateShields(1, true, p.shields / 0.34);
    return dm.shields.value.front;
  };
  assert.ok(regen(ENERGY_PRESETS.SCHILD) > regen(ENERGY_PRESETS.AUSGL));
  assert.ok(close(regen(ENERGY_PRESETS.ANTRIEB), regen(ENERGY_PRESETS.WAFFE)), 'same shield share → same regen');
  // the knob is read from the cockpit controls in one place
  const pl = makePlayer('bastion', { hot: true });
  pl.controls.setValue('energyPreset', 3, 'system');
  assert.equal(energySplitOf(pl.controls), ENERGY_PRESETS.ANTRIEB);
});

// ---- 2. gyro ----

test('gyro off: less stability, more sway and wobble, but the walker stays fully usable', () => {
  for (const id of WALKER_ORDER) {
    const on = scenario(id, 'AUSGL').cond;
    const off = scenario(id, 'AUSGL+gyroOff').cond;
    assert.equal(on.gyro, 1);
    assert.equal(off.gyro, 0);
    assert.ok(close(off.movementStability, 1 - COMBAT.condition.stabilityGyroShare), `${id} stability ${off.movementStability}`);
    assert.ok(close(off.weaponStabilization, 1 - COMBAT.condition.stabilizationGyroShare));
    assert.equal(off.drivePower, on.drivePower, 'gyro does not change the drive');
    assert.equal(off.weaponsOnline, true);
    const mOn = measure(id, limitsOf(on));
    const mOff = measure(id, limitsOf(off));
    assert.ok(mOff.swayDeg > mOn.swayDeg, `${id}: sway ${mOff.swayDeg} > ${mOn.swayDeg}`);
    assert.ok(mOff.headBob > mOn.headBob, `${id}: head ${mOff.headBob} > ${mOn.headBob}`);
    assert.ok(mOff.pitchSettle >= mOn.pitchSettle, `${id}: settle ${mOff.pitchSettle} ≥ ${mOn.pitchSettle}`);
    assert.ok(close(mOff.topSpeed, mOn.topSpeed, 1e-9), 'same speed');
    assert.ok(mOff.swayDeg < mOn.swayDeg * 2, 'bounded: not more than double the sway');
  }
});

test('gyro without bus power counts as off; aligning counts with its progress', () => {
  const p = makePlayer('marder', { hot: true });
  p.systems.s.power.bus = false;
  assert.equal(p.unit.condition.evaluate().gyro, 0);
  p.systems.s.power.bus = true;
  p.systems.s.gyro.mode = 'aligning';
  p.systems.s.gyro.align = 0.4;
  assert.ok(close(p.unit.condition.evaluate().gyro, 0.4));
  p.systems.s.gyro.mode = 'failed';
  assert.equal(p.unit.condition.evaluate().gyro, 0);
});

test('aim stabilisation while walking: spread 1 when standing or aligned, bounded otherwise', () => {
  assert.equal(spreadFactor(0, 0), 1);
  assert.equal(spreadFactor(1, 1), 1);
  const off = spreadFactor(1, 0.5); // gyro off → weaponStabilization 0.5
  assert.ok(close(off, 1 + COMBAT.condition.moveSpread * 0.5));
  assert.ok(spreadFactor(0.5, 0.5) < off);
});

test('recoil: heavy weapons kick, light ones hardly; rapid fire kicks less per shot; gyro damps', () => {
  const sr3 = recoilImpulse(WEAPONS['sr-3'], WALKERS.goliath.tonnage, 1);
  const lux = recoilImpulse(WEAPONS['lux-12'], WALKERS.kestrel.tonnage, 1);
  const rk = recoilImpulse(WEAPONS['rk-30'], WALKERS.koloss.tonnage, 1);
  assert.ok(sr3 > 5 * lux, `SR-3 ${sr3} vs LUX-12 ${lux}`);
  assert.ok(rk < sr3, 'per shot, the rotary cannon kicks less than the rail gun');
  const sr3Off = recoilImpulse(WEAPONS['sr-3'], WALKERS.goliath.tonnage, 0.5);
  assert.ok(sr3Off > sr3);
  // the same weapon kicks a lighter walker more
  assert.ok(recoilImpulse(WEAPONS['ak-20'], 25, 1) > recoilImpulse(WEAPONS['ak-20'], 100, 1));
  // effect on the torso: pitch rises, then the spring brings it back
  const m = makeMotion('goliath');
  m.recoil(sr3Off);
  let peak = 0;
  for (let i = 0; i < 240; i++) {
    m.update(DT, { throttleRate: 0, throttleAbs: 0, turn: 0 });
    peak = Math.max(peak, m.pitchSpring.value);
  }
  assert.ok(peak > 0.5 * (Math.PI / 180), `peak ${peak}`);
  assert.ok(Math.abs(m.pitchSpring.value) < 0.05 * (Math.PI / 180), 'settled after 4 s');
});

// ---- 3. mass ----

test('mass: heavier walkers turn up slower, brake longer per speed and swing slower (all six)', () => {
  const rows = WALKER_ORDER.map((id) => ({ id, w: WALKERS[id], m: measure(id, limitsOf(scenario(id, 'AUSGL').cond)) }));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    assert.ok(b.w.tonnage > a.w.tonnage);
    assert.ok(b.m.turnResponse > a.m.turnResponse, `turn response ${a.id} ${a.m.turnResponse} < ${b.id} ${b.m.turnResponse}`);
    // braking deceleration relative to the walker's own acceleration falls with mass
    const rel = (r) => r.m.topSpeed / r.m.stopTime / r.w.acceleration;
    assert.ok(rel(b) <= rel(a) + 1e-9, `relative braking ${a.id} ${rel(a)} ≥ ${b.id} ${rel(b)}`);
  }
  // torso spring: heavier → lower natural frequency (same damping ratio)
  const freq = (id) => Math.sqrt(makeMotion(id).pitchSpring.k);
  assert.ok(freq('kestrel') > freq('bastion') && freq('bastion') > freq('koloss'));
  // the walker's own data still sets the pace: turn rate after the lag is the data value
  for (const r of rows) assert.ok(close(r.m.turnAngle2s / 2, r.w.turnRate, r.w.turnRate * 0.35), r.id);
});

// ---- 4. damaged legs ----

test('legs SCHWER: the speed factor is applied once; stability falls and the walker limps', () => {
  for (const id of WALKER_ORDER) {
    const ok = scenario(id, 'AUSGL').cond;
    const heavy = scenario(id, 'AUSGL+legsHeavy').cond;
    const medium = scenario(id, 'AUSGL+legsMedium').cond;
    assert.ok(close(heavy.drivePower, COMBAT.consequences.legsHeavySpeed), `${id}: ${heavy.drivePower}`);
    assert.equal(medium.drivePower, 1, 'MITTEL: no speed loss (as before)');
    assert.ok(medium.limp > 0 && heavy.limp > medium.limp, `${id}: limp ${medium.limp} / ${heavy.limp}`);
    assert.equal(ok.limp, 0);
    assert.ok(heavy.movementStability < medium.movementStability && medium.movementStability < ok.movementStability);
    const mOk = measure(id, limitsOf(ok));
    const mHeavy = measure(id, limitsOf(heavy));
    assert.ok(close(mHeavy.topSpeed, WALKERS[id].maxSpeed * COMBAT.consequences.legsHeavySpeed, 1e-6), `${id} speed ${mHeavy.topSpeed}`);
    assert.ok(mHeavy.swayDeg > mOk.swayDeg && mHeavy.headBob > mOk.headBob, `${id}: unrest`);
  }
});

// ---- 5. AI and determinism ----

test('AI units are not affected by the player systems (knob, gyro)', () => {
  const pl = makePlayer('bastion', { hot: true });
  pl.controls.setValue('energyPreset', 0, 'system');
  pl.systems.s.gyro.mode = 'off';
  const ai = makeUnit('sichel');
  const c = ai.condition.evaluate();
  assert.equal(c.driveEnergy, 1);
  assert.equal(c.gyro, 1);
  assert.equal(c.drivePower, 1);
  assert.equal(c.movementStability, 1);
  // legs damage still counts for the AI (its own damage)
  const l = ai.damage.parts.legs;
  ai.damage.applyHit(armourHit('legs', (l.maxArmor + l.maxInternal) * 0.8));
  assert.ok(close(ai.condition.evaluate().drivePower, COMBAT.consequences.legsHeavySpeed));
});

test('motion measurements are deterministic at 60 Hz', () => {
  for (const id of ['kestrel', 'koloss']) {
    const a = measure(id, limitsOf(scenario(id, 'SCHILD+legsHeavy+gyroOff').cond));
    const b = measure(id, limitsOf(scenario(id, 'SCHILD+legsHeavy+gyroOff').cond));
    assert.deepEqual(a, b);
  }
});

test('feel values used by the motion exist in the config', () => {
  for (const k of ['massRef', 'turnLagBase', 'turnLagPerTon', 'brakeMassExp', 'unrestSway', 'unrestKick', 'unrestDamping', 'limpRoll', 'recoil', 'recoilGyroDamping']) {
    assert.equal(typeof CONFIG.feel[k], 'number', k);
  }
});

test('Shift+C (legs to torso) with leg turn lag: torso heading kept, twist gone in time (all six)', () => {
  for (const id of WALKER_ORDER) {
    const m = makeMotion(id);
    m.twist = m.twistTarget = 0.5;
    m.alignLegsToTorso();
    const yaw0 = m.legYaw + m.twist;
    for (let t = 0; t < 2.5; t += DT) m.update(DT, { throttleRate: 0, throttleAbs: null, turn: 0 });
    assert.ok(Math.abs(m.twist) < 1 * (Math.PI / 180), `${id}: twist ${(m.twist * 57.3).toFixed(2)}°`);
    assert.ok(Math.abs(m.legYaw + m.twist - yaw0) < 1e-9, `${id}: torso heading moved`);
  }
});
