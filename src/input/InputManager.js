import { ACTIONS, ACTION_BY_ID, KEY_AXES, INPUT_DEFAULTS, CONTEXTS } from './actions.js';
import { Storage } from '../core/Storage.js';
import { Keyboard } from './Keyboard.js';
import { Mouse } from './Mouse.js';
import { GamepadInput } from './Gamepad.js';
import { loadLayoutMap } from './keyLabels.js';

const STORE_KEY = 'controls';
const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

/**
 * Maps devices to actions (input/actions.js) for the active contexts.
 *
 * States set the context each frame (setContext('combat') …); 'global'
 * actions are always live and the 'debug' layer is added while debug mode
 * is on. Game code only asks for actions — input.action('fireChain') —
 * and axes; no module listens to keys itself.
 *
 * Rules: a Shift combination wins over the plain key in the active
 * contexts; Ctrl/Alt/Meta held → no keyboard actions (browser shortcuts);
 * preventDefault only for keys bound in the active contexts; OS key repeat
 * is ignored; on focus loss all held keys and buttons are released.
 */
export class InputManager {
  constructor(canvas, bus) {
    this.bus = bus;
    this.debugMode = false;
    this.context = 'menu';
    this.keyboard = new Keyboard((code) => this.activeCodes.has(code));
    this.mouse = new Mouse(canvas, bus);
    this.gamepad = new GamepadInput(bus);
    this.capture = null; // rebinding UI: callback for the next key/button
    this.keyboard.onRaw = (code, e) => this.onRawKey(code, e);
    this.mouse.onRaw = (button) => this.onRawMouse(button);
    this.load();
    loadLayoutMap(() => bus.emit('input:layout'));
  }

  // ---- bindings ----

  /** Defaults merged with the user's saved bindings and settings. */
  load() {
    const saved = Storage.load(STORE_KEY, {}) ?? {};
    this.settings = {
      mouse: { ...INPUT_DEFAULTS.mouse, ...saved.mouse },
      gamepad: { ...structuredClone(INPUT_DEFAULTS.gamepad), ...saved.gamepad },
      profiles: saved.profiles ?? {},
    };
    this.keys = {};
    this.pad = {};
    for (const a of ACTIONS) {
      this.keys[a.id] = [...(saved.keys?.[a.id] ?? a.keys ?? [])].slice(0, 2);
      this.pad[a.id] = [...(saved.pad?.[a.id] ?? a.pad ?? [])];
    }
    this.rebuild();
  }

  save() {
    const keys = {};
    const pad = {};
    for (const a of ACTIONS) {
      if (!same(this.keys[a.id], a.keys ?? [])) keys[a.id] = this.keys[a.id];
      if (!same(this.pad[a.id], a.pad ?? [])) pad[a.id] = this.pad[a.id];
    }
    Storage.save(STORE_KEY, { keys, pad, mouse: this.settings.mouse, gamepad: this.settings.gamepad, profiles: this.settings.profiles });
    this.rebuild();
    this.bus.emit('input:bindings');
  }

  resetDefaults() {
    Storage.save(STORE_KEY, { profiles: this.settings.profiles });
    this.load();
    this.bus.emit('input:bindings');
  }

  /** Whole configuration as JSON text (export). */
  exportJSON() {
    return JSON.stringify({ format: 'steelwarden-controls', version: 1, keys: this.keys, pad: this.pad, mouse: this.settings.mouse, gamepad: this.settings.gamepad, profiles: this.settings.profiles }, null, 2);
  }

