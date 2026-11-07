const REPEAT_DELAY = 0.38; // s held before a direction repeats
const REPEAT_RATE = 0.085; // s between repeats
const STICK = 0.55; // stick deflection that counts as a direction
const DIRS = { menuUp: [0, -1], menuDown: [0, 1], menuLeft: [-1, 0], menuRight: [1, 0] };

/**
 * Menu screen stack. Every screen is a MenuPage with its own root element;
 * only the top one is visible. Input comes from the action system (context
 * 'menu', the owning state sets it): arrows/WASD/D-pad/stick move the focus
 * spatially between [data-focus] elements, left/right change a value when
 * the focused element is adjustable, Q/E/LB/RB switch tabs, Enter/A
 * confirms, Esc/B goes back. The mouse focuses on hover and activates on
 * click. Each screen remembers its last focus. Quiet procedural sounds;
 * short CRT-style transitions.
 */
export class MenuStack {
  constructor({ game, container, className = '' }) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.className = `menu-root ${className}`;
    container.appendChild(this.root);
    this.pages = [];
    this.memory = new Map(); // page key → focus key
    this.focused = null;
    this.repeat = { dir: null, t: 0 };
    this.mouseSince = 0;
    this.root.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  get top() {
    return this.pages[this.pages.length - 1] ?? null;
  }

  get depth() {
    return this.pages.length;
  }

  push(page) {
    const prev = this.top;
    if (prev) {
      this.remember(prev);
      prev.root.hidden = true;
      prev.onHide?.();
    }
    this.pages.push(page);
    page.stack = this;
    this.root.appendChild(page.root);
    page.mount();
    this.enterFx(page);
    this.restoreFocus(page);
    return page;
  }

  pop() {
    const page = this.pages.pop();
    if (!page) return;
    this.remember(page);
    page.onHide?.();
    page.destroy();
    const top = this.top;
    if (top) {
      top.root.hidden = false;
      top.onShow?.();
      top.refresh?.();
      this.enterFx(top);
      this.restoreFocus(top);
    } else {
      this.focused = null;
    }
  }

  replace(page) {
    const old = this.pages.pop();
    if (old) {
      old.onHide?.();
      old.destroy();
    }
    this.push(page);
  }

  /** Pops down to (and keeping) the first page whose key matches, or to the root. */
  popTo(key) {
    while (this.pages.length > 1 && this.top.key !== key) this.pop();
  }

  clear() {
    while (this.pages.length) {
      const p = this.pages.pop();
      p.onHide?.();
      p.destroy();
    }
    this.focused = null;
  }

  destroy() {
    this.clear();
    this.root.remove();
  }

  setVisible(on) {
    this.root.hidden = !on;
  }

  enterFx(page) {
    page.root.classList.remove('menu-enter');
    void page.root.offsetWidth; // restart the animation
    page.root.classList.add('menu-enter');
  }

  // ---- sound ----

  sound(name) {
    this.game.audio.play(`menu.${name}`);
  }

  // ---- focus ----

  remember(page) {
    if (this.focused && page.root.contains(this.focused)) this.memory.set(page.key, this.focused.dataset.focus);
  }

  restoreFocus(page) {
    const key = this.memory.get(page.key) ?? page.initialFocus?.();
    const el = (key && page.find(key)) ?? page.focusables()[0] ?? null;
    this.focus(el, { quiet: true });
  }

  focus(el, { quiet = false, scroll = true } = {}) {
    if (el === this.focused) return;
    this.focused?.classList.remove('is-focused');
    this.focused = el;
    if (!el) return;
    el.classList.add('is-focused');
    if (scroll) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (!quiet) this.sound('move');
    this.top?.onFocus?.(el);
  }

  /**
   * Spatial navigation: nearest focusable in the direction (dx, dy). Distance
   * across the direction counts as the gap between the two boxes (0 when they
   * overlap), so a wide row right below wins over a button far down. Wraps vertically.
   */
  move(dx, dy) {
    const page = this.top;
    const list = page.focusables();
    if (!list.length) return;
    const cur = this.focused && list.includes(this.focused) ? this.focused : null;
    if (!cur) {
      this.focus(list[0]);
      return;
    }
    const a = cur.getBoundingClientRect();
    const score = (b, sign) => {
      const along = sign * (dx ? (b.left + b.width / 2) - (a.left + a.width / 2) : (b.top + b.height / 2) - (a.top + a.height / 2));
      const gap = dx
        ? Math.max(0, a.top - b.bottom, b.top - a.bottom)
        : Math.max(0, a.left - b.right, b.left - a.right);
      return { along, s: along + gap * 3 };
    };
    // Elements in line (overlapping across the direction) win over everything else:
    // right from "Zurück" goes to the button beside it, not to the row above
    let best = null;
    let bestScore = Infinity;
    let bestInLine = false;
    for (const el of list) {
      if (el === cur) continue;
      const { along, s } = score(el.getBoundingClientRect(), dx + dy);
      if (along <= 4) continue;
      const inLine = s === along;
      if ((inLine && !bestInLine) || (inLine === bestInLine && s < bestScore)) {
        bestScore = s;
        best = el;
        bestInLine = inLine;
      }
    }
    if (!best && dy !== 0 && page.wrap !== false) {
      // Wrap: furthest in the opposite direction, best in line
      let far = -Infinity;
      for (const el of list) {
        if (el === cur) continue;
        const { along, s } = score(el.getBoundingClientRect(), -(dx + dy));
        const v = along - (s - along);
        if (along > 4 && v > far) {
          far = v;
          best = el;
        }
      }
    }
    if (best) this.focus(best);
  }

