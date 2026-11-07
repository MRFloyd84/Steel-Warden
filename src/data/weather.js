/**
 * Weather presets (mission.weather, otherwise the theater's typical weather).
 *
 *   fog        far: multiplier on the theater's fog distance (sight range), near likewise,
 *              color: fog/sky horizon tint mixed in (amount 0..1)
 *   particles  world particles around the camera: kind, count, size (m), fall (m/s),
 *              wind [x, y, z] (m/s), gust (0..1), color, alpha
 *   canopy     particles on the cockpit glass: kind ('snow' | 'sand' | 'drops' | 'ash'), rate (per s),
 *              life (s), streak (drops run down)
 *   wind       wind noise level 0..1
 *   camRange   missile camera: extra snow at range (0 = clear … 1 = blind beyond a few hundred m)
 *   lockRate   target lock builds up at this rate (1 = normal)
 *   lockDrop   chance per second that the lock flickers out (sandstorm)
 */
export const WEATHER = {
  clear: {
    name: 'KLAR', fog: { far: 1, near: 1 }, particles: null, canopy: null, wind: 0.1, camRange: 0, lockRate: 1, lockDrop: 0,
  },
  snowstorm: {
    name: 'SCHNEESTURM',
    fog: { far: 0.38, near: 0.2, color: '#d9e2ea', amount: 0.7 },
    particles: { kind: 'snow', count: 3000, size: 0.22, fall: 3.5, wind: [9, 0, 4], gust: 0.5, color: '#ffffff', alpha: 0.9 },
    canopy: { kind: 'snow', rate: 14, life: 9 },
    wind: 0.8, camRange: 0.5, lockRate: 0.85, lockDrop: 0,
  },
  sandstorm: {
    name: 'SANDSTURM',
    fog: { far: 0.3, near: 0.12, color: '#c39a66', amount: 0.85 },
    particles: { kind: 'sand', count: 3200, size: 0.14, fall: 0.6, wind: [22, 1, 7], gust: 0.7, color: '#d8b07a', alpha: 0.75 },
    canopy: { kind: 'sand', rate: 40, life: 5 },
    wind: 1, camRange: 0.7, lockRate: 0.6, lockDrop: 0.18,
  },
  ashfall: {
    name: 'ASCHEREGEN',
    fog: { far: 0.6, near: 0.5, color: '#4a3a34', amount: 0.5 },
    particles: { kind: 'ash', count: 2200, size: 0.18, fall: 1.4, wind: [3, 0, 2], gust: 0.3, color: '#5a524c', alpha: 0.85, embers: 0.06 },
    canopy: { kind: 'ash', rate: 6, life: 14 },
    wind: 0.35, camRange: 0.3, lockRate: 0.95, lockDrop: 0,
  },
  groundFog: {
    name: 'BODENNEBEL',
    fog: { far: 0.42, near: 0.15, color: '#c6cbc4', amount: 0.75 },
    particles: { kind: 'mist', count: 160, size: 14, fall: 0, wind: [1.2, 0, 0.6], gust: 0.1, color: '#d4d8d0', alpha: 0.16, low: 6 },
    canopy: { kind: 'drops', rate: 1.5, life: 10, streak: 0.2 },
    wind: 0.15, camRange: 0.45, lockRate: 0.9, lockDrop: 0,
  },
  rain: {
    name: 'REGEN',
    fog: { far: 0.65, near: 0.6, color: '#8a9096', amount: 0.4 },
    particles: { kind: 'rain', count: 3500, size: 0.06, fall: 16, wind: [3, 0, 1.5], gust: 0.3, color: '#b8c4cc', alpha: 0.55, streak: 1.4 },
    canopy: { kind: 'drops', rate: 22, life: 6, streak: 1 },
    wind: 0.45, camRange: 0.2, lockRate: 0.95, lockDrop: 0,
  },
};

export function getWeather(id) {
  return WEATHER[id] ?? WEATHER.clear;
}
