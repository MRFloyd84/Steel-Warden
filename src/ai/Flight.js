import * as THREE from 'three';
import { AIGroup } from './AIGroup.js';
import { WingmanController } from './WingmanController.js';
import { PILOTS, WING_NAMES, WING, WING_RADIO, wingLine } from '../data/pilots.js';
import { getDifficulty } from '../data/difficulty.js';

const HEAVY = 3;
const v1 = new THREE.Vector3();

/**
 * The player's wingmen (docs/WINGMEN-PLAN.md): spawns them next to the start, hands out the
 * seven radio orders, shares contacts inside the flight (AIGroup network), keeps the in-mission
 * morale and speaks on the radio. The AIDirector steps it (AIDirector.flight) so the wingmen
 * use its nav grid, sight and path queue; they are not in director.controllers.
 *
 * Wingmen always fly with the 'normal' AI difficulty — the menu difficulty is the enemy's.
 *
 * @param picks  [walkerId | null] × slots (MissionPrep / ?wingmen=)
 * @param env    { navPoint(): {id,x,z}|null, target(): unit|null, startup }
 */
export class Flight {
  constructor({ director, entities, world, bus, radio, picks, env }) {
    this.d = director;
    this.entities = entities;
    this.world = world;
    this.bus = bus;
    this.radio = radio;
    this.env = env;
    this.diff = getDifficulty('normal');
    this.group = new AIGroup({ id: 'team', role: 'wing' });
    this.members = [];
    this.order = 'wait';
    this.aimLegs = false;
    this.lastFF = new Map(); // controller → time of the last friendly-fire call
    this.time = 0;
    this.deployed = false;
    this.spawn(picks ?? []);
    director.flight = this;
    this.offs = bus ? [
      bus.on('combat:wreck', (e) => this.onWreck(e)),
      bus.on('combat:stage', (e) => this.onStage(e)),
      bus.on('combat:friendlyFire', (e) => this.onFriendlyFire(e)),
    ] : [];
    if (this.members.length) {
      const list = this.members.map((c) => `${WING_NAMES[c.slot]} ${c.unit.walker.name}`).join(', ');
      this.say(this.members[0], wingLine(WING_RADIO.ready, list));
    }
  }

  // ---- setup ----

  /** Wingmen next to the start: behind the player at a drop zone, in front of the hangar at a base. */
  spawn(picks) {
    const p = this.d.player.motion;
    const yaw = p.legYaw;
    const hangar = this.env.startup?.location === 'hangar';
    const placed = [{ x: p.x, z: p.z }];
    picks.slice(0, WING_NAMES.length).forEach((type, slot) => {
      if (!type) return;
      const pilot = PILOTS[slot];
      const [ox, oz] = hangar ? [(slot - 1) * 45, -110] : WING.slots[slot];
      const want = local(p.x, p.z, yaw, ox, oz);
      const spot = this.freeSpot(want.x, want.z, placed, type);
      placed.push(spot);
      const u = this.entities.addUnit({ id: WING_NAMES[slot].toLowerCase(), type, x: spot.x, z: spot.z, heading: yaw, side: 'player' });
      u.motion.obstacles = this.world.objects;
      u.pilot = pilot;
      u.wingName = WING_NAMES[slot];
      const ctrl = new WingmanController({ unit: u, director: this.d, difficulty: this.diff, flight: this, slot, pilot });
      this.group.add(ctrl);
      ctrl.slot = slot; // radio name follows the chosen slot, not the spawn order
      ctrl.home = { x: spot.x, z: spot.z };
      ctrl.anchor.set(spot.x, 0, spot.z);
      this.members.push(ctrl);
    });
    this.d.updateSides();
    // Scramble start: the wingmen are hot and fight from the start site; else they wait for deploy
    for (const c of this.members) c.setOrder('wait', { anchor: c.home });
  }

