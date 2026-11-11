import { MenuPage, esc, choiceRow } from './MenuPage.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { WALKERS, WALKER_ORDER, CLASS_LABELS } from '../../data/walkers.js';
import { WEAPONS } from '../../data/weapons.js';
import { WEATHER } from '../../data/weather.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../../data/difficulty.js';
import { Storage } from '../../core/Storage.js';
import { missionError, startupOf } from '../../states/missionStartup.js';
import { TIME_LABELS, theaterName, weatherName, START_LABELS } from './missionInfo.js';
import { PILOTS, WING_NAMES, wingmenSlots } from '../../data/pilots.js';

const ALL = WALKER_ORDER.map((id) => WALKERS[id]);
const armorOf = (w) => Object.values(w.armor).reduce((a, b) => a + b, 0);
const STATS = [
  { label: 'Tonnage', get: (w) => w.tonnage, text: (w) => `${w.tonnage} t` },
  { label: 'Tempo', get: (w) => w.maxSpeed, text: (w) => `${Math.round(w.maxSpeed * 3.6)} km/h` },
  { label: 'Panzerung', get: armorOf, text: (w) => String(armorOf(w)) },
  { label: 'Reaktor', get: (w) => w.reactorOutput, text: (w) => `${w.reactorOutput} MW` },
  { label: 'Hardpoints', get: (w) => w.hardpoints.length, text: (w) => String(w.hardpoints.length) },
];
const MAX = Object.fromEntries(STATS.map((s) => [s.label, Math.max(...ALL.map(s.get))]));

const PRACTICE_DEFAULTS = { invulnerable: false, infiniteAmmo: false, timeOfDay: 'mission', weather: 'mission', startMode: 'default' };
const TIMES = ['mission', 'day', 'dusk', 'night'];
const WEATHERS = ['mission', ...Object.keys(WEATHER)];
const START_MODES = ['default', 'full', 'simple', 'auto', 'hot'];
const START_MODE_LABELS = { full: 'voll', simple: 'einfach', auto: 'automatisch', hot: 'heiß (bereit)' };

/**
 * Mission preparation: walker on a turntable (3D scene), stats as bars,
 * factory loadout, practice options; Einsatz beginnen / Zurück.
 */
export class MissionPrep extends MenuPage {
  constructor(mission) {
    super(`prep:${mission.id}`, 'm-prep');
    this.mission = mission;
    const savedWalker = Storage.load('prepWalker', null);
    this.walkerId = WALKERS[savedWalker] ? savedWalker : mission.playerStart.walker ?? 'bastion';
    if (mission.playerStart.walker && !savedWalker) this.walkerId = mission.playerStart.walker;
    this.practice = { ...PRACTICE_DEFAULTS, ...(Storage.load('practice', {}) ?? {}) };
    const d = Storage.load('difficulty', 'normal');
    this.difficulty = DIFFICULTY[d] ? d : 'normal';
    // Team: one walker (or none) per wingman slot; the mission limits the slots
    const savedTeam = Storage.load('prepWingmen', []) ?? [];
    this.team = WING_NAMES.map((_, i) => (WALKERS[savedTeam[i]] ? savedTeam[i] : null));
  }

  get slots() {
    return wingmenSlots(this.mission);
  }

  /** Chosen wingmen for the mission start (null = slot empty). */
  get wingmen() {
    return this.team.slice(0, this.slots);
  }

  teamHtml() {
    const n = this.slots;
    if (!n) return '<h3>Team</h3><p class="m-dim">Dieser Einsatz ist allein zu fliegen.</p>';
    const rows = this.team.slice(0, n).map((id, i) => {
      const p = PILOTS[i];
      return choiceRow(`wing${i}`, `${WING_NAMES[i]} · ${p.callsign}`, id ? WALKERS[id].name : '—', { hint: `${p.name} — Walker wählen oder leer lassen` });
    }).join('');
    const count = this.wingmen.filter(Boolean).length;
    return `<h3>Team <span class="m-dim">(${count ? `${count} Flügel${count > 1 ? 'leute' : 'mann'}` : 'allein'} · Funk: F, Befehle Shift+1–7)</span></h3>${rows}`;
  }

  mount() {
    this.render();
    this.onShow();
  }

  onShow() {
    this.stack.scene?.showcase(this.walkerId);
  }

  onHide() {
    this.stack.scene?.showcase(null);
  }

  get walker() {
    return WALKERS[this.walkerId];
  }

  startModeLabel(v) {
    if (v !== 'default') return START_MODE_LABELS[v];
    const s = startupOf(this.mission);
    if (s.mode === 'scramble') return 'Standard (einfach, Alarmstart)';
    return `Standard (${START_MODE_LABELS[this.game.settings.get('startMode')] ?? 'voll'})`;
  }

