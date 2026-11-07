import { esc } from './MenuPage.js';

const TIPS = [
  'Die Startprozedur folgt der Checkliste: K öffnet das Klemmbrett.',
  'Mit SENSOREN aus ortet dich die Synthese erst auf kurze Distanz.',
  'Ein kalter Walker ist fast unsichtbar — der Reaktor verrät dich auf rund einen Kilometer.',
  'T schaltet das Ziel unter dem Fadenkreuz auf, Tab wählt die Trefferzone der Zielkapsel.',
  'Beine treffen statt Reaktor: das Wrack bleibt intakt und bringt vollen Bergungswert.',
  'Schilde nach vorn mit Q, nach hinten mit E.',
  'Shift+S lässt die ganze Startprozedur automatisch laufen.',
  'H zeigt die Tasten des aktuellen Kontexts.',
  'Lenkraketen: Aufschaltung halten, bis der Ton durchgehend klingt.',
  'Ein Belagerer schießt nur, wenn ein anderer Synthese-Walker dich sieht.',
  'Im Pausenmenü stehen die Einsatzziele und die aktuelle Tastenbelegung.',
];

/**
 * Loading screen. Owned by the game (it outlives the menu state); the
 * mission state reports progress per stage (terrain, models, audio).
 */
export const MIN_SHOW = 1.6; // s

export class LoadingScreen {
  constructor(container) {
    this.root = document.createElement('div');
    this.root.className = 'loading-screen';
    this.root.hidden = true;
    container.appendChild(this.root);
    this.stages = { terrain: 0, models: 0, audio: 0 };
    this.tipIndex = Math.floor(Math.random() * TIPS.length);
    this.tipT = 0;
    this.age = 0;
  }

  get visible() {
    return !this.root.hidden;
  }

  show({ name, place }) {
    this.stages = { terrain: 0, models: 0, audio: 0 };
    this.age = 0; // s shown (the mission keeps it up for at least MIN_SHOW, so it can be read)
    this.root.innerHTML = `
      <div class="m-panel m-loading crt-on">
        <div class="m-loading-head">EINSATZ WIRD VORBEREITET</div>
        <h2>${esc(name)}</h2>
        <div class="m-dim">${esc(place)}</div>
        <div class="m-progress">
          ${[['terrain', 'Gelände'], ['models', 'Modelle'], ['audio', 'Audio']].map(([id, l]) => `
            <div class="m-prog-row"><span>${l}</span><span class="m-bar"><span data-bar="${id}"></span></span><span data-pct="${id}">0 %</span></div>`).join('')}
        </div>
        <div class="m-tip" data-role="tip">${esc(TIPS[this.tipIndex])}</div>
      </div>`;
    this.root.hidden = false;
  }

  set(stage, frac) {
    this.stages[stage] = Math.max(0, Math.min(1, frac));
    const bar = this.root.querySelector(`[data-bar="${stage}"]`);
    if (bar) bar.style.width = `${Math.round(this.stages[stage] * 100)}%`;
    const pct = this.root.querySelector(`[data-pct="${stage}"]`);
    if (pct) pct.textContent = `${Math.round(this.stages[stage] * 100)} %`;
  }

  update(dt) {
    if (this.root.hidden) return;
    this.age += dt;
    this.tipT += dt;
    if (this.tipT > 3.5) {
      this.tipT = 0;
      this.tipIndex = (this.tipIndex + 1) % TIPS.length;
      const el = this.root.querySelector('[data-role="tip"]');
      if (el) el.textContent = TIPS[this.tipIndex];
    }
  }

  hide() {
    this.root.hidden = true;
  }
}
