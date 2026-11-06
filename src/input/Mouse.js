/** Pointer-lock mouse: accumulates movement and wheel deltas, button presses and releases. */
export class Mouse {
  constructor(element, bus) {
    this.el = element;
    this.bus = bus;
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    element.addEventListener('mousedown', (e) => {
      this.down.add(e.button);
      this.pressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      if (this.down.delete(e.button)) this.released.add(e.button);
    });
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      // One notch = ±1 regardless of the device's delta units.
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    element.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) {
        this.dx = 0;
        this.dy = 0;
      }
      this.bus.emit('pointer:lock', { locked: this.locked });
    });
    window.addEventListener('blur', () => {
      for (const b of this.down) this.released.add(b);
      this.down.clear();
    });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const result = this.el.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* lock refused (e.g. too soon after exit) — user can click again */
    }
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  consumeDelta() {
    const d = { x: this.dx, y: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }

  /** Wheel notches since the last call (positive = toward the user / down). */
  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  isDown(button) {
    return this.down.has(button);
  }

  wasPressed(button) {
    return this.pressed.has(button);
  }

  wasReleased(button) {
    return this.released.has(button);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
