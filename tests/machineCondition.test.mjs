import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/data/combat.js';
import { CONFIG } from '../src/data/config.js';
import { evaluateCondition } from '../src/sim/MachineCondition.js';
import { makeUnit, makePlayer, run, armourHit, DT } from './helpers.mjs';

const snapshot = (dm) => JSON.stringify({ parts: dm.parts, shields: dm.shields, time: dm.time, stats: dm.stats });

test('AI unit, undamaged: everything available', () => {
  const c = makeUnit('sichel').condition.evaluate();
  assert.equal(c.reactorAvailable, 1);
  assert.equal(c.reactorOutput, 1);
  assert.equal(c.drivePower, 1);
  assert.equal(c.hydraulicPower, 1);
  assert.equal(c.sensorPerformance, 1);
  assert.equal(c.weaponsOnline, true);
  assert.equal(c.shieldsOnline, true);
  assert.equal(c.weaponAvailability, 1);
  assert.equal(c.canMove, true);
  assert.equal(c.critical, false);
  assert.equal(c.reactorStage, 0);
});

test('deterministic and read-only: same state → same values, damage model untouched', () => {
  const u = makeUnit('goliath');
  u.damage.applyHit(armourHit('legs', 300));
  u.damage.applyHit(armourHit('sensors', 70));
  const before = snapshot(u.damage);
  const a = u.condition.evaluate();
  for (let i = 0; i < 100; i++) u.condition.evaluate();
  const b = u.condition.evaluate();
  assert.deepEqual(a, b);
  assert.equal(snapshot(u.damage), before, 'evaluate() must not change the damage model');
  assert.ok(Object.isFrozen(a));
  // Two separate units with the same history agree
  const v = makeUnit('goliath');
  v.damage.applyHit(armourHit('legs', 300));
  v.damage.applyHit(armourHit('sensors', 70));
  assert.deepEqual(v.condition.evaluate(), a);
});

test('legs SCHWER → drive factor legsHeavySpeed (as before: CombatUnits.applyLimits)', () => {
  const u = makeUnit('bastion');
  const p = u.damage.parts.legs;
  // leave 20 % of armour + internal → stage 'heavy'
  u.damage.applyHit(armourHit('legs', (p.maxArmor + p.maxInternal) * 0.8));
  assert.equal(u.damage.stage('legs'), 3);
  const c = u.condition.evaluate();
  assert.equal(c.drivePower, COMBAT.consequences.legsHeavySpeed);
  assert.equal(c.legsSpeed, COMBAT.consequences.legsHeavySpeed);
  assert.equal(c.canMove, true);
});

test('immobile (legs destroyed) → no drive, no stance, no stability', () => {
  const u = makeUnit('bastion');
  u.immobile = true;
  const c = u.condition.evaluate();
  assert.equal(c.canMove, false);
  assert.equal(c.drivePower, 0);
  assert.equal(c.hydraulicPower, 0);
  assert.equal(c.movementStability, 0);
  assert.equal(c.weaponsOnline, true, 'a kneeling walker still fights');
});

test('sensor stages give the range factors of COMBAT.consequences.sensorRange', () => {
  const u = makeUnit('bastion');
  const p = u.damage.parts.sensors;
  const total = p.maxArmor + p.maxInternal;
  const seen = [];
  // step through the stages with small hits and record every stage once
  for (let i = 0; i < 200 && u.damage.stage('sensors') < 4; i++) {
    const st = u.damage.stage('sensors');
    if (!seen.includes(st)) {
      seen.push(st);
      assert.equal(u.condition.evaluate().sensorPerformance, COMBAT.consequences.sensorRange[st], `stage ${st}`);
    }
    u.damage.applyHit(armourHit('sensors', total / 100));
  }
  assert.equal(u.damage.stage('sensors'), 4);
  assert.equal(u.condition.evaluate().sensorPerformance, COMBAT.consequences.sensorRange[4]);
  assert.deepEqual(seen, [0, 1, 2, 3]);
});

test('disrupt hit (PZ-9 effect) lowers sensor performance for its duration (P3)', () => {
  const u = makeUnit('bastion');
  u.damage.applyHit({ component: 'torso', side: 'front', damage: 1, vsShield: 0, vsArmor: 1, effect: { kind: 'disrupt', time: 1.5 } });
  let c = u.condition.evaluate();
  assert.equal(c.disrupted, true);
  assert.equal(c.sensorPerformance, COMBAT.consequences.disruptSensor);
  // the damage model's own clock runs in updateShields
  for (let t = 0; t < 1.6; t += DT) u.damage.updateShields(DT, true, 1);
  c = u.condition.evaluate();
  assert.equal(c.disrupted, false);
  assert.equal(c.sensorPerformance, 1);
});

