import * as THREE from 'three';
import { NavGrid } from './NavGrid.js';
import { Perception } from './Perception.js';
import { AIController, velocityOf } from './AIController.js';
import { AIGroup } from './AIGroup.js';
import { Gunner } from './Gunner.js';
import { GUNS } from '../data/enemies.js';
import { STRUCTURES } from '../data/structures.js';
import { buildParts } from '../render/world/PartBuilder.js';

const PATHS_PER_STEP = 3;
const RADIO = {
  reinforcements: { from: 'LEITSTELLE', text: 'Synthese-Funkverkehr aufgefangen — der Späher ruft Verstärkung!' },
  lander: { from: 'LEITSTELLE', text: 'Landefähre im Anflug, Sektor markiert auf dem Radar.' },
  edge: { from: 'LEITSTELLE', text: 'Neue Synthese-Kontakte am Rand des Einsatzgebiets.' },
  wave: (n, total) => ({ from: 'LEITSTELLE', text: `Welle ${n} von ${total} im Anflug!` }),
  waveClear: (n) => ({ from: 'LEITSTELLE', text: `Welle ${n} vernichtet.` }),
};
const litMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
let landerGeo = null;
const tmp = new THREE.Vector3();

/**
 * All AI of a mission: groups and their units from mission.forces, guns on
 * buildings, the staggered AI tick, the path budget, noise, reinforcements
 * (edge spawn or lander after a delay, called by a scout) and waves.
 *
 * mission.forces = {
 *   groups: [{ id, role: 'patrol'|'guard'|'hunt', units: [{ type, at: [x, z], heading }], patrol: [[x, z], …], loop }],
 *   guns: ['spike', 'turret' | structure id …]   buildings that fight for the enemy
 *   reinforcements: { delay (s), via: 'lander'|'edge', points: [[x, z]], trigger: 'call'|'contact', groups: [{ units: [{ type }] }] },
 *   waves: [{ delay (s after the previous wave is gone), via, points, groups }],
 * }
 * Difficulty scales unit counts, reinforcement delay, sight, aim and tactics.
 */
export class AIDirector {
  constructor({ mission, world, entities, combat, difficulty, radio = () => {}, lit = () => false, bus = null, startup = null }) {
    this.mission = mission;
    this.world = world;
    this.entities = entities;
    this.combat = combat;
    this.diff = difficulty;
    this.radio = radio;
    this.player = combat.player;
    this.perception = new Perception({ world, mission, difficulty, lit });
    const start = mission.playerStart;
    this.nav = new NavGrid({ sampler: world.sampler, objects: world.objects, center: { x: start.x, z: start.z }, size: 4200, cell: 12 });
    // Start phase (states/missionStartup.js): enemies rest until deploy (safe), or are
    // awake from the start and move on the base after scrambleDelay (scramble)
    this.startup = startup ?? { mode: 'hot', safeRadius: 0, scrambleDelay: 0 };
    this.startPoint = { x: start.x, z: start.z };
    if (this.startup.safeRadius > 0) this.nav.safeZone = { x: start.x, z: start.z, r: this.startup.safeRadius };
    this.deployed = false;
    this.deployTime = null;
    this.scrambled = false;
    this.triggers = (mission.triggers ?? []).map((t) => ({ ...t, fired: false }));
    this.gravity = world.sampler.gravity ?? 1;
    this.controllers = [];
    this.groups = [];
    this.gunners = [];
    this.pathQueue = [];
    this.landers = [];
    this.sideCache = { enemy: [], player: [] };
    this.spotted = new Map(); // target → time any AI unit last saw it (artillery spotting)
    this.frozen = false;
    this.holdFire = false;
    this.time = 0;
    this.tickMs = 0;
    this.groupSerial = 0;
    combat.onNoise = (pos, r, src) => this.noise(pos, r, src);
    this.offs = [];
    if (bus) {
      this.offs.push(
        bus.on('combat:wreck', ({ unit }) => this.onWreck(unit)),
        bus.on('world:structure', ({ id, stage }) => {
          if (stage !== 'rubble') return;
          const st = world.objects.structures.find((s) => s.id === id);
          if (st) this.nav.invalidate(st.x, st.z, st.radius + 12);
        }),
      );
    }

    const forces = mission.forces ?? {};
    const defaultActivate = this.startup.mode === 'scramble' ? 'immediate' : 'onDeploy';
    for (const g of forces.groups ?? []) {
      const activate = g.activate ?? defaultActivate;
      this.spawnGroup(g, { known: g.role === 'hunt', active: activate === 'immediate', activate });
    }
    const guns = forces.guns ?? [];
    for (const st of world.objects.structures) {
      const gun = GUNS[st.type];
      if (gun && (guns.includes(st.type) || guns.includes(st.id))) {
        const gunner = new Gunner({ st, gun, director: this, difficulty, objects: world.objects });
        gunner.active = this.startup.mode === 'scramble';
        this.gunners.push(gunner);
      }
    }
    this.reinf = forces.reinforcements ?? null;
    this.reinfState = 'ready'; // 'ready' | 'coming' | 'done'
    this.reinfT = 0;
    this.waves = forces.waves ?? [];
    this.waveIndex = -1;
    this.waveT = this.waves[0]?.delay ?? 0;
    this.waveUnits = [];
    this.wavesCleared = 0;
  }

