import * as THREE from 'three';
import { COMBAT } from '../../data/combat.js';

const DEG = Math.PI / 180;
const to = new THREE.Vector3();

/**
 * ZIELNACHF.: the torso follows the locked target (or the pod component)
 * within its twist and pitch limits at its normal rates — no lead.
 * Manual aiming pauses the tracking for a moment. If the target leaves the
 * twist range the switch drops back to AUS (and the lamp goes out).
 */
export class TargetTracking {
  constructor({ controls, motion, targeting, walker, radio }) {
    this.controls = controls;
    this.motion = motion;
    this.targeting = targeting;
    this.walker = walker;
    this.radio = radio;
    this.manualUntil = 0;
    this.time = 0;
    this.active = false;
  }

  get switchedOn() {
    return this.controls.has('targetTracking') && this.controls.value('targetTracking') === 1;
  }

  /** Called when the pilot aims by hand. */
  manual() {
    this.manualUntil = this.time + COMBAT.targeting.trackingManualPause;
  }

  update(dt, eye) {
    this.time += dt;
    const t = this.targeting.target;
    this.active = false;
    if (!this.switchedOn || !t || t.wreck?.kind === 'reactor') return;
    const m = this.motion;
    if (!m.limits.canTwist) return;
    t.volumes.componentCenter(this.targeting.component ?? 'torso', to).sub(eye);
    const yaw = Math.atan2(-to.x, -to.z);
    const twist = wrap(yaw - m.legYaw);
    const limit = this.walker.torsoTwistLimit * DEG;
    if (Math.abs(twist) > limit + 2 * DEG) {
      this.controls.setValue('targetTracking', 0, 'system');
      this.radio?.();
      return;
    }
    this.active = true;
    if (this.time < this.manualUntil) return;
    const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    const [pMin, pMax] = this.walker.torsoPitchLimit;
    m.twistTarget = Math.max(-limit, Math.min(limit, twist));
    m.pitchTarget = Math.max(pMin * DEG, Math.min(pMax * DEG, pitch));
  }
}

function wrap(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
