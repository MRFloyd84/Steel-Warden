import { MenuPage } from './MenuPage.js';

/** Credits. */
export class CreditsScreen extends MenuPage {
  constructor() {
    super('credits', 'm-panel-page');
  }

  html() {
    return `
      <div class="m-panel m-narrow">
        <h2>Mitwirkende</h2>
        <div class="m-credits">
          <p><b>Idee, Gestaltung, Spieltests</b><br>Rene</p>
          <p><b>Programmierung</b><br>Rene mit Claude (Anthropic)</p>
          <p><b>Technik</b><br>Three.js · Vite · Web Audio · Gamepad API</p>
          <p><b>Klänge</b><br>Maschinen, Hilfsaggregat, Schritte: Samples ·
            Menü, Schalter, Treffer und Warntöne: prozedural erzeugt</p>
          <p class="m-dim">Gewidmet den Mech-Simulationen der Mitte der Neunziger.</p>
        </div>
        <div class="m-buttons"><button class="m-btn" data-focus="back">Zurück</button></div>
      </div>`;
  }

  activate(el) {
    if (el.dataset.focus === 'back') this.stack.pop();
    return true;
  }
}
