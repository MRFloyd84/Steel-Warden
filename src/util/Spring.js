/** Damped 1D spring (semi-implicit Euler). Underdamped settings overshoot and wobble. */
export class Spring {
  constructor({ stiffness, damping }) {
    this.k = stiffness;
    this.c = damping;
    this.value = 0;
    this.velocity = 0;
  }

  step(dt, target = 0) {
    const accel = (target - this.value) * this.k - this.velocity * this.c;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  kick(impulse) {
    this.velocity += impulse;
  }

  reset(value = 0) {
    this.value = value;
    this.velocity = 0;
  }
}
