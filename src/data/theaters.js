/**
 * Theaters (battlefields). Each defines terrain shape, colour palette,
 * sky and fog. Heights are in metres.
 *
 * terrain:
 *   scale            horizontal size of the main noise features
 *   amplitude        height of rolling base terrain
 *   ridgeAmplitude   height of ridged mountain chains (masked by low-freq noise)
 *   terraceStep      optional: quantises height into plateaus
 *   craters          optional: { cell, chance, minRadius, maxRadius, depth, rim }
 *   startMinHeight   optional: player start pad is raised at least to this height
 * lightingOverride   optional: replaces fields of the mission's time-of-day preset
 * canopyGrime       dirt on the cockpit glass { color, amount 0..1 }
 * palette:
 *   bands            colour by height (first band whose max >= height wins)
 *   rock / rockSlope faces steeper than rockSlope (normal.y) use the rock colour
 *   variation        random per-face brightness jitter
 *   surfaces         colours per ground type (soft, thinIce, hot, waterBed, lavaBed)
 *   tints            colours for feature tints (road, vein, ash …)
 * features          terrain feature generators (world/FeatureField.js)
 * surface           ground mask: { base, soft: { scale, threshold }, hot: { … } } (data/surfaces.js)
 * scatter           scatter rules (world/ScatterField.js, models in data/structures.js)
 * structureRules    buildings placed automatically per chunk ({ type, chance, align: 'blocks' })
 * weather           typical weather (data/weather.js), used when the mission sets none
 * gravity           factor vs. Earth (projectile drop; prepared for jump jets)
 */
