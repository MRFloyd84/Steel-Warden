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
 */
export const THEATERS = {
  ice: {
    name: 'Eiswüste Kalvik',
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
    },
    sky: { zenith: '#557aa0', horizon: '#b7c7d4', ground: '#6d7a85' },
    fog: { near: 140, far: 900 },
    ambientScale: 1.0,
    canopyGrime: { color: '#eef4fa', amount: 0.55 },
  },

  volcano: {
    name: 'Vulkanplateau Ashmar',
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
    },
    sky: { zenith: '#35262a', horizon: '#8a4c30', ground: '#2a1c16' },
    fog: { near: 90, far: 720 },
    ambientScale: 1.7,
    // Volcanic haze scatters light: sun sits higher than a plain dusk preset.
    lightingOverride: { sunElevation: 22 },
    canopyGrime: { color: '#2c2522', amount: 0.75 },
  },

  industrial: {
    name: 'Industriezone Brenn-Süd',
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
    },
    sky: { zenith: '#6a7076', horizon: '#a9a99c', ground: '#4d4b45' },
    fog: { near: 100, far: 760 },
    ambientScale: 1.0,
    canopyGrime: { color: '#5c5442', amount: 0.65 },
  },

  moon: {
    name: 'Mondbasis Selene-7',
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
    },
    sky: { zenith: '#000000', horizon: '#04050a', ground: '#151517' },
    fog: { near: 380, far: 960 },
    ambientScale: 0.35,
    stars: true,
    // No atmosphere: low, hard, white sun for long crater shadows.
    lightingOverride: { sunElevation: 16, sunColor: '#ffffff', sunIntensity: 3.2 },
    canopyGrime: { color: '#8a8a8a', amount: 0.45 },
  },
};

export function getTheater(id) {
  const theater = THEATERS[id];
  if (!theater) throw new Error(`Unknown theater "${id}"`);
  return theater;
}
