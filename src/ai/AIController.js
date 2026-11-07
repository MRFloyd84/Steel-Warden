import * as THREE from 'three';
import { wrap } from './Perception.js';

const DEG = Math.PI / 180;
const MEMORY = 25; // s until a contact is forgotten
const THINK = 0.2; // s between decisions
const SENSE = 0.4; // s between sight checks (+ jitter)
const IDLE = { throttleRate: 0, throttleAbs: null, turn: 0 };
const DEFAULT_AI = { profile: 'hunter', preferredRange: 300, aggression: 0.5, morale: 0.5, flankChance: 0.3, sight: { range: 900, coneDeg: 120 }, detectEmitting: 1500, retreatAt: 0.25, callsHelp: false };

export const STATE_LABELS = {
  idle: 'Ruhe', patrol: 'Patrouille', investigate: 'Untersuchen', attack: 'Angriff', flank: 'Flankieren',
  retreat: 'Rückzug', callHelp: 'Verstärkung', search: 'Suchen', cover: 'Deckung', dead: 'Wrack',
};

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();

/**
 * One AI walker: perception and memory, a state machine, steering through
 * the same inputs as the player (throttle + turn, torso aim targets) and
 * fire control through its own WeaponSystem.
 *
 * States: idle/patrol → investigate → attack ⇄ flank / cover → retreat,
 * callHelp (scouts), search. A walker without legs fights on from where it
 * kneels. step() runs every simulation step (aim, weapons; sight and
 * decisions are staggered), drive() is called by MissionEntities for the
 * walker's motion input.
 */
export class AIController {
  constructor({ unit, director, difficulty }) {
    this.unit = unit;
    this.d = director;
    this.diff = difficulty;
    this.ai = { ...DEFAULT_AI, ...(unit.walker.ai ?? {}) };
    unit.controller = this;
    this.group = null;
    this.state = 'idle';
    this.stateT = 0;
    this.time = 0;
    this.dead = false;
    this.contacts = new Map(); // target unit → { target, pos, vel, time, seenAt, kind, visible }
    this.target = null;
    this.alert = null; // { pos, time } — noise of a fight with no known enemy
    this.goal = new THREE.Vector3();
    this.hasGoal = false;
    this.goalSpeed = 0.6;
    this.arrive = 12;
    this.backing = false;
    this.path = null;
    this.pathAt = -Infinity;
    this.pathPending = false;
    this.aimPoint = new THREE.Vector3();
    this.aimErr = new THREE.Vector3();
    this.aimErrT = 0;
    this.aimYaw = 0;
    this.yawErr = Math.PI;
    this.pitchErr = 0;
    this.outOfTwist = false;
    this.fireReadyAt = 0;
    this.lockT = 0;
    this.locked = false;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 4 + Math.random() * 4;
    this.flankTried = false;
    this.flankPoint = new THREE.Vector3();
    this.coverUntil = 0;
    this.coverCooldown = 0;
    this.moraleBreak = 0;
    this.thinkT = Math.random() * THINK;
    this.senseT = Math.random() * SENSE;
    this.stuck = { t: 0, check: 1, x: 0, z: 0, unstick: 0, turn: 1 };
    this.scanPhase = Math.random() * 10;
    this.ballisticCache = null;
    this.shots = 0;
    // Weapon figures for aiming
    const slots = unit.weapons.slots;
    const direct = slots.filter((s) => !s.def.missile && !s.def.ballistic);
    const fast = direct.filter((s) => s.def.kind !== 'beam' && s.def.projectileSpeed > 0);
    this.leadSpeed = fast.length ? Math.min(...fast.map((s) => s.def.projectileSpeed)) : Infinity;
    this.directRange = direct.length ? Math.max(...direct.map((s) => s.def.range)) : 0;
    this.missileSlots = slots.filter((s) => s.def.missile);
    this.missileRange = this.missileSlots.length ? Math.max(...this.missileSlots.map((s) => s.def.range)) : 0;
    this.lockTime = this.missileSlots.length ? Math.max(...this.missileSlots.map((s) => s.def.lockTime || 0)) * difficulty.lockTime : 0;
    this.ballisticSlots = slots.filter((s) => s.def.ballistic);
    this.ballisticRange = this.ballisticSlots.length ? Math.max(...this.ballisticSlots.map((s) => s.def.range)) : 0;
    this.heavy = unit.walker.tonnage >= 50;
  }

