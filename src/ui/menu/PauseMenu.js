import { MenuPage, esc } from './MenuPage.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { OptionsScreen } from './OptionsScreen.js';
import { ACTIONS, CATEGORIES } from '../../input/actions.js';
import { tokenLabel, padLabel } from '../../input/keyLabels.js';

/**
 * Pause menu in a mission: Fortsetzen · Einsatzziele · Steuerung (view only) ·
 * Optionen · Einsatz neu starten · Einsatz abbrechen (with confirmation).
 * mission: { name, resume(), restart(), abort(), objectives(), briefing }
 */
export class PauseMenu extends MenuPage {
  constructor(mission) {
    super('pause', 'm-pause');
    this.mission = mission;
  }

  html() {
    const items = [
      ['resume', 'Fortsetzen'],
      ['objectives', 'Einsatzziele'],
      ['bindings', 'Steuerung'],
      ['options', 'Optionen'],
      ['restart', 'Einsatz neu starten'],
      ['abort', 'Einsatz abbrechen'],
    ];
    return `
      <div class="m-panel m-narrow m-pause-panel">
        <h2>Einsatz angehalten</h2>
        <div class="m-dim">${esc(this.mission.name)}</div>
        <nav class="m-entries compact">${items.map(([id, l]) => `<button class="m-entry" data-focus="${id}"><span>${l}</span></button>`).join('')}</nav>
        <div class="m-keys">Esc / B: weiter · danach ins Bild klicken, um die Maus zu fangen</div>
      </div>`;
  }

  initialFocus() {
    return 'resume';
  }

  activate(el) {
    const id = el.dataset.focus;
    const m = this.mission;
    if (id === 'resume') m.resume();
    else if (id === 'objectives') this.stack.push(new ObjectivesPage(m));
    else if (id === 'bindings') this.stack.push(new BindingsPage());
    else if (id === 'options') this.stack.push(new OptionsScreen());
    else if (id === 'restart') {
      this.stack.push(new ConfirmDialog({
        title: 'Einsatz neu starten?', text: 'Der Einsatz beginnt von vorn, der jetzige Stand geht verloren.',
        buttons: [{ label: 'Neu starten', primary: true, action: () => m.restart() }, { label: 'Weiterspielen', cancel: true }],
      }));
    } else if (id === 'abort') {
      this.stack.push(new ConfirmDialog({
        title: 'Einsatz abbrechen?', text: 'Der Einsatz endet als abgebrochen, es folgt die Nachbesprechung.',
        buttons: [{ label: 'Abbrechen', primary: true, action: () => m.abort() }, { label: 'Weiterspielen', cancel: true }],
      }));
    }
    return true;
  }

  back() {
    this.mission.resume();
    return true;
  }
}

/** Objectives and briefing. */
export class ObjectivesPage extends MenuPage {
  constructor(mission) {
    super('objectives', 'm-panel-page');
    this.mission = mission;
  }

  html() {
    const list = this.mission.objectives();
    const mark = { done: '✓', active: '▸', open: '·' };
    return `
      <div class="m-panel m-narrow">
        <h2>Einsatzziele</h2>
        ${list.length ? `<ul class="m-objectives">${list.map((o) => `<li class="${o.state}"><span>${mark[o.state]}</span> ${esc(o.text)}</li>`).join('')}</ul>` : '<p class="m-dim">Freies Gelände — keine festen Ziele.</p>'}
        <h3>Lage</h3>
        <p class="m-desc-text">${esc(this.mission.briefing ?? '')}</p>
        <div class="m-buttons"><button class="m-btn" data-focus="back">Zurück</button></div>
      </div>`;
  }

  activate() {
    this.stack.pop();
    return true;
  }
}

/** Current bindings, read only (changing them: Optionen → Steuerung). */
export class BindingsPage extends MenuPage {
  constructor() {
    super('bindings', 'm-panel-page');
  }

  html() {
    const input = this.game.input;
    const sections = Object.entries(CATEGORIES).filter(([cat]) => cat !== 'debug' || input.debugMode).map(([cat, name]) => {
      const rows = ACTIONS.filter((a) => a.category === cat && !a.id.startsWith('menuChoice')).map((a) => {
        const keys = (input.keys[a.id] ?? []).filter(Boolean).map((t) => `<kbd>${esc(tokenLabel(t))}</kbd>`).join(' ');
        const pad = (input.pad[a.id] ?? []).map((b) => `<kbd class="pad">${esc(padLabel(b))}</kbd>`).join(' ');
        return `<tr><td>${esc(a.label)}</td><td>${keys || '—'}</td><td>${pad}</td></tr>`;
      }).join('');
      return `<h3>${esc(name)}</h3><table class="m-bindings">${rows}</table>`;
    }).join('');
    return `
      <div class="m-panel m-wide">
        <header class="m-head"><h2>Steuerung</h2><span class="m-dim">nur Ansicht · ändern unter Optionen → Steuerung</span></header>
        <div class="m-bind-scroll menu-scroll">${sections}</div>
        <div class="m-buttons"><button class="m-btn" data-focus="back">Zurück</button></div>
      </div>`;
  }

  /** Up/down (and the right stick) scroll the table. */
  onNav(dx, dy) {
    if (!dy) return false;
    const box = this.root.querySelector('.m-bind-scroll');
    box.scrollTop += dy * box.clientHeight * 0.25;
    return true;
  }

  frame() {
    const pad = this.game.input.gamepad;
    const box = this.root.querySelector('.m-bind-scroll');
    if (box && pad.connected && Math.abs(pad.axis(3)) > 0.3) box.scrollTop += pad.axis(3) * 20;
  }

  activate(el) {
    if (el.dataset.focus === 'back') this.stack.pop();
    return true;
  }
}
