import { DEFAULT_BINDINGS } from '../data/inputBindings.js';
import { Storage } from '../core/Storage.js';
import { Keyboard } from './Keyboard.js';
import { Mouse } from './Mouse.js';
import { GamepadInput } from './Gamepad.js';

/**
 * Maps raw devices to named actions and axes. Game code only ever asks for
 * actions ("moveForward", "pause") — never for keys or button indices.
 */
export class InputManager {
  constructor(canvas, bus) {
    this.bindings = mergeBindings(DEFAULT_BINDINGS, Storage.load('bindings'));
    this.rebuildKeyIndex();
    this.keyboard = new Keyboard((code) => this.boundCodes.has(code));
    this.mouse = new Mouse(canvas, bus);
    this.gamepad = new GamepadInput(bus);
  }

  rebuildKeyIndex() {
    this.boundCodes = new Set(Object.values(this.bindings.keys).flat());
  }

  poll() {
    this.gamepad.poll();
  }

  isDown(action) {
    const codes = this.bindings.keys[action];
    if (codes?.some((c) => this.keyboard.isDown(c))) return true;
    const mouseButtons = this.bindings.mouseButtons[action];
    if (mouseButtons?.some((b) => this.mouse.isDown(b))) return true;
    const buttons = this.bindings.gamepad.buttons[action];
    return buttons?.some((b) => this.gamepad.isDown(b)) ?? false;
  }

  wasPressed(action) {
    const codes = this.bindings.keys[action];
    if (codes?.some((c) => this.keyboard.wasPressed(c))) return true;
    const mouseButtons = this.bindings.mouseButtons[action];
    if (mouseButtons?.some((b) => this.mouse.wasPressed(b))) return true;
    const buttons = this.bindings.gamepad.buttons[action];
    return buttons?.some((b) => this.gamepad.wasPressed(b)) ?? false;
  }

  /** Composite axis in [-1, 1] from keys plus any mapped gamepad axes. */
  axis(name) {
    let value = 0;
    const pair = this.bindings.keyAxes[name];
    if (pair) value += (this.isDown(pair[0]) ? 1 : 0) - (this.isDown(pair[1]) ? 1 : 0);
    value += this.gamepadAxis(name);
    return Math.max(-1, Math.min(1, value));
  }

  gamepadAxis(name) {
    const { deadzone, axes } = this.bindings.gamepad;
    let value = 0;
    for (const map of axes) {
      if (map.action !== name) continue;
      const raw = applyDeadzone(this.gamepad.axis(map.axis), deadzone);
      value += map.invert ? -raw : raw;
    }
    return value;
  }

  /**
   * Absolute axis value (e.g. a HOTAS throttle lever) or null when no
   * connected device has that axis mapped.
   */
  absoluteAxis(name) {
    if (!this.gamepad.connected) return null;
    const map = this.bindings.gamepad.axes.find((m) => m.action === name);
    if (!map || this.gamepad.axes.length <= map.axis) return null;
    const raw = this.gamepad.axis(map.axis);
    return map.invert ? -raw : raw;
  }

  /** Look rotation for this frame in radians (mouse + right stick). */
  lookDelta(dt) {
    const { sensitivity, invertY } = this.bindings.mouse;
    const m = this.mouse.consumeDelta();
    const speed = this.bindings.gamepad.lookSpeed * dt;
    const x = m.x * sensitivity + this.gamepadAxis('lookX') * speed;
    let y = m.y * sensitivity + this.gamepadAxis('lookY') * speed;
    if (invertY) y = -y;
    return { x, y };
  }

  endFrame() {
    this.keyboard.endFrame();
    this.mouse.endFrame();
  }
}

function applyDeadzone(v, dz) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}

/** Overrides replace whole entries per section so partial saves stay valid. */
function mergeBindings(defaults, overrides) {
  const merged = structuredClone(defaults);
  if (!overrides || typeof overrides !== 'object') return merged;
  for (const section of ['keys', 'mouseButtons', 'keyAxes', 'mouse']) {
    if (overrides[section]) Object.assign(merged[section], overrides[section]);
  }
  if (overrides.gamepad) {
    const g = overrides.gamepad;
    if (typeof g.deadzone === 'number') merged.gamepad.deadzone = g.deadzone;
    if (typeof g.lookSpeed === 'number') merged.gamepad.lookSpeed = g.lookSpeed;
    if (Array.isArray(g.axes)) merged.gamepad.axes = g.axes;
    if (g.buttons) Object.assign(merged.gamepad.buttons, g.buttons);
  }
  return merged;
}
