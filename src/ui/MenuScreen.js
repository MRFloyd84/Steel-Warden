import { Overlay, esc, keyLabel } from './Overlay.js';
import { MISSIONS } from '../data/missions.js';
import { getTheater } from '../data/theaters.js';
import { ACTION_LABELS } from '../data/inputBindings.js';

const TIME_LABELS = { day: 'Tag', dusk: 'Dämmerung', night: 'Nacht' };

/** Main menu: test-mission list and a controls reference. */
export class MenuScreen extends Overlay {
  constructor(container, bindings, { onStart }) {
    super(container, 'menu-screen');
    this.selected = 0;
    this.onStart = onStart;

    const missions = MISSIONS.map((m, i) => {
      const theater = getTheater(m.theater);
      return `
        <button class="mission-item" data-index="${i}">
          <span class="mission-name">${esc(m.name)}</span>
          <span class="mission-meta">${esc(theater.name)} · ${esc(TIME_LABELS[m.timeOfDay] ?? m.timeOfDay)}</span>
        </button>`;
    }).join('');

    const controls = Object.entries(bindings.keys)
      .map(([action, codes]) => `<tr><td>${esc(ACTION_LABELS[action] ?? action)}</td><td>${codes.map((c) => `<kbd>${esc(keyLabel(c))}</kbd>`).join(' ')}</td></tr>`)
      .join('');

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
            <button class="btn primary" data-role="start">Einsatz starten</button>
          </section>
          <section>
            <h2>Steuerung</h2>
            <table class="controls">${controls}
              <tr><td>Umsehen</td><td><kbd>Maus</kbd> (Klick fängt Zeiger)</td></tr>
            </table>
          </section>
        </div>
        <footer class="menu-footer">Ausbaustufe 1 · Grundgerüst</footer>
      </div>`;

    this.items = [...this.root.querySelectorAll('.mission-item')];
    this.briefing = this.root.querySelector('[data-role="briefing"]');
    this.items.forEach((el) => {
      el.addEventListener('click', () => this.select(Number(el.dataset.index)));
      el.addEventListener('dblclick', () => this.start());
    });
    this.root.querySelector('[data-role="start"]').addEventListener('click', () => this.start());
    this.select(0);
  }

  select(index) {
    this.selected = (index + MISSIONS.length) % MISSIONS.length;
    this.items.forEach((el, i) => el.classList.toggle('selected', i === this.selected));
    this.briefing.textContent = MISSIONS[this.selected].briefing;
  }

  move(delta) {
    this.select(this.selected + delta);
  }

  start() {
    this.onStart(MISSIONS[this.selected].id);
  }
}
