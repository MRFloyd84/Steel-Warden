import { DEG } from '../util/math.js';

/**
 * Scripted driver for walkers without AI (showcase, later scripted mission
 * units). Behaviours:
 *   { type: 'idle' }
 *   { type: 'circle', radius, throttle }   walks a circle (positive radius = left turn)
 *   { type: 'turn', rate }                 turns on the spot (-1..1)
 *   { type: 'pace', distance, throttle }   walks back and forth
 */
export class DummyDriver {
  constructor(behavior = { type: 'idle' }) {
    this.b = behavior;
    this.t = 0;
    this.leg = 1;
  }

  /** Sets throttle directly and returns the motion input for this step. */
  next(dt, motion) {
    this.t += dt;
    const b = this.b;
    const w = motion.w;
    switch (b.type) {
      case 'circle': {
        motion.throttle.value = b.throttle ?? 0.5;
        const v = Math.max(0.5, Math.abs(motion.speed));
        const turn = (v / b.radius) / (w.turnRate * DEG);
        return { throttleRate: 0, throttleAbs: null, turn: -Math.max(-1, Math.min(1, turn)) };
      }
      case 'turn':
        motion.throttle.value = 0;
        return { throttleRate: 0, throttleAbs: null, turn: b.rate ?? 0.6 };
      case 'pace': {
        const period = (b.distance ?? 40) / (w.maxSpeed * (b.throttle ?? 0.5));
        if (this.t > period) {
          this.t = 0;
          this.leg = -this.leg;
        }
        motion.throttle.value = this.leg > 0 ? b.throttle ?? 0.5 : -1;
        return { throttleRate: 0, throttleAbs: null, turn: 0 };
      }
      default:
        motion.throttle.value = 0;
        return { throttleRate: 0, throttleAbs: null, turn: 0 };
    }
  }
}
