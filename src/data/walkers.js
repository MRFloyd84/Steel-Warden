/**
 * Playable walkers. Units: tonnage t, speeds m/s, accelerations m/s²,
 * angles degrees, rates degrees/s.
 *
 * hardpoint.type:  'energy' | 'ballistic' | 'missile' | 'universal'
 * hardpoint.size:  'S' | 'M' | 'L'
 * hardpoint.mount: attachment point on the model ('armL.0', 'shoulderR', 'torsoC', …).
 *                  The 3D position follows from the model (walkerModels.js), so data and
 *                  geometry can't drift apart; WalkerModel exposes it as hardpointPositions.
 * hardpoint.arc:   aim limits relative to the torso { yaw: [min, max], pitch: [min, max] }
 * build:           cost in scrap and build time in missions (workshop, campaign phase)
 * systems:         overrides for data/systems.js — light walkers start faster, heavy ones slower
 * cockpit.extraCircuit: second reactor circuit (assault class) — needs the 'assault' panel layout
 * defaultLoadout:  hardpoint id → weapon id (data/weapons.js); checked by sim/loadout.js
 * defaultGroups:   hardpoint id → weapon group 1–4 (keys 1–4)
 * defaultChains:   three factory fire chains { name, weapons: [hardpoint ids], mode: 'salvo' | 'sequence' };
 *                  keys 1–4 choose the active chain (left mouse button)
 * secondaryChain:  name of the chain on the second trigger (right mouse button); factory: the
 *                  chain with the missile launchers, without one chain 2 (later set in the hangar)
 */
const ARM = { yaw: [-10, 10], pitch: [-15, 20] };
const FIXED = { yaw: [0, 0], pitch: [0, 0] };

