/**
 * Mission definitions. Phase 1 only uses id/name/theater/timeOfDay/seed/
 * briefing/playerStart; navPoints, spawns, triggers, objectives etc. are
 * read by the mission system from phase 6 on.
 */
export const MISSIONS = [
  {
    id: 'test-ice',
    name: 'Testgelände Kalvik',
    theater: 'ice',
    timeOfDay: 'day',
    seed: 1337,
    briefing: 'Geländeerprobung in der Eiswüste. Keine Feindkontakte erwartet.',
    playerStart: { x: 0, z: 0, heading: 0 },
  },
  {
    id: 'test-volcano',
    name: 'Testgelände Ashmar',
    theater: 'volcano',
    timeOfDay: 'dusk',
    seed: 4242,
    briefing: 'Plateau-Terrassen und Lavasenken. Sichtweite eingeschränkt.',
    playerStart: { x: 0, z: 0, heading: 1.2 },
  },
  {
    id: 'test-industrial',
    name: 'Testgelände Brenn-Süd',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 90210,
    briefing: 'Flaches Industriegelände. Bebauung folgt in einer späteren Ausbaustufe.',
    playerStart: { x: 0, z: 0, heading: -0.6 },
  },
  {
    id: 'test-moon',
    name: 'Testgelände Selene-7',
    theater: 'moon',
    timeOfDay: 'day',
    seed: 777,
    briefing: 'Kraterfeld ohne Atmosphäre. Harte Schatten, schwarzer Himmel.',
    playerStart: { x: 0, z: 0, heading: 2.4 },
  },
  {
    id: 'test-ice-night',
    name: 'Nachtlauf Kalvik',
    theater: 'ice',
    timeOfDay: 'night',
    seed: 2024,
    briefing: 'Nachterprobung. Sternenhimmel, geringe Restlichtverstärkung.',
    playerStart: { x: 0, z: 0, heading: 0.4 },
  },
];

export function getMission(id) {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) throw new Error(`Unknown mission "${id}"`);
  return mission;
}
