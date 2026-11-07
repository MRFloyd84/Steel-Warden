import { Storage } from './Storage.js';
import { OPTIONS, OPTION_BY_ID } from '../data/options.js';

const KEY = 'settings';

/**
 * Player settings (Optionen). Values live in localStorage (Storage wraps
 * try/catch) and take effect immediately: every change runs the option's
 * apply(game, value) and emits settings:changed on the bus.
 */
export class Settings {
  constructor(game) {
    this.game = game;
    const saved = Storage.load(KEY, {}) ?? {};
    this.values = {};
    for (const o of OPTIONS) this.values[o.id] = valid(o, saved[o.id]) ? saved[o.id] : o.default;
  }

  get(id) {
    return this.values[id];
  }

  set(id, value) {
    const o = OPTION_BY_ID[id];
    if (!o || !valid(o, value)) return;
    this.values[id] = value;
    Storage.save(KEY, this.values);
    o.apply?.(this.game, value);
    this.game.bus.emit('settings:changed', { id, value });
  }

  /** One step left/right for a choice, or a slider step. */
  step(id, dir) {
    const o = OPTION_BY_ID[id];
    const v = this.values[id];
    if (o.type === 'choice') {
      const i = o.choices.findIndex((c) => c.value === v);
      const n = Math.max(0, Math.min(o.choices.length - 1, i + dir));
      if (n === i) return false;
      this.set(id, o.choices[n].value);
      return true;
    }
    if (o.type === 'slider') {
      const n = Math.round(Math.max(o.min, Math.min(o.max, v + dir * o.step)) / o.step) * o.step;
      if (Math.abs(n - v) < 1e-9) return false;
      this.set(id, +n.toFixed(4));
      return true;
    }
    return false;
  }

  resetPage(page) {
    for (const o of OPTIONS) if (o.page === page) this.set(o.id, o.default);
  }

  /** Applies all values (game start). */
  applyAll() {
    for (const o of OPTIONS) o.apply?.(this.game, this.values[o.id]);
  }
}

function valid(o, v) {
  if (v === undefined || v === null) return false;
  if (o.type === 'choice') return o.choices.some((c) => c.value === v);
  if (o.type === 'slider') return typeof v === 'number' && v >= o.min && v <= o.max;
  return false;
}
