/**
 * Simulation state of every cockpit control from the panel layout. This is
 * the single source of truth: the 3D cockpit, sounds and walker systems
 * all react to its events instead of reading meshes.
 *
 * Events on the bus:
 *   control:changed { id, type, value, prev, cause }  switch/knob position
 *   control:guard   { id, open, cause }                flip cover
 *   control:pressed { id, pressed, cause }             momentary button
 *   control:lamp    { id, lit }                        lamp/cap illumination
 *   control:blocked { id, reason }                     user tried something impossible
 *
 * cause is 'user' (cockpit cursor / key) or 'system' (simulation, scripts).
 */
const STATEFUL = new Set(['toggle', 'rotary', 'button', 'lamp']);

export class CockpitControls {
  constructor(layout, bus) {
    this.bus = bus;
    this.states = new Map();
    for (const item of layout.items) {
      if (!STATEFUL.has(item.type)) continue;
      this.states.set(item.id, {
        id: item.id,
        type: item.type,
        def: item,
        value: item.initial ?? 0,
        guardOpen: false,
        pressed: false,
        lit: false,
        testing: false,
      });
    }
  }

  has(id) {
    return this.states.has(id);
  }

  get(id) {
    const s = this.states.get(id);
    if (!s) throw new Error(`Unknown cockpit control "${id}"`);
    return s;
  }

  value(id) {
    return this.get(id).value;
  }

  /** Human-readable current position, e.g. "EIN" or "VORH". */
  positionLabel(id) {
    const s = this.get(id);
    return s.def.positions?.[s.value] ?? String(s.value);
  }

  setValue(id, value, cause = 'user') {
    const s = this.get(id);
    if (s.type !== 'toggle' && s.type !== 'rotary') return false;
    const max = (s.def.positions?.length ?? 2) - 1;
    const v = Math.max(0, Math.min(max, value | 0));
    if (v === s.value) return false;
    if (s.def.guard && !s.guardOpen && cause === 'user') {
      this.bus.emit('control:blocked', { id, reason: 'guard' });
      return false;
    }
    const prev = s.value;
    s.value = v;
    this.bus.emit('control:changed', { id, type: s.type, value: v, prev, cause });
    return true;
  }

  toggle(id, cause = 'user') {
    return this.setValue(id, this.get(id).value ? 0 : 1, cause);
  }

  /** Rotary step; returns false at an end stop. */
  step(id, dir, cause = 'user') {
    const s = this.get(id);
    const moved = this.setValue(id, s.value + Math.sign(dir), cause);
    if (!moved) this.bus.emit('control:blocked', { id, reason: 'end' });
    return moved;
  }

  /** Closing a cover pushes its switch back to off, like the real thing. */
  setGuard(id, open, cause = 'user') {
    const s = this.get(id);
    if (!s.def.guard || s.guardOpen === open) return false;
    if (!open && s.value !== 0) {
      const prev = s.value;
      s.value = 0;
      this.bus.emit('control:changed', { id, type: s.type, value: 0, prev, cause });
    }
    s.guardOpen = open;
    this.bus.emit('control:guard', { id, open, cause });
    return true;
  }

  press(id, cause = 'user') {
    const s = this.get(id);
    if (s.pressed) return;
    s.pressed = true;
    if (s.type === 'lamp') this.setTesting(s, true);
    else this.bus.emit('control:pressed', { id, pressed: true, cause });
  }

  release(id, cause = 'user') {
    const s = this.get(id);
    if (!s.pressed) return;
    s.pressed = false;
    if (s.type === 'lamp') this.setTesting(s, false);
    else this.bus.emit('control:pressed', { id, pressed: false, cause });
  }

  /** Lamp or illuminated button cap driven by the simulation. */
  setLamp(id, lit) {
    const s = this.get(id);
    if (s.lit === lit) return;
    s.lit = lit;
    this.bus.emit('control:lamp', { id, lit: s.lit || s.testing });
  }

  /** Press-to-test: a held lamp lights regardless of its state. */
  setTesting(s, on) {
    s.testing = on;
    this.bus.emit('control:lamp', { id: s.id, lit: s.lit || s.testing, test: on });
  }

  /** Plain data for save games. */
  snapshot() {
    const out = {};
    for (const [id, s] of this.states) out[id] = { value: s.value, guardOpen: s.guardOpen, lit: s.lit };
    return out;
  }

  restore(data) {
    for (const [id, saved] of Object.entries(data ?? {})) {
      if (!this.states.has(id)) continue;
      const s = this.states.get(id);
      s.guardOpen = !!saved.guardOpen;
      this.bus.emit('control:guard', { id, open: s.guardOpen, cause: 'system' });
      if (s.type === 'toggle' || s.type === 'rotary') this.setValue(id, saved.value, 'system');
      this.setLamp(id, !!saved.lit);
    }
  }
}
