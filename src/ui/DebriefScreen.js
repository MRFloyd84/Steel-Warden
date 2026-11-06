import { Overlay, esc } from './Overlay.js';

const RESULT_LABELS = {
  aborted: 'Einsatz abgebrochen',
  completed: 'Einsatz erfüllt',
  failed: 'Einsatz gescheitert',
};

/** Post-mission statistics. Phase 6 extends this with objectives and salvage. */
export class DebriefScreen extends Overlay {
  constructor(container, { onContinue }) {
    super(container, 'debrief-screen');
    this.onContinue = onContinue;
  }

  showReport({ mission, theaterName, result, stats }) {
    const minutes = Math.floor(stats.duration / 60);
    const seconds = Math.floor(stats.duration % 60).toString().padStart(2, '0');
    const rows = [
      ['Einsatz', mission.name],
      ['Schauplatz', theaterName],
      ['Status', RESULT_LABELS[result] ?? result],
      ['Einsatzdauer', `${minutes}:${seconds} min`],
      ['Zurückgelegte Strecke', `${(stats.distance / 1000).toFixed(2)} km`],
      ['Ø Bildrate', `${stats.avgFps.toFixed(0)} FPS`],
    ];
    this.root.innerHTML = `
      <div class="small-panel crt">
        <h2>Nachbesprechung</h2>
        <table class="report">
          ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
        </table>
        <button class="btn primary" data-role="continue">Zurück zum Hauptmenü</button>
      </div>`;
    this.root.querySelector('[data-role="continue"]').addEventListener('click', this.onContinue);
    this.show();
  }
}
