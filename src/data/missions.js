/**
 * Mission definitions. Used so far: id/name/theater/timeOfDay/seed/briefing,
 * playerStart { x, z, heading (rad), walker } and navPoints [{ id, x, z }].
 * spawns, triggers, objectives etc. follow with the mission system.
 */
export const MISSIONS = [
  {
    id: 'test-ice',
    name: 'Testgelände Kalvik',
    theater: 'ice',
    timeOfDay: 'day',
    seed: 1337,
    briefing: 'Geländeerprobung in der Eiswüste. Keine Feindkontakte erwartet.',
    playerStart: { x: 0, z: 0, heading: 0, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 600, z: -900 }, { id: 'BRAVO', x: -1400, z: -300 }],
  },
  {
    id: 'test-volcano',
    name: 'Testgelände Ashmar',
    theater: 'volcano',
    timeOfDay: 'dusk',
    seed: 4242,
    briefing: 'Plateau-Terrassen und Lavasenken. Sichtweite eingeschränkt.',
    playerStart: { x: 0, z: 0, heading: 1.2, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: -900, z: -500 }, { id: 'BRAVO', x: 300, z: 1200 }],
  },
  {
    id: 'test-industrial',
    name: 'Testgelände Brenn-Süd',
    theater: 'industrial',
    timeOfDay: 'day',
    seed: 90210,
    briefing: 'Flaches Industriegelände. Bebauung folgt in einer späteren Ausbaustufe.',
    playerStart: { x: 0, z: 0, heading: -0.6, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: 500, z: -700 }, { id: 'BRAVO', x: 1500, z: 200 }],
  },
  {
    id: 'test-moon',
    name: 'Testgelände Selene-7',
    theater: 'moon',
    timeOfDay: 'day',
    seed: 777,
    briefing: 'Kraterfeld ohne Atmosphäre. Harte Schatten, schwarzer Himmel.',
    playerStart: { x: 0, z: 0, heading: 2.4, walker: 'bastion' },
    navPoints: [{ id: 'ALPHA', x: -700, z: 600 }, { id: 'BRAVO', x: 900, z: 900 }],
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
];

export function getMission(id) {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) throw new Error(`Unknown mission "${id}"`);
  return mission;
}