  // ---- queries for controllers ----

  hostilesOf(u) {
    return this.combat.units.all.filter((x) => x.side !== u.side && x.wreck?.kind !== 'reactor');
  }

  unitsOfSide(side) {
    return this.sideCache[side] ?? [];
  }

  /** Someone sees the target: artillery anywhere on the side gets the data (Synthesis network). */
  spot(target, pos, vel, from) {
    this.spotted.set(target, this.time);
    for (const c of this.controllers) if (c !== from && !c.dead && c.ai.needsSpotter) c.learn(target, pos, vel, 'net');
  }

  /** Seconds since any AI unit saw the target. */
  spottedAgo(target) {
    const t = this.spotted.get(target);
    return t === undefined ? Infinity : this.time - t;
  }

  get lockingPlayer() {
    return this.controllers.find((c) => !c.dead && c.unit.locking === this.player) ?? null;
  }

  // ---- spawning ----

  /** Spawns a group; at: centre for units without own positions. known: they know where the player is. */
  spawnGroup(def, { known = false, at = null, active = true, activate = 'immediate' } = {}) {
    const id = def.id ?? `gruppe-${++this.groupSerial}`;
    const units = scaleUnits(def.units ?? [], this.diff.count);
    const center = at ?? (def.units?.[0]?.at ? { x: def.units[0].at[0], z: def.units[0].at[1] } : { x: 0, z: 0 });
    const group = new AIGroup({ id, role: def.role ?? 'patrol', patrol: def.patrol, loop: def.loop ?? true, home: { x: center.x, z: center.z } });
    group.active = active;
    group.activate = activate;
    const toPlayer = Math.atan2(-(this.player.motion.x - center.x), -(this.player.motion.z - center.z));
    units.forEach((ud, i) => {
      let x;
      let z;
      if (ud.at && !at) [x, z] = ud.at;
      else {
        const a = (i / Math.max(1, units.length)) * Math.PI * 2 + 0.4;
        const r = units.length > 1 ? 22 : 0;
        x = center.x + Math.sin(a) * r;
        z = center.z + Math.cos(a) * r;
      }
      const u = this.entities.addUnit({ id: ud.id ?? `${id}-${i + 1}`, type: ud.type, x, z, heading: ud.heading ?? toPlayer });
      u.motion.obstacles = this.world.objects;
      const ctrl = new AIController({ unit: u, director: this, difficulty: this.diff });
      ctrl.home = { x, z };
      group.add(ctrl);
      ctrl.dormant = !active;
      this.controllers.push(ctrl);
      if (known && active) ctrl.learn(this.player, this.player.volumes.componentCenter('torso', tmp), velocityOf(this.player, new THREE.Vector3()), 'net');
    });
    this.groups.push(group);
    this.updateSides();
    return group;
  }