test('reactor destroyed → no output, weapons, shields, drive (P1)', () => {
  const { unit, systems } = makePlayer('bastion', { hot: true });
  run(systems, 0.5);
  let c = unit.condition.evaluate();
  assert.equal(c.weaponsOnline, true);
  assert.equal(c.reactorOutput, 1);
  unit.wreck = { kind: 'reactor' };
  unit.damage.parts.torso.internal = 0;
  c = unit.condition.evaluate();
  assert.equal(systems.canFire, true, 'the machinery simulation itself is unchanged');
  assert.equal(c.reactorAvailable, 0);
  assert.equal(c.reactorOutput, 0);
  assert.equal(c.weaponsOnline, false);
  assert.equal(c.shieldsOnline, false);
  assert.equal(c.drivePower, 0);
  assert.equal(c.canMove, false);
  assert.equal(c.sensorPerformance, 0);
  assert.equal(c.critical, false, 'a wreck is not "critical" any more — it is gone');
  assert.equal(c.reactorStage, 4);
});

test('critical threshold matches the cockpit config (torso internal share)', () => {
  const u = makeUnit('bastion');
  const t = u.damage.parts.torso;
  u.damage.applyRaw('torso', t.maxArmor + t.maxInternal * (1 - CONFIG.hitFeedback.critical.torsoInternal) + 0.01);
  assert.equal(u.condition.evaluate().critical, true);
  const v = makeUnit('bastion');
  v.damage.applyRaw('torso', v.damage.parts.torso.maxArmor + v.damage.parts.torso.maxInternal * 0.4);
  assert.equal(v.condition.evaluate().critical, false);
});

test('player cold: nothing available; hot: everything — values follow WalkerSystems', () => {
  const cold = makePlayer('kestrel');
  run(cold.systems, 1);
  let c = cold.unit.condition.evaluate();
  assert.equal(c.reactorOutput, 0);
  assert.equal(c.drivePower, 0);
  assert.equal(c.canMove, false);
  assert.equal(c.weaponsOnline, false);
  assert.equal(c.shieldsOnline, false);
  assert.equal(c.sensorPerformance, 0, 'SENSOREN off → no target range (P2)');
  assert.equal(c.hydraulicPower, 0);
  const hot = makePlayer('kestrel', { hot: true });
  run(hot.systems, 1);
  c = hot.unit.condition.evaluate();
  assert.equal(c.reactorOutput, 1);
  assert.equal(c.drivePower, hot.systems.drive.speedFactor);
  assert.equal(c.hydraulicPower, 1);
  assert.equal(c.sensorPerformance, 1);
  assert.equal(c.weaponsOnline, true);
  assert.equal(c.shieldsOnline, true);
  assert.equal(c.movementStability, 1);
  assert.equal(c.weaponStabilization, 1);
});

test('sensors switched off in flight → sensor performance 0 (P2), back after boot time', () => {
  const { unit, systems, controls } = makePlayer('bastion', { hot: true });
  run(systems, 0.2);
  assert.equal(unit.condition.evaluate().sensorPerformance, 1);
  controls.setValue('sensors', 0, 'system');
  run(systems, 0.1);
  assert.equal(unit.condition.evaluate().sensorPerformance, 0);
  controls.setValue('sensors', 1, 'system');
  run(systems, systems.cfg.sensors.bootTime + 0.1);
  assert.equal(unit.condition.evaluate().sensorPerformance, 1);
});

test('drive power equals the old formula: reactor power × legs factor', () => {
  const { unit, systems, controls } = makePlayer('marder', { hot: true });
  controls.setValue('reactorMode', 1, 'system'); // VORH: power falls toward idle
  const p = unit.damage.parts.legs;
  unit.damage.applyHit(armourHit('legs', (p.maxArmor + p.maxInternal) * 0.8));
  run(systems, 0.5, () => {
    const c = unit.condition.evaluate();
    const old = systems.drive.speedFactor * (unit.damage.stage('legs') >= 3 ? COMBAT.consequences.legsHeavySpeed : 1);
    assert.ok(Math.abs(c.drivePower - old) < 1e-12, `${c.drivePower} vs ${old}`);
  });
});

test('weapon availability counts hardpoints on lost arms', () => {
  const u = makeUnit('halberd'); // LS, RS on the torso; LA, RA on the arms
  assert.equal(u.condition.evaluate().weaponAvailability, 1);
  u.lostArms.add('armL');
  assert.equal(u.condition.evaluate().weaponAvailability, 0.75);
});

test('evaluateCondition works without a unit object', () => {
  const u = makeUnit('splitter');
  const c = evaluateCondition({ damage: u.damage });
  assert.equal(c.reactorAvailable, 1);
  assert.equal(c.weaponAvailability, 0, 'no hardpoints given');
});
