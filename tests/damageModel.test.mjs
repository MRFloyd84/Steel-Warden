import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DamageModel } from '../src/sim/DamageModel.js';
import { walker, makeUnit, armourHit, DT } from './helpers.mjs';

const total = (dm, c) => dm.parts[c].armor + dm.parts[c].internal;

test('one hit is applied exactly once: shield takes its share, the rest goes to armour', () => {
  const dm = new DamageModel(walker('bastion'));
  dm.fillShields();
  const shield = dm.shields.value.front;
  const before = total(dm, 'torso');
  // vsShield 0.5: 100 raw = 50 shield damage; shield (front, ~shiftless) absorbs up to its value
  const res = dm.applyHit({ component: 'torso', side: 'front', damage: 400, vsShield: 0.5, vsArmor: 1.5 });
  const absorbed = Math.min(shield, 400 * 0.5);
  assert.equal(res.shieldDamage, absorbed);
  const rawLeft = (400 * 0.5 - absorbed) / 0.5;
  assert.ok(Math.abs(res.armorDamage - rawLeft * 1.5) < 1e-9);
  assert.ok(Math.abs(before - total(dm, 'torso') - rawLeft * 1.5) < 1e-9, 'armour + internal lost = armour damage, once');
  assert.equal(dm.stats.hits, 1);
});

test('same sequence of hits → same state (deterministic)', () => {
  const seq = [['torso', 80], ['legs', 120], ['armL', 60], ['sensors', 30], ['torso', 200], ['legs', 90]];
  const play = () => {
    const dm = new DamageModel(walker('goliath'));
    dm.fillShields();
    for (const [c, d] of seq) {
      dm.applyHit({ component: c, side: 'left', damage: d, vsShield: 0.8, vsArmor: 1.2 });
      dm.updateShields(0.25, true, 1);
    }
    return JSON.stringify(dm.parts) + JSON.stringify(dm.shields.value);
  };
  assert.equal(play(), play());
});

test('applyRaw bypasses shields and lands once', () => {
  const dm = new DamageModel(walker('marder'));
  dm.fillShields();
  const sh = { ...dm.shields.value };
  const before = total(dm, 'legs');
  dm.applyRaw('legs', 37);
  assert.deepEqual(dm.shields.value, sh);
  assert.ok(Math.abs(before - total(dm, 'legs') - 37) < 1e-9);
});

test('stage changes are reported once per change', () => {
  const dm = new DamageModel(walker('kestrel'));
  const p = dm.parts.armR;
  const changes = [];
  for (let i = 0; i < 40; i++) changes.push(...dm.applyHit(armourHit('armR', (p.maxArmor + p.maxInternal) / 30)).changes);
  assert.deepEqual(changes.map((c) => c.to), [1, 2, 3, 4]);
  assert.equal(dm.isDestroyed('armR'), true);
});

test('invulnerable (practice): nothing is lost', () => {
  const dm = new DamageModel(walker('bastion'));
  dm.invulnerable = true;
  const before = JSON.stringify(dm.parts);
  dm.applyHit(armourHit('torso', 999));
  dm.applyRaw('legs', 999);
  assert.equal(JSON.stringify(dm.parts), before);
});

test('walker without shields (drone): no NaN (P5)', () => {
  const dm = new DamageModel(walker('schwarm'));
  for (let i = 0; i < 120; i++) dm.updateShields(DT, true, 1);
  for (const v of Object.values(dm.shields.value)) assert.ok(Number.isFinite(v), `shield value ${v}`);
  assert.ok(Number.isFinite(dm.frontShare));
  const res = dm.applyHit({ component: 'torso', side: 'front', damage: 5, vsShield: 1, vsArmor: 1 });
  assert.equal(res.shieldHit, false);
  assert.equal(res.armorDamage, 5);
});

test('EMP empties shields and blocks recharge for its time', () => {
  const u = makeUnit('bastion');
  const dm = u.damage;
  dm.fillShields();
  dm.applyHit({ component: 'torso', side: 'front', damage: 10, vsShield: 1, vsArmor: 1, effect: { kind: 'emp', time: 4 } });
  for (const v of Object.values(dm.shields.value)) assert.equal(v, 0);
  for (let t = 0; t < 3.5; t += DT) dm.updateShields(DT, true, 1);
  assert.equal(dm.shields.value.front, 0);
  for (let t = 0; t < 1; t += DT) dm.updateShields(DT, true, 1);
  assert.ok(dm.shields.value.front > 0);
});
