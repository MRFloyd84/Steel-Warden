/**
 * Wingmen (docs/WINGMEN-PLAN.md): friendly-fire rule, team setup, the seven orders, line of
 * fire, morale, kill credit, radio. Headless: real WalkerMotion, WeaponSystem, DamageModel and
 * the real Flight / WingmanController / AIController; the world (flat, open, full sight) and
 * the AIDirector services are small stand-ins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { canHit, killCredit } from '../src/sim/friendlyFire.js';
import { Flight } from '../src/ai/Flight.js';
import { WalkerMotion } from '../src/sim/WalkerMotion.js';
import { WeaponSystem } from '../src/sim/WeaponSystem.js';
import { DamageModel } from '../src/sim/DamageModel.js';
import { Targeting } from '../src/sim/Targeting.js';
import { EventBus } from '../src/core/EventBus.js';
import { CONFIG } from '../src/data/config.js';
import { WALKERS } from '../src/data/walkers.js';
import { ENEMIES } from '../src/data/enemies.js';
import { WING, WING_RADIO, wingmenSlots } from '../src/data/pilots.js';
import { getMission } from '../src/data/missions.js';

const DT = 1 / 60;
const FLAT = { heightAt: () => 0, surfaceAt: () => 'hard' };
const QUIET = { emit() {} };

/** A walker as the AI sees it: real motion, weapons, damage; hit volumes = a point on the torso. */
function unit(id, type, x, z, side, heading = 0) {
  const walker = WALKERS[type] ?? ENEMIES[type];
  const motion = new WalkerMotion(walker, FLAT, CONFIG.feel, QUIET);
  motion.place(x, z, heading);
  const u = {
    id, walker, motion, side, isPlayer: id === 'player', wreck: null, immobile: false, lostArms: new Set(),
    weapons: new WeaponSystem(walker, { loadout: walker.defaultLoadout, groups: walker.defaultGroups, chains: walker.defaultChains }),
    damage: new DamageModel(walker),
    volumes: {
      componentCenter: (c, out) => out.set(motion.x, (c === 'legs' ? 0.3 : 0.75) * walker.cockpit.eyeHeight, motion.z),
      hasComponent: () => true,
      center: (out) => out.set(motion.x, walker.cockpit.eyeHeight * 0.6, motion.z),
    },
    mounts: { muzzleWorld: (id, out) => out.set(motion.x, walker.cockpit.eyeHeight, motion.z) },
  };
  return u;
}

/** Stand-in for the AIDirector services the controllers use; open terrain, sight 900 m. */
function world({ wingmen = ['marder', 'bastion', 'goliath'], enemies = [], startup = { location: 'dropZone' }, nav = null } = {}) {
  const player = unit('player', 'bastion', 0, 0, 'player');
  const units = [player];
  const radio = [];
  const bus = new EventBus();
  const shots = [];
  const d = {
    player,
    nav: null,
    frozen: false,
    holdFire: false,
    time: 0,
    perception: {
      look: (eye, yaw, sight, det, t) => (Math.hypot(t.motion.x - eye.x, t.motion.z - eye.z) <= sight.range ? 'seen' : null),
      rangeFactor: () => 1,
      lineOfSight: () => true,
    },
    world: { objects: { near: () => [] }, sampler: FLAT },
    hostilesOf: (u) => units.filter((x) => x.side !== u.side && x.wreck?.kind !== 'reactor'),
    unitsOfSide: (side) => units.filter((x) => x.side === side),
    spot() {},
    spottedAgo: () => Infinity,
    requestPath() {},
    updateSides() {},
    combat: { fireFrom: (u, s) => shots.push({ from: u.id, slot: s.id }), beamFrom() {}, enemyBeamPos: new Map(), enemyBeams: new Map() },
  };
  for (const [i, [type, x, z]] of enemies.entries()) units.push(unit(`e${i + 1}`, type, x, z, 'enemy', Math.PI));
  const entities = {
    player,
    addUnit: ({ id, type, x, z, heading, side }) => {
      const u = unit(id, type, x, z, side, heading);
      units.push(u);
      return u;
    },
  };
  let target = null;
  let navPoint = { id: 'ALPHA', x: 0, z: -600 };
  const flight = new Flight({
    director: d, entities, world: { objects: { resolveWalker: () => false } }, bus, radio: (m) => radio.push(m), picks: wingmen,
    env: { startup, navPoint: () => navPoint, target: () => target },
  });
  const w = {
    d, flight, player, units, radio, bus, shots,
    setTarget: (t) => (target = t),
    setNav: (n) => (navPoint = n),
    enemy: (i = 0) => units.filter((u) => u.side === 'enemy')[i],
    /** seconds of simulation: player input, flight (sense/think/aim/fire), all motions */
    run(seconds, playerThrottle = 0) {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        d.time += DT;
        player.motion.throttle.value = playerThrottle;
        player.motion.update(DT, { throttleRate: 0, throttleAbs: null, turn: 0 });
        flight.update(DT);
        for (const c of flight.members) {
          if (c.dead) continue;
          c.unit.motion.update(DT, c.drive(DT));
        }
      }
    },
    last: () => radio[radio.length - 1]?.text ?? '',
  };
  return w;
}

