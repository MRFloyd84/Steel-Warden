/** Tracks held keys and per-frame presses by KeyboardEvent.code. */
export class Keyboard {
  /** @param {(code:string)=>boolean} isGameKey  game keys get preventDefault */
  constructor(isGameKey) {
    this.isGameKey = isGameKey;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    window.addEventListener('keydown', (e) => {
      if (this.isGameKey(e.code) && !isTypingTarget(e.target)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (this.down.delete(e.code)) this.released.add(e.code);
    });
    // Losing focus would otherwise leave keys "stuck".
    window.addEventListener('blur', () => {
      for (const code of this.down) this.released.add(code);
      this.down.clear();
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasReleased(code) {
    return this.released.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}

function isTypingTarget(el) {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable;
}
