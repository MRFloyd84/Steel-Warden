import { MenuPage, esc } from './MenuPage.js';

const RESULT_LABELS = { aborted: 'Einsatz abgebrochen', completed: 'Einsatz erfüllt', failed: 'Einsatz gescheitert' };
const COMPONENT_LABELS = { torso: 'Torso', armL: 'Arm links', armR: 'Arm rechts', legs: 'Beine', sensors: 'Sensoren', reactor: 'Reaktor' };
const WRECK_LABELS = { legs: 'Beine zerstört (intaktes Wrack)', reactor: 'Reaktor (ausgebrannt)' };

/**
 * Debrief (simple, extended in phase B): result, mission time from deploy,
 * kills with destruction type, own damage per component, accuracy.
 * Buttons Erneut / Zum Hauptmenü.
 */
export class DebriefPage extends MenuPage {
  constructor({ mission, theaterName, result, stats, onRetry, onMenu }) {
    super('debrief', 'm-panel-page m-debrief');
    Object.assign(this, { mission, theaterName, result, stats, onRetry, onMenu });
  }

  html() {
    const s = this.stats;
    const t = Math.floor(s.duration ?? 0);
    const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} min${s.deployed === false ? ' (nicht ausgerückt)' : ''}`;
    const acc = s.shots ? `${Math.round((s.hits / s.shots) * 100)} % (${s.hits} von ${s.shots} Schüssen)` : '—';
    const kills = (s.killList ?? []).map((k) => `<tr><td>${esc(k.name)}</td><td>${esc(WRECK_LABELS[k.kind] ?? k.kind)}</td><td>${k.scrap} Schrott</td></tr>`).join('');
    const dmg = Object.entries(s.damage ?? {}).map(([c, d]) => `
      <tr><td>${esc(COMPONENT_LABELS[c] ?? c)}</td><td><span class="m-bar dmg"><span style="width:${Math.round(d.left * 100)}%"></span></span></td><td>${Math.round(d.left * 100)} %${d.lost ? ' · zerstört' : ''}</td></tr>`).join('');
    return `
      <div class="m-panel m-wide">
        <header class="m-head"><h2>Nachbesprechung</h2><span class="m-result ${this.result}">${esc(RESULT_LABELS[this.result] ?? this.result)}</span></header>
        <div class="m-debrief-grid menu-scroll">
          <section>
            <table class="m-facts">
              <tr><td>Einsatz</td><td>${esc(this.mission.name)}</td></tr>
              <tr><td>Schauplatz</td><td>${esc(this.theaterName)}</td></tr>
              <tr><td>Einsatzzeit</td><td>${time}</td></tr>
              <tr><td>Strecke</td><td>${((s.distance ?? 0) / 1000).toFixed(2)} km</td></tr>
              <tr><td>Abschüsse</td><td>${s.kills ?? 0}</td></tr>
              <tr><td>Treffergenauigkeit</td><td>${acc}</td></tr>
            </table>
            <h3>Abschüsse</h3>
            ${kills ? `<table class="m-facts">${kills}</table>` : '<p class="m-dim">keine</p>'}
          </section>
          <section>
            <h3>Eigener Schaden</h3>
            <table class="m-facts m-dmg">${dmg}</table>
          </section>
        </div>
        <footer class="m-buttons">
          <button class="m-btn" data-focus="retry">Erneut</button>
          <button class="m-btn primary" data-focus="menu">Zum Hauptmenü</button>
        </footer>
      </div>`;
  }

  initialFocus() {
    return 'menu';
  }

  activate(el) {
    if (el.dataset.focus === 'retry') this.onRetry();
    else this.onMenu();
    return true;
  }

  back() {
    this.onMenu();
    return true;
  }
}