const dist = (a, b) => Math.hypot(a.motion.x - b.motion.x, a.motion.z - b.motion.z);
const distXZ = (a, x, z) => Math.hypot(a.motion.x - x, a.motion.z - z);

// ---- rules ----

test('friendly fire: the player hits its wingmen; nobody else hits its own side', () => {
  const player = { side: 'player', isPlayer: true };
  const wing = { side: 'player', isPlayer: false };
  const wing2 = { side: 'player', isPlayer: false };
  const enemy = { side: 'enemy', isPlayer: false };
  const enemy2 = { side: 'enemy', isPlayer: false };
  const gun = { side: 'enemy', isGun: true };
  assert.equal(canHit(player, wing), true, 'player → wingman');
  assert.equal(canHit(player, enemy), true);
  assert.equal(canHit(player, player), false, 'never itself');
  assert.equal(canHit(wing, player), false, 'wingman → player');
  assert.equal(canHit(wing, wing2), false, 'wingman → wingman');
  assert.equal(canHit(wing, enemy), true);
  assert.equal(canHit(enemy, enemy2), false, 'enemies among themselves (as before)');
  assert.equal(canHit(enemy, wing), true, 'enemy → wingman');
  assert.equal(canHit(gun, player), true);
  assert.equal(canHit(null, wing), true, 'no shooter known');
});

test('slots per mission: default 3, the duel is flown alone', () => {
  assert.equal(wingmenSlots({}), 3);
  assert.equal(wingmenSlots(getMission('test-duel')), 0);
  assert.equal(wingmenSlots({ wingmen: 7 }), 3);
});

test('lock and radar lists: wingmen are not enemies', () => {
  const w = world({ enemies: [['splitter', 0, -300]] });
  const t = new Targeting();
  const eye = new THREE.Vector3(0, 8, 0);
  const list = t.candidates(w.units, eye, new THREE.Vector3(0, 0, -1), 1);
  assert.deepEqual(list.map((c) => c.unit.id), ['e1']);
});

// ---- team ----

test('team: named radio slots, side player, waiting until deploy, then formation', () => {
  const w = world({ wingmen: ['marder', null, 'koloss'] });
  const f = w.flight;
  assert.deepEqual(f.members.map((c) => c.unit.wingName), ['ZWEI', 'VIER']);
  assert.deepEqual(f.members.map((c) => c.pilot.callsign), ['ANKER', 'RIEGEL']);
  assert.ok(f.members.every((c) => c.unit.side === 'player'));
  assert.ok(f.members.every((c) => c.order === 'wait'));
  assert.match(w.radio[0].text, /ZWEI MARDER.*VIER KOLOSS/);
  // spawned behind the player, apart from each other
  assert.ok(f.members.every((c) => c.unit.motion.z > 0 && dist(c.unit, w.player) > 25));
  w.run(5, 0.6);
  assert.ok(f.members.every((c) => dist(c.unit, w.player) < 120), 'waiting: they stay at the start');
  f.deploy();
  assert.ok(f.members.every((c) => c.order === 'formation'));
  assert.equal(w.last(), WING_RADIO.deploy);
});

test('formation: wingmen keep their wedge slot while the player walks 40 s', () => {
  const w = world();
  w.flight.deploy();
  w.run(40, 0.5);
  const moved = Math.abs(w.player.motion.z);
  assert.ok(moved > 200, `player walked ${moved} m`);
  for (const c of w.flight.members) {
    const s = w.flight.slotPoint(c);
    const d = distXZ(c.unit, s.x, s.z);
    assert.ok(d < 30, `${c.unit.wingName}: ${d.toFixed(0)} m from its slot`);
  }
});

test('hold position: stays put while the player leaves, formation brings them back', () => {
  const w = world();
  w.flight.deploy();
  w.run(1);
  w.flight.command('holdPosition');
  const at = w.flight.members.map((c) => [c.unit.motion.x, c.unit.motion.z]);
  w.run(30, 0.6);
  w.flight.members.forEach((c, i) => assert.ok(distXZ(c.unit, ...at[i]) < 15, `${c.unit.wingName} drifted`));
  assert.ok(dist(w.flight.members[0].unit, w.player) > 250);
  w.flight.command('formation');
  w.run(40);
  for (const c of w.flight.members) assert.ok(dist(c.unit, w.player) < 100, `${c.unit.wingName} back`);
});

