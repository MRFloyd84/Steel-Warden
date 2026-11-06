import { clamp } from '../util/math.js';

/**
 * Throttle lever in [-1, 1] (negative = reverse). Keys move it at a fixed
 * rate and it stays where it is released. Crossing zero stops at the
 * detent until the key is released and pressed again, so you don't slip
 * into reverse by accident. An absolute HOTAS axis overrides it when moved.
 */
export class Throttle {
  constructor(rate) {
    this.rate = rate;
    this.value = 0;
    this.detentHold = false;
    this.lastAbs = null;
  }

  stop() {
    this.value = 0;
    this.detentHold = true;
  }

  /**
   * @param rateInput  -1..1 from keys / stick
   * @param absInput   null or -1..1 from an absolute lever axis
   */
  update(dt, rateInput, absInput) {
    if (absInput !== null) {
      if (this.lastAbs === null || Math.abs(absInput - this.lastAbs) > 0.004) this.value = absInput;
      this.lastAbs = absInput;
    }
    if (rateInput === 0) {
      this.detentHold = false;
      return;
    }
    if (this.detentHold) return;

    const prev = this.value;
    let next = clamp(prev + rateInput * this.rate * dt, -1, 1);
    if (prev !== 0 && Math.sign(next) !== Math.sign(prev)) {
      next = 0;
      this.detentHold = true;
    }
    this.value = next;
  }
}
