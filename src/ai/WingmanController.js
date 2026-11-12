import * as THREE from 'three';
import { AIController } from './AIController.js';
import { WING } from '../data/pilots.js';

const v1 = new THREE.Vector3();
// States of the hunter AI (AIController.think); the wingman's own ones are not among them
const HUNTER_STATES = { idle: 1, patrol: 1, investigate: 1, attack: 1, flank: 1, retreat: 1, search: 1, cover: 1 };

/**
 * One of the player's wingmen (docs/WINGMEN-PLAN.md). Perception, aiming, fire control,
 * driving and path finding are the AIController's; only the decisions follow the order of
 * the flight (Flight.command):
 *
 *   wait          before the player deploys: stays at the start, fights what comes close
 *   formation     wedge slot behind the player, fights enemies near the player (leash)
 *   attackMyTarget  the ordered unit until it is out of action, then formation
 *   freeFire      the normal hunter AI, on a long leash around the player
 *   goNav         to the nav point, holds there and fights around it
 *   holdPosition  stays where the order reached it, fights from there
 *   fallBack      breaks off, full speed to the player, then formation
 * aimLegs (switch) aims at the legs instead of the torso.
 *
 * Morale (Flight): below WING.morale.breakAt the pilot falls back to the player.
 */
export class WingmanController extends AIController {
  constructor({ unit, director, difficulty, flight, slot, pilot }) {
    super({ unit, director, difficulty });
    this.flight = flight;
    this.slot = slot; // 0..2 → ZWEI, DREI, VIER
    this.pilot = pilot;
    this.ai = { ...this.ai, aggression: pilot.aggression, morale: pilot.morale, callsHelp: false, retreatAt: 0 };
    this.friendlyCheck = true;
    this.friendlyGap = WING.friendlyGap;
    this.order = 'wait';
    this.orderTarget = null; // attackMyTarget: the unit
    this.anchor = new THREE.Vector3(unit.motion.x, 0, unit.motion.z); // hold / nav point
    this.morale = pilot.morale;
    this.broken = false;
    this.kills = 0;
    this.friendlyHits = 0;
  }

  get player() {
    return this.d.player;
  }

  /**
   * Feuer einstellen (Flight.weaponsHold): no shots — except returning fire for 5 s after
   * this wingman took a hit.
   */
  weaponsHeld() {
    if (!this.flight.weaponsHold) return false;
    const hp = this.unit.damage.fraction('torso') + this.unit.damage.shieldFraction('front') + this.unit.damage.shieldFraction('rear');
    if (this.lastHp !== undefined && hp < this.lastHp - 1e-6) this.returnFireUntil = this.time + 5;
    this.lastHp = hp;
    return this.time >= (this.returnFireUntil ?? -1);
  }

  /** Shots of the own side are no news (only an alert for the enemy). */
  hear(pos, source) {
    if (source?.side === this.unit.side) return;
    super.hear(pos, source);
  }

  /** New order from the flight. */
  setOrder(order, { target = null, anchor = null } = {}) {
    this.order = order;
    this.orderTarget = target;
    if (anchor) this.anchor.set(anchor.x, 0, anchor.z);
    this.hasGoal = false;
    this.path = null;
    if (target) {
      // The player hands over what it knows about its target
      this.learn(target, target.volumes.componentCenter('torso', v1), velocityOf(target, new THREE.Vector3()), 'net');
    }
  }

  /** Anchor of the current order: where the leash is measured from. */
  anchorOf() {
    const p = this.player.motion;
    if (this.order === 'formation' || this.order === 'freeFire' || this.order === 'fallBack' || this.order === 'attackMyTarget') return v1.set(p.x, 0, p.z);
    return v1.copy(this.anchor);
  }

