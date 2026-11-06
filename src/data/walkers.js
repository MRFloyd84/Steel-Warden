/**
 * Playable walkers. Units: tonnage t, speeds m/s, accelerations m/s²,
 * angles degrees, rates degrees/s, positions metres in model space
 * (origin at ground between the feet, -Z forward).
 *
 * hardpoint.type: 'energy' | 'ballistic' | 'missile' | 'universal'
 * hardpoint.size: 'S' | 'M' | 'L'
 * hardpoint.arc:  aim limits relative to the torso { yaw: [min, max], pitch: [min, max] }
 *
 * Only BASTION exists so far; the other five follow with the walker builder.
 */
export const WALKERS = {
  bastion: {
    id: 'bastion',
    name: 'BASTION MW-1',
    manufacturer: 'Vossberg Maschinenbau',
    class: 'medium',
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
      { id: 'LA1', location: 'armL', size: 'M', type: 'energy', position: [-2.3, 6.4, -0.9], arc: { yaw: [-10, 10], pitch: [-15, 20] } },
      { id: 'LA2', location: 'armL', size: 'S', type: 'universal', position: [-2.3, 5.8, -0.7], arc: { yaw: [-10, 10], pitch: [-15, 20] } },
      { id: 'RA1', location: 'armR', size: 'M', type: 'ballistic', position: [2.3, 6.4, -0.9], arc: { yaw: [-10, 10], pitch: [-15, 20] } },
      { id: 'RA2', location: 'armR', size: 'S', type: 'universal', position: [2.3, 5.8, -0.7], arc: { yaw: [-10, 10], pitch: [-15, 20] } },
      { id: 'LS', location: 'torso', size: 'M', type: 'missile', position: [-1.3, 8.9, 0.2], arc: { yaw: [0, 0], pitch: [0, 0] } },
      { id: 'RS', location: 'torso', size: 'M', type: 'missile', position: [1.3, 8.9, 0.2], arc: { yaw: [0, 0], pitch: [0, 0] } },
    ],
    maxLoadoutWeight: 16,
    jumpJets: null,

    cockpit: {
      variant: 'standard',
      eyeHeight: 9.2,
      canopyShape: 'faceted',
      panelLayout: 'standard',
      serial: 'MW1-50-0417',
    },
    sound: { stepPitch: 1.0, servoPitch: 1.0, reactorHum: 1.0 },
    geometry: 'bastion',
  },
};

export function getWalker(id) {
  const walker = WALKERS[id];
  if (!walker) throw new Error(`Unknown walker "${id}"`);
  return walker;
}