  /** Wakes a resting group; hunters learn where the player is. */
  activateGroup(g, why) {
    if (g.active) return;
    g.active = true;
    g.activatedBy = why;
    for (const c of g.members) {
      c.dormant = false;
      if (g.role === 'hunt') c.learn(this.player, this.player.volumes.componentCenter('torso', tmp), velocityOf(this.player, new THREE.Vector3()), 'net');
    }
  }

  /** The walker is ready and leaves the start: mission clock and resting AI start. */
  deploy() {
    if (this.deployed) return;
    this.deployed = true;
    this.deployTime = this.time;
    for (const g of this.groups) if (g.activate === 'onDeploy') this.activateGroup(g, 'deploy');
    for (const gun of this.gunners) gun.active = true;
  }

  /** AI is running at all (after deploy; with scramble from the start). */
  get awake() {
    return this.deployed || this.startup.mode === 'scramble';
  }

  updateTriggers() {
    if (!this.deployed) return;
    const since = this.time - this.deployTime;
    const m = this.player.motion;
    for (const t of this.triggers) {
      if (t.fired) continue;
      const fire = t.type === 'time' ? since >= t.after : t.type === 'area' ? Math.hypot(m.x - t.at[0], m.z - t.at[1]) < t.radius : false;
      if (!fire) continue;
      t.fired = true;
      for (const g of this.groups) if (g.activate === `onTrigger:${t.id}`) this.activateGroup(g, t.id);
    }
  }

  /** Scramble: after the delay the awake groups move on the base (they know the place, not the walker). */
  updateScramble() {
    if (this.startup.mode !== 'scramble' || this.scrambled || this.time < this.startup.scrambleDelay) return;
    this.scrambled = true;
    const pos = new THREE.Vector3(this.startPoint.x, this.world.sampler.heightAt(this.startPoint.x, this.startPoint.z) + 8, this.startPoint.z);
    for (const c of this.controllers) {
      if (c.dormant || c.dead) continue;
      c.alert = { pos: pos.clone(), time: c.time, persist: true }; // until they get there
      if (c.state === 'idle' || c.state === 'patrol') c.setState('investigate');
    }
    this.radio({ from: 'LEITSTELLE', text: 'Synthese-Gruppe hält auf den Stützpunkt zu!' });
  }

  /** Distance of the nearest living enemy group (leader) to the start point. */
  nearestGroupToStart() {
    let best = null;
    for (const g of this.groups) {
      const l = g.leader ?? g.alive[0];
      if (!l) continue;
      const d = Math.hypot(l.unit.motion.x - this.startPoint.x, l.unit.motion.z - this.startPoint.z);
      if (!best || d < best.d) best = { g, d };
    }
    return best;
  }

  /** Debug: a scout and a hunter 300 m ahead of the player, hunting. */
  spawnDebugGroup() {
    const m = this.player.motion;
    const yaw = m.legYaw + m.twist;
    const at = { x: m.x - Math.sin(yaw) * 300, z: m.z - Math.cos(yaw) * 300 };
    return this.spawnGroup({ id: `debug-${++this.groupSerial}`, role: 'hunt', units: [{ type: 'splitter' }, { type: 'sichel' }] }, { known: true, at });
  }

  // ---- reinforcements and waves ----

  canCallHelp() {
    return !!this.reinf && this.reinfState === 'ready';
  }

  /** A scout radios for help (or first contact, trigger 'contact'): reinforcements after the mission's delay. */
  callReinforcements() {
    if (!this.canCallHelp()) return;
    this.reinfState = 'coming';
    this.reinfT = (this.reinf.delay ?? 60) * this.diff.reinforcement;
    this.radio(RADIO.reinforcements);
  }