  get label() {
    return STATE_LABELS[this.state] ?? this.state;
  }

  setState(s) {
    if (s === this.state) return;
    if (s !== 'idle' && s !== 'patrol') this.wasBusy = true;
    this.state = s;
    this.stateT = 0;
  }

  // ---- knowledge ----

  /** New information about a target: 'seen' | 'located' (emitting) | 'net' (group) | 'noise'. */
  learn(target, pos, vel, kind) {
    if (!target || target.wreck?.kind === 'reactor') return;
    let c = this.contacts.get(target);
    if (!c) {
      c = { target, pos: new THREE.Vector3(), vel: new THREE.Vector3(), time: -Infinity, seenAt: -Infinity, kind, visible: false };
      this.contacts.set(target, c);
    }
    // Vague information doesn't overwrite what we see ourselves
    if (kind !== 'seen' && c.visible) return;
    if ((kind === 'noise' || kind === 'net') && c.kind === 'located' && this.time - c.time < 1) return;
    c.pos.copy(pos);
    c.vel.copy(vel);
    c.time = this.time;
    c.kind = kind;
    if (kind === 'seen') c.seenAt = this.time;
  }

  /** A shot or explosion was heard at pos (source: who caused it). */
  hear(pos, source) {
    if (this.dead) return;
    if (source && source.side && source.side !== this.unit.side && source.volumes) this.learn(source, pos, v1.set(0, 0, 0), 'noise');
    else this.alert = { pos: pos.clone(), time: this.time };
  }

  sense() {
    const u = this.unit;
    const p = u.motion.pose;
    const eye = v1.set(p.x, p.y, p.z);
    for (const h of this.d.hostilesOf(u)) {
      const res = this.d.perception.look(eye, p.yaw, this.ai.sight, this.ai.detectEmitting, h);
      const c = this.contacts.get(h);
      if (!res) {
        if (c) c.visible = false;
        continue;
      }
      const pos = h.volumes.componentCenter('torso', v2);
      const vel = velocityOf(h, v3);
      const wasVisible = c?.visible ?? false;
      this.learn(h, pos, vel, res);
      const cc = this.contacts.get(h);
      cc.visible = res === 'seen';
      if (cc.visible && !wasVisible) this.fireReadyAt = Math.max(this.fireReadyAt, this.time + this.diff.reaction * (0.6 + Math.random() * 0.6));
      this.group?.report(this, h, pos, vel, res);
      if (cc.visible) this.d.spot(h, pos, vel, this);
    }
  }

