import { Overlay, esc } from './Overlay.js';
import { MISSIONS } from '../data/missions.js';
import { getTheater } from '../data/theaters.js';
import { ACTIONS } from '../input/actions.js';
import { tokenLabel } from '../input/keyLabels.js';
import { WALKERS, WALKER_ORDER, CLASS_LABELS } from '../data/walkers.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../data/difficulty.js';
import { Storage } from '../core/Storage.js';

const TIME_LABELS = { day: 'Tag', dusk: 'Dämmerung', night: 'Nacht' };

/** Main menu: test-mission list and a controls reference. */
export class MenuScreen extends Overlay {
  constructor(container, input, { onStart, onControls }) {
    super(container, 'menu-screen');
    this.selected = 0;
    this.onStart = onStart;
    this.input = input;

    const missions = MISSIONS.map((m, i) => {
      const theater = getTheater(m.theater);
      return `
        <button class="mission-item" data-index="${i}">
          <span class="mission-name">${esc(m.name)}</span>
          <span class="mission-meta">${esc(theater.name)} · ${esc(TIME_LABELS[m.timeOfDay] ?? m.timeOfDay)}</span>
        </button>`;
    }).join('');


    this.root.innerHTML = `
      <div class="menu-panel crt">
        <header class="menu-title">
          <div class="title-main">STEEL WARDEN</div>
          <div class="title-sub">Widerstandskommando · Walker-Einsatzsystem</div>
        </header>
        <div class="menu-columns">
          <section>
            <h2>Erprobungseinsätze</h2>
            <div class="mission-list">${missions}</div>
            <p class="mission-briefing" data-role="briefing"></p>
            <label class="walker-pick">Walker
              <select data-role="walker">${WALKER_ORDER.map((id) => {
                const w = WALKERS[id];
                return `<option value="${esc(id)}">${esc(w.name)} — ${esc(CLASS_LABELS[w.class])}, ${w.tonnage} t, ${esc(w.role)}</option>`;
              }).join('')}</select>
            </label>
            <label class="walker-pick">Schwierigkeit
              <select data-role="difficulty">${DIFFICULTY_ORDER.map((id) => `<option value="${id}">${esc(DIFFICULTY[id].name)}</option>`).join('')}</select>
            </label>
            <button class="btn primary" data-role="start">Einsatz starten</button>
          </section>
          <section>
            <h2>Steuerung</h2>
            <div class="controls-scroll"><table class="controls" data-role="controls"></table></div>
            <button class="btn" data-role="controlsBtn">Steuerung anpassen</button>
          </section>
        </div>
        <footer class="menu-footer">Erprobung · Synthese-Gegner und KI</footer>
      </div>`;

    this.items = [...this.root.querySelectorAll('.mission-item')];
    this.walkerSelect = this.root.querySelector('[data-role="walker"]');
    this.walkerSelect.value = 'bastion';
    this.walkerSelect.addEventListener('keydown', (e) => e.stopPropagation());
    this.difficultySelect = this.root.querySelector('[data-role="difficulty"]');
    const stored = Storage.load('difficulty', 'normal');
    this.difficultySelect.value = DIFFICULTY[stored] ? stored : 'normal';
    this.difficultySelect.addEventListener('keydown', (e) => e.stopPropagation());
    this.difficultySelect.addEventListener('change', () => Storage.save('difficulty', this.difficultySelect.value));
    this.briefing = this.root.querySelector('[data-role="briefing"]');
    this.items.forEach((el) => {
      el.addEventListener('click', () => this.select(Number(el.dataset.index)));
      el.addEventListener('dblclick', () => this.start());
    });
    this.root.querySelector('[data-role="start"]').addEventListener('click', () => this.start());
    this.root.querySelector('[data-role="controlsBtn"]').addEventListener('click', () => onControls?.());
    this.controlsTable = this.root.querySelector('[data-role="controls"]');
    this.renderControls();
    this.select(0);
  }

  /** Short key list (the help actions) with the real keyboard labels. */
  renderControls() {
    this.controlsTable.innerHTML = ACTIONS.filter((a) => a.help).map((a) => {
      const keys = this.input.keys[a.id].map((t) => `<kbd>${esc(tokenLabel(t))}</kbd>`).join(' ') || '–';
      return `<tr><td>${esc(a.label)}</td><td>${keys}</td></tr>`;
    }).join('') + '<tr><td>Torso und Fadenkreuz</td><td><kbd>Maus</kbd> (Klick fängt den Zeiger)</td></tr>';
  }

  select(index) {
    this.selected = (index + MISSIONS.length) % MISSIONS.length;
    this.items.forEach((el, i) => el.classList.toggle('selected', i === this.selected));
    this.briefing.textContent = MISSIONS[this.selected].briefing;
  }

  move(delta) {
    this.select(this.selected + delta);
  }

  /** Plain-text error over the menu (invalid mission); any confirm/click closes it. */
  showError(text) {
    this.errorEl?.remove();
    const el = document.createElement('pre');
    el.className = 'menu-error crt';
    el.textContent = `${text}\n\n[Klick oder Enter schließt]`;
    el.addEventListener('click', () => this.hideError());
    this.root.appendChild(el);
    this.errorEl = el;
  }

  hideError() {
    this.errorEl?.remove();
    this.errorEl = null;
  }

  start() {
    if (this.errorEl) {
      this.hideError();
      return;
    }
    Storage.save('difficulty', this.difficultySelect.value);
    this.onStart(MISSIONS[this.selected].id, this.walkerSelect.value);
  }
}
