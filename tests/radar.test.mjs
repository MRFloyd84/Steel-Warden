/**
 * A4 radar and stealth (docs/A4-PLAN.md): emission rule, contact lists (active / passive /
 * data link), danger circle, AI radar and jammer in the perception, jammer missile rule,
 * missile lock only with the radar active, equipment swap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { playerEmits, radarContacts, linkContacts, dangerRadius, jamBreaks } from '../src/sim/Radar.js';
import { Perception } from '../src/ai/Perception.js';
import { MissileControl } from '../src/states/combat/MissileControl.js';
import { equipmentOverride, factoryEquipment, checkLoadout } from '../src/sim/loadout.js';
import { COMBAT } from '../src/data/combat.js';
import { WALKERS, WALKER_ORDER } from '../src/data/walkers.js';
import { ENEMIES } from '../src/data/enemies.js';

/** A unit as the radar sees it: a point at (x, z), 8 m up. */
function unit(id, x, z, { emitting = false, type = 'sichel', wreck = null, jamming = false, signature = null } = {}) {
  return {
    id, walker: ENEMIES[type] ?? WALKERS[type], emitting, wreck, jamming, signature,
    motion: { x, z },
    volumes: { componentCenter: (c, out) => out.set(x, 8, z), hasComponent: () => true },
  };
}

const eye = new THREE.Vector3(0, 8, 0);
const clear = () => true;

test('emission: radar active with sensors on and power, or the jammer', () => {
  assert.equal(playerEmits({ sensorsOn: true, powered: true, radarActive: true, jamming: false }), true);
  assert.equal(playerEmits({ sensorsOn: true, powered: true, radarActive: false, jamming: false }), false, 'passive');
  assert.equal(playerEmits({ sensorsOn: false, powered: true, radarActive: true, jamming: false }), false, 'sensors off');
  assert.equal(playerEmits({ sensorsOn: true, powered: false, radarActive: true, jamming: false }), false, 'no power');
  assert.equal(playerEmits({ sensorsOn: false, powered: false, radarActive: false, jamming: true }), true, 'jammer always emits');
});

test('active radar: everything in range with a free line; terrain covers', () => {
  const near = unit('near', 0, -800);
  const far = unit('far', 0, -1500);
  const hidden = unit('hidden', 300, -300);
  const los = (a, b) => b.x !== 300; // a hill in front of "hidden"
  const list = radarContacts({ mode: 'active', range: 1000, eye, enemies: [near, far, hidden], los });
  assert.deepEqual(list.map((c) => `${c.unit.id}:${c.how}`), ['near:radar']);
});

test('passive radar: only emitters, up to the passive range, no line needed', () => {
  const quiet = unit('quiet', 0, -300);
  const scout = unit('scout', 0, -1800, { emitting: true });
  const tooFar = unit('tooFar', 0, -(COMBAT.radar.passiveRange + 100), { emitting: true });
  const wreck = unit('wreck', 0, -200, { emitting: true, wreck: { kind: 'reactor' } });
  const list = radarContacts({ mode: 'passive', range: 500, eye, enemies: [quiet, scout, tooFar, wreck], los: () => false });
  assert.deepEqual(list.map((c) => `${c.unit.id}:${c.how}`), ['scout:passive']);
});

test('data link: what a wingman saw recently is on the radar in both modes', () => {
  const a = unit('a', 0, -3000);
  const b = unit('b', 0, -3100);
  const flight = {
    members: [
      { dead: false, time: 50, contacts: new Map([[a, { visible: true, seenAt: 50 }], [b, { visible: false, seenAt: 45 }]]) },
      { dead: false, time: 50, contacts: new Map([[b, { visible: false, seenAt: 48 }]]) },
    ],
  };
  const link = linkContacts(flight);
  assert.equal(link.get(a), 0);
  assert.equal(link.get(b), 2, 'the most recent sighting counts');
  for (const mode of ['active', 'passive']) {
    const list = radarContacts({ mode, range: 1000, eye, enemies: [a, b], los: clear, link });
    assert.deepEqual(list.map((c) => `${c.unit.id}:${c.how}`), ['a:link', 'b:link'], mode);
  }
  link.set(b, COMBAT.radar.linkMemory + 0.5);
  assert.equal(radarContacts({ mode: 'active', range: 1000, eye, enemies: [b], los: clear, link }).length, 0, 'link memory ran out');
  assert.equal(linkContacts(null).size, 0);
});

test('danger circle: the furthest way the enemy can notice you', () => {
  const sig = { sight: 1, detect: 1100 };
  const sichel = unit('s', 0, -100, { type: 'sichel' });
  const scout = unit('sc', 0, -100, { type: 'splitter', emitting: true });
  const f = () => 1;
  assert.equal(dangerRadius({ signature: sig, enemies: [], rangeFactor: f }), 1100, 'reactor signature');
  assert.equal(dangerRadius({ signature: sig, enemies: [sichel], rangeFactor: f }), ENEMIES.sichel.ai.sight.range);
  assert.equal(dangerRadius({ signature: sig, enemies: [sichel, scout], rangeFactor: f }), ENEMIES.splitter.ai.radar, 'emitting scout radar');
  assert.equal(dangerRadius({ signature: { sight: 0.35, detect: 0 }, enemies: [sichel], rangeFactor: () => 0.5 }), ENEMIES.sichel.ai.sight.range * 0.35 * 0.5, 'cold walker at night');
  assert.equal(dangerRadius({ signature: sig, enemies: [sichel], rangeFactor: f, emitting: true }), ENEMIES.sichel.ai.detectEmitting, 'you emit');
});

