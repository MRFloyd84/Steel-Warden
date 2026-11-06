/** Pointer-lock mouse: accumulates movement deltas and button presses. */
export class Mouse {
  constructor(element, bus) {
    this.el = element;
    this.bus = bus;
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.down = new Set();
    this.pressed = new Set();

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    element.addEventListener('mousedown', (e) => {
      this.down.add(e.button);
      this.pressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.down.delete(e.button));
    element.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) {
        this.dx = 0;
        this.dy = 0;
      }
      this.bus.emit('pointer:lock', { locked: this.locked });
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

  isDown(button) {
    return this.down.has(button);
  }

  wasPressed(button) {
    return this.pressed.has(button);
  }

  endFrame() {
    this.pressed.clear();
  }
}
