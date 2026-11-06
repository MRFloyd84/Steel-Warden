/** Frame timing, fixed-step accumulator and a smoothed FPS readout. */
export class Time {
  constructor(fixedStep, maxSteps) {
    this.fixedStep = fixedStep;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
    this.frameDt = 0;
    this.simTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.frameMs = 0;
    this.droppedSteps = 0;
    this.last = null;
  }

  /** Returns the clamped frame delta in seconds. */
  beginFrame(nowMs) {
    if (this.last === null) this.last = nowMs;
    const raw = (nowMs - this.last) / 1000;
    this.last = nowMs;
    this.frameDt = Math.min(Math.max(raw, 0), 0.25);
    this.accumulator += this.frameDt;
    this.frameCount++;
    if (this.frameDt > 0) {
      const k = 0.08;
      this.frameMs += (this.frameDt * 1000 - this.frameMs) * k;
      this.fps = this.frameMs > 0 ? 1000 / this.frameMs : 0;
    }
    return this.frameDt;
  }

  /** Iterates fixed simulation steps, dropping backlog if we fall behind. */
  consumeSteps(stepFn) {
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxSteps) {
      stepFn(this.fixedStep);
      this.accumulator -= this.fixedStep;
      this.simTime += this.fixedStep;
      steps++;
    }
    if (steps === this.maxSteps && this.accumulator >= this.fixedStep) {
      this.droppedSteps += Math.floor(this.accumulator / this.fixedStep);
      this.accumulator = 0;
    }
    return steps;
  }

  get alpha() {
    return this.accumulator / this.fixedStep;
  }

  /** Forget elapsed real time, e.g. after loading or unpausing. */
  resetAccumulator() {
    this.accumulator = 0;
  }
}