  think() {
    const u = this.unit;
    if (u.immobile) return super.think();
    if (this.broken && this.order !== 'fallBack' && this.order !== 'wait') this.order = 'formation';

    if (this.order === 'freeFire') {
      // Nothing known and nothing heard: stay with the player (the hunter AI would cycle
      // through search/idle with our own states)
      if (!this.pickTarget() && !this.alert) {
        this.target = null;
        this.idleMove();
        return;
      }
      // The hunter AI as it is, from its own states
      if (!(this.state in HUNTER_STATES)) this.setState('idle');
      super.think();
      this.leash(WING.freeFire.leash);
      return;
    }
    if (this.order === 'attackMyTarget') {
      const t = this.orderTarget;
      if (!t || t.wreck) {
        this.flight.onOrderDone(this, t);
        this.order = 'formation';
      } else {
        // Keeps the ordered target known while the player or anyone in the flight sees it
        if (this.time - (this.contacts.get(t)?.time ?? -Infinity) > 1) this.learn(t, t.volumes.componentCenter('torso', v1), velocityOf(t, new THREE.Vector3()), 'net');
        const c = (this.target = this.contacts.get(t) ?? this.pickTarget());
        const m = u.motion;
        if (!c) return;
        const dist = Math.hypot(c.pos.x - m.x, c.pos.z - m.z);
        if (c.visible || this.time - c.seenAt < 3) this.combatMove(c, dist);
        else {
          // Not in sight yet (distance, haze, cover): walk at it until we see it
          this.setGoal(c.pos.x, c.pos.z, 0.85, { arrive: this.sightRange(t) * 0.5 });
          this.setState('attack');
        }
        return;
      }
    }

    const c = (this.target = this.pickTarget());
    const m = u.motion;
    if (this.order === 'fallBack') {
      const f = this.flight.slotPoint(this, v1);
      this.setGoal(f.x, f.z, 1, { arrive: 15 });
      this.setState('fallBack');
      if (Math.hypot(this.player.motion.x - m.x, this.player.motion.z - m.z) < WING.fallBack.arrive && !this.broken) this.order = 'formation';
      return;
    }

    const cfg = { wait: WING.holdPosition, formation: WING.formation, goNav: WING.goNav, holdPosition: WING.holdPosition }[this.order] ?? WING.formation;
    const anchor = this.anchorOf().clone();
    const threat = c && (c.visible || this.time - c.seenAt < 4) && Math.hypot(c.pos.x - anchor.x, c.pos.z - anchor.z) < cfg.engage ? c : null;
    if (threat && !this.broken) {
      this.combatMove(threat, Math.hypot(threat.pos.x - m.x, threat.pos.z - m.z));
      this.leash(cfg.leash, anchor);
      return;
    }
    // No fight: take the place of the order
    if (this.order === 'formation') {
      const f = this.flight.slotPoint(this, v1);
      const behind = Math.hypot(f.x - m.x, f.z - m.z);
      // Keeps up with the player: its pace (as a share of our own top speed) plus more the
      // further behind — a heavy walker behind a fast player runs flat out
      const pace = Math.abs(this.player.motion.speed) / Math.max(1, m.w.maxSpeed);
      this.setGoal(f.x, f.z, Math.min(1, Math.max(0.35, pace + 0.1) + behind / 60), { arrive: 14 });
      this.setState('follow');
      return;
    }
    if (this.order === 'goNav') {
      this.setGoal(anchor.x + WING.slots[this.slot][0] * 0.6, anchor.z + WING.slots[this.slot][1] * 0.6, 0.8, { arrive: WING.goNav.arrive });
      this.setState(this.hasGoal && Math.hypot(this.goal.x - m.x, this.goal.z - m.z) > WING.goNav.arrive ? 'move' : 'hold');
      return;
    }
    // wait, holdPosition
    if (Math.hypot(anchor.x - m.x, anchor.z - m.z) > 15) this.setGoal(anchor.x, anchor.z, 0.6, { arrive: 10 });
    else this.hasGoal = false;
    this.setState(this.order === 'wait' ? 'wait' : 'hold');
  }

  /** How far this wingman sees the target now (sight × light × weather × difficulty). */
  sightRange(target) {
    return this.ai.sight.range * this.d.perception.rangeFactor(target) * (target?.signature?.sight ?? 1);
  }

  /**
   * Fight at the preferred range, but never further than 80 % of the current sight (haze,
   * night): a wingman that cannot see its target cannot shoot it.
   */
  combatMove(c, dist) {
    const keep = this.ai.preferredRange;
    this.ai.preferredRange = Math.min(keep, this.sightRange(c.target) * 0.8);
    super.combatMove(c, dist);
    this.ai.preferredRange = keep;
  }

  /** Idle in the hunter AI (free fire without contact): stay with the player. */
  idleMove() {
    const f = this.flight.slotPoint(this, v1);
    this.setGoal(f.x, f.z, 0.7, { arrive: 20 });
    this.setState('follow');
  }

  goHome() {
    this.idleMove();
  }

  /** Keeps the current goal within `radius` of the anchor (default: the player). */
  leash(radius, anchor = null) {
    if (!this.hasGoal || !Number.isFinite(radius)) return;
    const a = anchor ?? this.anchorOf();
    const dx = this.goal.x - a.x;
    const dz = this.goal.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d <= radius) return;
    this.setGoal(a.x + (dx / d) * radius, a.z + (dz / d) * radius, this.goalSpeed, { arrive: this.arrive, backing: this.backing });
  }
}

function velocityOf(u, out) {
  const m = u.motion;
  return out.set(-Math.sin(m.legYaw) * m.speed, 0, -Math.cos(m.legYaw) * m.speed);
}
