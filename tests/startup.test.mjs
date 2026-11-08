import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTUP_SCRIPT } from '../src/data/systems.js';
import { StartupAutomation } from '../src/sim/StartupAutomation.js';
import { makePlayer, DT } from './helpers.mjs';

/** Runs the automatic start (Shift+S) until the legs are released; returns seconds or null. */
function autoStart(id, limit = 240) {
  const p = makePlayer(id);
  const auto = new StartupAutomation(p.controls, 'auto');
  auto.start('auto');
  const trace = [];
  for (let t = 0; t < limit; t += DT) {
    p.systems.update(DT);
    auto.update(DT, p.systems.flags);
    if (Math.round(t / DT) % 60 === 0) trace.push(p.unit.condition.evaluate().drivePower.toFixed(6));
    if (p.systems.flags.legsReleased && p.systems.flags.reactorFull) return { t, p, trace };
  }
  return { t: null, p, trace };
}

test('automatic start (visible, moves the real switches) reaches ready-to-walk', () => {
  for (const id of ['kestrel', 'bastion', 'koloss']) {
    const { t, p } = autoStart(id);
    assert.ok(t !== null, `${id}: automatic start did not finish`);
    const c = p.unit.condition.evaluate();
    assert.equal(c.canMove, true, id);
    assert.equal(c.weaponsOnline, true, id);
    assert.equal(c.shieldsOnline, true, id);
    assert.equal(c.sensorPerformance, 1, id);
    assert.ok(c.drivePower > 0.95, `${id}: drive ${c.drivePower}`);
  }
});

test('automatic start is deterministic (same time, same condition trace)', () => {
  const a = autoStart('bastion');
  const b = autoStart('bastion');
  assert.equal(a.t, b.t);
  assert.deepEqual(a.trace, b.trace);
});

test('manual cold start (switches set by the pilot, cause "user") reaches ready-to-walk', () => {
  const p = makePlayer('marder');
  const c = p.controls;
  const steps = STARTUP_SCRIPT.filter((s) => !s.requires || p.systems.flags[s.requires]);
  let t = 0;
  const wait = (flag, limit = 40) => {
    for (let i = 0; i < limit / DT; i++, t += DT) {
      p.systems.update(DT);
      if (p.systems.flags[flag]) return true;
    }
    return false;
  };
  for (const step of steps) {
    if (step.flag && p.systems.flags[step.flag]) continue;
    if ((step.skipIf ?? []).some((f) => p.systems.flags[f])) continue;
    for (const [op, id, arg] of step.actions) {
      if (op === 'guard') c.setGuard(id, arg, 'user');
      if (op === 'set') c.setValue(id, arg, 'user');
      if (op === 'press') c.press(id, 'user');
      if (op === 'release') c.release(id, 'user');
      p.systems.update(DT);
    }
    if (step.id === 'apu') {
      // a pilot holds START until the APU sustains itself, then lets go
      for (let i = 0; i < 20 / DT && p.systems.s.apu.rpm < p.systems.cfg.apu.selfSustain; i++) p.systems.update(DT);
      c.release('apuStart', 'user');
    }
    assert.ok(wait(step.flag), `step ${step.id}: flag ${step.flag} not reached`);
    for (const [op, id] of step.after ?? []) if (op === 'release') c.release(id, 'user');
  }
  const cond = p.unit.condition.evaluate();
  assert.equal(p.systems.flags.legsReleased, true);
  assert.equal(cond.canMove, true);
  assert.equal(cond.weaponsOnline, true);
});

test('wrong order has physical consequences, no lock: ignition without preheat fails', () => {
  const p = makePlayer('bastion');
  const c = p.controls;
  c.setGuard('batteryMaster', true, 'user');
  c.setValue('batteryMaster', 1, 'user');
  let failed = null;
  p.bus.on('systems:event', (e) => { if (e.type === 'ignitionFailed') failed = e.reason; });
  c.setGuard('reactorIgnition', true, 'user');
  c.setValue('reactorIgnition', 1, 'user');
  for (let i = 0; i < 30; i++) p.systems.update(DT);
  assert.ok(failed, 'ignitionFailed expected');
  assert.equal(p.systems.flags.reactorRunning, false);
  assert.equal(p.unit.condition.evaluate().reactorOutput, 0);
});
