import { MenuPage, esc, choiceRow, sliderRow } from './MenuPage.js';
import { OPTIONS, OPTION_PAGES, OPTION_BY_ID } from '../../data/options.js';
import { ControlsScreen } from '../ControlsScreen.js';

/**
 * Optionen: Spiel · Grafik · Audio · Steuerung. Rows from data/options.js,
 * left/right changes the value at once (saved in localStorage). Steuerung
 * hosts the bindings screen. "Standard wiederherstellen" per page.
 */
export class OptionsScreen extends MenuPage {
  constructor(tab = 'game') {
    super('options', 'm-options');
    this.tab = tab;
    this.controls = null;
    this.confirmReset = false;
  }

  get settings() {
    return this.game.settings;
  }

  html() {
    const tabs = OPTION_PAGES.map((p) => `<button class="m-tab${p.id === this.tab ? ' on' : ''}" data-focus="tab:${p.id}">${esc(p.label)}</button>`).join('') + '<span class="m-tabkeys">Q / E</span>';
    let body;
    if (this.tab === 'controls') {
      body = '<div class="m-controls-host" data-role="controls"></div>';
    } else {
      body = `<div class="m-rows menu-scroll">${OPTIONS.filter((o) => o.page === this.tab).map((o) => this.rowHtml(o)).join('')}</div>
        <div class="m-hint" data-role="hint"></div>`;
    }
    const reset = this.tab === 'controls' ? '' : `<button class="m-btn" data-focus="reset">${this.confirmReset ? 'Wirklich? Nochmal bestätigen' : 'Standard wiederherstellen'}</button>`;
    return `
      <div class="m-panel m-wide">
        <header class="m-head"><h2>Optionen</h2><div class="m-tabs">${tabs}</div></header>
        <div class="m-options-body">${body}</div>
        <footer class="m-buttons">
          <button class="m-btn" data-focus="back">Zurück</button>
          ${reset}
        </footer>
      </div>`;
  }

  rowHtml(o) {
    const v = this.settings.get(o.id);
    if (o.type === 'slider') return sliderRow(`opt:${o.id}`, o.label, (v - o.min) / (o.max - o.min), o.format ? o.format(v) : String(v), { hint: o.help ?? '' });
    const c = o.choices.find((x) => x.value === v);
    return choiceRow(`opt:${o.id}`, o.label, c?.label ?? String(v), { hint: o.help ?? '' });
  }

  afterRender() {
    if (this.tab === 'controls') this.mountControls();
    else this.unmountControls();
  }

  mountControls() {
    const host = this.root.querySelector('[data-role="controls"]');
    if (!this.controls) {
      this.controls = new ControlsScreen(host, this.game.input, this.game.bus, { onClose: () => this.closeFromControls() });
      this.controls.root.classList.add('embedded');
      // Its own buttons, selects and fields become menu focus targets
      const render = this.controls.render.bind(this.controls);
      this.controls.render = () => {
        render();
        this.decorateControls();
      };
    } else {
      host.appendChild(this.controls.root);
    }
    this.controls.open();
    this.decorateControls();
  }

  /** Focus keys for its buttons and fields, scroll hints for its long table. */
  decorateControls() {
    tagFocus(this.controls.root);
    this.controls.root.querySelector('.ctl-body')?.classList.add('menu-scroll');
    this.updateScrollHints();
  }

  unmountControls() {
    if (!this.controls) return;
    this.controls.input.cancelCapture();
    cancelAnimationFrame(this.controls.raf);
    this.controls.destroy();
    this.controls = null;
  }

  closeFromControls() {
    // The bindings screen's own "Zurück"
    if (this.closing) return;
    this.closing = true;
    this.stack.pop();
  }

  onFocus(el) {
    const hint = this.root.querySelector('[data-role="hint"]');
    if (hint) hint.textContent = el.dataset.hint ?? '';
    if (el.dataset.focus !== 'reset' && this.confirmReset) {
      this.confirmReset = false;
      const r = this.find('reset');
      if (r) r.textContent = 'Standard wiederherstellen';
    }
  }

  blocking() {
    return !!(this.controls && (this.controls.capturing || this.controls.pending) && this.game.input.capturing);
  }

  adjust(el, dir) {
    const key = el.dataset.focus;
    if (key?.startsWith('opt:')) {
      const ok = this.settings.step(key.slice(4), dir);
      if (ok) this.refresh();
      return ok;
    }
    return super.adjust(el, dir);
  }

  onTab(dir) {
    const ids = OPTION_PAGES.map((p) => p.id);
    this.setTab(ids[(ids.indexOf(this.tab) + dir + ids.length) % ids.length]);
    return true;
  }

  setTab(tab) {
    if (tab === this.tab) return;
    if (this.tab === 'controls') this.unmountControls();
    this.tab = tab;
    this.confirmReset = false;
    this.render();
    this.stack.focused = null;
    this.stack.focus(this.find(`tab:${tab}`), { quiet: true });
  }

  activate(el) {
    const key = el.dataset.focus;
    if (key.startsWith('tab:')) {
      this.setTab(key.slice(4));
      return 'quiet';
    }
    if (key === 'back') {
      this.stack.pop();
      return true;
    }
    if (key === 'reset') {
      if (!this.confirmReset) {
        this.confirmReset = true;
        el.textContent = 'Wirklich? Nochmal bestätigen';
        return 'quiet';
      }
      this.confirmReset = false;
      this.settings.resetPage(this.tab);
      this.refresh();
      return true;
    }
    if (key.startsWith('opt:')) {
      const o = OPTION_BY_ID[key.slice(4)];
      if (o.type === 'choice') {
        // Enter cycles through the choices
        if (!this.settings.step(o.id, 1)) this.settings.set(o.id, o.choices[0].value);
        this.refresh();
        return 'quiet';
      }
      return false;
    }
    return super.activate(el);
  }

  back() {
    if (this.controls && (this.controls.capturing || this.controls.pending)) {
      this.controls.back();
      return true;
    }
    this.stack.pop();
    return true;
  }

  destroy() {
    this.unmountControls();
    super.destroy();
  }
}

/** Gives the buttons and fields of a foreign HTML block stable focus keys from their data attributes. */
export function tagFocus(root) {
  let n = 0;
  for (const el of root.querySelectorAll('button, select, input, textarea')) {
    if (el.dataset.focus) continue;
    const data = Object.entries(el.dataset).map(([k, v]) => `${k}=${v}`).join(',');
    el.dataset.focus = `ext:${el.tagName}:${data || `n${n++}`}`;
  }
}