// ---- AI perception ----

/** Perception on flat ground; ridge = x of a 60 m wall between observer and target (or null). */
function perception(ridgeAtZ = null) {
  const sampler = { heightAt: (x, z) => (ridgeAtZ !== null && Math.abs(z - ridgeAtZ) < 20 ? 60 : 0), surfaceAt: () => 'hard' };
  return new Perception({ world: { sampler, objects: { blocked: () => false }, weatherDef: null }, mission: { timeOfDay: 'day' }, difficulty: { sight: 1 } });
}

test('AI radar: an emitting observer locates in range with a free line, terrain covers', () => {
  const sight = { range: 400, coneDeg: 90 };
  const target = unit('player', 0, 1000); // behind the observer (cone looks to -z), out of sight range
  const open = perception();
  assert.equal(open.look(eye, 0, sight, 1500, target, null, 0), null, 'no radar: not noticed');
  assert.equal(open.look(eye, 0, sight, 1500, target, null, 1200), 'located', 'radar 1200 m');
  assert.equal(open.look(eye, 0, sight, 1500, target, null, 900), null, 'out of radar range');
  assert.equal(perception(500).look(eye, 0, sight, 1500, target, null, 1200), null, 'ridge in between');
});

test('jammer gives itself away within the notice radius', () => {
  const p = perception();
  const sight = { range: 100, coneDeg: 90 };
  const k = COMBAT.jammer.noticeRadius;
  assert.equal(p.look(eye, 0, sight, 0, unit('j', 0, k - 50, { jamming: true }), null, 0), 'located');
  assert.equal(p.look(eye, 0, sight, 0, unit('j', 0, k + 50, { jamming: true }), null, 0), null);
  assert.equal(p.look(eye, 0, sight, 0, unit('q', 0, k - 50), null, 0), null, 'not jamming');
});

test('jammer vs radar missiles: none within burn-through, about breakChance beyond, fixed per missile', () => {
  const k = COMBAT.jammer;
  let broken = 0;
  for (let s = 1; s <= 1000; s++) {
    assert.equal(jamBreaks(s, k.missileRange - 1), false);
    if (jamBreaks(s, k.missileRange + 50)) broken++;
    assert.equal(jamBreaks(s, 900), jamBreaks(s, 900), 'deterministic');
  }
  assert.ok(Math.abs(broken / 1000 - k.breakChance) < 0.06, `share ${broken / 1000}`);
});

test('scouts emit with their own radar range; everything else waits for an order or the mission', () => {
  assert.equal(ENEMIES.splitter.ai.emits, true);
  assert.ok(ENEMIES.splitter.ai.radar > 0);
  for (const id of ['sichel', 'monolith', 'obelisk']) assert.ok(!ENEMIES[id].ai.emits, id);
});

// ---- player weapons ----

test('passive radar: active and semi-active missiles hold ("RADAR PASSIV"), others fire', () => {
  const targeting = { target: { id: 't' }, inCone: true, lockTime: 99 };
  const mc = new MissileControl({ game: null, controls: { has: () => false }, targeting, weapons: { slots: [] }, player: {}, units: { all: [] }, sound: null });
  let active = false;
  mc.radarLock = () => active;
  const slot = (mode) => ({ def: { guidance: ['dumb', 'active', 'semiActive', 'antiRadar', 'optical'], lockTime: 1 }, mode });
  assert.equal(mc.holdReason(slot('active')), 'RADAR PASSIV');
  assert.equal(mc.holdReason(slot('semiActive')), 'RADAR PASSIV');
  assert.equal(mc.holdReason(slot('antiRadar')), '');
  assert.equal(mc.holdReason(slot('dumb')), '');
  active = true;
  assert.equal(mc.holdReason(slot('active')), '', 'radar active and locked');
});

test('equipment swap: ST-2 jammer instead of the target pod where it fits', () => {
  for (const id of WALKER_ORDER) {
    const w = WALKERS[id];
    const o = equipmentOverride(w, 'jammer');
    if (factoryEquipment(w)) {
      assert.ok(o, `${id}: jammer fits`);
      assert.deepEqual(checkLoadout(w, { ...w.defaultLoadout, ...o }, w.defaultGroups, w.defaultChains).problems, []);
      assert.ok(Object.values(o).every((v) => v === 'jammer'));
    } else assert.equal(o, null, `${id}: no equipment slot`);
  }
  assert.equal(equipmentOverride(WALKERS.kestrel, 'lux-40'), null, 'only equipment');
  assert.equal(equipmentOverride(WALKERS.kestrel, null), null);
  // a swap that would break the weight limit is refused
  const tight = { ...WALKERS.kestrel, maxLoadoutWeight: 4.6 };
  assert.equal(equipmentOverride(tight, 'jammer'), null, 'overweight');
  assert.ok(equipmentOverride({ ...WALKERS.kestrel, maxLoadoutWeight: 5 }, 'jammer'));
});
