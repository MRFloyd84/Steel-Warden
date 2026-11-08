/**
 * External environment models (assets/props/<pack>/, GLB, embedded, all CC0).
 * Copied in by tools/import_props.py; CREDITS.md names every pack (tools/check_credits.mjs).
 *
 * On load (world/PropLibrary.js) materials and textures are dropped: every vertex keeps
 * only a brightness and a material group; colour then comes from the theater palette
 * per group (palette.materials) and the detail texture of that group.
 *
 * Prop fields
 *   pack, file     source (assets/props/<pack>/<file>)
 *   scale          model units → metres; rot: [x, y, z]° applied before placement
 *   y              ground offset in m (after the model is set on its lowest point)
 *   size           [w, h, d] m — only for the placeholder when the file is missing
 *   collide        footprint for walker collision: 'bounds' (default) | [w, d] | false
 *   hit            hit boxes: 'bounds' (default, one box) | 'nodes' (one box per mesh)
 *   armor, structure   when used as a building of its own (STRUCTURES `prop:` types)
 *   rubble         false: no rubble pile when destroyed
 *   mats           material name → group, optionally 'group:brightness' (named-material packs; others: GROUP_RULES)
 *   tint           brightness factor (e.g. 0.8 for darker variants)
 */
export const PROP_PACKS = {
  'kenney-industrial': {
    name: 'City Kit Industrial 2.0', author: 'Kenney (www.kenney.nl)', license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/city-kit-industrial', colormap: 'colormap.png',
  },
  'kenney-space': {
    name: 'Space Kit 2.0', author: 'Kenney (www.kenney.nl)', license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/space-kit',
  },
  'tripo-synth': {
    name: 'STEEL WARDEN Tripo-Modelle (Synthese)', author: 'Rene, erzeugt mit Tripo AI', license: 'Tripo-Nutzungsbedingungen (siehe CREDITS.md)',
    url: 'https://www.tripo3d.ai',
  },
  'quaternius-scifi': {
    name: 'Ultimate Modular Sci-Fi (Feb 2021)', author: 'Quaternius', license: 'CC0 1.0',
    url: 'https://quaternius.com/packs/ultimatemodularscifi.html',
  },
};

// Named materials of the packs → material group
const SPACE_MATS = { metal: 'metal', metalDark: 'metal:0.78', metalRed: 'accent', dark: 'dark', rock: 'rock', rockTrack: 'rock', crystal: 'crystal' };
const QUAT_MATS = { Main: 'metal', DarkGrey: 'dark', Black: 'dark', Accent: 'accent', DarkAccent: 'accent', Pipes: 'dark' };

const I = (file, scale, extra = {}) => ({ pack: 'kenney-industrial', file: `${file}.glb`, scale, ...extra });
const S = (file, scale, extra = {}) => ({ pack: 'kenney-space', file: `${file}.glb`, scale, mats: SPACE_MATS, ...extra });
const Q = (file, scale, extra = {}) => ({ pack: 'quaternius-scifi', file: `${file}.glb`, scale, mats: QUAT_MATS, ...extra });

