/**
 * Buildings, scatter models and sites.
 *
 * Structure blueprint (origin = ground centre, metres, +Y up, -Z = front):
 *   parts      low-poly pieces: { box: [w, h, d] | cyl: [r, h, seg?] | cone: [r, h, seg?] | ring: [r, tube, seg?],
 *              at: [x, y, z] (centre), rot: [x, y, z] degrees, color, zone ('main' default), glow (self-lit) }
 *              rtop: top radius for cyl (tapered)
 *   armor      hit points until 'damaged'; structure: further points until 'rubble'
 *   collide    walker collision: [{ box: [w, d], at: [x, z] } | { circle: r, at: [x, z] }]
 *   blocksSight (default true), destructible (default true), emitting (radar emitter, anti-radar target)
 *   onDestroy  'fire' | 'explosion' | 'smoke'
 *
 * Damage stages: intact → damaged (darker, parts tilted, smoke) → rubble (flat debris, fire, no collision).
 */
const STEEL = '#6f6d64';
const DARK = '#3d3c37';
const CONCRETE = '#8b877a';
const OLIVE = '#5d6249';
const RUST = '#7a4f34';
const WARN = '#b8962e';
const GLASS = '#3a5e6a';
const SYN = '#3a2f55';
const SYN_LIGHT = '#6b55a0';
const CRYSTAL = '#5ef2e6';

