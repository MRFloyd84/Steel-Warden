import { STARTUP_SCRIPT, SYSTEMS } from '../data/systems.js';

/**
 * Runs the startup script by moving the real cockpit controls (cause
 * 'auto'), so switches flip visibly and every sound plays. In 'simple'
 * mode it does everything except the steps marked for the player and
 * waits for those; in 'auto' mode it does everything. It never touches
 * the simulation directly. Stops after an emergency shutdown.
 */
export class StartupAutomation {
  constructor(controls, mode) {
    this.c = controls;
    this.mode = mode;
    this.active = false;
    this.index = 0;
    this.phase = 'next';
    this.queue = [];
    this.delay = 0;
    this.waitT = 0;
    this.held = new Set();
  }

  start(mode = this.mode) {
    this.mode = mode;
    this.active = true;
    this.index = 0;
    this.phase = 'next';
    this.delay = 0;
  }

  stop() {
    this.active = false;
    for (const id of this.held) this.c.release(id, 'auto');
    this.held.clear();
  }

  get currentStep() {
    return this.active ? STARTUP_SCRIPT[this.index]?.id ?? null : null;
  }

  update(dt, flags) {
    if (!this.active) return;
    if (flags.scrammed) {
      this.stop();
      return;
    }
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    const step = STARTUP_SCRIPT[this.index];
    if (!step) {
      this.stop();
      return;
    }
    const done = flags[step.flag] || (step.skipIf ?? []).some((f) => flags[f]) || (step.requires && !flags[step.requires]);

    switch (this.phase) {
      case 'next':
        if (done) return this.advance(0);
        if (step.player?.includes(this.mode)) {
          this.phase = 'player';
          return;
        }
        this.queue = [...step.actions];
        this.phase = 'act';
        return;
      case 'player':
        if (done) this.advance();
        return;
      case 'act':
        if (this.queue.length) return this.runNext();
        this.phase = 'wait';
        this.waitT = 0;
        return;
      case 'wait':
        if (done) {
          this.queue = [...(step.after ?? [])];
          this.phase = 'after';
          return;
        }
        this.waitT += dt;
        if (step.timeout && this.waitT > step.timeout) {
          this.queue = [...(step.retry ?? step.actions)];
          this.phase = 'act';
        }
        return;
      case 'after':
        if (this.queue.length) return this.runNext();
        return this.advance();
      default:
        return undefined;
    }
  }

  advance(delay = SYSTEMS.automation.groupDelay) {
    this.index++;
    this.phase = 'next';
    this.delay = delay;
  }

  runNext() {
    const [op, id, arg] = this.queue.shift();
    const c = this.c;
    this.delay = SYSTEMS.automation.actionDelay;
    switch (op) {
      case 'guard':
        if (c.get(id).guardOpen === arg) this.delay = 0;
        else c.setGuard(id, arg, 'auto');
        break;
      case 'set':
        if (c.value(id) === arg) this.delay = 0;
        else c.setValue(id, arg, 'auto');
        break;
      case 'press':
        c.press(id, 'auto');
        this.held.add(id);
        break;
      case 'release':
        c.release(id, 'auto');
        this.held.delete(id);
        break;
      case 'wait':
        this.delay = id;
        break;
      default:
        break;
    }
  }
}
