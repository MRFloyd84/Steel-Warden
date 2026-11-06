import * as THREE from 'three';
import { MOTION_AUDIO } from '../data/sounds.js';
import { DEG } from '../util/math.js';

/**
 * Mission sound glue: control clicks (panned to where the control sits),
 * footsteps, torso servo and ventilation loops, and the walker's
 * structural noises (creaks when braking hard, thump at the torso stop,
 * hydraulic settle when coming to a halt).
 */
export class CockpitAudio {
  constructor(audio, bus, cockpit, walker) {
    this.audio = audio;
    this.cockpit = cockpit;
    this.walker = walker;
    this.profile = walker.sound;
    this.tmp = new THREE.Vector3();
    this.atLimit = false;
    this.peakSpeed = 0;
    this.detentHold = false;

    const pan = (id) => {
      const p = cockpit.positionOf(id, this.tmp);
      return p ? Math.max(-0.8, Math.min(0.8, p.x / 0.7)) : 0;
    };
    const play = (name, id, opts = {}) => audio.play(name, { pan: id ? pan(id) : 0, ...opts });
    let foot = 0;

    this.offs = [
      bus.on('control:changed', ({ id, type }) => {
        if (type === 'rotary') play('rotary.detent', id);
        else play(cockpit.controls.get(id)?.item.guard ? 'switch.toggleHeavy' : 'switch.toggle', id);
      }),
      bus.on('control:guard', ({ id, open }) => play(open ? 'guard.open' : 'guard.close', id)),
      bus.on('control:pressed', ({ id, pressed }) => play(pressed ? 'button.press' : 'button.release', id)),
      bus.on('control:lamp', ({ id, test }) => {
        if (test) play('lamp.test', id);
      }),
      bus.on('control:blocked', ({ id, reason }) => play(reason === 'end' ? 'rotary.end' : 'switch.blocked', id)),
      bus.on('walker:footfall', ({ strength }) => {
        foot = -foot || 1;
        audio.play('footstep', {
          gain: 0.35 + 0.65 * strength,
          rate: this.profile.stepPitch,
          pan: foot * MOTION_AUDIO.stepPanSpread,
        });
      }),
    ];

    this.airflow = audio.loop('airflow');
    this.servo = audio.loop('servo');
    this.motor = audio.loop('motor');
  }

  /** Per-frame modulation from the walker's motion state; ventilation needs bus power. */
  update(motion, busPowered = true, reactorPower = 1) {
    this.airflow.setGain(busPowered ? 1 : 0, 0.8);
    const m = MOTION_AUDIO;
    const w = this.walker;

    // Servo: loudness and pitch follow how fast the torso actually turns.
    const twist = Math.abs(motion.twistRate) / (w.torsoTwistRate * DEG);
    const pitch = Math.abs(motion.pitchRate) / (w.torsoPitchRate * DEG);
    const servo = Math.min(1, Math.max(twist, pitch * 0.7));
    this.servo.setGain(servo, 0.05);
    this.servo.setRate((m.servoRateMin + (m.servoRateMax - m.servoRateMin) * servo) * this.profile.servoPitch, 0.08);

    // Drive motor: hums once the reactor runs, rises with speed and throttle.
    const speedFrac = Math.min(1, Math.abs(motion.speed) / w.maxSpeed);
    const load = Math.max(speedFrac, Math.abs(motion.throttle.value) * 0.6);
    const running = reactorPower > 0.05 ? Math.min(1, reactorPower / 0.3) : 0;
    this.motor.setGain(running * (m.motorIdle + (1 - m.motorIdle) * load), 0.25);
    const motorPitch = Math.sqrt(this.profile.stepPitch);
    this.motor.setRate((m.motorRate[0] + (m.motorRate[1] - m.motorRate[0]) * load) * motorPitch, 0.3);

    if (motion.accel < -m.creakBrake) this.audio.play('structure.creak');

    const limit = motion.atTwistLimit;
    if (limit && !this.atLimit) this.audio.play('torso.limit', { pan: motion.twist > 0 ? -0.4 : 0.4 });
    this.atLimit = limit;

    const speed = Math.abs(motion.speed);
    this.peakSpeed = Math.max(this.peakSpeed, speed);
    if (speed < 0.3) {
      if (this.peakSpeed > m.settleSpeed) this.audio.play('walker.settle');
      this.peakSpeed = 0;
    }

    const hold = motion.throttle.detentHold && motion.throttle.value === 0;
    if (hold && !this.detentHold) this.audio.play('throttle.detent', { pan: -0.6 });
    this.detentHold = hold;
  }

  dispose() {
    this.offs.forEach((off) => off());
    for (const v of [this.airflow, this.servo, this.motor]) v.stop(0.2);
  }
}
