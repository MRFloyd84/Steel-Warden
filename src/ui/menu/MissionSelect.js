import { MenuPage, esc } from './MenuPage.js';
import { MISSIONS } from '../../data/missions.js';
import { CATEGORY_LABELS, TIME_LABELS, theaterName, weatherName, startLabel, enemyLines, missionMap } from './missionInfo.js';
import { MissionPrep } from './MissionPrep.js';

const PRACTICE_TABS = ['theater', 'combat', 'system'];
// Order within a group (others follow in data order)
const ORDER = ['test-duel', 'test-ambush', 'test-stellung', 'test-waves', 'test-scramble', 'first-sortie', 'range', 'test-parade', 'test-ground', 'test-ice-night'];

/**
 * Mission choice. Practice: tabs Schauplätze · Gefechte · Systemtests.
 * Trials (debug mode): every mission in one list. Left the list, right the
 * details of the focused mission with an overview map.
 */
export class MissionSelect extends MenuPage {
  constructor(mode = 'practice') {
    super(`missions:${mode}`, 'm-missions');
    this.mode = mode;
    this.tab = mode === 'practice' ? 'combat' : 'all';
    this.current = null;
  }

  missions() {
    const list = this.mode === 'practice' ? MISSIONS.filter((m) => m.category === this.tab) : MISSIONS;
    const rank = (m) => (ORDER.includes(m.id) ? ORDER.indexOf(m.id) : 100 + MISSIONS.indexOf(m));
    return [...list].sort((a, b) => rank(a) - rank(b));
  }

  html() {
    const tabs = this.mode === 'practice'
      ? PRACTICE_TABS.map((t) => `<button class="m-tab${t === this.tab ? ' on' : ''}" data-focus="tab:${t}">${CATEGORY_LABELS[t]}</button>`).join('') + '<span class="m-tabkeys">Q / E</span>'
      : '<span class="m-dim">alle Testmissionen</span>';
    const items = this.missions().map((m) => `
      <button class="m-item" data-focus="m:${m.id}">
        <span class="m-item-name">${esc(m.name)}</span>
        <span class="m-item-sub">${esc(theaterName(m))} · ${esc(TIME_LABELS[m.timeOfDay] ?? m.timeOfDay)}${this.mode !== 'practice' ? ` · ${esc(CATEGORY_LABELS[m.category] ?? '')}` : ''}</span>
      </button>`).join('');
    return `
      <div class="m-panel m-wide">
        <header class="m-head"><h2>${this.mode === 'practice' ? 'Übungseinsatz' : 'Erprobung'}</h2><div class="m-tabs">${tabs}</div></header>
        <div class="m-split">
          <div class="m-list menu-scroll">${items}</div>
          <div class="m-detail" data-role="detail"></div>
        </div>
        <footer class="m-buttons">
          <button class="m-btn" data-focus="back">Zurück</button>
          <button class="m-btn primary" data-focus="next">Weiter ▸</button>
        </footer>
      </div>`;
  }

  initialFocus() {
    return `m:${this.missions()[0]?.id}`;
  }

  afterRender() {
    const m = this.current && this.missions().includes(this.current) ? this.current : this.missions()[0];
    if (m) this.showDetail(m);
  }

  onFocus(el) {
    const key = el.dataset.focus;
    if (key.startsWith('m:')) this.showDetail(MISSIONS.find((m) => m.id === key.slice(2)));
  }

  showDetail(m) {
    if (!m) return;
    this.current = m;
    const d = this.root.querySelector('[data-role="detail"]');
    if (!d) return;
    const rows = [
      ['Schauplatz', theaterName(m)],
      ['Tageszeit', TIME_LABELS[m.timeOfDay] ?? m.timeOfDay],
      ['Wetter', weatherName(m)],
      ['Start', startLabel(m)],
    ];
    d.innerHTML = `
      <h3>${esc(m.name)}</h3>
      <p class="m-desc-text">${esc(m.description ?? m.briefing ?? '')}</p>
      <table class="m-facts">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}
        <tr><td>Gegner</td><td>${enemyLines(m).map(esc).join('<br>')}</td></tr></table>
      <div class="m-map-wrap"><img class="m-map" alt="" data-role="map"><div class="m-map-legend">
        <span class="lg-start">◆ Start</span><span class="lg-nav">○ Navpunkt</span><span class="lg-enemy">▲ Gegner</span><span class="lg-area">┅ Gebiet</span><span class="lg-safe">◯ Schutzzone</span></div></div>`;
    // The map needs the height field: draw it a moment later so moving through the list stays quick
    clearTimeout(this.mapTimer);
    this.mapTimer = setTimeout(() => {
      const img = this.root.querySelector('[data-role="map"]');
      if (img && this.current === m) img.src = missionMap(m);
    }, 60);
  }

  onTab(dir) {
    if (this.mode !== 'practice') return false;
    const i = (PRACTICE_TABS.indexOf(this.tab) + dir + PRACTICE_TABS.length) % PRACTICE_TABS.length;
    this.setTab(PRACTICE_TABS[i]);
    return true;
  }

  setTab(tab) {
    this.tab = tab;
    this.current = null;
    this.render();
    this.stack.focused = null;
    this.stack.focus(this.find(this.initialFocus()), { quiet: true });
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
    const m = key.startsWith('m:') ? MISSIONS.find((x) => x.id === key.slice(2)) : this.current;
    if (!m) return false;
    this.stack.push(new MissionPrep(m));
    return true;
  }

  destroy() {
    clearTimeout(this.mapTimer);
    super.destroy();
  }
}
