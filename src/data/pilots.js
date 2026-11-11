/**
 * Wingmen (docs/WINGMEN-PLAN.md): named pilots, radio names and radio lines. The player is
 * EINS; slot i (0..2) flies as ZWEI, DREI, VIER with PILOTS[i].
 *
 *   aggression  0..1 — preferred range and how hard the pilot pushes (AIController ai.aggression)
 *   morale      0..1 — start value of the in-mission morale (Flight)
 *
 * Experience, wounds and death between missions come with the campaign (phase C).
 */
export const PILOTS = [
  { id: 'kessler', name: 'Fw. Jana Kessler', callsign: 'ANKER', aggression: 0.45, morale: 0.75 },
  { id: 'brandt', name: 'Uffz. Tomas Brandt', callsign: 'FUNKE', aggression: 0.7, morale: 0.6 },
  { id: 'okafor', name: 'Lt. Ada Okafor', callsign: 'RIEGEL', aggression: 0.55, morale: 0.85 },
];

export const WING_NAMES = ['ZWEI', 'DREI', 'VIER'];

/** Slots a mission allows when it says nothing (missions.js → wingmen). */
export const WINGMEN_DEFAULT = 3;
export const WINGMEN_MAX = 3;

export function wingmenSlots(mission) {
  const n = mission?.wingmen ?? WINGMEN_DEFAULT;
  return Math.max(0, Math.min(WINGMEN_MAX, n | 0));
}

/**
 * Command behaviour (Flight / WingmanController). Distances in m.
 *   leash   how far from the anchor (player, nav point, hold spot) a wingman may fight
 *   engage  enemies closer than this to the anchor are attacked
 */
export const WING = {
  formation: { leash: 500, engage: 450 },
  freeFire: { leash: 1500, engage: Infinity },
  goNav: { leash: 400, engage: 400, arrive: 40 },
  holdPosition: { leash: 120, engage: 600 },
  fallBack: { arrive: 90 },
  slots: [[-40, 35], [40, 35], [0, 70]], // formation offsets behind the player (x right, z back)
  friendlyGap: 4, // m — no fire if a friend is this close to the line of fire (plus its radius)
  friendlyFireRadioGap: 6, // s between two friendly-fire calls of the same pilot
  morale: {
    heavyHit: -0.2, // a component reaches HEAVY
    friendLost: -0.15,
    friendlyFire: -0.05,
    kill: 0.1,
    recover: 0.01, // per s without a visible enemy
    breakAt: 0.25, // below: falls back to the player, refuses attack orders
    steadyAt: 0.4, // back above: takes orders again
  },
};

/**
 * Radio lines. The speaker stands in the radio log's "from" (e.g. ZWEI · ANKER); {x} = extra
 * text (target, nav point, names). Acks come from the first wingman still in action.
 */
export const WING_RADIO = {
  ready: 'Team bereit: {x}. Wir warten auf dein Ausrücken.',
  deploy: 'Verstanden, wir folgen dir.',
  ack: {
    formation: 'Formation, verstanden.',
    attackMyTarget: 'Greifen dein Ziel an — {x}.',
    freeFire: 'Freies Feuer, wir jagen.',
    goNav: 'Laufen Navpunkt {x} an.',
    holdPosition: 'Halten Stellung.',
    fallBack: 'Brechen ab, kommen zu dir.',
    aimLegsOn: 'Zielen auf die Beine.',
    aimLegsOff: 'Zielen wieder auf den Torso.',
  },
  noTarget: 'Negativ, kein Ziel markiert. Schalte eins auf.',
  noNav: 'Negativ, kein Navpunkt aktiv.',
  refuse: 'Negativ — ich bin am Ende, ich bleibe bei dir!',
  noWingmen: 'Keine Flügelleute im Einsatz.',
  targetDown: 'Ziel ausgeschaltet. Zurück in Formation.',
  kill: 'Abschuss!',
  heavyHit: 'Schwer getroffen!',
  legsLost: 'Beine weg — ich kann nicht mehr laufen, feuere von hier weiter.',
  lost: '{x} ist ausgefallen!',
  friendlyFire: 'An Eins: Eigenbeschuss! Feuer einstellen!',
  broken: 'Ich halte das nicht mehr aus — ziehe mich zu dir zurück!',
  steady: 'Wieder einsatzbereit.',
};

export function wingLine(text, x = '') {
  return text.replaceAll('{x}', x);
}