export const STRUCTURES = {
  // ---- human ----
  depot: {
    name: 'Versorgungsdepot', faction: 'human', armor: 260, structure: 180, onDestroy: 'fire',
    parts: [
      { box: [22, 7, 14], at: [0, 3.5, 0], color: OLIVE },
      { box: [23, 1, 15], at: [0, 7.4, 0], color: DARK },
      { box: [8, 5, 0.4], at: [0, 2.5, -7.1], color: DARK },
      ...[-8, -4, 4, 8].map((x) => ({ box: [2.4, 2.4, 6], at: [x, 1.2, -11], color: x < 0 ? RUST : STEEL })),
      { box: [5, 2.6, 2.6], at: [12.5, 1.3, 9], color: RUST },
    ],
    collide: [{ box: [23, 15], at: [0, 0] }, { box: [20, 7], at: [0, -11] }],
  },
  hangar: {
    name: 'Walker-Hangar', faction: 'human', armor: 420, structure: 300, onDestroy: 'fire',
    parts: [
      { cyl: [14, 30, 10], at: [0, 0, 0], rot: [90, 0, 0], color: STEEL, half: true },
      { box: [26, 2, 31], at: [0, 1, 0], color: CONCRETE },
      { box: [12, 16, 0.6], at: [0, 8, -15.2], color: DARK },
      { box: [12.4, 0.8, 0.8], at: [0, 16.2, -15.4], color: WARN },
    ],
    collide: [{ box: [28, 31], at: [0, 0] }],
  },
  // Walk-in hangar (mission start, site homeBase): two sliding door halves (zones doorL/doorR,
  // opened by world/HangarDoor.js at deploy), walls collide one by one
  hangarBay: {
    name: 'Walker-Hangar', faction: 'human', armor: 900, structure: 600, onDestroy: 'fire', destructible: false,
    parts: [
      { box: [34, 0.4, 36], at: [0, 0.2, 0], color: '#6e6b62' },
      { box: [34, 23, 1.6], at: [0, 11.5, 17.2], color: STEEL },
      { box: [1.6, 23, 36], at: [-16.2, 11.5, 0], color: STEEL },
      { box: [1.6, 23, 36], at: [16.2, 11.5, 0], color: STEEL },
      { box: [35, 1.6, 37], at: [0, 23.8, 0], color: DARK },
      { box: [34, 3, 1.6], at: [0, 21.5, -17.2], color: WARN },
      ...[-9, 0, 9].map((x) => ({ box: [1.2, 0.3, 10], at: [x, 22.8, 2], color: '#fff2c0', glow: true })),
      { box: [3, 20, 3], at: [-12.5, 10, 12], color: '#545249' },
      { box: [3, 20, 3], at: [12.5, 10, 12], color: '#545249' },
      ...[-10, 10].map((x) => ({ box: [6, 0.3, 0.3], at: [x, 0.45, -14], color: WARN })),
      // Door halves, outside the front wall line; they slide sideways along the outer walls
      ...[-1, 1].flatMap((side) => {
        const zone = side < 0 ? 'doorL' : 'doorR';
        return [
          { box: [16.2, 20, 0.8], at: [side * 8.1, 10, -18.4], color: '#5f5d55', zone },
          { box: [16.2, 1.2, 0.9], at: [side * 8.1, 4, -18.45], color: WARN, zone },
          { box: [16.2, 1.2, 0.9], at: [side * 8.1, 16, -18.45], color: WARN, zone },
          { box: [0.6, 20, 1], at: [side * 0.3, 10, -18.45], color: DARK, zone },
        ];
      }),
    ],
    collide: [
      { box: [1.6, 36], at: [-16.2, 0] }, { box: [1.6, 36], at: [16.2, 0] }, { box: [34, 1.6], at: [0, 17.2] },
      { box: [3, 3], at: [-12.5, 12] }, { box: [3, 3], at: [12.5, 12] },
      { box: [34, 1.2], at: [0, -18.4], door: true },
    ],
  },
  // Drop zone marking on the ground (mission start, site dropZone): paint only
  dropMarker: {
    name: 'Absetzpunkt', faction: 'human', destructible: false, blocksSight: false,
    parts: [
      { ring: [22, 0.7, 28], at: [0, -0.25, 0], color: WARN },
      { box: [30, 0.1, 1.4], at: [0, 0.1, 0], color: '#e8e2cf' },
      { box: [1.4, 0.1, 30], at: [0, 0.1, 0], color: '#e8e2cf' },
      ...[0, 90, 180, 270].map((a) => ({ cyl: [0.45, 1.6, 6], at: [Math.sin(a * Math.PI / 180) * 23, 0.8, Math.cos(a * Math.PI / 180) * 23], color: '#d8a22a', glow: true })),
    ],
    collide: [],
  },
  generator: {
    name: 'Generator', faction: 'human', armor: 180, structure: 120, onDestroy: 'explosion',
    parts: [
      { box: [10, 5, 7], at: [0, 2.5, 0], color: OLIVE },
      { cyl: [1.1, 6, 8], at: [-3, 8, 1.5], color: DARK },
      { cyl: [1.1, 6, 8], at: [3, 8, 1.5], color: DARK },
      { box: [10.4, 0.6, 7.4], at: [0, 5.2, 0], color: WARN },
      { box: [3, 3, 3], at: [7, 1.5, -1], color: STEEL },
    ],
    collide: [{ box: [13, 8], at: [1, 0] }],
  },
  radarTower: {
    name: 'Radarturm', faction: 'human', armor: 160, structure: 100, onDestroy: 'fire', emitting: true,
    parts: [
      ...[[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].map(([x, z]) => ({ box: [0.6, 22, 0.6], at: [x * 0.7, 11, z * 0.7], rot: [z * -1.5, 0, x * 1.5], color: STEEL })),
      { box: [6, 3, 6], at: [0, 22.5, 0], color: OLIVE },
      { box: [9, 4, 0.5], at: [0, 26.5, 0], rot: [-12, 0, 0], color: '#c9cbc4', zone: 'antenna' },
      { cyl: [0.3, 3, 6], at: [0, 25.5, 0], color: DARK },
    ],
    collide: [{ circle: 4, at: [0, 0] }],
  },
  turret: {
    name: 'Geschützturm', faction: 'human', armor: 220, structure: 140, onDestroy: 'explosion',
    parts: [
      { cyl: [4.5, 3, 8], at: [0, 1.5, 0], color: CONCRETE },
      { box: [5.5, 3, 6], at: [0, 4.5, 0.5], color: OLIVE, zone: 'gun' },
      { cyl: [0.45, 7, 6], at: [-1.1, 5, -5], rot: [90, 0, 0], color: DARK, zone: 'gun' },
      { cyl: [0.45, 7, 6], at: [1.1, 5, -5], rot: [90, 0, 0], color: DARK, zone: 'gun' },
    ],
    collide: [{ circle: 5, at: [0, 0] }],
  },
  bunker: {
    name: 'Bunker', faction: 'human', armor: 600, structure: 400, onDestroy: 'smoke',
    parts: [
      { box: [16, 4, 10], at: [0, 2, 0], color: CONCRETE },
      { box: [12, 2, 7], at: [0, 5, 0.5], color: '#7d7a6e' },
      { box: [8, 0.8, 0.6], at: [0, 3, -5.1], color: '#141412' },
    ],
    collide: [{ box: [16, 10], at: [0, 0] }],
  },
  relay: {
    name: 'Funkrelais', faction: 'human', armor: 100, structure: 60, onDestroy: 'smoke', emitting: true,
    parts: [
      { box: [3, 2.4, 3], at: [0, 1.2, 0], color: OLIVE },
      { cyl: [0.25, 18, 6], at: [0, 11, 0], color: STEEL, rtop: 0.1 },
      ...[6, 12, 17].map((y) => ({ box: [3, 0.15, 0.15], at: [0, y, 0], color: STEEL })),
      { cone: [0.5, 1, 6], at: [0, 20.5, 0], color: '#c43a2a' },
    ],
    collide: [{ circle: 2.5, at: [0, 0] }],
  },
  refinery: {
    name: 'Raffinerie', faction: 'human', armor: 360, structure: 240, onDestroy: 'explosion',
    parts: [
      { cyl: [5, 14, 10], at: [-7, 7, 0], color: STEEL },
      { cyl: [5, 14, 10], at: [7, 7, 0], color: STEEL },
      { cyl: [1.6, 24, 8], at: [0, 12, 6], color: RUST, rtop: 1.2 },
      { box: [22, 1.2, 1.2], at: [0, 12, -2], color: DARK },
      { box: [26, 2, 18], at: [0, 1, 0], color: CONCRETE },
      { cone: [5.2, 2.5, 10], at: [-7, 15.3, 0], color: DARK },
      { cone: [5.2, 2.5, 10], at: [7, 15.3, 0], color: DARK },
    ],
    collide: [{ box: [26, 18], at: [0, 0] }],
  },
  landingPad: {
    name: 'Landeplatz', faction: 'human', armor: 500, structure: 400, onDestroy: 'smoke', blocksSight: false,
    parts: [
      { cyl: [16, 0.8, 12], at: [0, 0.4, 0], color: CONCRETE },
      { ring: [11, 0.5, 12], at: [0, 0.85, 0], color: WARN },
      { box: [10, 0.12, 2], at: [0, 0.86, 0], color: '#e8e2cf' },
      ...[0, 90, 180, 270].map((a) => ({ cyl: [0.5, 1.4, 6], at: [Math.sin(a * Math.PI / 180) * 15, 0.7, Math.cos(a * Math.PI / 180) * 15], color: '#d84a2a', glow: true })),
    ],
    collide: [],
  },
  // Industrial scenery (auto-placed in Brenn-Süd)
  hall: {
    name: 'Werkhalle', faction: 'human', armor: 380, structure: 260, onDestroy: 'fire',
    parts: [
      { box: [36, 12, 22], at: [0, 6, 0], color: '#7d786a' },
      { box: [37, 1, 12], at: [0, 13.2, -5.5], rot: [14, 0, 0], color: DARK },
      { box: [37, 1, 12], at: [0, 13.2, 5.5], rot: [-14, 0, 0], color: DARK },
      { box: [10, 9, 0.5], at: [-8, 4.5, -11.1], color: RUST },
      ...[-15, -5, 5, 15].map((x) => ({ box: [6, 2, 0.3], at: [x, 9, 11.1], color: GLASS })),
    ],
    collide: [{ box: [36, 22], at: [0, 0] }],
  },
  coolingTower: {
    name: 'Kühlturm', faction: 'human', armor: 700, structure: 500, onDestroy: 'smoke',
    parts: [
      { cyl: [20, 22, 14], at: [0, 11, 0], color: '#a39e90', rtop: 14 },
      { cyl: [14, 18, 14], at: [0, 31, 0], color: '#a8a395', rtop: 16 },
    ],
    collide: [{ circle: 20, at: [0, 0] }],
  },
  crane: {
    name: 'Kran', faction: 'human', armor: 150, structure: 90, onDestroy: 'smoke', blocksSight: false,
    parts: [
      { box: [1.6, 34, 1.6], at: [0, 17, 0], color: WARN },
      { box: [30, 1.4, 1.4], at: [8, 34, 0], color: WARN },
      { box: [3, 3, 3], at: [-6, 33, 0], color: DARK },
      { box: [0.2, 14, 0.2], at: [20, 27, 0], color: DARK },
      { box: [5, 1.5, 5], at: [0, 0.75, 0], color: CONCRETE },
    ],
    collide: [{ circle: 3, at: [0, 0] }],
  },
  pipeline: {
    name: 'Rohrleitung', faction: 'human', armor: 120, structure: 80, onDestroy: 'smoke', blocksSight: false,
    parts: [
      { cyl: [1.1, 40, 8], at: [0, 3.5, 0], rot: [90, 0, 0], color: STEEL },
      { cyl: [1.1, 40, 8], at: [3, 3.5, 0], rot: [90, 0, 0], color: RUST },
      ...[-16, 0, 16].map((z) => ({ box: [6, 3.2, 0.6], at: [1.5, 1.6, z], color: DARK })),
    ],
    collide: [{ box: [6, 40], at: [1.5, 0] }],
  },
  // ---- synthesis ----
  pylon: {
    name: 'Kristall-Pylon', faction: 'synth', armor: 200, structure: 140, onDestroy: 'explosion', emitting: true,
    parts: [
      { cyl: [3, 2, 6], at: [0, 1, 0], color: SYN },
      { cone: [1.8, 16, 4], at: [0, 10, 0], color: CRYSTAL, glow: true },
      { cone: [1.2, 6, 4], at: [0, 3.5, 0], rot: [180, 45, 0], color: SYN_LIGHT },
    ],
    collide: [{ circle: 3, at: [0, 0] }],
  },
  foundry: {
    name: 'Fertigungskuppel', faction: 'synth', armor: 450, structure: 320, onDestroy: 'explosion',
    parts: [
      { cyl: [15, 9, 6], at: [0, 4.5, 0], color: SYN, rtop: 11 },
      { cyl: [11, 5, 6], at: [0, 11.5, 0], color: SYN_LIGHT, rtop: 4 },
      { ring: [12.5, 0.6, 6], at: [0, 9.2, 0], color: CRYSTAL, glow: true },
      { box: [6, 6, 1], at: [0, 3, -14.5], color: '#1a1428' },
    ],
    collide: [{ circle: 15, at: [0, 0] }],
  },
  sensorNode: {
    name: 'Sensorknoten', faction: 'synth', armor: 120, structure: 70, onDestroy: 'explosion', emitting: true,
    parts: [
      { cone: [2.5, 5, 3], at: [0, 2.5, 0], color: SYN },
      { box: [1.6, 1.6, 1.6], at: [0, 7, 0], rot: [45, 0, 45], color: CRYSTAL, glow: true },
      ...[0, 120, 240].map((a) => ({ box: [0.3, 6, 0.3], at: [Math.sin(a * Math.PI / 180) * 2.2, 4, Math.cos(a * Math.PI / 180) * 2.2], rot: [Math.cos(a * Math.PI / 180) * 18, 0, -Math.sin(a * Math.PI / 180) * 18], color: SYN_LIGHT })),
    ],
    collide: [{ circle: 3, at: [0, 0] }],
  },
  lander: {
    name: 'Landefähre', faction: 'synth', armor: 380, structure: 260, onDestroy: 'explosion',
    parts: [
      { cyl: [9, 4, 6], at: [0, 6, 0], color: SYN_LIGHT, rtop: 6 },
      { cone: [6, 5, 6], at: [0, 10.5, 0], color: SYN },
      ...[30, 150, 270].map((a) => ({ box: [0.8, 7, 0.8], at: [Math.sin(a * Math.PI / 180) * 8, 3, Math.cos(a * Math.PI / 180) * 8], rot: [Math.cos(a * Math.PI / 180) * -20, 0, Math.sin(a * Math.PI / 180) * 20], color: SYN })),
      { ring: [7.5, 0.4, 6], at: [0, 4.2, 0], color: CRYSTAL, glow: true },
    ],
    collide: [{ circle: 9, at: [0, 0] }],
  },
  spike: {
    name: 'Abwehrstachel', faction: 'synth', armor: 140, structure: 90, onDestroy: 'explosion',
    parts: [
      { cone: [2.2, 12, 4], at: [0, 6, 0], rot: [8, 0, 0], color: SYN },
      { cone: [0.8, 4, 4], at: [0, 12.5, -0.9], rot: [8, 0, 0], color: CRYSTAL, glow: true },
    ],
    collide: [{ circle: 2.4, at: [0, 0] }],
  },
  // ---- natural, indestructible ----
  arch: {
    name: 'Felsbogen', faction: 'nature', destructible: false,
    parts: [
      { box: [9, 26, 10], at: [-17, 13, 0], rot: [0, 0, 4], color: '#9a5e3e' },
      { box: [9, 26, 10], at: [17, 13, 0], rot: [0, 0, -4], color: '#93583a' },
      { box: [45, 9, 11], at: [0, 29, 0], color: '#a2664a' },
      { box: [12, 5, 9], at: [-6, 34, 0.5], color: '#8e5537' },
    ],
    collide: [{ box: [10, 10], at: [-17, 0] }, { box: [10, 10], at: [17, 0] }],
  },
};

/**
 * Scatter models (instanced). radius: collision/blocking radius at scale 1 (0 = none);
 * parts as above. Far LOD is generated automatically (one tinted box/cone).
 */
export const SCATTER_MODELS = {
  rock: { radius: 1.6, parts: [{ box: [3, 2.2, 2.6], at: [0, 0.8, 0], rot: [8, 20, 12], color: '#6c6658' }, { box: [1.8, 1.4, 1.6], at: [1.2, 0.5, 0.6], rot: [-10, 50, 4], color: '#5f594d' }] },
  boulder: { radius: 3.2, parts: [{ box: [6, 4.4, 5.4], at: [0, 1.8, 0], rot: [6, 30, -8], color: '#6a6457' }, { box: [3.6, 2.8, 3.2], at: [-2.2, 1.0, 1.4], rot: [12, 10, 6], color: '#5c5649' }] },
  iceBlock: { radius: 2.2, parts: [{ box: [4, 3.2, 3.4], at: [0, 1.2, 0], rot: [10, 25, 6], color: '#c9e4f2' }, { box: [2.2, 4, 2], at: [1.5, 1.6, -0.6], rot: [-6, 60, 10], color: '#b4d6ea' }] },
  basalt: { radius: 2.2, parts: [{ cyl: [1.3, 9, 6], at: [0, 4.5, 0], color: '#2c2826' }, { cyl: [1.2, 6, 6], at: [2.1, 3, 0.6], color: '#332e2b' }, { cyl: [1.1, 11, 6], at: [-1, 5.5, 1.9], color: '#282422' }] },
  wreck: { radius: 3, parts: [{ box: [7, 2.4, 3.6], at: [0, 1, 0], rot: [0, 10, 14], color: '#4a3d30' }, { box: [2.6, 3.6, 2.6], at: [-2.2, 2.2, 0.4], rot: [20, 0, 30], color: '#3b3229' }, { cyl: [0.3, 5, 5], at: [2, 2.2, 0], rot: [0, 0, 70], color: '#2a2622' }] },
  container: { radius: 3, parts: [{ box: [6, 2.6, 2.4], at: [0, 1.3, 0], color: '#8a4630' }, { box: [6, 2.6, 2.4], at: [0.4, 3.9, 0.2], rot: [0, 8, 0], color: '#3e6a7a' }] },
  pipes: { radius: 0, parts: [{ cyl: [0.5, 12, 6], at: [0, 0.5, 0], rot: [0, 0, 90], color: '#6a5f52' }, { cyl: [0.5, 12, 6], at: [0, 0.5, 1.2], rot: [0, 0, 90], color: '#5d5347' }, { cyl: [0.5, 12, 6], at: [0, 1.4, 0.6], rot: [0, 0, 90], color: '#73685a' }] },
  crystal: { radius: 1.5, parts: [{ cone: [1.1, 6, 4], at: [0, 3, 0], rot: [10, 0, 6], color: CRYSTAL, glow: true }, { cone: [0.7, 4, 4], at: [1, 2, 0.5], rot: [-14, 30, -20], color: '#8f6ef0', glow: true }] },
  reeds: { radius: 0, parts: [0, 1, 2, 3, 4].map((i) => ({ box: [0.15, 2.4 + (i % 3) * 0.5, 0.15], at: [(i - 2) * 0.4, 1.2, ((i * 7) % 5 - 2) * 0.3], rot: [((i * 11) % 7 - 3) * 4, 0, ((i * 5) % 7 - 3) * 4], color: '#6f7a3a' })) },
  drift: { radius: 0, parts: [{ box: [8, 1.2, 3.5], at: [0, 0.4, 0], rot: [0, 0, 4], color: '#eef3f7' }] },
  mesaRock: { radius: 4, parts: [{ cyl: [4.5, 14, 6], at: [0, 7, 0], color: '#9a5e3e', rtop: 3.6 }, { cyl: [3.8, 2, 6], at: [0, 15, 0], color: '#a8694a' }] },
};

/**
 * Sites: predefined groups placed by missions (sites: [{ type, at: [x, z], rotation }]).
 * The ground under them is levelled (radius + falloff).
 */
export const SITES = {
  // Own base with the start hangar (mission startup.location 'hangar'); door toward -Z
  homeBase: {
    name: 'Stützpunkt (Start)', flatten: { radius: 75, falloff: 60 },
    items: [
      { s: 'hangarBay', at: [0, 0] },
      { s: 'depot', at: [-42, 12], rot: 90 },
      { s: 'generator', at: [42, 10], rot: 90 },
      { s: 'radarTower', at: [-46, -34] },
      { s: 'relay', at: [44, -36] },
      { s: 'landingPad', at: [0, 58] },
    ],
  },
  // Drop zone (mission startup.location 'dropZone')
  dropZone: {
    name: 'Absetzpunkt', flatten: { radius: 40, falloff: 50 },
    items: [{ s: 'dropMarker', at: [0, 0] }],
  },
  outpost: {
    name: 'Stützpunkt', flatten: { radius: 70, falloff: 50 },
    items: [
      { s: 'hangar', at: [-30, 10], rot: 0 },
      { s: 'depot', at: [12, 18], rot: 0 },
      { s: 'generator', at: [30, -6], rot: 90 },
      { s: 'radarTower', at: [-8, -24] },
      { s: 'relay', at: [24, -30] },
      { s: 'bunker', at: [-42, -28], rot: 20 },
      { s: 'turret', at: [-50, 42], rot: 210 },
      { s: 'turret', at: [48, 40], rot: 150 },
      { s: 'landingPad', at: [0, 52] },
    ],
  },
  refineryPlant: {
    name: 'Raffinerie-Anlage', flatten: { radius: 65, falloff: 45 },
    items: [
      { s: 'refinery', at: [0, 0] },
      { s: 'pipeline', at: [-24, 8], rot: 90 },
      { s: 'generator', at: [24, 18], rot: 0 },
      { s: 'depot', at: [-6, 36], rot: 180 },
      { s: 'turret', at: [36, -34], rot: 160 },
      { s: 'turret', at: [-38, -30], rot: 200 },
    ],
  },
  synthNest: {
    name: 'Synthese-Nest', flatten: { radius: 70, falloff: 50 },
    items: [
      { s: 'foundry', at: [0, 0] },
      { s: 'lander', at: [34, 26] },
      { s: 'pylon', at: [-28, -22] },
      { s: 'pylon', at: [26, -28] },
      { s: 'pylon', at: [-36, 30] },
      { s: 'sensorNode', at: [0, -40] },
      ...[0, 72, 144, 216, 288].map((a) => ({ s: 'spike', at: [Math.sin(a * Math.PI / 180) * 58, Math.cos(a * Math.PI / 180) * 58], rot: a + 180 })),
    ],
  },
  landingSite: {
    name: 'Landeplatz', flatten: { radius: 50, falloff: 40 },
    items: [
      { s: 'landingPad', at: [0, 0] },
      { s: 'depot', at: [-30, 20], rot: 90 },
      { s: 'radarTower', at: [26, 24] },
      { s: 'relay', at: [30, -20] },
      { s: 'bunker', at: [-26, -28], rot: -30 },
    ],
  },
  archGate: {
    name: 'Felsbogen', flatten: { radius: 30, falloff: 40 },
    items: [{ s: 'arch', at: [0, 0] }],
  },
};

export function getStructure(type) {
  const s = STRUCTURES[type];
  if (!s) throw new Error(`Unknown structure "${type}"`);
  return s;
}
