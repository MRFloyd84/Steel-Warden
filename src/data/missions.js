/**
 * Mission definitions. Used so far: id/name/theater/timeOfDay/seed/briefing,
 * playerStart { x, z, heading (rad), walker }, navPoints [{ id, x, z }] and
 * spawns [{ id, unit (walker id), at: [x, z], heading, behavior, emitting }] — units are
 * driven by DummyDriver until the AI exists. Triggers, objectives etc. follow
 * with the mission system.
 *
 * World (Teil 2):
 *   weather        data/weather.js id (default: the theater's typical weather)
 *   sites          [{ type (data/structures.js SITES), at: [x, z], rotation (deg), id }] — ground levelled
 *   structures     [{ type, at: [x, z], rotation, id }] single buildings
 *   features       fixed terrain features with `at` (world/FeatureField.js), on top of the theater's
 *   hills          [{ x, z, radius, height }]
 *   area           mission area polygon [[x, z], …] — fence, radar border, radio warning
 *   terrainFeatures: false, surface, scatter: false, autoStructures: false, surfaceColors, surfaceTints
 *                  overrides for test fields
 *
 * Enemies and objectives (A3):
 *   forces         groups, guns, reinforcements, waves — see ai/AIDirector.js
 *   script         objectives (nav, destroy, waves, extract) — see states/MissionScript.js
 */