  /** Nearest walkable cell to (x, z), 30 m away from the player and the others. */
  freeSpot(x, z, placed, type) {
    const nav = this.d.nav;
    const heavy = (this.entities.player?.walker?.tonnage ?? 0) >= 50 || type === 'goliath' || type === 'koloss';
    const ok = (px, pz) => (!nav || nav.walkable(px, pz, heavy)) && placed.every((q) => Math.hypot(q.x - px, q.z - pz) > 30);
    if (ok(x, z)) return { x, z };
    for (let r = 12; r <= 240; r += 12) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const px = x + Math.sin(a) * r;
        const pz = z + Math.cos(a) * r;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  get alive() {
    return this.members.filter((c) => !c.dead);
  }

  /** Wingmen that can still take orders that need walking. */
  get mobile() {
    return this.alive.filter((c) => !c.unit.immobile);
  }

  // ---- orders ----

  /** The player left the start: the flight follows. */
  deploy() {
    if (this.deployed) return;
    this.deployed = true;
    if (!this.members.length) return;
    this.order = 'formation';
    for (const c of this.alive) if (c.order === 'wait') c.setOrder('formation');
    this.say(this.alive[0], WING_RADIO.deploy);
  }

  /**
   * Radio order (RadioMenu / Shift+1..7). Returns false when there is nobody to take it.
   * id: formation | attackMyTarget | freeFire | goNav | holdPosition | fallBack | aimLegs
   */
  command(id) {
    const all = this.alive;
    if (!all.length) {
      this.radio({ from: 'FUNK', text: WING_RADIO.noWingmen });
      return false;
    }
    const speaker = all[0];
    if (id === 'aimLegs') {
      this.aimLegs = !this.aimLegs;
      for (const c of all) c.aimComponent = this.aimLegs ? 'legs' : 'torso';
      this.say(speaker, WING_RADIO.ack[this.aimLegs ? 'aimLegsOn' : 'aimLegsOff']);
      return true;
    }
    if (id === 'attackMyTarget') {
      const t = this.env.target();
      if (!t || t.side !== 'enemy' || t.wreck) {
        this.say(speaker, WING_RADIO.noTarget);
        return true;
      }
      const willing = all.filter((c) => !c.broken);
      for (const c of all) {
        if (c.broken) this.say(c, WING_RADIO.refuse);
        else c.setOrder('attackMyTarget', { target: t });
      }
      if (willing.length) this.say(willing[0], wingLine(WING_RADIO.ack.attackMyTarget, `${t.walker.name}, ${Math.round(dist(willing[0].unit, t))} m`));
      this.order = 'attackMyTarget';
      return true;
    }
    if (id === 'goNav') {
      const n = this.env.navPoint();
      if (!n) {
        this.say(speaker, WING_RADIO.noNav);
        return true;
      }
      for (const c of all) c.setOrder('goNav', { anchor: n });
      this.order = 'goNav';
      this.say(speaker, wingLine(WING_RADIO.ack.goNav, n.id));
      return true;
    }
    if (id === 'holdPosition') {
      for (const c of all) c.setOrder('holdPosition', { anchor: c.unit.motion });
    } else if (['formation', 'freeFire', 'fallBack'].includes(id)) {
      for (const c of all) c.setOrder(id);
    } else return false;
    this.order = id;
    this.say(speaker, WING_RADIO.ack[id]);
    return true;
  }

  /** A wingman's ordered target is out of action. */
  onOrderDone(ctrl, target) {
    if (this.order === 'attackMyTarget' && this.alive.every((c) => c.order !== 'attackMyTarget' || c === ctrl)) {
      this.order = 'formation';
      if (target?.wreck) this.say(ctrl, WING_RADIO.targetDown);
    }
  }

  /**
   * Formation point of a wingman: wedge behind the player (x right, z back). A slot that is
   * not walkable (the player still inside the hangar, a wall behind it) moves to the nearest
   * walkable spot; looked up at most every 0.5 s per wingman.
   */
  slotPoint(ctrl, out = new THREE.Vector3()) {
    const p = this.d.player.motion;
    const rank = Math.max(0, this.mobile.indexOf(ctrl));
    const [ox, oz] = WING.slots[Math.min(rank, WING.slots.length - 1)];
    const q = local(p.x, p.z, p.legYaw, ox, oz);
    const nav = this.d.nav;
    if (nav && !nav.walkable(q.x, q.z, ctrl.heavy)) {
      const cache = ctrl.slotCache;
      if (cache && this.time - cache.t < 0.5 && Math.hypot(cache.qx - q.x, cache.qz - q.z) < 6) return out.set(cache.x, 0, cache.z);
      const spot = this.nearestWalkable(q.x, q.z, ctrl.heavy);
      ctrl.slotCache = { t: this.time, qx: q.x, qz: q.z, x: spot.x, z: spot.z };
      return out.set(spot.x, 0, spot.z);
    }
    return out.set(q.x, 0, q.z);
  }

  nearestWalkable(x, z, heavy) {
    const nav = this.d.nav;
    for (let r = nav.cell; r <= 160; r += nav.cell) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = x + Math.sin(a) * r;
        const pz = z + Math.cos(a) * r;
        if (nav.walkable(px, pz, heavy)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  // ---- per step ----

  update(dt) {
    this.time += dt;
    if (!this.members.length) return;
    this.group.update(dt);
    for (const c of this.members) {
      if (c.legsCallAt !== undefined && this.time >= c.legsCallAt) {
        if (c.unit.wreck?.kind === 'legs') this.say(c, WING_RADIO.legsLost);
        c.legsCallAt = undefined;
      }
      if (c.dead) continue;
      c.step(dt);
      // Morale recovers slowly when no enemy is in sight
      if (!c.target?.visible) c.morale = Math.min(c.pilot.morale, c.morale + WING.morale.recover * dt);
      this.checkMorale(c);
    }
  }

  checkMorale(c) {
    const k = WING.morale;
    if (!c.broken && c.morale < k.breakAt) {
      c.broken = true;
      c.setOrder('fallBack');
      this.say(c, WING_RADIO.broken);
    } else if (c.broken && c.morale >= k.steadyAt) {
      c.broken = false;
      if (c.order === 'fallBack') c.setOrder('formation');
      this.say(c, WING_RADIO.steady);
    }
  }

  // ---- events ----

  member(id) {
    return this.members.find((c) => c.unit.id === id) ?? null;
  }

  onWreck({ unit, kind, by, first }) {
    const lost = this.member(unit);
    if (lost) {
      // A reactor kill first takes the legs, then the reactor in the same step: the legs call
      // waits a moment and is dropped if the wingman is gone by then (update)
      if (kind === 'legs') lost.legsCallAt = this.time + 0.5;
      else if (!lost.reportedLost) {
        lost.reportedLost = true;
        const other = this.alive.find((c) => c !== lost);
        this.radio({ from: other ? this.nameOf(other) : 'LEITSTELLE', text: wingLine(WING_RADIO.lost, `${lost.unit.wingName} (${lost.pilot.callsign})`) });
        for (const c of this.alive) if (c !== lost) c.morale += WING.morale.friendLost;
      }
      return;
    }
    const killer = by && first ? this.member(by) : null;
    if (killer) {
      killer.kills++;
      killer.morale = Math.min(1, killer.morale + WING.morale.kill);
      this.say(killer, WING_RADIO.kill);
    }
  }

  onStage({ unit, component, to }) {
    const c = this.member(unit);
    if (!c || c.dead || to !== HEAVY || (component !== 'torso' && component !== 'legs')) return;
    c.morale += WING.morale.heavyHit;
    this.say(c, WING_RADIO.heavyHit);
  }

  onFriendlyFire({ unit }) {
    const c = this.member(unit);
    if (!c || c.dead) return;
    const last = this.lastFF.get(c) ?? -Infinity;
    if (this.time - last < WING.friendlyFireRadioGap) return;
    this.lastFF.set(c, this.time);
    c.friendlyHits++;
    c.morale += WING.morale.friendlyFire;
    this.say(c, WING_RADIO.friendlyFire);
  }

  // ---- radio and status ----

  nameOf(c) {
    return `${c.unit.wingName} · ${c.pilot.callsign}`;
  }

  say(c, text) {
    if (c) this.radio({ from: this.nameOf(c), text });
  }

  /** One line per wingman for the radio menu, radar and debrief. */
  status() {
    return this.members.map((c) => {
      const u = c.unit;
      const d = u.damage;
      return {
        slot: c.slot,
        name: u.wingName,
        callsign: c.pilot.callsign,
        pilot: c.pilot.name,
        walker: u.walker.name,
        state: u.wreck?.kind === 'reactor' ? 'lost' : u.immobile ? 'immobile' : c.broken ? 'broken' : 'ok',
        order: c.order,
        label: c.label,
        torso: d.fraction('torso'),
        damage: Object.fromEntries(Object.keys(d.parts).map((k) => [k, d.fraction(k)])),
        kills: c.kills,
        friendlyHits: c.friendlyHits,
        morale: c.morale,
        x: u.motion.x,
        z: u.motion.z,
      };
    });
  }

  debugLines() {
    if (!this.members.length) return [];
    return [`Team: Befehl ${this.order}${this.aimLegs ? ' + Beine' : ''}  ` + this.members.map((c) => `${c.unit.wingName} ${c.unit.walker.name} ${c.label} T${Math.round(c.unit.damage.fraction('torso') * 100)} % Moral ${c.morale.toFixed(2)}${c.target ? ` Ziel ${c.target.target.id}` : ''}`).join(' · ')];
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.offs = [];
  }
}

/** Local offset (x right, z back) of a walker at (x, z) facing yaw → world x/z. */
function local(x, z, yaw, ox, oz) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x + ox * c + oz * s, z: z - ox * s + oz * c };
}

function dist(a, b) {
  return Math.hypot(a.motion.x - b.motion.x, a.motion.z - b.motion.z);
}