export const PROPS = {
  // Kenney City Kit Industrial — buildings, stacks, tanks, containers
  'factory-a': I('building-a', 14, { armor: 520, structure: 400, size: [29, 21, 17] }),
  'factory-c': I('building-c', 14, { armor: 520, structure: 400, size: [26, 18, 30] }),
  'factory-f': I('building-f', 14, { armor: 480, structure: 380, size: [25, 27, 18] }),
  'shed-k': I('building-k', 15, { armor: 300, structure: 240, size: [20, 12, 14] }),
  'workshop-p': I('building-p', 15, { armor: 340, structure: 260, size: [25, 11, 15] }),
  'chimney-large': I('chimney-large', 18, { armor: 380, structure: 260, size: [19, 31, 19] }),
  'chimney-medium': I('chimney-medium', 16, { armor: 220, structure: 160, size: [7, 31, 7] }),
  'tank-small': I('detail-tank', 14, { armor: 200, structure: 140, size: [12, 6, 7] }),
  'tank-large': I('detail-tank-large', 16, { armor: 420, structure: 320, size: [24, 15, 26] }),
  'container-a': I('shipping-container-a', 14.5, { armor: 120, structure: 80, size: [5.4, 5, 12] }),
  'container-b': I('shipping-container-b', 14.5, { armor: 120, structure: 80, size: [5.4, 5, 12] }),
  'container-c': I('shipping-container-c', 14.5, { armor: 120, structure: 80, size: [5.4, 5, 12] }),
  'water-tower': I('water-tower', 14, { armor: 260, structure: 160, size: [12, 30, 12] }),
  'solar-field': I('solar-panel-landscape-group', 10, { armor: 90, structure: 60, size: [15, 2.6, 9], collide: [15, 9] }),
  'wind-turbine': I('windmill', 20, { armor: 200, structure: 140, size: [12, 46, 22], collide: [5, 5] }),
  // Kenney Space Kit — hangars, machines, rocks and crystals
  'hangar-long': S('hangar-large-a', 14, { armor: 600, structure: 500, size: [28, 14, 42] }),
  'hangar-dome': S('hangar-round-a', 12, { armor: 560, structure: 460, size: [39, 18, 34] }),
  'generator': S('machine-generator-large', 10, { armor: 300, structure: 200, size: [10, 7, 13] }),
  'sat-dish': S('satellite-dish-large', 18, { armor: 240, structure: 150, size: [15, 15, 13], collide: [8, 8] }),
  'frame': S('structure-detailed', 10, { armor: 260, structure: 180, size: [10, 10, 10], collide: [10, 10] }),
  'supports': S('supports-high', 10, { armor: 200, structure: 140, size: [8, 10, 8] }),
  'cargo-craft': S('craft-cargo-a', 12, { armor: 480, structure: 360, size: [19, 10, 29] }),
  'barrels': S('barrels', 4, { size: [2.2, 1.4, 2], collide: false }),
  'rock-crystals-a': S('rock-crystals-large-a', 8, { size: [7, 4.3, 7.4] }),
  'rock-crystals-b': S('rock-crystals-large-b', 8, { size: [7.5, 4.4, 7.5] }),
  'rock-large-a': S('rock-large-a', 8, { size: [7.4, 4, 6.7] }),
  'rock-large-b': S('rock-large-b', 8, { size: [7.4, 4, 7.5] }),
  'rocks-small': S('rocks-small-a', 6, { size: [5.6, 0.6, 5.2], collide: false }),
  // Quaternius Ultimate Modular Sci-Fi — crates and vessels
  'crate': Q('crate', 3, { size: [2.4, 2.4, 2.4] }),
  'crate-long': Q('crate-long', 3.5, { size: [4.3, 2.7, 2.7] }),
  'cargo-pod': Q('container-full', 5, { size: [6, 2.9, 3.8] }),
  'vessel': Q('vessel-tall', 6, { size: [1.7, 6.1, 1.7] }),
  // Tripo (tools/import_walkers.py, already in metres with baked vertex colours)
  'spike-tower': { pack: 'tripo-synth', file: 'spike-tower.glb', scale: 1, armor: 140, structure: 90, size: [9, 14, 9], collide: [5, 5] },
};

/**
 * Colour-map packs (one texture of colour swatches): the swatch colour at a vertex
 * decides its group. First matching rule wins; h in degrees, s/v 0..1.
 */
export const GROUP_RULES = [
  { group: 'dark', test: ({ v }) => v < 0.25 },
  { group: 'accent', test: ({ h, s }) => s > 0.45 && h >= 20 && h < 60 },
  { group: 'wood', test: ({ h, s, v }) => s > 0.3 && h < 35 && v < 0.75 },
  { group: 'crystal', test: ({ h, s }) => s > 0.3 && h >= 230 && h < 330 },
  { group: 'tank', test: ({ s }) => s > 0.35 },
  { group: 'concrete', test: ({ s, v }) => s < 0.2 && v > 0.62 },
  { group: 'metal', test: () => true },
];

/** Default palette per material group; theaters override in palette.materials. */
export const DEFAULT_MATERIAL_COLORS = {
  metal: '#6f6d64', concrete: '#8b877a', wood: '#6b4a30', tank: '#5d6249', crystal: '#6b55a0',
  rock: '#6c6658', ice: '#c9e4f2', accent: '#b8962e', dark: '#3a3c3d',
};

export function getProp(id) {
  return PROPS[id] ?? null;
}