  deliver(entry, label) {
    const points = entry.points ?? [[0, -800]];
    const via = entry.via ?? 'edge';
    const spawned = [];
    entry.groups.forEach((g, i) => {
      const [x, z] = points[(i + Math.floor(Math.random() * points.length)) % points.length];
      if (via === 'lander') {
        this.landers.push(new Lander({ director: this, x, z, onLand: () => spawned.push(...this.spawnGroup({ ...g, id: g.id ?? `${label}-${i + 1}`, role: 'hunt' }, { known: true, at: { x, z } }).members), wave: -1 }));
      } else {
        spawned.push(...this.spawnGroup({ ...g, id: g.id ?? `${label}-${i + 1}`, role: 'hunt' }, { known: true, at: { x, z } }).members);
      }
    });
    this.radio(via === 'lander' ? RADIO.lander : RADIO.edge);
    return spawned;
  }

  updateReinforcements(dt) {
    const r = this.reinf;
    if (!r) return;
    if (r.trigger === 'contact' && this.reinfState === 'ready' && this.controllers.some((c) => c.target?.visible)) this.callReinforcements();
    if (this.reinfState !== 'coming') return;
    this.reinfT -= dt;
    if (this.reinfT > 0) return;
    this.reinfState = 'done';
    this.deliver(r, 'verstaerkung');
  }

  updateWaves(dt) {
    if (!this.waves.length) return;
    const i = this.waveIndex;
    if (i >= 0 && i < this.waves.length) {
      // Current wave: cleared when all its units are out of action (and none is still landing)
      const landing = this.landers.some((l) => l.wave === i && !l.spawned);
      if (!landing && this.waveUnits.length && this.waveUnits.every((c) => c.unit.wreck)) {
        this.wavesCleared = i + 1;
        this.radio(RADIO.waveClear(i + 1));
        this.waveUnits = [];
        if (i + 1 >= this.waves.length) {
          this.waveIndex = this.waves.length;
          return;
        }
        this.waveIndex = i + 0.5; // waiting for the next one
        this.waveT = this.waves[i + 1].delay ?? 10;
      }
      if (Number.isInteger(this.waveIndex)) return;
    }
    if (this.waveIndex >= this.waves.length) return;
    this.waveT -= dt;
    if (this.waveT > 0) return;
    const next = Math.floor(this.waveIndex) + 1;
    this.waveIndex = next;
    const w = this.waves[next];
    this.radio(RADIO.wave(next + 1, this.waves.length));
    this.deliverWave(w, next);
  }

  /** Lands (or edge-spawns) a wave's groups; their units count for the wave once they are down. */
  deliverWave(w, n) {
    const via = w.via ?? 'lander';
    w.groups.forEach((g, i) => {
      const [x, z] = w.points[i % w.points.length];
      const spawn = () => {
        const grp = this.spawnGroup({ ...g, id: g.id ?? `welle${n + 1}-${i + 1}`, role: 'hunt' }, { known: true, at: { x, z } });
        this.waveUnits.push(...grp.members);
      };
      if (via === 'lander') this.landers.push(new Lander({ director: this, x, z, onLand: spawn, wave: n }));
      else spawn();
    });
  }

  get wavesDone() {
    return this.waves.length > 0 && this.wavesCleared >= this.waves.length;
  }

  // ---- events ----

  /** Shots and explosions: units in hearing range learn the position. */
  noise(pos, radius, source) {
    for (const c of this.controllers) {
      if (c.dead || c.dormant || c.unit === source) continue;
      const m = c.unit.motion;
      if (Math.hypot(pos.x - m.x, pos.z - m.z) < radius) c.hear(pos, source);
    }
  }