test('go to nav point and fall back', () => {
  const w = world();
  w.flight.deploy();
  w.flight.command('goNav');
  assert.equal(w.last(), WING_RADIO.ack.goNav.replace('{x}', 'ALPHA'));
  w.run(90); // GOLIATH: 11 m/s top speed, the march pace is 80 %
  for (const c of w.flight.members) assert.ok(distXZ(c.unit, 0, -600) < 80, `${c.unit.wingName} at ALPHA: ${distXZ(c.unit, 0, -600).toFixed(0)} m`);
  w.flight.command('fallBack');
  w.run(75); // 600 m back; GOLIATH runs 11 m/s
  for (const c of w.flight.members) assert.ok(dist(c.unit, w.player) < 100, `${c.unit.wingName} back with the player`);
  assert.ok(w.flight.members.every((c) => c.order === 'formation'), 'after falling back: formation');
  w.setNav(null);
  w.flight.command('goNav');
  assert.equal(w.last(), WING_RADIO.noNav);
});

test('attack my target: without a target they ask, with one they close in and shoot it', () => {
  const w = world({ enemies: [['splitter', 350, -700]] });
  w.flight.deploy();
  w.flight.command('attackMyTarget');
  assert.equal(w.last(), WING_RADIO.noTarget);
  assert.ok(w.flight.members.every((c) => c.order === 'formation'));
  const e = w.enemy();
  w.setTarget(e);
  w.flight.command('attackMyTarget');
  assert.ok(w.flight.members.every((c) => c.order === 'attackMyTarget' && c.contacts.has(e)));
  const d0 = Math.min(...w.flight.members.map((c) => dist(c.unit, e)));
  w.run(30);
  const d1 = Math.min(...w.flight.members.map((c) => dist(c.unit, e)));
  assert.ok(d1 < d0 - 200 && d1 < 450, `closed in: ${d0.toFixed(0)} → ${d1.toFixed(0)} m`);
  assert.ok(w.shots.some((s) => s.from !== 'player'), 'wingmen fired');
  // target out of action → back to formation with a radio call
  e.wreck = { kind: 'reactor' };
  w.run(1);
  assert.ok(w.flight.members.every((c) => c.order === 'formation'));
  assert.equal(w.flight.order, 'formation');
});

test('formation fights only near the player (leash), free fire hunts further out', () => {
  const w = world({ enemies: [['splitter', 0, -800]] });
  w.flight.deploy();
  w.run(20);
  const near = Math.max(...w.flight.members.map((c) => dist(c.unit, w.player)));
  assert.ok(near < WING.formation.leash, `formation stays within the leash (${near.toFixed(0)} m)`);
  w.flight.command('freeFire');
  w.run(30);
  const e = w.enemy();
  const closest = Math.min(...w.flight.members.map((c) => dist(c.unit, e)));
  assert.ok(closest < 500, `free fire went for the enemy: ${closest.toFixed(0)} m`);
});

test('aim at legs: switch on and off', () => {
  const w = world();
  w.flight.command('aimLegs');
  assert.ok(w.flight.members.every((c) => c.aimComponent === 'legs'));
  assert.equal(w.last(), WING_RADIO.ack.aimLegsOn);
  w.flight.command('aimLegs');
  assert.ok(w.flight.members.every((c) => c.aimComponent === 'torso'));
});

test('line of fire: a wingman holds fire while a friend stands in it', () => {
  const w = world();
  const c = w.flight.members[0];
  const m = c.unit.motion;
  c.time = 10;
  c.aimPoint.set(m.x, m.pose.y, m.z - 400);
  w.player.motion.place(m.x + 1, m.z - 150, 0);
  assert.equal(c.friendInLine(), true, 'player in the line');
  c.time = 11;
  w.player.motion.place(m.x + 60, m.z - 150, 0);
  for (const o of w.flight.members) if (o !== c) o.unit.motion.place(o.unit.motion.x + 200, o.unit.motion.z, 0);
  assert.equal(c.friendInLine(), false, 'line clear');
});

test('morale: losses break a pilot (falls back, refuses attack orders), quiet time steadies', () => {
  const w = world({ enemies: [['splitter', 0, -900]] });
  w.flight.deploy();
  const c = w.flight.members[1];
  c.morale = 0.2;
  w.run(0.5);
  assert.equal(c.broken, true);
  assert.equal(c.order, 'fallBack');
  assert.equal(w.last(), WING_RADIO.broken);
  w.setTarget(w.enemy());
  w.flight.command('attackMyTarget');
  assert.notEqual(c.order, 'attackMyTarget');
  assert.ok(w.radio.some((r) => r.text === WING_RADIO.refuse));
  assert.ok(w.flight.members.filter((x) => x !== c).every((x) => x.order === 'attackMyTarget'));
  c.morale = WING.morale.steadyAt + 0.01;
  w.run(0.5);
  assert.equal(c.broken, false);
});

