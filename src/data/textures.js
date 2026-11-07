/**
 * Low-res detail textures (assets/textures/, grayscale PNG ≤ 128 px, embedded).
 * Made by tools/import_textures.py: converted to grayscale, normalised to mean 0.5
 * and a common contrast. They only modulate brightness — colour stays the palette's.
 *
 *   tile     m per repeat (terrain: world metres; objects: object metres)
 *   source   pack (TEXTURE_SOURCES) and original file or generator
 */
export const TEXTURE_SOURCES = {
  sbs: {
    name: 'Base Materials 256x256', author: 'Screaming Brain Studios', license: 'CC0 1.0',
    url: 'https://screamingbrainstudios.itch.io/',
  },
  generated: {
    name: 'STEEL WARDEN (prozedural, tools/import_textures.py)', author: 'Rene / STEEL WARDEN', license: 'CC0 1.0',
    url: null,
  },
};

export const TEXTURES = {
  // Terrain
  'ground-gravel': { tile: 9, source: 'sbs', file: 'Stone/Mat_Stone_Brown_01' },
  'ground-dirt': { tile: 10, source: 'sbs', file: 'Plaster/Mat_Plaster_Brown_01' },
  'ground-mud': { tile: 8, source: 'sbs', file: 'Clay/Mat_Clay_Red_07' },
  'ground-rock': { tile: 14, source: 'sbs', file: 'Stone/Mat_Stone_Black_01' },
  'ground-snow': { tile: 12, source: 'sbs', file: 'Plaster/Mat_Plaster_White_01' },
  'ground-ice': { tile: 16, source: 'sbs', file: 'Marble/Mat_Marble_White_01' },
  'ground-dust': { tile: 10, source: 'sbs', file: 'Plaster/Mat_Plaster_Gray_03' },
  'ground-sand': { tile: 9, source: 'generated', file: 'gen:sand' },
  'ground-lava': { tile: 12, source: 'generated', file: 'gen:lava' },
  'ground-crystal': { tile: 10, source: 'generated', file: 'gen:crystal' },
  // Objects (material groups)
  'mat-concrete': { tile: 6, source: 'sbs', file: 'Concrete/Mat_Concrete_Gray_03' },
  'mat-plaster': { tile: 6, source: 'sbs', file: 'Plaster/Mat_Plaster_Gray_01' },
  'mat-wood': { tile: 2.5, source: 'sbs', file: 'Wood/Mat_Wood_Brown_01' },
  'mat-stone': { tile: 5, source: 'sbs', file: 'Stone/Mat_Stone_Dark_01' },
  'mat-metal': { tile: 4, source: 'generated', file: 'gen:metal' },
  'mat-tank': { tile: 5, source: 'generated', file: 'gen:tank' },
  'mat-crystal': { tile: 3, source: 'generated', file: 'gen:crystal' },
};

/**
 * Terrain layers (fixed order, the shader relies on it). Each theater maps them to
 * textures in `theater.detail` (see theaters.js); missing entries fall back to these.
 */
export const TERRAIN_LAYERS = ['hard', 'soft', 'rock', 'shore', 'lava', 'ice', 'road'];
export const TERRAIN_DEFAULT = {
  strength: 0.32,
  hard: 'ground-gravel', soft: 'ground-dirt', rock: 'ground-rock', shore: 'ground-mud',
  lava: 'ground-lava', ice: 'ground-ice', road: 'mat-concrete',
};

/**
 * Object material groups (fixed order, index = vertex attribute `mat`).
 * 0 = none (glowing parts, untextured).
 */
export const MATERIAL_GROUPS = ['none', 'metal', 'concrete', 'wood', 'tank', 'crystal', 'rock', 'ice', 'accent', 'dark'];
export const GROUP_TEXTURES = {
  metal: 'mat-metal', concrete: 'mat-concrete', wood: 'mat-wood', tank: 'mat-tank', crystal: 'mat-crystal',
  rock: 'mat-stone', ice: 'ground-ice', accent: 'mat-metal', dark: 'mat-plaster',
};