  /** A unit is out of action: its group's morale may break. */
  onWreck(id) {
    const dead = this.controllers.find((c) => c.unit.id === id);
    if (!dead?.group) return;
    for (const c of dead.group.members) {
      if (c === dead || c.dead || !c.target) continue;
      if (Math.random() < (1 - c.ai.morale) * 0.5) c.moraleBreak = c.time + 15;
    }
  }

  requestPath(c) {
    if (c.pathPending) return;
    c.pathPending = true;
    this.pathQueue.push(c);
  }

  // ---- per step ----

  updateSides() {
    const all = this.combat.units.all;
    this.sideCache.enemy = all.filter((u) => u.side === 'enemy' && u.wreck?.kind !== 'reactor');
    this.sideCache.player = all.filter((u) => u.side === 'player');
  }

  update(dt) {
    const t0 = performance.now();
    this.time += dt;
    this.updateSides();
    for (const g of this.groups) g.update(dt);
    this.updateTriggers();
    this.updateScramble();
    if (this.frozen) {
      for (const c of this.controllers) c.unit.locking = null;
    } else {
      for (const c of this.controllers) if (!c.dormant) c.step(dt);
    }
    for (const g of this.gunners) if (g.active) g.update(dt);
    for (let n = 0; n < PATHS_PER_STEP && this.pathQueue.length; n++) {
      const c = this.pathQueue.shift();
      c.pathPending = false;
      if (c.dead || !c.hasGoal) continue;
      const m = c.unit.motion;
      c.path = this.nav.findPath(m.x, m.z, c.goal.x, c.goal.z, { heavy: c.heavy, avoidSafe: c.pathAvoidSafe });
      c.pathAt = c.time;
    }
    if (this.awake) {
      this.updateReinforcements(dt);
      this.updateWaves(dt);
    }
    for (let i = this.landers.length - 1; i >= 0; i--) {
      const l = this.landers[i];
      l.update(dt);
      if (l.done) {
        l.dispose();
        this.landers.splice(i, 1);
      }
    }
    const ms = performance.now() - t0;
    this.tickMs += (ms - this.tickMs) * 0.05;
  }

  debugLines() {
    const active = this.controllers.filter((c) => !c.dead);
    const lines = [
      `KI ${this.diff.name}${this.frozen ? ' EINGEFROREN' : ''}: Einheiten ${active.length}/${this.controllers.length}  Gruppen ${this.groups.length}  Geschütze ${this.gunners.filter((g) => !g.dead).length}  Pfade ${this.nav.searches} (offen ${this.pathQueue.length})  Sicht ${this.perception.checks}  Takt ${this.tickMs.toFixed(2)} ms`
        + `${this.reinf ? `  Verstärkung ${this.reinfState}${this.reinfState === 'coming' ? ` ${this.reinfT.toFixed(0)} s` : ''}` : ''}${this.waves.length ? `  Welle ${Math.min(this.waves.length, Math.floor(this.waveIndex) + 1)}/${this.waves.length} (vernichtet ${this.wavesCleared})` : ''}${this.landers.length ? `  Landefähren ${this.landers.length}` : ''}`,
    ];
    const st = this.startup;
    const near = this.nearestGroupToStart();
    const sig = this.player.signature;
    lines.push(`Start ${st.mode}${st.mode === 'scramble' ? ` (Angriff nach ${st.scrambleDelay} s${this.scrambled ? ', läuft' : ''})` : ''}  Schutzzone ${st.safeRadius} m  ${this.deployed ? `deploy bei ${this.deployTime.toFixed(0)} s` : 'vor deploy'}  nächste Gruppe ${near ? `${near.g.id} ${Math.round(near.d)} m` : '-'}  Signatur ${sig ? `${sig.label} (Sicht ×${sig.sight}, Ortung ${sig.detect} m)` : '-'}${this.player.emitting ? ' + Sensoren' : ''}`);
    lines.push(`  Gruppen: ${this.groups.map((g) => `${g.id} ${g.active ? 'aktiv' : `ruhend (${g.activate})`}`).join(' · ')}${this.triggers.length ? `  Trigger: ${this.triggers.map((t) => `${t.id}${t.fired ? '✓' : ''}`).join(' ')}` : ''}`);
    for (const c of active.slice(0, 8)) {
      const m = c.unit.motion;
      const d = c.target ? Math.round(Math.hypot(c.target.pos.x - m.x, c.target.pos.z - m.z)) : '-';
      lines.push(`  ${c.unit.id.padEnd(12)} ${c.label.padEnd(12)} Ziel ${c.debug.target} ${d} m  Torso ${Math.round(c.unit.damage.fraction('torso') * 100)} %${c.unit.locking ? '  AUFSCHALTUNG' : ''}${c.unit.immobile ? '  stationär' : ''}`);
    }
    return lines;
  }

