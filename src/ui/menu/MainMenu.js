import { MenuPage, esc } from './MenuPage.js';
import { MissionSelect } from './MissionSelect.js';
import { OptionsScreen } from './OptionsScreen.js';
import { CreditsScreen } from './CreditsScreen.js';

const ENTRIES = [
  { id: 'campaign', label: 'Kampagne', desc: 'Der Feldzug gegen die Synthese — in Vorbereitung (Phase C).', disabled: true },
  { id: 'practice', label: 'Übungseinsatz', desc: 'Einen Einsatz wählen, Walker und Übungsoptionen einstellen, losziehen.' },
  { id: 'options', label: 'Optionen', desc: 'Spiel, Grafik, Audio und Steuerung. Änderungen gelten sofort.' },
  { id: 'trials', label: 'Erprobung', desc: 'Alle Testmissionen ungefiltert, auch die absichtlich fehlerhaften. Nur im Debug-Modus.', debug: true },
  { id: 'credits', label: 'Mitwirkende', desc: 'Wer an STEEL WARDEN gebaut hat.' },
];

/** Narrow column on the left, the 3D scene stays visible on the right. */
export class MainMenu extends MenuPage {
  constructor() {
    super('main', 'm-main');
  }

  mount() {
    this.off = this.game.bus.on('debug:mode', () => this.refresh());
    this.render();
  }

  html() {
    const debug = this.game.input.debugMode;
    const items = ENTRIES.filter((e) => !e.debug || debug).map((e) => `
      <button class="m-entry${e.disabled ? ' is-disabled' : ''}" data-focus="${e.id}" data-desc="${esc(e.desc)}" ${e.disabled ? 'aria-disabled="true"' : ''}>
        <span>${esc(e.label)}</span>${e.disabled ? '<small>in Vorbereitung</small>' : ''}
      </button>`).join('');
    return `
      <div class="m-column">
        <h1 class="m-logo small">STEEL WARDEN</h1>
        <nav class="m-entries">${items}</nav>
        <div class="m-desc" data-role="desc"></div>
        <div class="m-keys">↑↓ wählen · Enter bestätigen · Esc zurück</div>
      </div>`;
  }

  initialFocus() {
    return 'practice';
  }

  onFocus(el) {
    const d = this.root.querySelector('[data-role="desc"]');
    if (d) d.textContent = el.dataset.desc ?? '';
  }

  onDisabled(el) {
    const d = this.root.querySelector('[data-role="desc"]');
    if (d) d.textContent = `${el.dataset.desc} Noch nicht verfügbar.`;
  }

  activate(el) {
    const id = el.dataset.focus;
    if (id === 'practice') this.stack.push(new MissionSelect('practice'));
    else if (id === 'trials') this.stack.push(new MissionSelect('trials'));
    else if (id === 'options') this.stack.push(new OptionsScreen());
    else if (id === 'credits') this.stack.push(new CreditsScreen());
    return true;
  }

  destroy() {
    this.off?.();
    super.destroy();
  }
}
