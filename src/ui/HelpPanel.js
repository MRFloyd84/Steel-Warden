import { Overlay, esc } from './Overlay.js';
import { ACTIONS, CONTEXTS } from '../input/actions.js';
import { tokenLabel, padLabel } from '../input/keyLabels.js';
import { Storage } from '../core/Storage.js';

const INTRO_TIME = 14; // seconds the first-mission key card stays

/**
 * In-game key help (H): the actions of the current input context with the
 * keys as printed on the player's keyboard (layout map / QWERTZ table).
 * On the first mission a short card with the eight most important keys.
 */
export class HelpPanel extends Overlay {
  /** intro: Optionen → Tastenhilfe zu Beginn ('once' | 'always' | 'never'). */
  constructor(container, input, bus, intro = 'once') {
    super(container, 'help-panel');
    this.input = input;
    this.on = false;
    this.shownContext = null;
    const show = intro === 'always' || (intro === 'once' && !Storage.load('introSeen', false));
    this.introLeft = show ? INTRO_TIME : 0;
    if (this.introLeft) Storage.save('introSeen', true);
    this.off = bus.on('input:layout', () => (this.shownContext = null));
    this.offBind = bus.on('input:bindings', () => (this.shownContext = null));
    this.show();
  }

  update(input, dt = 1 / 60) {
    if (input.pressed('help')) {
      this.on = !this.on;
      this.introLeft = 0;
      this.shownContext = null;
    }
    if (this.introLeft > 0) this.introLeft -= dt;
    const mode = this.on ? input.context : this.introLeft > 0 ? 'intro' : null;
    if (mode === this.shownContext) return;
    this.shownContext = mode;
    this.root.hidden = !mode;
    if (mode) this.root.innerHTML = mode === 'intro' ? this.introHtml() : this.contextHtml(mode);
  }

  keys(a) {
    const k = this.input.keys[a.id].map((t) => `<kbd>${esc(tokenLabel(t))}</kbd>`);
    const p = this.input.gamepad.connected ? this.input.pad[a.id].map((b) => `<kbd class="pad">${esc(padLabel(b))}</kbd>`) : [];
    return [...k, ...p].join(' ') || '–';
  }

  contextHtml(ctx) {
    const layers = [ctx, 'global', ...(this.input.debugMode ? ['debug'] : [])];
    const list = ACTIONS.filter((a) => a.contexts.some((c) => layers.includes(c)) && (a.help || ctx === 'freeCam' || ctx === 'menu' || a.contexts.includes('debug')));
    const rows = list.map((a) => `<tr><td>${this.keys(a)}</td><td>${esc(a.label)}</td></tr>`).join('');
    return `<div class="help-card crt"><div class="help-title">TASTEN · ${esc(CONTEXTS[ctx] ?? ctx)}</div><table>${rows}</table><div class="help-foot"><kbd>H</kbd> schließen · Belegung: Hauptmenü → Steuerung</div></div>`;
  }

  introHtml() {
    const rows = ACTIONS.filter((a) => a.intro).map((a) => `<tr><td>${this.keys(a)}</td><td>${esc(a.label)}</td></tr>`).join('');
    return `<div class="help-card intro crt"><div class="help-title">DIE WICHTIGSTEN TASTEN</div><table>${rows}</table></div>`;
  }

  destroy() {
    this.off();
    this.offBind();
    super.destroy();
  }
}