  dispose() {
    this.offs.forEach((off) => off());
    for (const l of this.landers) l.dispose();
    this.landers = [];
    this.combat.onNoise = null;
  }
}

/** Difficulty: more or fewer units per group (at least one); extra units copy the list. */
export function scaleUnits(list, factor) {
  if (!list.length) return [];
  const n = Math.max(1, Math.round(list.length * factor));
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = list[i % list.length];
    const round = Math.floor(i / list.length);
    out.push(round && base.at ? { ...base, id: undefined, at: [base.at[0] + round * 30 * (i % 2 ? 1 : -1), base.at[1] + round * 25] } : { ...base, id: round ? undefined : base.id });
  }
  return out;
}

/**
 * Synthesis lander: comes down over the drop point, sets its units down,
 * lifts off again. Only a visual (not a building), the units appear on touchdown.
 */
class Lander {
  constructor({ director, x, z, onLand, wave = -1 }) {
    this.d = director;
    this.wave = wave;
    this.x = x;
    this.z = z;
    this.onLand = onLand;
    this.ground = director.world.sampler.heightAt(x, z);
    landerGeo ??= buildParts(STRUCTURES.lander.parts);
    this.group = new THREE.Group();
    if (landerGeo.geometry) this.group.add(new THREE.Mesh(landerGeo.geometry, litMaterial));
    if (landerGeo.glowGeometry) this.group.add(new THREE.Mesh(landerGeo.glowGeometry, glowMaterial));
    director.world.scene.add(this.group);
    this.t = 0;
    this.phase = 'descend';
    this.spawned = false;
    this.done = false;
    this.height = 220;
    this.place();
  }

  place() {
    this.group.position.set(this.x, this.ground + this.height, this.z);
    this.group.rotation.y = this.t * 0.2;
  }

  update(dt) {
    this.t += dt;
    const fx = this.d.combat.fx;
    if (this.phase === 'descend') {
      const k = Math.min(1, this.t / 7);
      this.height = 220 * (1 - k) ** 2;
      if (Math.random() < dt * 20) fx.blast(tmp.set(this.x, this.ground + this.height + 1, this.z), 1.2, 'plasma');
      if (k >= 1) {
        this.phase = 'landed';
        this.t = 0;
        fx.groundHit(tmp.set(this.x, this.ground, this.z), 4);
        this.d.combat.sound.at('impact.blast', tmp, { gain: 1.4, rate: 0.6 });
        this.d.noise(tmp, 1200, null);
      }
    } else if (this.phase === 'landed') {
      if (!this.spawned && this.t > 1.2) {
        this.spawned = true;
        this.onLand();
      }
      if (this.t > 4) {
        this.phase = 'ascend';
        this.t = 0;
      }
    } else if (this.phase === 'ascend') {
      this.height = 3 * this.t * this.t;
      if (Math.random() < dt * 20) fx.blast(tmp.set(this.x, this.ground + this.height + 1, this.z), 1.2, 'plasma');
      if (this.height > 260) this.done = true;
    }
    this.place();
  }

  dispose() {
    this.group.removeFromParent();
  }
}