  /** Target choice: visible contacts first; focus fire (veteran+): the most damaged; else the nearest. */
  pickTarget() {
    const me = this.unit.motion;
    let best = null;
    let bestScore = Infinity;
    for (const [t, c] of this.contacts) {
      if (t.wreck?.kind === 'reactor' || (!c.visible && this.time - c.time > MEMORY)) {
        this.contacts.delete(t);
        continue;
      }
      const dist = Math.hypot(c.pos.x - me.x, c.pos.z - me.z);
      let score = dist + (c.visible ? 0 : 2000) + (this.time - c.time) * 20;
      if (this.diff.focus) score -= (1 - t.damage.fraction('torso')) * 800;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  // ---- per step ----

  step(dt) {
    const u = this.unit;
    this.time += dt;
    this.stateT += dt;
    if (this.dead) return;
    if (u.wreck?.kind === 'reactor') {
      this.dead = true;
      this.setState('dead');
      u.locking = null;
      this.hasGoal = false;
      return;
    }
    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = SENSE + Math.random() * 0.15;
      this.sense();
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = THINK;
      this.think();
    }
    this.aim(dt);
    this.fireControl(dt);
  }

  think() {
    const u = this.unit;
    const m = u.motion;
    const ai = this.ai;
    const c = (this.target = this.pickTarget());
    const health = u.damage.fraction('torso');
    if (u.immobile) {
      // No legs: fight on from where it kneels
      this.hasGoal = false;
      this.setState(c ? 'attack' : 'idle');
      return;
    }
    // Retreat: heavy damage (once — afterwards it fights to the end) or broken morale
    if (this.state !== 'retreat' && c && ((health < ai.retreatAt && !this.retreated) || this.moraleBreak > this.time)) {
      this.retreated ||= health < ai.retreatAt;
      this.setState('retreat');
    }
    if (this.alert && this.time - this.alert.time > MEMORY) this.alert = null;
    const dist = c ? Math.hypot(c.pos.x - m.x, c.pos.z - m.z) : Infinity;
    const recent = c && this.time - c.seenAt < 4;

    switch (this.state) {
      case 'idle':
      case 'patrol':
        if (c) return this.engage(c);
        if (this.alert) {
          this.setState('investigate');
          return;
        }
        this.idleMove();
        return;

      case 'investigate': {
        if (c?.visible) return this.engage(c);
        const pos = c?.pos ?? this.alert?.pos;
        if (!pos) {
          this.setState('idle');
          return;
        }
        if (this.ai.profile === 'artillery') {
          // Artillery doesn't go looking: it fires as soon as someone spots the target
          this.hasGoal = false;
          if (c && this.d.spottedAgo(c.target) < 3) this.setState('attack');
          return;
        }
        if (this.group?.role === 'guard' && this.group.home && Math.hypot(pos.x - this.group.home.x, pos.z - this.group.home.z) > 450) {
          // Guards don't leave their post; they turn to face the threat
          this.goHome();
          return;
        }
        this.setGoal(pos.x, pos.z, 0.5 + ai.aggression * 0.45, { arrive: 40 });
        if (Math.hypot(pos.x - m.x, pos.z - m.z) < 45) {
          this.alert = null;
          this.setState('search');
        }
        return;
      }

      case 'callHelp':
        this.hasGoal = false;
        if (this.stateT > 2.5) {
          this.d.callReinforcements(this.group, c?.pos ?? m.pose);
          this.setState(this.diff.flank && this.chooseFlank(c) ? 'flank' : 'attack');
        }
        return;

      case 'flank':
        if (!c) return this.setState('search');
        if (this.stateT > 25 || Math.hypot(this.flankPoint.x - m.x, this.flankPoint.z - m.z) < 40) {
          this.setState('attack');
          return;
        }
        this.setGoal(this.flankPoint.x, this.flankPoint.z, 0.9, { arrive: 30 });
        return;

      case 'cover':
        if (!c) return this.setState('search');
        if (this.time > this.coverUntil || u.damage.shieldFraction('front') > 0.8) {
          this.coverCooldown = this.time + 20;
          this.setState('attack');
        }
        return;

      case 'retreat': {
        if (!c) return this.setState('search');
        const far = Math.max(600, ai.preferredRange * 1.8);
        if (dist < far) {
          const away = this.awayFrom(c.pos, far + 100);
          this.setGoal(away.x, away.z, 1, { arrive: 30 });
        } else this.hasGoal = false;
        // A morale break wears off after 15 s; after heavy damage it regroups for 30 s, then makes a last stand
        if (this.moraleBreak < this.time && this.stateT > (this.retreated ? 30 : 15)) this.setState('attack');
        return;
      }

      case 'search': {
        if (c?.visible) return this.engage(c);
        const pos = c?.pos ?? this.alert?.pos;
        if (!pos) {
          this.setState('idle');
          return;
        }
        if (!this.hasGoal || this.stateT > 8 || Math.hypot(this.goal.x - m.x, this.goal.z - m.z) < 20) {
          this.stateT = 0;
          const a = Math.random() * Math.PI * 2;
          const r = 40 + Math.random() * 100;
          this.setGoal(pos.x + Math.sin(a) * r, pos.z + Math.cos(a) * r, 0.45, { arrive: 15 });
        }
        return;
      }

      case 'attack':
      default:
        if (!c) {
          this.setState('search');
          return;
        }
        if (!recent && !c.visible && !(this.ai.profile === 'artillery' && this.d.spottedAgo(c.target) < 6)) {
          this.setState('investigate');
          return;
        }
        this.combatMove(c, dist);
    }
  }

  /** First contact: scouts call for help, some flank, the rest attack. */
  engage(c) {
    if (this.ai.callsHelp && this.group && !this.group.helpCalled && this.d.canCallHelp(this.group) && c.visible) {
      this.group.helpCalled = true;
      this.setState('callHelp');
      return;
    }
    if (c.visible && !this.flankTried && this.diff.flank && this.ai.profile !== 'artillery') {
      this.flankTried = true;
      if (Math.random() < this.ai.flankChance && this.chooseFlank(c)) {
        this.setState('flank');
        return;
      }
    }
    this.setState(c.visible ? 'attack' : 'investigate');
  }

  /**
   * Flank point: off the target's side at preferred range, on the side closer
   * to us. It must be walkable and see the target (no flanking into a canyon
   * wall); tries 100° and then 60° off the target's heading. false = no flank.
   */
  chooseFlank(c) {
    if (!c) return false;
    const t = c.target.motion;
    const m = this.unit.motion;
    const face = t ? t.legYaw + t.twist : 0;
    const R = this.ai.preferredRange;
    const nav = this.d.nav;
    const eyeH = m.w.cockpit.eyeHeight;
    let best = null;
    for (const off of [100, 60]) {
      for (const side of [-1, 1]) {
        const a = face + side * off * DEG;
        const x = c.pos.x - Math.sin(a) * R;
        const z = c.pos.z - Math.cos(a) * R;
        if (nav && !nav.walkable(x, z, this.heavy)) continue;
        const eye = v2.set(x, this.d.world.sampler.heightAt(x, z) + eyeH, z);
        if (!this.d.perception.lineOfSight(eye, v3.copy(c.pos))) continue;
        const d = Math.hypot(x - m.x, z - m.z);
        if (!best || d < best.d) best = { x, z, d };
      }
      if (best) break;
    }
    if (!best) return false;
    this.flankPoint.set(best.x, 0, best.z);
    return true;
  }

  /** Attack movement: hold the preferred range, keep moving (strafe), take cover when shields are down. */
  combatMove(c, dist) {
    const m = this.unit.motion;
    const ai = this.ai;
    const R = ai.preferredRange;
    if (ai.profile === 'artillery') {
      // Stays back; only gives way when the enemy comes close
      if (dist < 380) {
        const away = this.awayFrom(c.pos, 600);
        this.setGoal(away.x, away.z, 0.8, { arrive: 30, backing: true });
      } else this.hasGoal = false;
      return;
    }
    if (this.diff.cover && this.time > this.coverCooldown && this.unit.damage.shieldFraction('front') < 0.3 && this.takeCover(c)) return;
    this.strafeT -= THINK;
    if (this.strafeT <= 0 || m.collided) {
      this.strafe = -this.strafe;
      this.strafeT = 4 + Math.random() * 5;
    }
    const dx = m.x - c.pos.x;
    const dz = m.z - c.pos.z;
    const a = Math.atan2(dx, dz);
    if (dist > R * 1.3) {
      this.setGoal(c.pos.x + Math.sin(a) * R, c.pos.z + Math.cos(a) * R, 0.6 + ai.aggression * 0.4, { arrive: 25 });
    } else if (dist < R * 0.6) {
      this.setGoal(c.pos.x + Math.sin(a) * R, c.pos.z + Math.cos(a) * R, 0.8, { arrive: 20, backing: true });
    } else {
      const s = a + this.strafe * (0.35 + ai.aggression * 0.2);
      this.setGoal(c.pos.x + Math.sin(s) * R, c.pos.z + Math.cos(s) * R, 0.45 + ai.aggression * 0.35, { arrive: 10 });
    }
    this.setState('attack');
  }

  /** Nearest building (or big rock) between us and the target: go behind it. */
  takeCover(c) {
    const m = this.unit.motion;
    let best = null;
    for (const st of this.d.world.objects.near(m.x, m.z, 160)) {
      if (st.stage === 'rubble' || st.radius < 4 || !st.blocksSight) continue;
      const ax = st.x - c.pos.x;
      const az = st.z - c.pos.z;
      const al = Math.hypot(ax, az) || 1;
      const off = st.radius * 0.7 + m.radius + 8;
      const x = st.x + (ax / al) * off;
      const z = st.z + (az / al) * off;
      const d = Math.hypot(x - m.x, z - m.z);
      if (d > 180 || (this.d.nav && !this.d.nav.walkable(x, z, this.heavy))) continue;
      if (!best || d < best.d) best = { x, z, d };
    }
    if (!best) {
      this.coverCooldown = this.time + 10;
      return false;
    }
    this.setGoal(best.x, best.z, 1, { arrive: 8 });
    this.coverUntil = this.time + 12;
    this.setState('cover');
    return true;
  }

  idleMove() {
    const g = this.group;
    const m = this.unit.motion;
    this.setState(g?.patrol ? 'patrol' : 'idle');
    if (g?.role === 'guard' || !g) return this.goHome();
    if (g.leader === this) {
      if (this.wasBusy) g.resumePatrol(m.x, m.z);
      this.wasBusy = false;
      const p = g.patrolPoint(m.x, m.z);
      if (p) this.setGoal(p[0], p[1], 0.45, { arrive: 20 });
      else this.hasGoal = false;
      return;
    }
    const f = g.formationPoint(this, v1);
    if (!f) return;
    const behind = Math.hypot(f.x - m.x, f.z - m.z);
    this.setGoal(f.x, f.z, Math.min(0.8, 0.4 + behind / 120), { arrive: 12 });
  }

  goHome() {
    const h = this.group?.home ?? this.home;
    const m = this.unit.motion;
    if (h && Math.hypot(h.x - m.x, h.z - m.z) > 25) this.setGoal(h.x, h.z, 0.5, { arrive: 15 });
    else this.hasGoal = false;
  }

  awayFrom(pos, dist) {
    const m = this.unit.motion;
    let dx = m.x - pos.x;
    let dz = m.z - pos.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const h = this.group?.home;
    // Fall back toward home if it lies roughly away from the enemy
    if (h) {
      const hx = h.x - pos.x;
      const hz = h.z - pos.z;
      const hl = Math.hypot(hx, hz);
      if (hl > 1 && (hx * dx + hz * dz) / hl > 0.3) return v1.set(h.x, 0, h.z);
    }
    return v1.set(pos.x + dx * dist, 0, pos.z + dz * dist);
  }

  // ---- movement ----

  setGoal(x, z, speed, { arrive = 12, backing = false } = {}) {
    // Guards stay near their post (fight within 250 m of it)
    const home = this.group?.role === 'guard' ? this.group.home : null;
    if (home) {
      const hx = x - home.x;
      const hz = z - home.z;
      const hl = Math.hypot(hx, hz);
      if (hl > 250) {
        x = home.x + (hx / hl) * 250;
        z = home.z + (hz / hl) * 250;
      }
    }
    const changed = !this.hasGoal || Math.hypot(this.goal.x - x, this.goal.z - z) > 25;
    this.goal.set(x, 0, z);
    this.hasGoal = true;
    this.goalSpeed = speed;
    this.arrive = arrive;
    this.backing = backing;
    const nav = this.d.nav;
    if (!nav) return;
    if (!changed && !(this.path && this.time - this.pathAt > 6)) return;
    const m = this.unit.motion;
    const [ax, az] = nav.toCell(m.x, m.z);
    const [bx, bz] = nav.toCell(x, z);
    if (nav.lineFree(ax, az, bx, bz, this.heavy)) {
      this.path = null;
      return;
    }
    if (this.time - this.pathAt > 2) this.d.requestPath(this);
  }

  /** Motion input for this step (called by MissionEntities). */
  drive(dt) {
    const m = this.unit.motion;
    if (this.d.frozen || this.dead) {
      m.throttle.value = 0;
      return IDLE;
    }
    const st = this.stuck;
    if (st.unstick > 0) {
      st.unstick -= dt;
      m.throttle.value = -0.6;
      return { throttleRate: 0, throttleAbs: null, turn: st.turn };
    }
    this.checkStuck(dt);
    let wx = null;
    let wz = null;
    if (this.hasGoal) {
      if (this.path?.length) {
        const cell = this.d.nav.cell;
        while (this.path.length > 1 && Math.hypot(this.path[0][0] - m.x, this.path[0][1] - m.z) < Math.max(10, cell)) this.path.shift();
        [wx, wz] = this.path[0];
      } else {
        wx = this.goal.x;
        wz = this.goal.z;
      }
    }
    const goalDist = this.hasGoal ? Math.hypot(this.goal.x - m.x, this.goal.z - m.z) : 0;
    if (wx === null || goalDist < this.arrive) {
      m.throttle.value = 0;
      // Standing: turn the legs when the target is beyond the torso's twist
      if (this.outOfTwist) return { throttleRate: 0, throttleAbs: null, turn: clamp(-wrap(this.aimYaw - m.legYaw) / (40 * DEG), -1, 1) };
      return IDLE;
    }
    let dx = wx - m.x;
    let dz = wz - m.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // Keep apart from other walkers of the side
    for (const o of this.d.unitsOfSide(this.unit.side)) {
      if (o === this.unit) continue;
      const ox = m.x - o.motion.x;
      const oz = m.z - o.motion.z;
      const d2 = ox * ox + oz * oz;
      const r = m.radius + o.motion.radius + 14;
      if (d2 > r * r || d2 < 1e-4) continue;
      const d = Math.sqrt(d2);
      const push = (r - d) / r;
      dx += (ox / d) * push * 1.5;
      dz += (oz / d) * push * 1.5;
    }
    const want = Math.atan2(-dx, -dz);
    let delta = wrap(want - m.legYaw);
    let reverse = false;
    if (this.backing && Math.abs(delta) > 110 * DEG) {
      reverse = true;
      delta = wrap(want + Math.PI - m.legYaw);
    }
    const turn = clamp(-delta / (35 * DEG), -1, 1);
    let thr = this.goalSpeed * clamp(Math.cos(delta), 0.12, 1);
    if (Math.abs(delta) > 75 * DEG) thr = 0.12;
    if (goalDist < 35) thr *= Math.max(0.35, goalDist / 35);
    m.throttle.value = reverse ? -Math.min(1, thr * 1.4) : thr;
    return { throttleRate: 0, throttleAbs: null, turn };
  }

  checkStuck(dt) {
    const st = this.stuck;
    const m = this.unit.motion;
    st.check -= dt;
    if (st.check > 0) return;
    st.check = 1;
    const moved = Math.hypot(m.x - st.x, m.z - st.z);
    st.x = m.x;
    st.z = m.z;
    if (this.hasGoal && Math.abs(m.throttle.value) > 0.25 && moved < 1.2) st.t += 1;
    else st.t = 0;
    if (st.t >= 2) {
      st.t = 0;
      st.unstick = 1.6;
      st.turn = Math.random() < 0.5 ? -1 : 1;
      this.path = null;
      this.pathAt = -Infinity;
      if (this.hasGoal) this.d.requestPath(this);
      this.stuckCount = (this.stuckCount ?? 0) + 1;
    }
  }

  // ---- aiming and firing ----

  /** Torso (and arms) toward the target with lead and an aim error that changes every reaction time. */
  aim(dt) {
    const u = this.unit;
    const m = u.motion;
    const p = m.pose;
    const c = this.target;
    const ap = this.aimPoint;
    let dist = 200;
    if (c && (c.visible || this.time - c.time < MEMORY)) {
      const tgt = c.target;
      let pos;
      let vel;
      // Artillery aims with its spotters' data (live) while someone sees the target
      if (c.visible || (this.ai.needsSpotter && this.d.spottedAgo(tgt) < 3)) {
        pos = tgt.volumes.componentCenter('torso', v1);
        vel = velocityOf(tgt, v2);
      } else {
        pos = v1.copy(c.pos).addScaledVector(c.vel, Math.min(2, this.time - c.time));
        vel = v2.copy(c.vel);
      }
      dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      const flight = Number.isFinite(this.leadSpeed) ? dist / this.leadSpeed : 0;
      ap.copy(pos).addScaledVector(vel, flight * this.diff.lead);
      this.aimErrT -= dt;
      if (this.aimErrT <= 0) {
        this.aimErrT = this.diff.reaction;
        const moving = Math.abs(m.speed) > m.w.maxSpeed * 0.5 ? 1.4 : 1;
        const ang = gauss() * this.diff.spread * moving * DEG;
        const a = Math.random() * Math.PI * 2;
        this.aimErr.set(Math.cos(a) * ang, Math.sin(a) * ang * 0.6, Math.sin(a) * ang);
      }
      ap.addScaledVector(this.aimErr, dist);
      if (!c.visible) ap.y = pos.y;
    } else {
      // Look around: the torso sweeps slowly
      this.scanPhase += dt * 0.35;
      const yaw = m.legYaw + Math.sin(this.scanPhase) * 40 * DEG;
      ap.set(p.x - Math.sin(yaw) * 200, p.y, p.z - Math.cos(yaw) * 200);
      dist = 200;
    }
    u.aimPoint = ap;
    const dx = ap.x - p.x;
    const dz = ap.z - p.z;
    const yaw = Math.atan2(-dx, -dz);
    this.aimYaw = yaw;
    const w = m.w;
    const limit = w.torsoTwistLimit * DEG;
    const twist = wrap(yaw - m.legYaw);
    this.outOfTwist = Math.abs(twist) > limit * 0.85;
    m.twistTarget = clamp(twist, -limit, limit);
    let pitch = Math.atan2(ap.y - p.y, Math.hypot(dx, dz));
    if (this.ballisticCache && c && !c.visible) pitch = 40 * DEG; // mortar raised for an indirect shot
    m.pitchTarget = clamp(pitch, w.torsoPitchLimit[0] * DEG, w.torsoPitchLimit[1] * DEG);
    this.yawErr = Math.abs(wrap(yaw - (m.legYaw + m.twist)));
    this.pitchErr = Math.abs(pitch - m.pitch);
    this.aimDist = dist;
  }

  fireControl(dt) {
    const u = this.unit;
    const c = this.target;
    const visible = !!c?.visible;
    const spotted = !!c && (visible || this.d.spottedAgo(c.target) < 3);
    // Missile lock: target seen, in range, roughly ahead
    if (this.missileSlots.length && visible && this.aimDist <= this.missileRange && this.yawErr < 30 * DEG) this.lockT = Math.min(this.lockT + dt, this.lockTime * 1.5);
    else this.lockT = Math.max(0, this.lockT - dt * 2);
    this.locked = this.lockT >= this.lockTime;
    u.locking = this.lockT > 0.25 ? c?.target ?? null : null;
    this.ballisticCache = null;
    const want = !!c && (visible || (this.ballisticSlots.length > 0 && spotted)) && this.time >= this.fireReadyAt && this.state !== 'callHelp' && !this.d.holdFire;
    const combat = this.d.combat;
    u.weapons.update(dt, {
      canFire: true,
      power: 1,
      weaponShare: 0.45,
      all: want,
      holdReason: (s) => this.hold(s, visible, spotted),
      beamHold: (s) => !!this.hold(s, visible, spotted),
      fire: (s, i) => {
        this.shots++;
        combat.fireFrom(u, s, i, this.aimPoint, this.shotFor(s));
        if (s.def.missile && this.locked) this.lockT = this.lockTime * 0.6; // keeps most of the lock for the next salvo
      },
      beam: (s, sdt, on) => {
        const key = `${u.id}:${s.id}`;
        if (on) {
          const from = u.mounts.muzzleWorld(s.id, new THREE.Vector3());
          combat.beamFrom(u, s, from, this.aimPoint, sdt);
          combat.enemyBeamPos.set(key, from);
        } else s.beamNoise = false;
        combat.enemyBeams.set(key, on);
      },
    });
  }

  /** Why a weapon holds fire this step ('' = fire). */
  hold(s, visible, spotted) {
    const d = s.def;
    const dist = this.aimDist;
    if (d.missile) {
      if (!visible) return 'SICHT';
      if (d.guidance?.includes('active') && !this.locked) return 'AUFSCHALT.';
      if (dist > d.range) return 'REICHW.';
      return this.yawErr > 20 * DEG ? 'AUSR.' : '';
    }
    if (d.ballistic) {
      if (!spotted) return 'SICHT';
      if (dist < 140) return 'NAH';
      if (this.yawErr > 8 * DEG) return 'AUSR.';
      if (!this.ballistic(s)) return 'REICHW.';
      return '';
    }
    if (!visible) return 'SICHT';
    if (dist > d.range * 0.97) return 'REICHW.';
    const tol = (s.hp.location.startsWith('arm') ? 10 : 3.5) * DEG + Math.atan2(3, Math.max(1, dist));
    if (this.yawErr > tol) return 'AUSR.';
    if (this.pitchErr > tol * 1.6 && !s.hp.location.startsWith('arm')) return 'AUSR.';
    return '';
  }

  shotFor(s) {
    const d = s.def;
    if (d.missile) {
      const active = this.locked && d.guidance?.includes('active');
      return { target: active ? this.target?.target ?? null : null, mode: active ? 'active' : 'dumb' };
    }
    if (d.ballistic) {
      const b = this.ballistic(s);
      return b ? { dir: b.dir, speed: b.speed } : {};
    }
    return {};
  }

  /**
   * Mortar: launch direction and speed (charge) for a shell to land on the
   * target (45° arc, steeper when close), with lead over the flight time.
   */
  ballistic(s) {
    if (this.ballisticCache?.slot === s) return this.ballisticCache.shot;
    const c = this.target;
    let shot = null;
    if (c) {
      const origin = this.unit.mounts.muzzleWorld(s.id, v3);
      const g = 9.81 * this.d.gravity;
      const live = c.visible || this.d.spottedAgo(c.target) < 3;
      const tgt = live ? c.target.volumes.componentCenter('torso', new THREE.Vector3()) : c.pos.clone();
      const vel = live ? velocityOf(c.target, new THREE.Vector3()) : c.vel;
      let aimP = tgt.clone().add(v2.copy(this.aimErr).multiplyScalar(this.aimDist * 0.5));
      for (let it = 0; it < 2; it++) {
        const dx = aimP.x - origin.x;
        const dz = aimP.z - origin.z;
        const dh = Math.hypot(dx, dz);
        const h = aimP.y - origin.y;
        let theta = dh < 260 ? 60 * DEG : 45 * DEG;
        let denom = 2 * Math.cos(theta) ** 2 * (dh * Math.tan(theta) - h);
        if (denom <= 0) {
          theta = 65 * DEG;
          denom = 2 * Math.cos(theta) ** 2 * (dh * Math.tan(theta) - h);
        }
        if (denom <= 0 || dh < 1) {
          shot = null;
          break;
        }
        const speed = Math.sqrt((g * dh * dh) / denom);
        if (speed > s.def.projectileSpeed) {
          shot = null;
          break;
        }
        const ct = Math.cos(theta);
        shot = { dir: new THREE.Vector3((dx / dh) * ct, Math.sin(theta), (dz / dh) * ct), speed };
        const flight = dh / (speed * ct);
        aimP = tgt.clone().addScaledVector(vel, flight * this.diff.lead).add(v2.copy(this.aimErr).multiplyScalar(this.aimDist * 0.5));
      }
    }
    this.ballisticCache = { slot: s, shot };
    return shot;
  }

  /** Data for the debug view. */
  get debug() {
    const c = this.target;
    return {
      state: this.label,
      target: c ? `${c.target.id}${c.visible ? '' : ` (${c.kind})`}` : '-',
      goal: this.hasGoal ? this.goal : null,
      path: this.path,
      lastKnown: c?.pos ?? null,
      sightRange: this.ai.sight.range * this.d.perception.rangeFactor(c?.target ?? this.d.player),
      coneDeg: this.ai.sight.coneDeg,
      locking: !!this.unit.locking,
    };
  }
}

/** World velocity of a walker from its leg heading and speed. */
export function velocityOf(u, out) {
  const m = u.motion;
  return out.set(-Math.sin(m.legYaw) * m.speed, 0, -Math.cos(m.legYaw) * m.speed);
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/** Roughly normal-distributed number (σ ≈ 1). */
function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}