  html() {
    const w = this.walker;
    const m = this.mission;
    const bars = STATS.map((s) => `
      <div class="m-stat"><span class="m-label">${s.label}</span><span class="m-bar"><span style="width:${Math.round((s.get(w) / MAX[s.label]) * 100)}%"></span></span><span class="m-num">${esc(s.text(w))}</span></div>`).join('');
    const loadout = w.hardpoints.map((hp) => {
      const wid = w.defaultLoadout[hp.id];
      const def = WEAPONS[wid];
      return `<tr><td>${esc(hp.id)}</td><td>${esc(hp.size)} ${esc(hp.type)}</td><td>${def ? esc(def.short) : '—'}</td></tr>`;
    }).join('');
    const p = this.practice;
    const s = startupOf(m);
    return `
      <div class="m-prep-col m-panel">
        <header class="m-head"><h2>Einsatzvorbereitung</h2><span class="m-dim">${esc(m.name)}</span></header>
        <div class="m-prep-scroll menu-scroll">
          ${choiceRow('walker', 'Walker', `${w.name}`, { hint: `${CLASS_LABELS[w.class]} · ${w.role ?? ''}` })}
          <div class="m-walker-sub">${esc(CLASS_LABELS[w.class])} · ${esc(w.role ?? '')} · ${esc(w.manufacturer ?? '')}</div>
          <div class="m-stats">${bars}</div>
          <h3>Bewaffnung <span class="m-dim">(Werk — Hangar folgt in Phase C)</span></h3>
          <table class="m-loadout">${loadout}</table>
          ${this.teamHtml()}
          <h3>Übung</h3>
          ${choiceRow('invulnerable', 'Verwundbar', p.invulnerable ? 'nein' : 'ja')}
          ${choiceRow('infiniteAmmo', 'Munition', p.infiniteAmmo ? 'unbegrenzt' : 'begrenzt')}
          ${choiceRow('difficulty', 'Schwierigkeit', DIFFICULTY[this.difficulty].name)}
          ${choiceRow('timeOfDay', 'Tageszeit', p.timeOfDay === 'mission' ? `Einsatz (${TIME_LABELS[m.timeOfDay] ?? m.timeOfDay})` : TIME_LABELS[p.timeOfDay])}
          ${choiceRow('weather', 'Wetter', p.weather === 'mission' ? `Einsatz (${weatherName(m)})` : weatherName(m, p.weather))}
          ${choiceRow('startMode', 'Startprozedur', this.startModeLabel(p.startMode))}
          <div class="m-brief"><b>Lage:</b> ${esc(m.briefing ?? m.description ?? '')}</div>
          <div class="m-dim">${esc(theaterName(m))} · Start ${esc(START_LABELS[s.mode])}</div>
        </div>
        <footer class="m-buttons">
          <button class="m-btn" data-focus="back">Zurück</button>
          <button class="m-btn primary big" data-focus="start">Einsatz beginnen</button>
        </footer>
      </div>`;
  }

  initialFocus() {
    return 'start';
  }

  cycle(list, value, dir, wrap = false) {
    let i = list.indexOf(value) + dir;
    if (wrap) i = (i + list.length) % list.length;
    if (i < 0 || i >= list.length) return null;
    return list[i];
  }

  adjust(el, dir, wrap = false) {
    const key = el.dataset.focus;
    const p = this.practice;
    let changed = false;
    if (key === 'walker') {
      const n = this.cycle(WALKER_ORDER, this.walkerId, dir, true);
      this.walkerId = n;
      Storage.save('prepWalker', n);
      this.stack.scene?.showcase(n);
      changed = true;
    } else if (key.startsWith('wing')) {
      const i = Number(key.slice(4));
      const list = [null, ...WALKER_ORDER];
      this.team[i] = this.cycle(list, this.team[i], dir, true);
      Storage.save('prepWingmen', this.team);
      changed = true;
    } else if (key === 'invulnerable' || key === 'infiniteAmmo') {
      p[key] = !p[key];
      changed = true;
    } else if (key === 'difficulty') {
      const n = this.cycle(DIFFICULTY_ORDER, this.difficulty, dir, wrap);
      if (n) {
        this.difficulty = n;
        Storage.save('difficulty', n);
        changed = true;
      }
    } else {
      const lists = { timeOfDay: TIMES, weather: WEATHERS, startMode: START_MODES };
      const n = lists[key] && this.cycle(lists[key], p[key], dir, wrap);
      if (n) {
        p[key] = n;
        changed = true;
      }
    }
    if (changed) {
      Storage.save('practice', p);
      this.refresh();
    }
    return changed;
  }

  activate(el) {
    const key = el.dataset.focus;
    if (key === 'back') {
      this.stack.pop();
      return true;
    }
    if (key === 'start') return this.start();
    if (el.hasAttribute('data-adjust')) return this.adjust(el, 1, true) ? 'quiet' : false;
    return false;
  }

  start() {
    const err = missionError(this.mission);
    if (err) {
      this.stack.sound('error');
      this.stack.push(new ConfirmDialog({ title: 'Einsatz ungültig', text: err, tone: 'error', buttons: [{ label: 'Zurück', cancel: true }] }));
      return false;
    }
    const practice = { ...this.practice, difficulty: this.difficulty };
    this.game.loading.show({ name: this.mission.name, place: `${theaterName(this.mission)} · ${this.walker.name}` });
    this.game.states.change('mission', { missionId: this.mission.id, walkerId: this.walkerId, practice, wingmen: this.wingmen });
    return true;
  }
}