  // ---- input ----

  frame(dt) {
    const page = this.top;
    if (!page || this.root.hidden) return;
    const input = this.game.input;
    page.frame?.(dt);
    if (this.top !== page) return;
    if (page.blocking?.() || input.capturing) return;
    // The focused element may have been re-rendered: find it again by its key
    if (this.focused && !this.focused.isConnected) {
      const key = this.focused.dataset.focus;
      this.focused = null;
      this.focus((key && page.find(key)) ?? page.focusables()[0] ?? null, { quiet: true, scroll: false });
    }
    if (!this.focused) {
      const first = page.focusables()[0];
      if (first) this.focus(first, { quiet: true });
    }

    if (input.pressed('menuBack')) {
      if (page.back() !== false) this.sound('back');
      return;
    }
    if (input.pressed('menuConfirm')) {
      if (this.focused) this.activate(this.focused);
      return;
    }
    if (input.pressed('menuTabPrev') && page.onTab?.(-1)) this.sound('move');
    if (input.pressed('menuTabNext') && page.onTab?.(1)) this.sound('move');

    const dir = this.direction(dt);
    if (dir) this.navigate(dir);
  }

  /** Direction this frame: fresh press, or a held key/stick after the repeat delay. */
  direction(dt) {
    const input = this.game.input;
    for (const id of Object.keys(DIRS)) {
      if (input.pressed(id)) {
        this.repeat = { dir: id, t: -REPEAT_DELAY };
        return id;
      }
    }
    let held = Object.keys(DIRS).find((id) => input.held(id)) ?? null;
    const pad = input.gamepad;
    if (!held && pad.connected) {
      const x = pad.axis(0);
      const y = pad.axis(1);
      if (Math.abs(x) > STICK || Math.abs(y) > STICK) held = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'menuRight' : 'menuLeft') : y > 0 ? 'menuDown' : 'menuUp';
      if (held && this.repeat.dir !== held) {
        this.repeat = { dir: held, t: -REPEAT_DELAY };
        return held;
      }
    }
    if (!held || this.repeat.dir !== held) {
      this.repeat = { dir: null, t: 0 };
      return null;
    }
    this.repeat.t += dt;
    if (this.repeat.t >= REPEAT_RATE) {
      this.repeat.t = 0;
      return held;
    }
    return null;
  }

  navigate(id) {
    const [dx, dy] = DIRS[id];
    const page = this.top;
    const el = this.focused;
    if (page.onNav?.(dx, dy)) return;
    if (dx && el && page.adjustable(el)) {
      if (page.adjust(el, dx)) this.sound('adjust');
      else this.sound('error');
      return;
    }
    this.move(dx, dy);
  }

  activate(el) {
    const page = this.top;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
      this.sound('error');
      page.onDisabled?.(el);
      return;
    }
    const r = page.activate(el);
    if (r !== false) this.sound(r === 'quiet' ? 'move' : 'confirm');
  }

  // ---- mouse ----

  onMouseMove(e) {
    const el = e.target.closest?.('[data-focus]');
    if (!el || !this.top?.root.contains(el) || el === this.focused) return;
    this.focus(el, { quiet: true, scroll: false });
  }

  onClick(e) {
    const page = this.top;
    if (!page) return;
    const arrow = e.target.closest?.('[data-dir]');
    const el = e.target.closest?.('[data-focus]');
    if (!el || !page.root.contains(el)) return;
    this.focus(el, { quiet: true, scroll: false });
    if (arrow && page.adjustable(el)) {
      if (page.adjust(el, Number(arrow.dataset.dir))) this.sound('adjust');
      return;
    }
    // Native controls (range, checkbox, select, text) handle their own clicks
    if (el.matches('input, select, textarea')) return;
    this.activate(el);
  }
}

