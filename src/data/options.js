import { CONFIG } from './config.js';
import { setDetailFilter, setDetailEnabled, setDetailScale } from '../render/DetailTextures.js';

/**
 * Options (menu Optionen → Spiel · Grafik · Audio; Steuerung is the
 * bindings screen). type 'choice' (◀ value ▶) or 'slider' (min/max/step).
 * apply(game, value) makes the change take effect at once; some only reach
 * the world on the next mission (note).
 */
const onOff = [{ value: true, label: 'an' }, { value: false, label: 'aus' }];
const pct = (v) => `${Math.round(v * 100)} %`;

export const OPTION_PAGES = [
  { id: 'game', label: 'Spiel' },
  { id: 'graphics', label: 'Grafik' },
  { id: 'audio', label: 'Audio' },
  { id: 'controls', label: 'Steuerung' },
];

export const OPTIONS = [
  // ---- Spiel ----
  {
    id: 'startMode', page: 'game', label: 'Startprozedur (Standard)', type: 'choice', default: 'full',
    choices: [{ value: 'full', label: 'voll' }, { value: 'simple', label: 'einfach' }, { value: 'auto', label: 'automatisch (Shift+S)' }],
    help: 'Voll: jeder Schalter selbst. Einfach: Batterie, Reaktor, Systeme, Waffen, Beine — der Rest läuft von allein. Alarmstarts nutzen „einfach“, außer die Übungsoption sagt anderes.',
    apply: (g, v) => { CONFIG.startup.mode = v; },
  },
  {
    id: 'randomEvents', page: 'game', label: 'Zufallsereignisse beim Start', type: 'choice', default: false, choices: onOff,
    help: 'Pumpe 2 fällt beim ersten Versuch aus, der Gyro braucht zwei Läufe.',
    apply: (g, v) => { CONFIG.startup.randomEvents = v; },
  },
  {
    id: 'helpIntro', page: 'game', label: 'Tastenhilfe zu Beginn', type: 'choice', default: 'once',
    choices: [{ value: 'once', label: 'einmal' }, { value: 'always', label: 'jedes Mal' }, { value: 'never', label: 'nie' }],
    help: 'Die Karte mit den wichtigsten Tasten am Einsatzbeginn.',
  },
  {
    id: 'radioText', page: 'game', label: 'Funktexte', type: 'choice', default: 7,
    choices: [{ value: 0, label: 'aus' }, { value: 4, label: 'kurz (4 s)' }, { value: 7, label: 'normal (7 s)' }, { value: 12, label: 'lang (12 s)' }],
    help: 'Wie lange Funksprüche oben links stehen bleiben.',
  },
  {
    id: 'units', page: 'game', label: 'Geschwindigkeit', type: 'choice', default: 'kmh',
    choices: [{ value: 'kmh', label: 'km/h' }, { value: 'ms', label: 'm/s' }],
    help: 'Einheit der Geschwindigkeitsanzeige im Cockpit.',
  },

  // ---- Grafik ----
  {
    id: 'viewDistance', page: 'graphics', label: 'Sichtweite', type: 'choice', default: 6,
    choices: [{ value: 4, label: 'nah' }, { value: 6, label: 'mittel' }, { value: 8, label: 'weit' }],
    help: 'Gelände-Kacheln um den Walker; Bewuchs und Felsen ab dem nächsten Einsatz.',
    apply: (g, v) => {
      CONFIG.terrain.viewRadius = v;
      CONFIG.scatter.viewDistance = { 4: 420, 6: 560, 8: 720 }[v];
      CONFIG.scatter.structureDistance = { 4: 850, 6: 1100, 8: 1400 }[v];
    },
  },
  {
    id: 'density', page: 'graphics', label: 'Objektdichte', type: 'choice', default: 1,
    choices: [{ value: 0.5, label: 'gering' }, { value: 1, label: 'normal' }, { value: 1.5, label: 'hoch' }],
    help: 'Felsen, Bewuchs und Kleinkram. Gilt ab dem nächsten Einsatz.',
    apply: (g, v) => { CONFIG.scatter.densityScale = v; },
  },
  {
    id: 'shadows', page: 'graphics', label: 'Schatten', type: 'choice', default: true,
    choices: [{ value: true, label: 'Kontaktschatten' }, { value: false, label: 'aus' }],
    help: 'Dunkler Fleck unter jedem Walker.',
    apply: (g, v) => { CONFIG.render.contactShadows = v; },
  },
  {
    id: 'effects', page: 'graphics', label: 'Effekte', type: 'choice', default: 1,
    choices: [{ value: 0.4, label: 'sparsam' }, { value: 1, label: 'voll' }],
    help: 'Partikelmenge bei Treffern, Explosionen, Rauch und Wetter.',
    apply: (g, v) => { CONFIG.render.effects = v; },
  },
  {
    id: 'detailTextures', page: 'graphics', label: 'Detailtexturen', type: 'choice', default: 1,
    choices: [{ value: 0, label: 'aus' }, { value: 0.6, label: 'schwach' }, { value: 1, label: 'normal' }, { value: 1.5, label: 'stark' }],
    help: 'Graustufen-Struktur auf Boden, Gebäuden und Walkern; die Farbe bleibt die der Palette.',
    apply: (g, v) => {
      setDetailEnabled(v > 0);
      setDetailScale(v);
    },
  },
  {
    id: 'texFilter', page: 'graphics', label: 'Texturfilter', type: 'choice', default: 'nearest',
    choices: [{ value: 'nearest', label: 'pixelig' }, { value: 'linear', label: 'gefiltert' }],
    help: 'Pixelig: harte Texel wie beim Software-Rendering. Gefiltert: weich wie die ersten 3D-Karten. Mipmaps immer an.',
    apply: (g, v) => setDetailFilter(v),
  },
  {
    id: 'crt', page: 'graphics', label: 'Scanlines / CRT', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.1, format: pct,
    help: 'Stärke der Scanlines und der Vignette über dem Bild.',
    apply: (g, v) => document.documentElement.style.setProperty('--crt', String(v)),
  },
  {
    id: 'renderScale', page: 'graphics', label: 'Auflösungsskala', type: 'choice', default: 0.75,
    choices: [{ value: 0.5, label: '50 %' }, { value: 0.75, label: '75 %' }, { value: 1, label: '100 %' }],
    help: 'Weniger Pixel, harte Kanten: Zeitkolorit und Tempo.',
    apply: (g, v) => g.renderer.setRenderScale(v),
  },
  {
    id: 'fps', page: 'graphics', label: 'FPS-Anzeige', type: 'choice', default: false, choices: onOff,
    help: 'Bildrate klein oben links.',
    apply: (g, v) => g.fpsCounter?.setVisible(v),
  },

  // ---- Audio ----
  ...[
    ['volMaster', 'Gesamt', 'master'],
    ['volEffects', 'Effekte (Welt, Waffen)', 'world'],
    ['volCockpit', 'Cockpit / Maschine', 'cockpit'],
    ['volRadio', 'Funk', 'radio'],
    ['volMusic', 'Musik', 'music'],
  ].map(([id, label, bus]) => ({
    id, page: 'audio', label, type: 'slider', default: 1, min: 0, max: 1, step: 0.05, format: pct,
    help: bus === 'music' ? 'Noch keine Musik im Spiel — der Regler steht schon bereit.' : null,
    apply: (g, v) => g.audio.setVolume(bus, v),
  })),
];

export const OPTION_BY_ID = Object.fromEntries(OPTIONS.map((o) => [o.id, o]));
