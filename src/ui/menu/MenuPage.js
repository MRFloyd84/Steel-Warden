/**
 * Base of a menu screen. Subclasses fill html() and react in activate(el),
 * adjust(el, dir) (left/right on a [data-adjust] row), onTab(dir), back().
 * Focusable elements carry data-focus="<stable key>" so the focus survives
 * re-rendering and is remembered per screen (key = this.key).
 */
export class MenuPage {
  constructor(key, className = '') {
    this.key = key;
    this.stack = null;
    this.root = document.createElement('div');
    this.root.className = `menu-page ${className}`;
  }

  get game() {
    return this.stack.game;
  }

  /** Called once when pushed. */
  mount() {
    this.render();
  }

  html() {
    return '';
  }

  render() {
    this.root.innerHTML = this.html();
    this.afterRender?.();
    this.updateScrollHints();
  }

  /** Re-render keeping the focus (by key). */
  refresh() {
    const key = this.stack?.focused?.dataset.focus;
    // Scroll areas keep their position across the re-render
    const scrolls = [...this.root.querySelectorAll('.menu-scroll')].map((el) => el.scrollTop);
    this.render();
    this.root.querySelectorAll('.menu-scroll').forEach((el, i) => {
      if (scrolls[i] !== undefined) el.scrollTop = scrolls[i];
    });
    if (key && this.stack) {
      const el = this.find(key);
      if (el) {
        this.stack.focused = null;
        this.stack.focus(el, { quiet: true, scroll: false });
        // Only scroll if the row is (partly) hidden
        el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    }
  }

  find(key) {
    return this.root.querySelector(`[data-focus="${CSS.escape(key)}"]`);
  }

  focusables() {
    return [...this.root.querySelectorAll('[data-focus]')].filter((el) => !el.hidden && el.offsetParent !== null);
  }

  adjustable(el) {
    return el.hasAttribute('data-adjust') || el.matches('input[type="range"], select');
  }

  /** Left/right on an adjustable element. Native range/select step by default. */
  adjust(el, dir) {
    if (el.matches('input[type="range"]')) {
      const step = Number(el.step) || 1;
      const v = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + dir * step));
      if (v === Number(el.value)) return false;
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.matches('select')) {
      const i = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + dir));
      if (i === el.selectedIndex) return false;
      el.selectedIndex = i;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /** Enter/A or click. Return false if nothing happened ('quiet' for a soft sound). */
  activate(el) {
    if (el.matches('input[type="checkbox"]')) {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.matches('input[type="text"], textarea')) {
      el.focus();
      return 'quiet';
    }
    el.click?.();
    return true;
  }

  /** Esc/B. Default: one screen back (not from the root). */
  back() {
    if (this.stack.depth <= 1) return false;
    this.stack.pop();
    return true;
  }

  /** Lists that overflow get .more-up / .more-down for the fade hints. */
  updateScrollHints() {
    for (const el of this.root.querySelectorAll('.menu-scroll')) {
      const set = () => {
        el.classList.toggle('more-up', el.scrollTop > 2);
        el.classList.toggle('more-down', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
      };
      if (!el.dataset.hinted) {
        el.dataset.hinted = '1';
        el.addEventListener('scroll', set, { passive: true });
      }
      requestAnimationFrame(set);
    }
  }

  destroy() {
    this.root.remove();
  }
}

/** Escapes text for innerHTML templates. */
export function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Option row "Label  ◀ value ▶" (data-adjust). */
export function choiceRow(key, label, value, { disabled = false, hint = '' } = {}) {
  return `<div class="m-row m-choice${disabled ? ' is-disabled' : ''}" data-focus="${esc(key)}" data-adjust ${hint ? `data-hint="${esc(hint)}"` : ''}>
    <span class="m-label">${esc(label)}</span>
    <span class="m-value"><span class="m-arrow" data-dir="-1">◀</span><span class="m-val">${esc(value)}</span><span class="m-arrow" data-dir="1">▶</span></span>
  </div>`;
}

/** Slider row with a bar (data-adjust). */
export function sliderRow(key, label, frac, text, { hint = '' } = {}) {
  return `<div class="m-row m-slider" data-focus="${esc(key)}" data-adjust ${hint ? `data-hint="${esc(hint)}"` : ''}>
    <span class="m-label">${esc(label)}</span>
    <span class="m-value"><span class="m-arrow" data-dir="-1">◀</span><span class="m-bar"><span style="width:${Math.round(frac * 100)}%"></span></span><span class="m-num">${esc(text)}</span><span class="m-arrow" data-dir="1">▶</span></span>
  </div>`;
}