export const WALKERS = {
  kestrel: {
    id: 'kestrel',
    name: 'KESTREL LW-2',
    manufacturer: 'Aldenburg Leichtbau',
    class: 'light',
    role: 'Aufklärer',
    tonnage: 25,
    maxSpeed: 24,
    maxReverseSpeed: 8,
    acceleration: 7,
    turnRate: 75,
    torsoTwistLimit: 100,
    torsoTwistRate: 110,
    torsoPitchLimit: [-20, 26],
    torsoPitchRate: 70,
    reactorOutput: 180,
    heatCapacity: 60,
    heatDissipation: 6,
    shields: { front: 80, rear: 40, left: 60, right: 60, rechargeRate: 6 },
    armor: { torso: 120, armL: 60, armR: 60, legs: 100, sensors: 50, reactor: 70 },
    hardpoints: [
      { id: 'LA', location: 'armL', size: 'S', type: 'energy', mount: 'armL.0', arc: ARM },     // twin chin gun left
      { id: 'RA', location: 'armR', size: 'S', type: 'universal', mount: 'armR.0', arc: ARM },  // twin chin gun right
      { id: 'CT', location: 'torso', size: 'S', type: 'universal', mount: 'torsoC', arc: FIXED }, // slot under the canopy
      { id: 'TS', location: 'torso', size: 'S', type: 'missile', mount: 'torsoTop', arc: FIXED },  // grille pods on top
    ],
    maxLoadoutWeight: 6,
    defaultLoadout: { LA: 'lux-12', RA: 'lux-12', CT: 'target-pod', TS: 'falke-4' },
    defaultGroups: { LA: 1, RA: 1, TS: 3 },
    defaultChains: [{ name: 'LASER', weapons: ['LA', 'RA'], mode: 'salvo' }, { name: 'RAKETEN', weapons: ['TS'], mode: 'salvo' }, { name: 'ALLES', weapons: ['LA', 'RA', 'TS'], mode: 'sequence' }],
    secondaryChain: 'RAKETEN',
    jumpJets: { thrust: 14, fuel: 4 },
    cockpit: { variant: 'compact', eyeHeight: 6.2, canopyShape: 'bubble', panelLayout: 'compact', serial: 'LW2-25-1183' },
    sound: { stepPitch: 1.4, servoPitch: 1.3, reactorHum: 0.75 },
    geometry: 'kestrel',
    build: { scrap: 140, missions: 1 },
    systems: { apu: { crankRate: 0.3 }, reactor: { preheatRate: 70 }, gyro: { alignTime: 6 }, hydraulics: { mainRate: 55 } },
  },

  marder: {
    id: 'marder',
    name: 'MARDER LW-4',
    manufacturer: 'Aldenburg Leichtbau',
    class: 'light',
    role: 'Jäger',
    tonnage: 35,
    maxSpeed: 20,
    maxReverseSpeed: 7,
    acceleration: 6,
    turnRate: 65,
    torsoTwistLimit: 110,
    torsoTwistRate: 130,
    torsoPitchLimit: [-20, 24],
    torsoPitchRate: 65,
    reactorOutput: 230,
    heatCapacity: 75,
    heatDissipation: 6.5,
    shields: { front: 100, rear: 50, left: 70, right: 70, rechargeRate: 7 },
    armor: { torso: 170, armL: 90, armR: 90, legs: 140, sensors: 55, reactor: 100 },
    hardpoints: [
      { id: 'LA', location: 'armL', size: 'M', type: 'ballistic', mount: 'armL.0', arc: ARM },
      { id: 'RA', location: 'armR', size: 'M', type: 'energy', mount: 'armR.0', arc: ARM },
      { id: 'LT', location: 'torso', size: 'S', type: 'energy', mount: 'torsoL', arc: FIXED },
      { id: 'RT', location: 'torso', size: 'S', type: 'missile', mount: 'torsoR', arc: FIXED },
    ],
    maxLoadoutWeight: 10,
    defaultLoadout: { LA: 'ak-20', RA: 'lux-40', LT: 'lux-12', RT: 'falke-4' },
    defaultGroups: { LA: 2, RA: 1, LT: 1, RT: 3 },
    defaultChains: [{ name: 'ARME', weapons: ['LA', 'RA'], mode: 'salvo' }, { name: 'ENERGIE', weapons: ['RA', 'LT'], mode: 'salvo' }, { name: 'RAKETEN', weapons: ['RT'], mode: 'salvo' }],
    secondaryChain: 'RAKETEN',
    jumpJets: null,
    cockpit: { variant: 'compact', eyeHeight: 6.9, canopyShape: 'wedge', panelLayout: 'compact', serial: 'LW4-35-0562' },
    sound: { stepPitch: 1.25, servoPitch: 1.2, reactorHum: 0.85 },
    geometry: 'marder',
    build: { scrap: 190, missions: 1 },
    systems: { apu: { crankRate: 0.28 }, reactor: { preheatRate: 62 }, gyro: { alignTime: 7 }, hydraulics: { mainRate: 50 } },
  },

  bastion: {
    id: 'bastion',
    name: 'BASTION MW-1',
    manufacturer: 'Vossberg Maschinenbau',
    class: 'medium',
    role: 'Allrounder',
    tonnage: 50,
    maxSpeed: 16,
    maxReverseSpeed: 6,
    acceleration: 4.5,
    turnRate: 45,
    torsoTwistLimit: 120,
    torsoTwistRate: 75,
    torsoPitchLimit: [-18, 24],
    torsoPitchRate: 45,
    reactorOutput: 320,
    heatCapacity: 100,
    heatDissipation: 7,
    shields: { front: 120, rear: 60, left: 90, right: 90, rechargeRate: 8 },
    armor: { torso: 240, armL: 120, armR: 120, legs: 200, sensors: 60, reactor: 140 },
    hardpoints: [
      { id: 'LA', location: 'armL', size: 'M', type: 'missile', mount: 'armL.0', arc: ARM },       // 2×2 rack on the forearm
      { id: 'RA', location: 'armR', size: 'M', type: 'ballistic', mount: 'armR.0', arc: ARM },     // twin cannon
      { id: 'LS', location: 'torso', size: 'M', type: 'missile', mount: 'shoulderL', arc: FIXED }, // shoulder box, X hatch
      { id: 'RS', location: 'torso', size: 'M', type: 'energy', mount: 'shoulderR', arc: FIXED },  // shoulder box, vents
      { id: 'CT', location: 'torso', size: 'S', type: 'universal', mount: 'torsoC', arc: FIXED },  // under the canopy
    ],
    maxLoadoutWeight: 16,
    defaultLoadout: { LA: 'falke-4', RA: 'ak-20', LS: 'habicht-8', RS: 'lux-40', CT: 'target-pod' },
    defaultGroups: { RA: 1, RS: 1, LA: 3, LS: 3 },
    defaultChains: [{ name: 'KANONE + LASER', weapons: ['RA', 'RS'], mode: 'salvo' }, { name: 'RAKETEN', weapons: ['LA', 'LS'], mode: 'sequence' }, { name: 'DAUERFEUER', weapons: ['RA'], mode: 'salvo' }],
    secondaryChain: 'RAKETEN',
    jumpJets: null,
    cockpit: { variant: 'standard', eyeHeight: 9.2, canopyShape: 'faceted', panelLayout: 'standard', serial: 'MW1-50-0417' },
    sound: { stepPitch: 1.0, servoPitch: 1.0, reactorHum: 1.0 },
    geometry: 'bastion',
    build: { scrap: 260, missions: 2 },
    systems: {},
  },

  halberd: {
    id: 'halberd',
    name: 'HALBERD MW-3',
    manufacturer: 'Vossberg Maschinenbau',
    class: 'medium',
    role: 'Unterstützung',
    tonnage: 60,
    maxSpeed: 13.5,
    maxReverseSpeed: 5,
    acceleration: 3.8,
    turnRate: 38,
    torsoTwistLimit: 110,
    torsoTwistRate: 50,
    torsoPitchLimit: [-15, 22],
    torsoPitchRate: 35,
    reactorOutput: 340,
    heatCapacity: 110,
    heatDissipation: 7.5,
    shields: { front: 140, rear: 70, left: 100, right: 100, rechargeRate: 9 },
    armor: { torso: 280, armL: 130, armR: 130, legs: 230, sensors: 70, reactor: 160 },
    hardpoints: [
      { id: 'LS', location: 'torso', size: 'L', type: 'missile', mount: 'shoulderL', arc: FIXED },
      { id: 'RS', location: 'torso', size: 'L', type: 'missile', mount: 'shoulderR', arc: FIXED },
      { id: 'LA', location: 'armL', size: 'M', type: 'universal', mount: 'armL.0', arc: ARM },
      { id: 'RA', location: 'armR', size: 'M', type: 'energy', mount: 'armR.0', arc: ARM },
    ],
    maxLoadoutWeight: 20,
    defaultLoadout: { LS: 'speer', RS: 'habicht-8', LA: 'imp-2', RA: 'lux-40' },
    defaultGroups: { LS: 3, RS: 3, LA: 4, RA: 1 },
    defaultChains: [{ name: 'RAKETEN', weapons: ['LS', 'RS'], mode: 'sequence' }, { name: 'LASER', weapons: ['RA'], mode: 'salvo' }, { name: 'EMP + LASER', weapons: ['LA', 'RA'], mode: 'sequence' }],
    secondaryChain: 'RAKETEN',
    jumpJets: null,
    cockpit: { variant: 'standard', eyeHeight: 9.8, canopyShape: 'faceted', panelLayout: 'standard', serial: 'MW3-60-0230' },
    sound: { stepPitch: 0.92, servoPitch: 0.85, reactorHum: 1.05 },
    geometry: 'halberd',
    build: { scrap: 320, missions: 2 },
    systems: {},
  },

  goliath: {
    id: 'goliath',
    name: 'GOLIATH HW-2',
    manufacturer: 'Hartwerk Schwermaschinen',
    class: 'heavy',
    role: 'Frontlinie',
    tonnage: 80,
    maxSpeed: 11,
    maxReverseSpeed: 4,
    acceleration: 2.6,
    turnRate: 30,
    torsoTwistLimit: 120,
    torsoTwistRate: 45,
    torsoPitchLimit: [-15, 20],
    torsoPitchRate: 30,
    reactorOutput: 450,
    heatCapacity: 140,
    heatDissipation: 9,
    shields: { front: 200, rear: 100, left: 150, right: 150, rechargeRate: 12 },
    // more armour in place of the dropped torso guns (only four weapons on the model)
    armor: { torso: 500, armL: 260, armR: 260, legs: 400, sensors: 100, reactor: 270 },
    hardpoints: [
      { id: 'RA', location: 'armR', size: 'L', type: 'ballistic', mount: 'armR.0', arc: ARM },   // twin-barrel cannon
      { id: 'LA', location: 'armL', size: 'M', type: 'missile', mount: 'armL.0', arc: ARM },     // 2×2 rack
      { id: 'LT', location: 'torso', size: 'M', type: 'energy', mount: 'torsoL', arc: FIXED },   // chest slit left
      { id: 'RT', location: 'torso', size: 'M', type: 'energy', mount: 'torsoR', arc: FIXED },   // chest slit right
    ],
    maxLoadoutWeight: 28,
    defaultLoadout: { RA: 'sr-3', LA: 'habicht-8', LT: 'lux-40', RT: 'lux-40' },
    defaultGroups: { RA: 1, LT: 2, RT: 2, LA: 3 },
    defaultChains: [{ name: 'SCHWER', weapons: ['RA'], mode: 'salvo' }, { name: 'LASER', weapons: ['LT', 'RT'], mode: 'salvo' }, { name: 'RAKETEN', weapons: ['LA'], mode: 'salvo' }],
    secondaryChain: 'RAKETEN',
    jumpJets: null,
    cockpit: { variant: 'heavy', eyeHeight: 11.2, canopyShape: 'slit', panelLayout: 'heavy', serial: 'HW2-80-0071' },
    sound: { stepPitch: 0.78, servoPitch: 0.75, reactorHum: 1.15 },
    geometry: 'goliath',
    build: { scrap: 430, missions: 2 },
    systems: { apu: { crankRate: 0.17 }, reactor: { preheatRate: 38 }, gyro: { alignTime: 12 }, hydraulics: { mainRate: 28 } },
  },

  koloss: {
    id: 'koloss',
    name: 'KOLOSS AW-1',
    manufacturer: 'Hartwerk Schwermaschinen',
    class: 'assault',
    role: 'Belagerung',
    tonnage: 100,
    maxSpeed: 8.5,
    maxReverseSpeed: 3,
    acceleration: 1.9,
    turnRate: 24,
    torsoTwistLimit: 90,
    torsoTwistRate: 35,
    torsoPitchLimit: [-12, 18],
    torsoPitchRate: 24,
    reactorOutput: 560,
    heatCapacity: 180,
    heatDissipation: 11,
    shields: { front: 260, rear: 140, left: 200, right: 200, rechargeRate: 15 },
    armor: { torso: 560, armL: 300, armR: 300, legs: 440, sensors: 120, reactor: 320 },
    hardpoints: [
      { id: 'LA', location: 'armL', size: 'L', type: 'ballistic', mount: 'armL.0', arc: ARM },     // rotary cannon
      { id: 'RA', location: 'armR', size: 'L', type: 'ballistic', mount: 'armR.0', arc: ARM },     // rotary cannon
      { id: 'LS', location: 'torso', size: 'M', type: 'missile', mount: 'shoulderL', arc: FIXED }, // chest rack, upper left
      { id: 'RS', location: 'torso', size: 'M', type: 'missile', mount: 'shoulderR', arc: FIXED }, // chest rack, upper right
      { id: 'LT', location: 'torso', size: 'S', type: 'missile', mount: 'torsoL', arc: FIXED },    // chest rack, lower left
      { id: 'RT', location: 'torso', size: 'S', type: 'missile', mount: 'torsoR', arc: FIXED },    // chest rack, lower right
    ],
    maxLoadoutWeight: 38,
    defaultLoadout: { LA: 'rk-30', RA: 'rk-30', LS: 'habicht-8', RS: 'habicht-8', LT: 'falke-4', RT: 'falke-4' },
    defaultGroups: { LA: 1, RA: 1, LS: 3, RS: 3, LT: 2, RT: 2 },
    defaultChains: [{ name: 'ROTOREN', weapons: ['LA', 'RA'], mode: 'salvo' }, { name: 'LENKRAKETEN', weapons: ['LS', 'RS'], mode: 'sequence' }, { name: 'KURZSTRECKE', weapons: ['LT', 'RT'], mode: 'salvo' }],
    secondaryChain: 'RAKETEN',
    jumpJets: null,
    cockpit: { variant: 'heavy', eyeHeight: 13.6, canopyShape: 'tower', panelLayout: 'assault', serial: 'AW1-100-0009', extraCircuit: true },
    sound: { stepPitch: 0.66, servoPitch: 0.65, reactorHum: 1.25 },
    geometry: 'koloss',
    build: { scrap: 560, missions: 3 },
    systems: { apu: { crankRate: 0.15 }, reactor: { preheatRate: 32, ignitionTime: 4 }, gyro: { alignTime: 13 }, hydraulics: { mainRate: 24 } },
  },
};

export const WALKER_ORDER = ['kestrel', 'marder', 'bastion', 'halberd', 'goliath', 'koloss'];

export const CLASS_LABELS = { light: 'Leicht', medium: 'Mittel', heavy: 'Schwer', assault: 'Sturm' };

export function getWalker(id) {
  const walker = WALKERS[id];
  if (!walker) throw new Error(`Unknown walker "${id}"`);
  return walker;
}