export const MISSIONS = [
  {
    id: 'range',
    name: 'Schießstand Brenn-Süd',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 90210,
    briefing: 'Waffenerprobung: 6 stehende und 3 laufende Ziel-Walker in 100–800 m, keine Gegenwehr. T schaltet auf. GOLIATH (stehend) und BASTION (laufend) strahlen Radar ab; ein MARDER steht verdeckt hinter dem Hügel links.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 0, z: -600 }],
    hills: [{ x: -150, z: -300, radius: 60, height: 34 }],
    // Keep the range a clean test field: no rivers, no rule-placed halls, no scatter
    terrainFeatures: false, autoStructures: false, scatter: false, weather: 'clear',
    spawns: [
      { id: 's-kestrel', unit: 'kestrel', at: [-30, -110], heading: Math.PI, behavior: { type: 'idle' } },
      { id: 's-marder', unit: 'marder', at: [45, -190], heading: Math.PI * 0.75, behavior: { type: 'idle' } },
      { id: 's-bastion', unit: 'bastion', at: [-70, -280], heading: Math.PI / 2, behavior: { type: 'idle' } },
      { id: 's-halberd', unit: 'halberd', at: [90, -400], heading: Math.PI, behavior: { type: 'idle' } },
      { id: 's-goliath', unit: 'goliath', at: [-110, -560], heading: Math.PI * 1.2, behavior: { type: 'idle' }, emitting: true },
      { id: 's-koloss', unit: 'koloss', at: [60, -780], heading: Math.PI, behavior: { type: 'idle' } },
      { id: 'w-marder', unit: 'marder', at: [0, -250], heading: Math.PI / 2, behavior: { type: 'circle', radius: 40, throttle: 0.45 } },
      { id: 'w-bastion', unit: 'bastion', at: [-160, -420], heading: -Math.PI / 2, behavior: { type: 'pace', distance: 120, throttle: 0.6 }, emitting: true },
      { id: 'h-marder', unit: 'marder', at: [-210, -390], heading: Math.PI * 0.8, behavior: { type: 'idle' } },
      { id: 'w-goliath', unit: 'goliath', at: [160, -620], heading: Math.PI / 2, behavior: { type: 'pace', distance: 90, throttle: 0.7 } },
    ],
  },
  {
    id: 'test-parade',
    name: 'Paradeplatz Brenn-Süd',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 90210,
    briefing: 'Alle sechs Walker-Typen in Bewegung. Außenkamera mit Shift+V, Freiflug im Debug-Modus (^) mit Shift+F4.',
    playerStart: { x: 0, z: 30, heading: 0, walker: 'bastion' },
    terrainFeatures: false, autoStructures: false, scatter: false, weather: 'clear',
    navPoints: [{ id: 'ALPHA', x: 0, z: -400 }],
    spawns: [
      { id: 'p1', unit: 'kestrel', at: [-45, -40], heading: 0, behavior: { type: 'circle', radius: 22, throttle: 0.45 } },
      { id: 'p2', unit: 'marder', at: [-15, -55], heading: 0.4, behavior: { type: 'circle', radius: -26, throttle: 0.5 } },
      { id: 'p3', unit: 'bastion', at: [18, -40], heading: 0, behavior: { type: 'pace', distance: 35, throttle: 0.6 } },
      { id: 'p4', unit: 'halberd', at: [50, -60], heading: -0.6, behavior: { type: 'circle', radius: 32, throttle: 0.7 } },
      { id: 'p5', unit: 'goliath', at: [-30, -110], heading: 0, behavior: { type: 'circle', radius: -38, throttle: 0.8 } },
      { id: 'p6', unit: 'koloss', at: [30, -115], heading: 0, behavior: { type: 'turn', rate: 0.5 } },
    ],
  },
  {
    id: 'test-ice',
    name: 'Testgelände Kalvik',
    theater: 'ice',
    timeOfDay: 'day',
    seed: 1337,
    briefing: 'Eiswüste im Schneesturm: Gletscherspalten, Eisseen mit dünnem Eis (schwere Walker brechen ein), Schneewehen bremsen. Landeplatz 300 m voraus. Einsatzgebiet markiert.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 80, z: -320 }, { id: 'BRAVO', x: -1400, z: -300 }],
    sites: [{ type: 'landingSite', at: [80, -320], rotation: 15 }],
    features: [
      { type: 'lake', at: [-170, -170], radius: 55, fluid: 'thinIce', shore: 'soft' },
      { type: 'crevasse', at: [260, -120], angle: 70, length: 300, width: 8, depth: 22, wall: 3, meander: 0.1 },
    ],
    area: [[-700, 300], [700, 300], [800, -900], [-800, -900]],
  },
  {
    id: 'test-volcano',
    name: 'Testgelände Ashmar',
    theater: 'volcano',
    timeOfDay: 'dusk',
    seed: 4242,
    briefing: 'Ascheregen. Lavaflüsse und heiße Zonen heizen den Reaktor, Lava zerstört die Beine. Basaltsäulen als Deckung. Raffinerie 350 m voraus.',
    playerStart: { x: 0, z: 0, heading: 1.2, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: -330, z: -160 }, { id: 'BRAVO', x: 300, z: 1200 }],
    sites: [{ type: 'refineryPlant', at: [-330, -160], rotation: 30 }],
    features: [
      { type: 'river', at: [-120, 150], angle: 20, length: 420, width: 14, depth: 2.5, drop: 1.5, meander: 0.25, fluid: 'lava', shore: 'hot' },
      { type: 'zone', at: [-160, -10], radius: 40, surface: 'hot' },
    ],
  },
  {
    id: 'test-industrial',
    name: 'Testgelände Brenn-Süd',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 90210,
    briefing: 'Industriegelände im Regen: Straßenraster mit Hallen, Rohrleitungen, Kühltürmen und Kränen. Stützpunkt 400 m voraus — Bauwerke lassen sich zerstören.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 0, z: -400 }, { id: 'BRAVO', x: 1500, z: 200 }],
    sites: [{ type: 'outpost', at: [0, -400], rotation: 0 }],
    area: [[-600, 250], [600, 250], [600, -1000], [-600, -1000]],
  },
  {
    id: 'test-moon',
    name: 'Testgelände Selene-7',
    theater: 'moon',
    timeOfDay: 'day',
    seed: 777,
    briefing: 'Kraterfeld ohne Atmosphäre, Geröll, niedrige Schwerkraft (Raketen fallen nach Brennschluss kaum). Landeplatz 300 m voraus.',
    playerStart: { x: 0, z: 0, heading: 2.4, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: -200, z: 230 }, { id: 'BRAVO', x: 900, z: 900 }],
    sites: [{ type: 'landingSite', at: [-200, 230], rotation: 40 }],
  },
  {
    id: 'test-delta',
    name: 'Testgelände Flussdelta Morrow',
    theater: 'delta',
    timeOfDay: 'day',
    seed: 5150,
    briefing: 'Flaches Schwemmland mit Bodennebel: Kanäle, Deiche, Schilf, weicher Boden bremst schwere Walker. Stützpunkt jenseits des Kanals.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 40, z: -460 }],
    sites: [{ type: 'outpost', at: [40, -460], rotation: 180 }],
    features: [
      { type: 'river', at: [0, -230], angle: 0, length: 900, width: 30, depth: 3, drop: 0.8, meander: 0.12, fluid: 'water', shore: 'soft', dikes: { height: 3.5, width: 9 } },
    ],
    area: [[-500, 200], [500, 200], [500, -800], [-500, -800]],
  },
  {
    id: 'test-canyon',
    name: 'Testgelände Canyonwüste Tessar',
    theater: 'canyon',
    timeOfDay: 'day',
    seed: 6060,
    weather: 'sandstorm',
    briefing: 'Sandsturm: Sicht unter 300 m, Aufschaltung braucht länger und reißt ab. Felsbogen 260 m voraus, 140 m dahinter steht ein MARDER im Sichtschatten des rechten Pfeilers; links quert eine Schlucht — optische Rakete (HALBERD) um den Bogen lenken.',
    playerStart: { x: 160, z: 0, heading: 0, walker: 'halberd' },
    navPoints: [{ id: 'BOGEN', x: 160, z: -260 }, { id: 'SCHLUCHT', x: 0, z: -250 }],
    sites: [{ type: 'archGate', at: [160, -260], rotation: 0 }],
    spawns: [
      { id: 'arch-marder', unit: 'marder', at: [186, -400], heading: Math.PI, behavior: { type: 'idle' } },
    ],
  },
  {
    id: 'test-synth',
    name: 'Testgelände Synthese-Kernwelt',
    theater: 'synth',
    timeOfDay: 'day',
    seed: 1999,
    briefing: 'Kristalline Fremdwelt: regelmäßige Formen, leuchtende Adern im Boden. Synthese-Nest 380 m voraus (Pylone, Fertigungskuppel, Sensorknoten strahlt — Anti-Radar).',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 0, z: -380 }],
    sites: [{ type: 'synthNest', at: [0, -380], rotation: 0 }],
  },
  {
    id: 'test-ground',
    name: 'Bodenproben',
    theater: 'delta',
    timeOfDay: 'day',
    seed: 4711,
    weather: 'clear',
    briefing: 'Sechs Bodenarten nebeneinander, je 50 m breit und 300 m lang (von links): hart, weich, Wasser, Lava, dünnes Eis, heiß. Mit leichtem und schwerem Walker durchlaufen; das Debug-Overlay (^) zeigt die Bodenart.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'EIS', x: 90, z: -300 }],
    terrainFeatures: false,
    surface: { base: 'hard' },
    scatter: false,
    autoStructures: false,
    surfaceColors: { thinIce: '#a8cde0', hot: '#7a3a22', lavaBed: '#3a1a10', soft: '#4a3f2a' },
    features: [
      { type: 'patch', at: [-150, -300], size: [50, 300], surface: 'hard', tint: 'plate' },
      { type: 'patch', at: [-90, -300], size: [50, 300], surface: 'soft' },
      { type: 'patch', at: [-30, -300], size: [50, 300], fluid: 'water', depth: 1.6 },
      { type: 'patch', at: [30, -300], size: [50, 300], fluid: 'lava', depth: 1.2 },
      { type: 'patch', at: [90, -300], size: [50, 300], fluid: 'thinIce', drop: 0.3 },
      { type: 'patch', at: [150, -300], size: [50, 300], surface: 'hot' },
    ],
    surfaceTints: { plate: '#7d7e74' },
  },
  {
    id: 'test-ice-night',
    name: 'Nachtlauf Kalvik',
    theater: 'ice',
    timeOfDay: 'night',
    seed: 2024,
    briefing: 'Nachterprobung. Sternenhimmel, geringe Restlichtverstärkung.',
    playerStart: { x: 0, z: 0, heading: 0.4, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: -300, z: -1100 }],
  },
  // ---- A3: Synthesis enemies and AI ----
  {
    id: 'test-duel',
    name: 'Duell',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 31337,
    briefing: 'Ein Synthese-Jäger (SICHEL) gegen dich auf offenem Feld, 700 m voraus. Er kennt deine Position. Je Schwierigkeitsgrad einmal spielen und vergleichen (Treffsicherheit, Ausweichen, Flankieren).',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 0, z: -700 }],
    terrainFeatures: false, autoStructures: false, scatter: false, weather: 'clear',
    forces: {
      groups: [{ id: 'jaeger', role: 'hunt', units: [{ type: 'sichel', at: [0, -700], heading: 0 }] }],
    },
    script: { steps: [{ type: 'destroy', groups: 'all', text: 'Jäger SICHEL ausschalten', done: 'Jäger ausgeschaltet.' }] },
  },
  {
    id: 'test-ambush',
    name: 'Hinterhalt',
    theater: 'canyon',
    timeOfDay: 'day',
    seed: 7070,
    weather: 'clear',
    briefing: 'Canyon in Tessar: die Schlucht vor dir knickt nach 750 m rechts ab. Von dort zieht eine Synthese-Patrouille (Späher SPLITTER + Jäger SICHEL) heran — ungesehen am Knick (KNICK) auf sie warten. SENSOREN aus, sonst orten sie deine Abstrahlung auf rund 1500 m. Der Späher ruft Verstärkung, sobald er dich sieht: 40 s später kommt ein weiterer Jäger aus dem Ostteil der Schlucht.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'KNICK', x: 0, z: -700 }, { id: 'OST', x: 700, z: -760 }],
    features: [
      { type: 'canyon', at: [0, -420], angle: 90, length: 760, width: 60, depth: 30, wall: 14, meander: 0.1 },
      { type: 'canyon', at: [400, -760], angle: 0, length: 860, width: 60, depth: 30, wall: 14, meander: 0.1 },
    ],
    forces: {
      groups: [{
        id: 'patrouille', role: 'patrol', loop: false,
        units: [{ type: 'splitter', at: [700, -760], heading: Math.PI / 2 }, { type: 'sichel', at: [740, -770], heading: Math.PI / 2 }],
        patrol: [[700, -760], [40, -760], [0, -320]],
      }],
      reinforcements: { delay: 40, via: 'edge', points: [[780, -760]], trigger: 'call', groups: [{ units: [{ type: 'sichel' }] }] },
    },
    script: { steps: [{ type: 'destroy', groups: ['patrouille'], text: 'Patrouille im Canyon ausschalten', done: 'Patrouille ausgeschaltet.' }] },
  },
  {
    id: 'test-stellung',
    name: 'Stellung',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 4455,
    weather: 'clear',
    briefing: 'Die Synthese hält die Raffinerie 700 m voraus: zwei Abwehrstachel und ein Brecher (MONOLITH, Schwarmraketen mit echter Aufschaltung). Die zwei Geschütztürme der Anlage sind in Feindeshand. Deckung nutzen!',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ANLAGE', x: 0, z: -700 }],
    sites: [{ type: 'refineryPlant', at: [0, -700], rotation: 0, id: 'raffinerie' }],
    structures: [{ type: 'spike', at: [-45, -635], rotation: 180, id: 'stachel-l' }, { type: 'spike', at: [45, -635], rotation: 180, id: 'stachel-r' }],
    forces: {
      groups: [{ id: 'stellung', role: 'guard', units: [{ type: 'monolith', at: [10, -650], heading: 0 }] }],
      guns: ['spike', 'turret'],
    },
    script: { steps: [{ type: 'destroy', groups: ['stellung'], text: 'Brecher MONOLITH ausschalten', done: 'Brecher ausgeschaltet — Stellung genommen.' }] },
  },
  {
    id: 'test-waves',
    name: 'Welle',
    theater: 'industrial',
    timeOfDay: 'dusk',
    seed: 8080,
    briefing: 'Drei Wellen setzen per Landefähre ab, die nächste kommt 10 s nach der vorigen. Welle 3 bringt einen Belagerer (OBELISK, Mörser) — er schießt nur, wenn ein anderer dich sieht.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'goliath' },
    navPoints: [{ id: 'LZ-1', x: 0, z: -600 }],
    terrainFeatures: false, autoStructures: false, scatter: false, weather: 'clear',
    forces: {
      waves: [
        { delay: 6, via: 'lander', points: [[0, -600]], groups: [{ units: [{ type: 'splitter' }, { type: 'splitter' }] }] },
        { delay: 10, via: 'lander', points: [[-450, -420], [450, -420]], groups: [{ units: [{ type: 'sichel' }, { type: 'splitter' }] }, { units: [{ type: 'splitter' }] }] },
        { delay: 10, via: 'lander', points: [[0, -700], [350, -950]], groups: [{ units: [{ type: 'monolith' }, { type: 'sichel' }] }, { units: [{ type: 'obelisk' }] }] },
      ],
    },
    script: { steps: [{ type: 'waves', text: 'Drei Wellen abwehren', done: 'Alle Wellen abgewehrt.' }] },
  },
  {
    id: 'first-sortie',
    name: 'Erster Einsatz',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 2601,
    briefing: 'Kaltstart im Hangar. Walker hochfahren, durchs Tor raus, ALPHA anlaufen. Bei BRAVO patrouilliert eine Synthese-Gruppe (Späher SPLITTER + Jäger SICHEL) — stellen und ausschalten, danach zur EXTRAKTION. Sieht dich der Späher, ruft er eine Landefähre mit einem Brecher (MONOLITH, ca. 60 s). Mit SENSOREN an ortet die Synthese dich auf rund 1400 m.',
    playerStart: { x: 0, z: 4, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 0, z: -500 }, { id: 'BRAVO', x: 650, z: -1350 }, { id: 'EXTRAKTION', x: -420, z: -1650 }],
    structures: [{ type: 'hangarBay', at: [0, 0], rotation: 0, id: 'hangar' }],
    sites: [{ type: 'landingSite', at: [-420, -1650], rotation: 20, id: 'lz' }],
    area: [[-950, 300], [1250, 300], [1250, -2000], [-950, -2000]],
    forces: {
      groups: [{
        id: 'patrouille', role: 'patrol',
        units: [{ type: 'splitter', at: [650, -1280] }, { type: 'sichel', at: [625, -1305] }],
        patrol: [[650, -1280], [880, -1480], [560, -1620], [430, -1360]],
      }],
      reinforcements: { delay: 60, via: 'lander', points: [[950, -1700], [300, -1750]], trigger: 'call', groups: [{ units: [{ type: 'monolith' }] }] },
    },
    script: {
      steps: [
        { type: 'nav', id: 'ALPHA', radius: 70, text: 'Navpunkt ALPHA anlaufen', done: 'ALPHA erreicht. Weiter nach BRAVO, dort wurde eine Synthese-Patrouille gemeldet.' },
        { type: 'destroy', groups: ['patrouille'], nav: 'BRAVO', text: 'Synthese-Patrouille bei BRAVO stellen', done: 'Patrouille ausgeschaltet. Zur EXTRAKTION.' },
        { type: 'extract', id: 'EXTRAKTION', radius: 60, text: 'EXTRAKTION erreichen', done: 'Extraktion erreicht. Einsatz erfüllt.' },
      ],
    },
  },

];

export function getMission(id) {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) throw new Error(`Unknown mission "${id}"`);
  return mission;
}