  /** Imports exported JSON; throws on unusable data. */
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || !d.keys) throw new Error('Keine Steuerungsdatei');
    for (const a of ACTIONS) {
      if (Array.isArray(d.keys[a.id])) this.keys[a.id] = d.keys[a.id].filter((t) => typeof t === 'string').slice(0, 2);
      if (Array.isArray(d.pad?.[a.id])) this.pad[a.id] = d.pad[a.id].filter(Number.isInteger);
    }
    if (d.mouse) Object.assign(this.settings.mouse, d.mouse);
    if (d.gamepad) Object.assign(this.settings.gamepad, d.gamepad);
    if (d.profiles) this.settings.profiles = d.profiles;
    this.save();
  }

  /** Gamepad profiles (button and axis setup), e.g. "Gamepad", "HOTAS". */
  saveProfile(name) {
    this.settings.profiles[name] = { pad: structuredClone(this.pad), gamepad: structuredClone(this.settings.gamepad) };
    this.save();
  }

  loadProfile(name) {
    const p = this.settings.profiles[name];
    if (!p) return;
    for (const a of ACTIONS) this.pad[a.id] = [...(p.pad?.[a.id] ?? a.pad ?? [])];
    this.settings.gamepad = { ...structuredClone(INPUT_DEFAULTS.gamepad), ...p.gamepad };
    this.save();
  }

  deleteProfile(name) {
    delete this.settings.profiles[name];
    this.save();
  }

  /** Sets one keyboard/mouse slot (0/1) of an action; token null clears it. */
  bindKey(id, slot, token) {
    const list = [...this.keys[id]];
    list[slot] = token;
    this.keys[id] = list.filter(Boolean).slice(0, 2);
    this.save();
  }

  bindPad(id, button) {
    this.pad[id] = button === null ? [] : [button];
    this.save();
  }

  /** Index per context: token → actions, pad button → actions; conflicts. */
  rebuild() {
    this.byContext = {};
    for (const ctx of [...Object.keys(CONTEXTS), 'global']) this.byContext[ctx] = { tokens: new Map(), pad: new Map() };
    for (const a of ACTIONS) {
      for (const ctx of a.contexts) {
        const c = this.byContext[ctx];
        for (const t of this.keys[a.id]) push(c.tokens, t, a.id);
        for (const b of this.pad[a.id]) push(c.pad, b, a.id);
      }
    }
    this.conflicts = this.findConflicts();
    for (const c of this.conflicts) console.warn(`[Steuerung] ${c.text}`);
    this.setContext(this.context, true);
  }

  /**
   * Same token on two actions in one context (global counts for every
   * context, the debug layer for every context while debug mode is on).
   */
  findConflicts() {
    const out = [];
    const seen = new Set();
    for (const ctx of Object.keys(CONTEXTS)) {
      if (ctx === 'debug') continue;
      const layers = [ctx, 'global', 'debug'];
      for (const kind of ['tokens', 'pad']) {
        const all = new Map();
        for (const l of layers) for (const [t, ids] of this.byContext[l][kind]) for (const id of ids) push(all, t, id);
        for (const [t, ids] of all) {
          const uniq = [...new Set(ids)];
          if (uniq.length < 2) continue;
          const key = `${kind}:${t}:${uniq.sort().join(',')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ token: t, kind, actions: uniq, context: ctx, text: `${kind === 'pad' ? `Pad ${t}` : t} doppelt im Kontext ${ctx}: ${uniq.join(', ')}` });
        }
      }
    }
    return out;
  }

  /** Actions that would conflict if `token` were bound to `id` (for the controls screen). */
  conflictsFor(id, token, kind = 'tokens') {
    const a = ACTION_BY_ID[id];
    const out = new Set();
    for (const other of ACTIONS) {
      if (other.id === id) continue;
      const list = kind === 'pad' ? this.pad[other.id] : this.keys[other.id];
      if (!list.includes(token)) continue;
      if (sharesContext(a, other)) out.add(other.id);
    }
    return [...out];
  }

  // ---- contexts ----

  /** Top context: 'combat' | 'freeLook' | 'missileCam' | 'external' | 'menu' | 'freeCam'. */
  setContext(ctx, force = false) {
    if (ctx === this.context && !force) return;
    this.context = ctx;
    this.layers = [ctx, 'global', ...(this.debugMode ? ['debug'] : [])];
    this.activeCodes = new Set();
    this.shiftCodes = new Set(); // codes with a Shift+ binding in the active layers
    for (const l of this.layers) {
      for (const t of this.byContext[l].tokens.keys()) {
        const shift = t.startsWith('Shift+');
        const code = shift ? t.slice(6) : t;
        if (!code.startsWith('Mouse')) this.activeCodes.add(code);
        if (shift) this.shiftCodes.add(code);
      }
    }
  }

  setDebugMode(on) {
    this.debugMode = on;
    this.setContext(this.context, true);
  }

  isActive(id) {
    const a = ACTION_BY_ID[id];
    return !!a && a.contexts.some((c) => this.layers.includes(c));
  }

  // ---- queries ----

  /** Type-aware: hold → held, press/toggle → pressed this frame. */
  action(id) {
    const a = ACTION_BY_ID[id];
    return a?.type === 'hold' ? this.held(id) : this.pressed(id);
  }

  held(id) {
    if (!this.isActive(id)) return false;
    return this.keys[id].some((t) => this.tokenState(t, 'down')) || this.pad[id].some((b) => this.gamepad.isDown(b));
  }

  pressed(id) {
    if (!this.isActive(id)) return false;
    return this.keys[id].some((t) => this.tokenState(t, 'pressed')) || this.pad[id].some((b) => this.gamepad.wasPressed(b));
  }

  released(id) {
    if (!this.isActive(id)) return false;
    return this.keys[id].some((t) => this.tokenState(t, 'released')) || this.pad[id].some((b) => this.gamepad.wasReleased(b));
  }

  tokenState(token, what) {
    const kb = this.keyboard;
    const shift = kb.isDown('ShiftLeft') || kb.isDown('ShiftRight');
    const blocked = kb.isDown('ControlLeft') || kb.isDown('ControlRight') || kb.isDown('AltLeft') || kb.isDown('MetaLeft') || kb.isDown('MetaRight');
    const wantShift = token.startsWith('Shift+');
    const code = wantShift ? token.slice(6) : token;
    if (wantShift && !shift) return what === 'released' && this.rawState(code, what);
    // Plain key while Shift is down: the Shift combination on the same key wins
    if (!wantShift && shift && this.shiftCodes.has(code)) return what === 'released' && this.rawState(code, what);
    if (blocked && !code.startsWith('Mouse')) return false;
    return this.rawState(code, what);
  }

  rawState(code, what) {
    if (code.startsWith('Mouse')) {
      const b = Number(code.slice(5));
      return what === 'down' ? this.mouse.isDown(b) : what === 'pressed' ? this.mouse.wasPressed(b) : this.mouse.wasReleased(b);
    }
    const kb = this.keyboard;
    return what === 'down' ? kb.isDown(code) : what === 'pressed' ? kb.wasPressed(code) : kb.wasReleased(code);
  }

  /** Composite axis in [-1, 1]: key pair (KEY_AXES) plus gamepad axes. */
  axis(name) {
    let value = 0;
    const pair = KEY_AXES[name];
    if (pair) value += (this.held(pair[0]) ? 1 : 0) - (this.held(pair[1]) ? 1 : 0);
    if (!pair || this.isActive(pair[0])) value += this.gamepadAxis(name);
    return Math.max(-1, Math.min(1, value));
  }

  gamepadAxis(name) {
    const { deadzone, axes } = this.settings.gamepad;
    let value = 0;
    for (const map of axes) {
      if (map.action !== name) continue;
      const raw = applyDeadzone(this.gamepad.axis(map.axis), deadzone);
      value += map.invert ? -raw : raw;
    }
    return value;
  }

  /** Absolute axis (HOTAS throttle lever) or null when none is mapped. */
  absoluteAxis(name) {
    if (!this.gamepad.connected) return null;
    const map = this.settings.gamepad.axes.find((m) => m.action === name);
    if (!map || this.gamepad.axes.length <= map.axis) return null;
    const raw = this.gamepad.axis(map.axis);
    return map.invert ? -raw : raw;
  }

  /** Right stick in radians for this frame. */
  padLook(dt) {
    const speed = this.settings.gamepad.lookSpeed * dt;
    const y = this.gamepadAxis('lookY') * speed;
    return { x: this.gamepadAxis('lookX') * speed, y: this.settings.mouse.invertY ? -y : y };
  }

  /** Look rotation for this frame in radians (mouse + right stick). */
  look(dt) {
    const { sensitivity, invertY } = this.settings.mouse;
    const m = this.mouse.consumeDelta();
    const pad = this.padLook(dt);
    let y = m.y * sensitivity;
    if (invertY) y = -y;
    return { x: m.x * sensitivity + pad.x, y: y + pad.y };
  }

  /** Raw mouse movement in pixels (cockpit cursor) plus the right stick as cursor speed. */
  cursorDelta(dt) {
    const m = this.mouse.consumeDelta();
    const s = this.settings.gamepad.cursorSpeed * dt;
    return { x: m.x + this.gamepadAxis('lookX') * s, y: m.y + this.gamepadAxis('lookY') * s };
  }

  /** Drops mouse movement collected while nothing uses it (pause, menus). */
  discardMotion() {
    this.mouse.consumeDelta();
    this.mouse.consumeWheel();
  }

  /** Wheel notches since the last call. */
  wheel() {
    return this.mouse.consumeWheel();
  }

  get sensitivity() {
    return this.settings.mouse.sensitivity;
  }

  get pointerLocked() {
    return this.mouse.locked;
  }

  requestPointerLock() {
    this.mouse.requestLock();
  }

  releasePointerLock() {
    this.mouse.releaseLock();
  }

  // ---- rebinding capture ----

  /** Next key/mouse button (kind 'key') or gamepad button/axis (kind 'pad'/'axis') goes to cb. */
  startCapture(kind, cb) {
    this.capture = { kind, cb, base: kind === 'axis' ? [...this.gamepad.axes] : null };
  }

  cancelCapture() {
    this.capture = null;
  }

  onRawKey(code, e) {
    const c = this.capture;
    if (!c || c.kind !== 'key') return false;
    if (MODIFIERS.has(code) && code !== 'ShiftLeft') return true; // wait for the real key
    if (code === 'ShiftLeft') return true;
    this.capture = null;
    if (code === 'Escape') c.cb(null);
    else c.cb((e.shiftKey ? 'Shift+' : '') + code);
    return true;
  }

  onRawMouse(button) {
    const c = this.capture;
    if (!c || c.kind !== 'key') return false;
    this.capture = null;
    const shift = this.keyboard.isDown('ShiftLeft') || this.keyboard.isDown('ShiftRight');
    c.cb(`${shift ? 'Shift+' : ''}Mouse${button}`);
    return true;
  }

  poll() {
    this.gamepad.poll();
    const c = this.capture;
    if (!c || !this.gamepad.connected) return;
    if (c.kind === 'pad') {
      const b = this.gamepad.buttons.findIndex((down, i) => down && !this.gamepad.prevButtons[i]);
      if (b >= 0) {
        this.capture = null;
        c.cb(b);
      }
    } else if (c.kind === 'axis') {
      const axes = this.gamepad.axes;
      const i = axes.findIndex((v, k) => Math.abs(v - (c.base[k] ?? 0)) > 0.6);
      if (i >= 0) {
        this.capture = null;
        c.cb(i);
      }
    }
  }

  endFrame() {
    this.keyboard.endFrame();
    this.mouse.endFrame();
  }
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function same(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function sharesContext(a, b) {
  const expand = (x) => (x.contexts.includes('global') ? Object.keys(CONTEXTS) : x.contexts.includes('debug') ? Object.keys(CONTEXTS) : x.contexts);
  const ea = expand(a);
  return expand(b).some((c) => ea.includes(c));
}

function applyDeadzone(v, dz) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}