test('radio on losses: legs only → "Beine weg"; reactor (legs first in the same step) → only "ausgefallen"', () => {
  const w = world();
  const [a, b] = w.flight.members;
  a.unit.wreck = { kind: 'legs' };
  a.unit.immobile = true;
  w.bus.emit('combat:wreck', { unit: a.unit.id, kind: 'legs', first: true });
  b.unit.wreck = { kind: 'legs' };
  w.bus.emit('combat:wreck', { unit: b.unit.id, kind: 'legs', first: true });
  b.unit.wreck = { kind: 'reactor' };
  w.bus.emit('combat:wreck', { unit: b.unit.id, kind: 'reactor', first: false });
  w.run(1);
  const texts = w.radio.map((r) => `${r.from}|${r.text}`);
  assert.equal(texts.filter((t) => t.includes(WING_RADIO.legsLost)).length, 1);
  assert.ok(texts.some((t) => t.startsWith('ZWEI') && t.includes(WING_RADIO.legsLost)));
  assert.ok(texts.some((t) => t.includes('DREI (FUNKE) ist ausgefallen')));
  assert.ok(w.flight.members[2].morale < w.flight.members[2].pilot.morale);
});

test('friendly fire call: once per 6 s per pilot, costs morale', () => {
  const w = world();
  const c = w.flight.members[0];
  const m0 = c.morale;
  for (let i = 0; i < 10; i++) w.bus.emit('combat:friendlyFire', { unit: c.unit.id });
  assert.equal(c.friendlyHits, 1);
  assert.equal(w.radio.filter((r) => r.text === WING_RADIO.friendlyFire).length, 1);
  w.run(WING.friendlyFireRadioGap + 0.1);
  w.bus.emit('combat:friendlyFire', { unit: c.unit.id });
  assert.equal(c.friendlyHits, 2);
  assert.ok(c.morale < m0);
});

test('kill credit: player, wingman, nobody known (ground, chain blast), lost wingman', () => {
  const player = { id: 'player', isPlayer: true, side: 'player' };
  const wing = { id: 'zwei', isPlayer: false, side: 'player' };
  const enemy = (by) => ({ side: 'enemy', killedBy: by });
  assert.equal(killCredit(enemy(player)), 'player');
  assert.equal(killCredit(enemy(wing)), 'team');
  assert.equal(killCredit(enemy(null)), 'player', 'as before wingmen existed');
  assert.equal(killCredit({ side: 'player', killedBy: { side: 'enemy' } }), null, 'a lost wingman is no kill');
});

test('no wingmen: the radio says so, nothing else changes', () => {
  const w = world({ wingmen: [] });
  assert.equal(w.flight.members.length, 0);
  assert.equal(w.flight.command('formation'), false);
  assert.equal(w.last(), WING_RADIO.noWingmen);
  w.run(1);
});

// ---- A4: orders 8 and 9 ----

test('hold fire: no shots while held, return fire for 5 s after a hit, fire free again', () => {
  const w = world({ enemies: [['splitter', 0, -350]] });
  w.flight.deploy();
  w.flight.command('holdFire');
  assert.equal(w.flight.weaponsHold, true);
  assert.equal(w.last(), WING_RADIO.ack.holdFireOn);
  w.run(15);
  assert.equal(w.shots.filter((s) => s.from !== 'player').length, 0, 'nobody fired while held');
  // ZWEI takes a hit: returns fire
  const zwei = w.flight.members[0];
  zwei.unit.damage.applyRaw('torso', 20);
  w.run(3);
  assert.ok(w.shots.some((s) => s.from === zwei.unit.id), 'ZWEI returned fire');
  assert.ok(!w.shots.some((s) => s.from !== 'player' && s.from !== zwei.unit.id), 'the others still hold');
  w.flight.command('holdFire');
  assert.equal(w.flight.weaponsHold, false);
  assert.equal(w.last(), WING_RADIO.ack.holdFireOff);
  const before = w.shots.length;
  w.run(5);
  assert.ok(w.shots.length > before, 'fire free');
});

test('radio silence / radar: wingmen emit only on order', () => {
  const w = world();
  assert.ok(w.flight.members.every((c) => !c.unit.emitting), 'radio silence by default');
  w.flight.command('radar');
  assert.ok(w.flight.members.every((c) => c.unit.emitting === true));
  assert.equal(w.last(), WING_RADIO.ack.radarOn);
  w.flight.command('radar');
  assert.ok(w.flight.members.every((c) => c.unit.emitting === false));
  assert.equal(w.last(), WING_RADIO.ack.radarOff);
});
