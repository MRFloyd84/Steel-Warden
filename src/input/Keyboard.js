/**
 * Tracks held keys and per-frame presses by KeyboardEvent.code.
 * The only keyboard listener of the game (InputManager decides what it means).
 */
export class Keyboard {
  /** @param {(code:string)=>boolean} isGameKey  keys bound in the active context get preventDefault */
  constructor(isGameKey) {
    this.isGameKey = isGameKey;
    this.onRaw = null; // (code, event) → true if consumed (rebinding capture)
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (!e.repeat && this.onRaw?.(e.code, e)) {
        e.preventDefault();
        return;
      }
      if (this.isGameKey(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (this.down.delete(e.code)) this.released.add(e.code);
    });
    // Losing focus would otherwise leave keys "stuck".
    // Focus loss (Alt+Tab, other browser tab): release everything held
    const releaseAll = () => {
      for (const code of this.down) this.released.add(code);
      this.down.clear();
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
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