export const THEATERS = {
  ice: {
    name: 'Eiswüste Kalvik',
    // Detail textures (data/textures.js) and palette for external models per material group
    detail: { strength: 0.26, hard: 'ground-snow', soft: 'ground-snow', shore: 'ground-ice', ice: 'ground-ice' },
    materials: { metal: '#7a8088', concrete: '#9aa3a8', tank: '#5c6670', accent: '#c0a040', rock: '#7d8a94', dark: '#3c4248' },
    terrain: {
      scale: 420, octaves: 5, amplitude: 38,
      ridgeAmplitude: 95, ridgeMaskLow: 0.45, ridgeMaskHigh: 0.75,
      baseHeight: 0,
    },
    palette: {
      bands: [
        { max: -6, color: '#8fa9bd' },
        { max: 22, color: '#d4e0e8' },
        { max: 60, color: '#c3d0da' },
        { max: 1e9, color: '#f0f4f7' },
      ],
      rock: '#56606b', rockSlope: 0.8, variation: 0.07,
      surfaces: { soft: '#f6f9fb', thinIce: '#9ec4dc', waterBed: '#5a7488' },
    },
    sky: { zenith: '#557aa0', horizon: '#b7c7d4', ground: '#6d7a85' },
    fog: { near: 140, far: 900 },
    ambientScale: 1.0,
    canopyGrime: { color: '#eef4fa', amount: 0.55 },
    features: [
      { type: 'crevasse', cell: 520, chance: 0.55, length: [180, 380], width: [6, 10], depth: [18, 30], wall: 3, meander: 0.12 },
      { type: 'lake', cell: 640, chance: 0.5, radius: [45, 95], fluid: 'thinIce', shore: 'soft' },
      { type: 'zone', cell: 260, chance: 0.5, radius: [30, 60], surface: 'soft', bump: 1.6 },
    ],
    surface: { base: 'hard', soft: { scale: 140, threshold: 0.35 } },
    scatter: [
      { model: 'iceBlock', density: 70, slope: [0.8, 1], scale: [0.7, 2.2], minDist: 10, cluster: 3, clusterRadius: 45 },
      { model: 'drift', density: 120, slope: [0.9, 1], scale: [0.8, 2], surfaces: ['soft', 'hard'] },
      { model: 'boulder', density: 12, slope: [0.7, 1], scale: [0.8, 1.6], minDist: 30 },
    ],
    structureRules: [{ type: ['windTurbine', 'satDish', 'hangarLong'], chance: 0.05 }],
    weather: 'snowstorm',
  },

  volcano: {
    name: 'Vulkanplateau Ashmar',
    detail: { strength: 0.34, hard: 'ground-gravel', soft: 'ground-dust', shore: 'ground-mud' },
    materials: { metal: '#5a5450', concrete: '#6e6a62', tank: '#4e4a40', rock: '#3a3431', accent: '#c06a2a', dark: '#2a2624' },
    terrain: {
      scale: 360, octaves: 5, amplitude: 30,
      ridgeAmplitude: 70, ridgeMaskLow: 0.4, ridgeMaskHigh: 0.7,
      terraceStep: 11, baseHeight: 0, startMinHeight: 4,
    },
    palette: {
      bands: [
        { max: -8, color: '#c4501e' },
        { max: 15, color: '#55463d' },
        { max: 45, color: '#665244' },
        { max: 1e9, color: '#7a6352' },
      ],
      rock: '#2e2825', rockSlope: 0.78, variation: 0.1,
      surfaces: { soft: '#4a4038', hot: '#6a3a24', lavaBed: '#3a1a10' },
    },
    sky: { zenith: '#35262a', horizon: '#8a4c30', ground: '#2a1c16' },
    fog: { near: 90, far: 720 },
    ambientScale: 1.7,
    // Volcanic haze scatters light: sun sits higher than a plain dusk preset.
    lightingOverride: { sunElevation: 22 },
    canopyGrime: { color: '#2c2522', amount: 0.75 },
    features: [
      { type: 'river', cell: 760, chance: 0.6, length: [500, 900], width: [10, 20], depth: 2.5, drop: 1.5, meander: 0.3, fluid: 'lava', shore: 'hot' },
      { type: 'lake', cell: 900, chance: 0.35, radius: [30, 60], depth: 3, fluid: 'lava', shore: 'hot' },
      { type: 'zone', cell: 300, chance: 0.45, radius: [30, 70], surface: 'hot' },
      { type: 'crater', cell: 520, chance: 0.4, radius: [20, 50], depth: 0.25, rim: 0.18 },
    ],
    surface: { base: 'hard', soft: { scale: 160, threshold: 0.45 } },
    scatter: [
      { model: 'basalt', density: 45, slope: [0.6, 1], scale: [0.7, 1.8], minDist: 12, cluster: 2, clusterRadius: 40 },
      { model: 'rock', density: 60, slope: [0.7, 1], scale: [0.7, 1.8] },
      { model: 'stones', density: 30, slope: [0.8, 1], scale: [0.8, 1.4] },
    ],
    weather: 'ashfall',
  },

  industrial: {
    name: 'Industriezone Brenn-Süd',
    detail: { strength: 0.3, hard: 'ground-dirt', soft: 'ground-mud', shore: 'ground-mud', road: 'mat-concrete' },
    materials: { metal: '#6f6d64', concrete: '#8b877a', tank: '#5d6249', accent: '#b8962e', dark: '#3a3c3d' },
    terrain: {
      scale: 520, octaves: 4, amplitude: 14,
      ridgeAmplitude: 28, ridgeMaskLow: 0.55, ridgeMaskHigh: 0.8,
      baseHeight: 0,
    },
    palette: {
      bands: [
        { max: -3, color: '#4c4f48' },
        { max: 10, color: '#66655a' },
        { max: 25, color: '#777464' },
        { max: 1e9, color: '#878271' },
      ],
      rock: '#45433f', rockSlope: 0.82, variation: 0.09,
      surfaces: { soft: '#5a5444', waterBed: '#3a3b33' },
      tints: { road: '#3c3d3a' },
    },
    sky: { zenith: '#6a7076', horizon: '#a9a99c', ground: '#4d4b45' },
    fog: { near: 100, far: 760 },
    ambientScale: 1.0,
    canopyGrime: { color: '#5c5442', amount: 0.65 },
    features: [
      { type: 'roads', grid: 200, width: 16 },
      { type: 'river', cell: 900, chance: 0.4, length: [600, 900], width: 14, depth: 3, straight: true, fluid: 'water', shore: 'soft' },
    ],
    surface: { base: 'hard', soft: { scale: 120, threshold: 0.5 } },
    scatter: [
      { model: 'container', density: 30, slope: [0.92, 1], scale: [1, 1], minDist: 12, cluster: 2, clusterRadius: 25 },
      { model: 'pipes', density: 18, slope: [0.92, 1], scale: [0.8, 1.4] },
      { model: 'wreck', density: 10, slope: [0.85, 1], scale: [0.8, 1.3] },
      { model: 'barrels', density: 14, slope: [0.92, 1], scale: [0.9, 1.2], cluster: 3, clusterRadius: 12 },
      { model: 'crates', density: 10, slope: [0.92, 1], scale: [0.9, 1.1] },
    ],
    structureRules: [
      { type: 'hall', chance: 0.4, align: 'blocks' },
      { type: ['factoryA', 'factoryC', 'factoryF', 'storeShed', 'workshop'], chance: 0.35, align: 'blocks' },
      { type: ['containerStack', 'storageTank', 'pressureTanks', 'waterTower', 'chimneyPair', 'coolingStack', 'solarField'], chance: 0.3 },
      { type: ['coolingTower', 'crane', 'pipeline'], chance: 0.35, align: 'blocks' },
    ],
    weather: 'rain',
  },

  moon: {
    name: 'Mondbasis Selene-7',
    detail: { strength: 0.36, hard: 'ground-dust', soft: 'ground-dust' },
    materials: { metal: '#8a8c90', concrete: '#a8a8aa', tank: '#6c7080', rock: '#7a7a7e', accent: '#d0a030', dark: '#3e4044' },
    terrain: {
      scale: 600, octaves: 4, amplitude: 12,
      ridgeAmplitude: 45, ridgeMaskLow: 0.5, ridgeMaskHigh: 0.85,
      baseHeight: 0,
      craters: { cell: 90, chance: 0.55, minRadius: 8, maxRadius: 36, depth: 0.32, rim: 0.12 },
    },
    palette: {
      bands: [
        { max: -6, color: '#5c5c5e' },
        { max: 15, color: '#86868a' },
        { max: 40, color: '#97979b' },
        { max: 1e9, color: '#a9a9ad' },
      ],
      rock: '#4a4a4d', rockSlope: 0.8, variation: 0.08,
      surfaces: { soft: '#7a7a7e' },
    },
    sky: { zenith: '#000000', horizon: '#04050a', ground: '#151517' },
    fog: { near: 380, far: 960 },
    ambientScale: 0.35,
    stars: true,
    // No atmosphere: low, hard, white sun for long crater shadows.
    lightingOverride: { sunElevation: 16, sunColor: '#ffffff', sunIntensity: 3.2 },
    canopyGrime: { color: '#8a8a8a', amount: 0.45 },
    features: [
      { type: 'crater', cell: 420, chance: 0.5, radius: [40, 110], depth: 0.22, rim: 0.16 },
    ],
    surface: { base: 'hard', soft: { scale: 90, threshold: 0.3 } },
    scatter: [
      { model: 'rock', density: 110, slope: [0.65, 1], scale: [0.5, 1.6], cluster: 4, clusterRadius: 35 },
      { model: 'boulder', density: 16, slope: [0.7, 1], scale: [0.6, 1.5], minDist: 25 },
      { model: 'bigRock', density: 10, slope: [0.75, 1], scale: [0.7, 1.6], minDist: 30 },
      { model: 'stones', density: 40, slope: [0.8, 1], scale: [0.8, 1.5] },
    ],
    structureRules: [{ type: ['domeHangar', 'satDish', 'generatorBlock', 'supportFrame', 'cargoCraft'], chance: 0.07 }],
    weather: 'clear',
    gravity: 0.17,
  },

  delta: {
    name: 'Flussdelta Morrow',
    detail: { strength: 0.3, hard: 'ground-dirt', soft: 'ground-mud', shore: 'ground-mud' },
    materials: { metal: '#5f6258', concrete: '#7f7d70', tank: '#4f5a44', rock: '#5e5c50', accent: '#b0902e', dark: '#33352f' },
    terrain: {
      scale: 700, octaves: 4, amplitude: 6,
      ridgeAmplitude: 0, ridgeMaskLow: 0.5, ridgeMaskHigh: 0.8,
      baseHeight: 0,
    },
    palette: {
      bands: [
        { max: -2, color: '#4f5a3c' },
        { max: 4, color: '#5f6b42' },
        { max: 10, color: '#6d7748' },
        { max: 1e9, color: '#7a7f52' },
      ],
      rock: '#4a4a3e', rockSlope: 0.75, variation: 0.08,
      surfaces: { soft: '#4a4630', waterBed: '#3c3a2c' },
    },
    sky: { zenith: '#6f7f86', horizon: '#b6bdb4', ground: '#4f5640' },
    fog: { near: 80, far: 650 },
    ambientScale: 1.0,
    canopyGrime: { color: '#5d5a3e', amount: 0.6 },
    features: [
      { type: 'river', cell: 520, chance: 0.75, length: [600, 1000], width: [22, 40], depth: 3.5, drop: 0.8, meander: 0.3, fluid: 'water', shore: 'soft', dikes: { height: 3.5, width: 9 } },
      { type: 'river', cell: 300, chance: 0.5, length: [250, 450], width: [8, 12], depth: 2, drop: 0.6, straight: true, fluid: 'water', shore: 'soft' },
      { type: 'zone', cell: 220, chance: 0.5, radius: [30, 60], surface: 'soft' },
    ],
    surface: { base: 'soft', soft: null },
    scatter: [
      { model: 'reeds', density: 260, slope: [0.85, 1], scale: [0.8, 1.4], surfaces: ['soft'], cluster: 4, clusterRadius: 25 },
      { model: 'wreck', density: 6, slope: [0.85, 1], scale: [0.8, 1.2] },
      { model: 'rock', density: 15, slope: [0.8, 1], scale: [0.6, 1.2] },
    ],
    structureRules: [{ type: 'relay', chance: 0.06 }, { type: ['windTurbine', 'waterTower'], chance: 0.05 }],
    weather: 'groundFog',
  },

  canyon: {
    name: 'Canyonwüste Tessar',
    detail: { strength: 0.32, hard: 'ground-sand', soft: 'ground-sand' },
    materials: { metal: '#7a6a5a', concrete: '#b08a66', tank: '#6a5a40', rock: '#9a5e3e', accent: '#c89a40', dark: '#3e3028' },
    terrain: {
      scale: 480, octaves: 4, amplitude: 16,
      ridgeAmplitude: 30, ridgeMaskLow: 0.55, ridgeMaskHigh: 0.85,
      terraceStep: 7, baseHeight: 0,
    },
    palette: {
      bands: [
        { max: -15, color: '#8a4e34' },
        { max: 8, color: '#c08a5c' },
        { max: 30, color: '#b47a50' },
        { max: 1e9, color: '#a86e46' },
      ],
      rock: '#8a4e34', rockSlope: 0.72, variation: 0.1,
      surfaces: { soft: '#d4a874' },
    },
    sky: { zenith: '#5f88b0', horizon: '#e0c4a0', ground: '#8a6a4c' },
    fog: { near: 160, far: 950 },
    ambientScale: 1.05,
    canopyGrime: { color: '#c09060', amount: 0.7 },
    features: [
      { type: 'canyon', cell: 560, chance: 0.6, length: [400, 800], width: [26, 50], depth: [28, 48], wall: 12, meander: 0.22 },
      { type: 'mesa', cell: 700, chance: 0.45, radius: [50, 110], height: [35, 60], edge: 8 },
      { type: 'plateau', cell: 900, chance: 0.4, radius: [70, 120], height: [18, 28], edge: 10, ramp: true },
    ],
    surface: { base: 'hard', soft: { scale: 110, threshold: 0.3 } },
    scatter: [
      { model: 'mesaRock', density: 10, slope: [0.8, 1], scale: [0.8, 2], minDist: 40 },
      { model: 'bigRockB', density: 12, slope: [0.7, 1], scale: [0.8, 1.8], minDist: 30 },
      { model: 'rock', density: 70, slope: [0.6, 1], scale: [0.6, 1.8], cluster: 3, clusterRadius: 40 },
      { model: 'boulder', density: 14, slope: [0.7, 1], scale: [0.7, 1.4], minDist: 30 },
    ],
    structureRules: [{ type: 'arch', chance: 0.12, minFlat: 0.85 }],
    weather: 'sandstorm',
  },

  synth: {
    name: 'Synthese-Kernwelt',
    detail: { strength: 0.3, hard: 'ground-crystal', soft: 'ground-dust' },
    materials: { metal: '#3a3450', concrete: '#4a4560', tank: '#3a3048', crystal: '#6b55a0', rock: '#2c2840', accent: '#5ef2e6', dark: '#1c1828' },
    terrain: {
      scale: 300, octaves: 2, amplitude: 10,
      ridgeAmplitude: 40, ridgeMaskLow: 0.5, ridgeMaskHigh: 0.7,
      terraceStep: 6, baseHeight: 0,
    },
    palette: {
      bands: [
        { max: -4, color: '#251f3a' },
        { max: 8, color: '#2f2848' },
        { max: 24, color: '#3a3158' },
        { max: 1e9, color: '#463b6a' },
      ],
      rock: '#1c1830', rockSlope: 0.82, variation: 0.04,
      surfaces: { soft: '#3e3560' },
      tints: { vein: '#2aa8a0' },
    },
    sky: { zenith: '#1a0f33', horizon: '#3e7f8a', ground: '#140f24' },
    fog: { near: 120, far: 820 },
    ambientScale: 1.3,
    lightingOverride: { sunColor: '#c9a6ff', sunElevation: 30 },
    canopyGrime: { color: '#4a3a6a', amount: 0.4 },
    features: [
      { type: 'veins', cell: 140, width: 3.5 },
      { type: 'plateau', cell: 500, chance: 0.5, radius: [40, 70], height: [10, 22], edge: 2, ramp: true, rampWidth: 16 },
      { type: 'ridge', cell: 420, chance: 0.45, length: [200, 360], height: [12, 24], width: [8, 12] },
      { type: 'basin', cell: 380, chance: 0.4, radius: [30, 60], depth: [6, 12] },
    ],
    surface: { base: 'hard', soft: { scale: 80, threshold: 0.45 } },
    scatter: [
      { model: 'crystal', density: 90, slope: [0.75, 1], scale: [0.7, 2.4], cluster: 3, clusterRadius: 30 },
      { model: 'crystalRock', density: 16, slope: [0.75, 1], scale: [0.8, 1.8], minDist: 20 },
      { model: 'crystalRockB', density: 12, slope: [0.75, 1], scale: [0.8, 1.6], minDist: 20 },
    ],
    structureRules: [{ type: ['pylon', 'spike', 'sensorNode'], chance: 0.12 }],
    weather: 'clear',
  },
};

export function getTheater(id) {
  const theater = THEATERS[id];
  if (!theater) throw new Error(`Unknown theater "${id}"`);
  return theater;
}
