/**
 * Sound design data. Game code triggers named events; this file decides
 * what they sound like, so mixing and variation can be tuned here.
 *
 * Event fields:
 *   samples  list of sample names (src/audio/samples/<name>.mp3), one picked at random
 *   synth    procedural click buffer from ClickSynth ('toggle', 'detent', ...)
 *            samples and synth may be combined (both play, layered)
 *   gain     linear volume (0..1+), rate [min, max] random playback-rate range
 *   bus      'cockpit' (inside the cabin) | 'world' (outside) | 'ui'
 *   cooldown minimum seconds between two plays of this event
 *
 * Loop fields: sample, gain (base level; game code modulates on top), bus.
 */
export const AUDIO_MIX = {
  master: 0.8,
  buses: { cockpit: 1.0, world: 0.9, ui: 0.7 },
};

export const SOUND_EVENTS = {
  // Cockpit controls
  'switch.toggle': { synth: 'toggle', gain: 0.55, rate: [0.96, 1.04], bus: 'cockpit' },
  'switch.toggleHeavy': { synth: 'toggle', samples: ['valve_1', 'valve_2', 'valve_3'], gain: 0.45, rate: [1.15, 1.3], bus: 'cockpit' },
  'switch.blocked': { synth: 'tap', gain: 0.35, rate: [0.95, 1.05], bus: 'cockpit' },
  'guard.open': { synth: 'guard', gain: 0.5, rate: [0.97, 1.03], bus: 'cockpit' },
  'guard.close': { synth: 'guard', samples: ['valve_1', 'valve_3'], gain: 0.35, rate: [1.35, 1.5], bus: 'cockpit' },
  'rotary.detent': { synth: 'detent', gain: 0.5, rate: [0.95, 1.05], bus: 'cockpit' },
  'rotary.end': { synth: 'tap', gain: 0.3, rate: [0.9, 1.0], bus: 'cockpit' },
  'button.press': { synth: 'buttonDown', gain: 0.5, rate: [0.97, 1.03], bus: 'cockpit' },
  'button.release': { synth: 'buttonUp', gain: 0.35, rate: [0.97, 1.03], bus: 'cockpit' },
  'lamp.test': { synth: 'detent', gain: 0.25, rate: [1.2, 1.3], bus: 'cockpit' },
  'throttle.detent': { synth: 'detent', gain: 0.6, rate: [0.7, 0.75], bus: 'cockpit' },

  // Walker movement
  footstep: { samples: ['mech_step'], gain: 0.5, rate: [0.95, 1.04], bus: 'world' },
  'structure.creak': { samples: ['creak_1', 'creak_2', 'creak_3', 'creak_4'], gain: 0.4, rate: [0.85, 1.1], bus: 'cockpit', cooldown: 1.8 },
  'torso.limit': { samples: ['piston_end'], gain: 0.35, rate: [0.9, 1.0], bus: 'cockpit', cooldown: 0.6 },
  'walker.settle': { samples: ['piston_rattle', 'piston_short'], gain: 0.3, rate: [0.85, 0.95], bus: 'cockpit', cooldown: 1.5 },
};

export const SOUND_LOOPS = {
  airflow: { sample: 'airflow_loop', gain: 0.14, bus: 'cockpit' },
  servo: { sample: 'servo_loop', gain: 0.5, bus: 'cockpit' },
  reactor: { sample: 'reactor_loop', gain: 0.16, bus: 'cockpit' },
};

/** How the walker's motion drives the loops (multiplied with walker.sound). */
export const MOTION_AUDIO = {
  servoRateMin: 0.8,
  servoRateMax: 1.15,
  reactorIdle: 0.55, // share of the reactor loop gain at standstill
  creakBrake: 3.2, // m/s² of deceleration that makes the frame groan
  settleSpeed: 4, // m/s: coming to a halt from above this plays the settle sound
  stepPanSpread: 0.18, // left/right foot stereo offset
};
