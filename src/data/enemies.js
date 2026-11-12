/**
 * Synthesis units. Same fields as data/walkers.js (motion, armour per
 * component, shields, hardpoints, loadout) so motion, damage pipeline,
 * hit zones and weapons work unchanged, plus:
 *
 *   faction   'synth'
 *   ai        profile         'scout' | 'hunter' | 'bruiser' | 'artillery'
 *             preferredRange  m — distance the unit tries to hold in a fight
 *             aggression      0..1 — how readily it closes in / keeps attacking
 *             morale          0..1 — lower breaks earlier (retreat)
 *             flankChance     0..1 — chance to flank instead of a frontal attack
 *             sight           { range m, coneDeg full cone } (×daylight ×weather)
 *             detectEmitting  m — an emitting target is known this far away
 *             radar           m — own radar range while the unit emits (A4; located, line of sight)
 *             emits           emits from the start (scouts: active radar)
 *             retreatAt       share of structure left (torso) that triggers a retreat
 *             callsHelp       radios for reinforcements on first contact
 *             needsSpotter    fires only at contacts the group sees (artillery)
 *   salvage   scrap value of an intact wreck; weaponDropChance per weapon when an arm falls
 *
 * Drones are a data placeholder only (no air movement yet).
 */
const ARM = { yaw: [-12, 12], pitch: [-18, 22] };
const FIXED = { yaw: [0, 0], pitch: [0, 0] };
const COCKPIT = (eyeHeight) => ({ variant: 'compact', eyeHeight, canopyShape: 'none', panelLayout: 'compact', serial: 'SYN' });
const SOUND = (p) => ({ stepPitch: p, servoPitch: p * 1.3, reactorHum: 0.8 });

