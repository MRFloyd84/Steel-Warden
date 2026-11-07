import * as THREE from 'three';

const NET_DELAY = 0.8; // s until a contact reaches the rest of the group
// Formation slots behind the leader (local x right, z back), wedge
const WEDGE = [[0, 0], [-28, 24], [28, 24], [-56, 48], [56, 48], [0, 52], [-84, 72], [84, 72]];

/**
 * A group of AI units: shared Synthesis network (contacts reach the others
 * after a short delay), formation on patrol (wedge behind the leader), the
 * patrol route, the group's role and the reinforcement call.
 *
 *   role  'patrol' walks the route; 'guard' holds its spot; 'hunt' knows
 *         where the player is from the start (reinforcements, waves, duel)
 */
export class AIGroup {
  constructor({ id, role = 'patrol', patrol = null, loop = true, home = null }) {
    this.id = id;
    this.role = role;
    this.patrol = patrol?.length ? patrol : null;
    this.loop = loop;
    this.patrolIndex = 0;
    this.patrolDir = 1;
    this.home = home; // { x, z } — where guards return to
    this.members = [];
    this.queue = []; // network messages in flight
    this.helpCalled = false;
    this.time = 0;
    this.spotted = new Map(); // target → time last seen by any member (artillery needs spotting)
  }

  add(ctrl) {
    ctrl.group = this;
    ctrl.slot = this.members.length;
    this.members.push(ctrl);
  }

  get alive() {
    return this.members.filter((c) => !c.dead);
  }

  get leader() {
    return this.members.find((c) => !c.dead && !c.unit.immobile) ?? null;
  }

  /** A member saw (or located) a target: the others learn it after NET_DELAY. */
  report(from, target, pos, vel, kind) {
    if (kind === 'seen') this.spotted.set(target, this.time);
    this.queue.push({ due: this.time + NET_DELAY, from, target, pos: pos.clone(), vel: vel.clone(), kind });
  }

  /** Seconds since any member saw the target (Infinity if never). */
  spottedAgo(target) {
    const t = this.spotted.get(target);
    return t === undefined ? Infinity : this.time - t;
  }

  update(dt) {
    this.time += dt;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const m = this.queue[i];
      if (m.due > this.time) continue;
      this.queue.splice(i, 1);
      for (const c of this.members) if (c !== m.from && !c.dead) c.learn(m.target, m.pos, m.vel, 'net');
    }
  }

  /** Formation point for a member while following the leader (world x/z). */
  formationPoint(ctrl, out = new THREE.Vector3()) {
    const lead = this.leader;
    if (!lead || lead === ctrl) return null;
    const rank = this.alive.filter((c) => c !== lead && !c.unit.immobile).indexOf(ctrl) + 1;
    const [ox, oz] = WEDGE[Math.min(rank, WEDGE.length - 1)];
    const m = lead.unit.motion;
    const c = Math.cos(m.legYaw);
    const s = Math.sin(m.legYaw);
    // Local (x right, z back) → world, the walker faces -Z at yaw 0
    out.set(m.x + ox * c + oz * s, 0, m.z - ox * s + oz * c);
    return out;
  }

  /** Back on patrol after a fight: continue from the nearest waypoint. */
  resumePatrol(x, z) {
    if (!this.patrol) return;
    let best = 0;
    let bestD = Infinity;
    this.patrol.forEach(([px, pz], i) => {
      const d = Math.hypot(px - x, pz - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    this.patrolIndex = best;
  }

  /** Current patrol waypoint; advances when the leader is close. */
  patrolPoint(x, z) {
    if (!this.patrol) return null;
    let p = this.patrol[this.patrolIndex];
    if (Math.hypot(p[0] - x, p[1] - z) < 30) {
      const n = this.patrol.length;
      if (this.loop) this.patrolIndex = (this.patrolIndex + 1) % n;
      else {
        if (this.patrolIndex + this.patrolDir >= n || this.patrolIndex + this.patrolDir < 0) this.patrolDir = -this.patrolDir;
        this.patrolIndex += this.patrolDir;
      }
      p = this.patrol[this.patrolIndex];
    }
    return p;
  }
}
