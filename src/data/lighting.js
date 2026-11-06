/**
 * Time-of-day presets referenced by mission.timeOfDay.
 * Intensities use Three.js physical units (no legacy PI scaling).
 */
export const LIGHTING = {
  day: {
    sunElevation: 48,
    sunAzimuth: 135,
    sunColor: '#fff4e0',
    sunIntensity: 2.8,
    ambient: 1.4,
    skyBrightness: 1.0,
    tint: '#ffffff',
    stars: false,
  },
  dusk: {
    sunElevation: 9,
    sunAzimuth: 250,
    sunColor: '#ffb27a',
    sunIntensity: 2.2,
    ambient: 0.95,
    skyBrightness: 0.75,
    tint: '#ffc9a0',
    stars: false,
  },
  night: {
    sunElevation: 35,
    sunAzimuth: 60,
    sunColor: '#9fb4ff',
    sunIntensity: 0.6,
    ambient: 0.45,
    skyBrightness: 0.2,
    tint: '#8aa0ff',
    stars: true,
  },
};

export function getLighting(id) {
  const preset = LIGHTING[id];
  if (!preset) throw new Error(`Unknown timeOfDay "${id}"`);
  return preset;
}
