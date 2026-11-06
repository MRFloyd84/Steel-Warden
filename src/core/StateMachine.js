/**
 * Holds named states. Transitions are deferred to the start of the next
 * frame so a state never gets torn down in the middle of its own update.
 */
export class StateMachine {
  constructor(game) {
    this.game = game;
    this.states = new Map();
    this.current = null;
    this.currentName = null;
    this.pending = null;
  }

  register(name, state) {
    this.states.set(name, state);
  }

  change(name, params = {}) {
    if (!this.states.has(name)) throw new Error(`Unknown state "${name}"`);
    this.pending = { name, params };
  }

  applyPending() {
    if (!this.pending) return false;
    const { name, params } = this.pending;
    this.pending = null;
    const previous = this.currentName;
    this.current?.exit();
    this.current = this.states.get(name);
    this.currentName = name;
    this.current.enter(params);
    this.game.bus.emit('state:changed', { from: previous, to: name });
    return true;
  }
}