export const ENEMIES = {
  splitter: {
    id: 'splitter', name: 'SPLITTER', faction: 'synth', class: 'light', role: 'Späher', manufacturer: 'Synthese',
    tonnage: 22, maxSpeed: 26, maxReverseSpeed: 10, acceleration: 9, turnRate: 95,
    torsoTwistLimit: 110, torsoTwistRate: 140, torsoPitchLimit: [-20, 25], torsoPitchRate: 80,
    reactorOutput: 200, heatCapacity: 80, heatDissipation: 8,
    shields: { front: 50, rear: 30, left: 40, right: 40, rechargeRate: 6 },
    armor: { torso: 90, armL: 50, armR: 50, legs: 80, sensors: 30, reactor: 60 },
    hardpoints: [
      { id: 'LT', location: 'torso', size: 'S', type: 'energy', mount: 'torsoL', arc: FIXED },  // emitter on its boom
      { id: 'CT', location: 'torso', size: 'S', type: 'energy', mount: 'torsoC', arc: FIXED },  // red eye
    ],
    maxLoadoutWeight: 6,
    defaultLoadout: { LT: 'syn-splitter', CT: 'syn-splitter' },
    defaultGroups: { LT: 1, CT: 1 },
    defaultChains: [{ name: 'SPLITTER', weapons: ['LT', 'CT'], mode: 'salvo' }],
    jumpJets: null,
    cockpit: COCKPIT(5.35),
    sound: SOUND(1.5),
    geometry: 'splitter',
    systems: {},
    ai: {
      profile: 'scout', preferredRange: 170, aggression: 0.75, morale: 0.35, flankChance: 0.7,
      sight: { range: 1100, coneDeg: 140 }, detectEmitting: 1500, retreatAt: 0.35, callsHelp: true, radar: 1600, emits: true,
    },
    salvage: { scrap: 90, weaponDropChance: 0.5 },
  },

  sichel: {
    id: 'sichel', name: 'SICHEL', faction: 'synth', class: 'medium', role: 'Jäger', manufacturer: 'Synthese',
    tonnage: 45, maxSpeed: 17, maxReverseSpeed: 7, acceleration: 5.5, turnRate: 60,
    torsoTwistLimit: 120, torsoTwistRate: 90, torsoPitchLimit: [-18, 24], torsoPitchRate: 55,
    reactorOutput: 300, heatCapacity: 100, heatDissipation: 7,
    shields: { front: 100, rear: 50, left: 80, right: 80, rechargeRate: 7 },
    armor: { torso: 200, armL: 100, armR: 100, legs: 170, sensors: 50, reactor: 120 },
    hardpoints: [
      { id: 'LA', location: 'armL', size: 'M', type: 'energy', mount: 'armL.0', arc: ARM },
      { id: 'RA', location: 'armR', size: 'M', type: 'energy', mount: 'armR.0', arc: ARM },
      { id: 'CT', location: 'torso', size: 'M', type: 'energy', mount: 'torsoC', arc: FIXED },
    ],
    maxLoadoutWeight: 10,
    defaultLoadout: { LA: 'syn-lanze', RA: 'syn-impuls', CT: 'syn-impuls' },
    defaultGroups: { LA: 1, RA: 1, CT: 1 },
    defaultChains: [{ name: 'ALLE', weapons: ['LA', 'RA', 'CT'], mode: 'salvo' }],
    jumpJets: null,
    cockpit: COCKPIT(8.0),
    sound: SOUND(1.15),
    geometry: 'sichel',
    systems: {},
    ai: {
      profile: 'hunter', preferredRange: 300, aggression: 0.6, morale: 0.55, flankChance: 0.35,
      sight: { range: 1200, coneDeg: 120 }, detectEmitting: 1400, retreatAt: 0.25, callsHelp: false,
    },
    salvage: { scrap: 180, weaponDropChance: 0.4 },
  },

  monolith: {
    id: 'monolith', name: 'MONOLITH', faction: 'synth', class: 'heavy', role: 'Brecher', manufacturer: 'Synthese',
    tonnage: 78, maxSpeed: 10, maxReverseSpeed: 4, acceleration: 2.5, turnRate: 30,
    torsoTwistLimit: 100, torsoTwistRate: 50, torsoPitchLimit: [-15, 20], torsoPitchRate: 35,
    reactorOutput: 420, heatCapacity: 140, heatDissipation: 8,
    shields: { front: 150, rear: 70, left: 110, right: 110, rechargeRate: 7 },
    armor: { torso: 380, armL: 180, armR: 180, legs: 300, sensors: 70, reactor: 220 },
    hardpoints: [
      { id: 'RA', location: 'armR', size: 'L', type: 'ballistic', mount: 'armR.0', arc: ARM },  // hex cannon
      { id: 'LA', location: 'armL', size: 'L', type: 'missile', mount: 'armL.0', arc: ARM },    // 6-tube rack
      { id: 'CT', location: 'torso', size: 'M', type: 'energy', mount: 'torsoC', arc: FIXED },  // chest crystal
    ],
    maxLoadoutWeight: 18,
    defaultLoadout: { RA: 'syn-hammer', LA: 'syn-schwarm-l', CT: 'syn-impuls' },
    defaultGroups: { RA: 1, CT: 1, LA: 2 },
    defaultChains: [{ name: 'HAMMER', weapons: ['RA', 'CT'], mode: 'sequence' }, { name: 'SCHWARM', weapons: ['LA'], mode: 'salvo' }],
    jumpJets: null,
    cockpit: COCKPIT(10.4),
    sound: SOUND(0.75),
    geometry: 'monolith',
    systems: {},
    ai: {
      profile: 'bruiser', preferredRange: 420, aggression: 0.45, morale: 0.8, flankChance: 0,
      sight: { range: 1200, coneDeg: 100 }, detectEmitting: 1400, retreatAt: 0.15, callsHelp: false,
    },
    salvage: { scrap: 320, weaponDropChance: 0.35 },
  },

  obelisk: {
    id: 'obelisk', name: 'OBELISK', faction: 'synth', class: 'assault', role: 'Belagerer', manufacturer: 'Synthese',
    tonnage: 70, maxSpeed: 9, maxReverseSpeed: 4, acceleration: 2.2, turnRate: 28,
    torsoTwistLimit: 90, torsoTwistRate: 40, torsoPitchLimit: [-10, 50], torsoPitchRate: 30,
    reactorOutput: 380, heatCapacity: 130, heatDissipation: 7,
    shields: { front: 110, rear: 60, left: 90, right: 90, rechargeRate: 6 },
    armor: { torso: 300, armL: 120, armR: 120, legs: 240, sensors: 60, reactor: 180 },
    hardpoints: [
      { id: 'CT', location: 'torso', size: 'L', type: 'ballistic', mount: 'torsoC', arc: FIXED },
      { id: 'RA', location: 'armR', size: 'M', type: 'energy', mount: 'armR.0', arc: ARM },
    ],
    maxLoadoutWeight: 14,
    defaultLoadout: { CT: 'syn-moerser', RA: 'syn-impuls' },
    defaultGroups: { CT: 1, RA: 2 },
    defaultChains: [{ name: 'MÖRSER', weapons: ['CT'], mode: 'salvo' }, { name: 'IMPULS', weapons: ['RA'], mode: 'salvo' }],
    jumpJets: null,
    cockpit: COCKPIT(9.0),
    sound: SOUND(0.8),
    geometry: 'obelisk',
    systems: {},
    ai: {
      profile: 'artillery', preferredRange: 900, aggression: 0.2, morale: 0.5, flankChance: 0,
      sight: { range: 900, coneDeg: 90 }, detectEmitting: 1600, retreatAt: 0.3, callsHelp: false, needsSpotter: true,
    },
    salvage: { scrap: 280, weaponDropChance: 0.3 },
  },

  schwarm: {
    id: 'schwarm', name: 'SCHWARM', faction: 'synth', class: 'light', role: 'Drohne', placeholder: true,
    note: 'Lufteinheit — nur Daten, Flugmodell folgt',
    tonnage: 3, maxSpeed: 40, maxReverseSpeed: 20, acceleration: 20, turnRate: 180,
    torsoTwistLimit: 180, torsoTwistRate: 360, torsoPitchLimit: [-60, 60], torsoPitchRate: 180,
    reactorOutput: 40, heatCapacity: 30, heatDissipation: 10,
    shields: { front: 0, rear: 0, left: 0, right: 0, rechargeRate: 0 },
    armor: { torso: 20, armL: 5, armR: 5, legs: 5, sensors: 5, reactor: 10 },
    hardpoints: [{ id: 'CT', location: 'torso', size: 'S', type: 'energy', mount: 'torsoC', arc: FIXED }],
    maxLoadoutWeight: 1,
    defaultLoadout: { CT: 'syn-splitter' },
    defaultGroups: { CT: 1 },
    defaultChains: [{ name: 'SPLITTER', weapons: ['CT'], mode: 'salvo' }],
    jumpJets: null,
    cockpit: COCKPIT(1.2),
    sound: SOUND(2),
    geometry: 'schwarm',
    systems: {},
    ai: { profile: 'scout', preferredRange: 120, aggression: 0.9, morale: 0.2, flankChance: 0.9, sight: { range: 900, coneDeg: 360 }, detectEmitting: 1500, retreatAt: 0, callsHelp: false },
    salvage: { scrap: 10, weaponDropChance: 0 },
  },
};

/**
 * Guns on buildings (structure type → gun). The Synthesis spike and the human
 * turret (in enemy hands in the test missions) get a gunner AI.
 *   head      parts with this zone turn toward the target (blueprint zone)
 *   muzzles   local muzzle positions (at rest, front = -Z)
 *   burst     [s firing, s pause]; spread: factor on the difficulty's aim error
 */
export const GUNS = {
  spike: { weapon: 'syn-impuls', muzzles: [[0, 13.6, 0]], sight: { range: 900 }, turnRate: 360, head: null, reaction: 0.4, burst: [3, 2], spread: 1.2 },
  turret: { weapon: 'ak-20', muzzles: [[-1.1, 5, -8.6], [1.1, 5, -8.6]], sight: { range: 800 }, turnRate: 50, head: 'gun', reaction: 0.6, burst: [1.2, 2.2], spread: 2 },
};

export function getEnemy(id) {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy "${id}"`);
  return e;
}
