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
 * Loop fields: sample, gain (base level; game code modulates on top), bus,
 *   loopPoints [start, end] s — explicit loop range; the file carries 1 s of wrapped
 *            audio at both ends, so a decoder offset can't break the seam.
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
  // Ground layers on top of the footstep (data/surfaces.js → step)
  'footstep.soft': { synth: 'squelch', gain: 0.45, rate: [0.8, 1.0], bus: 'world' },
  'footstep.water': { synth: 'splash', gain: 0.6, rate: [0.8, 1.05], bus: 'world' },
  'footstep.lava': { synth: 'sizzle', samples: ['hiss_1', 'hiss_2', 'hiss_3'], gain: 0.45, rate: [0.9, 1.1], bus: 'world' },
  'footstep.ice': { synth: 'crunch', gain: 0.5, rate: [0.9, 1.15], bus: 'world' },
  'ground.iceBreak': { synth: 'iceBreak', samples: ['creak_2', 'creak_4'], gain: 1, rate: [0.8, 0.9], bus: 'world' },
  'structure.creak': { samples: ['creak_1', 'creak_2', 'creak_3', 'creak_4'], gain: 0.4, rate: [0.85, 1.1], bus: 'cockpit', cooldown: 1.8 },
  'torso.limit': { samples: ['piston_end'], gain: 0.35, rate: [0.9, 1.0], bus: 'cockpit', cooldown: 0.6 },
  'walker.settle': { samples: ['piston_rattle', 'piston_short'], gain: 0.3, rate: [0.85, 0.95], bus: 'cockpit', cooldown: 1.5 },

  // Start base: hangar door (world/HangarDoor.js)
  'base.door': { samples: ['hangar_door'], gain: 0.9, rate: [1, 1], bus: 'world' },
  'base.horn': { samples: ['alarm_critical'], gain: 0.7, rate: [0.72, 0.74], bus: 'world' },

  // Startup procedure (systems:event types → see SYSTEM_EVENT_SOUNDS)
  'sys.relayOn': { samples: ['relay_on'], gain: 0.55, rate: [0.97, 1.03], bus: 'cockpit' },
  'sys.relayOff': { samples: ['relay_off'], gain: 0.5, rate: [0.97, 1.03], bus: 'cockpit' },
  // APU start (≈ 8.5 s: spool-up, then the running loop takes over — SystemsAudio)
  'sys.apuStart': { samples: ['apu_start'], gain: 0.15, rate: [1, 1], bus: 'cockpit' },
  'sys.contactor': { samples: ['contactor_heavy'], gain: 0.6, rate: [0.95, 1.02], bus: 'cockpit' },
  'sys.ignition': { samples: ['contactor_heavy'], gain: 0.8, rate: [0.55, 0.6], bus: 'cockpit' },
  'sys.ignitionFail': { samples: ['relay_off'], gain: 0.5, rate: [0.7, 0.75], bus: 'cockpit' },
  'sys.scram': { samples: ['contactor_heavy'], gain: 0.8, rate: [0.8, 0.85], bus: 'cockpit' },
  'sys.vent': { samples: ['hiss_1', 'hiss_2', 'hiss_3'], gain: 0.5, rate: [0.8, 0.9], bus: 'cockpit' },
  'sys.hydraulicsUp': { samples: ['hydraulic_stop'], gain: 0.5, rate: [0.95, 1.0], bus: 'cockpit' },
  'sys.standUp': { samples: ['piston_end'], gain: 0.45, rate: [0.8, 0.85], bus: 'cockpit' },
  'sys.crtBoot': { samples: ['crt_boot'], gain: 0.45, rate: [1, 1], bus: 'cockpit' },
  'sys.gyroSpin': { samples: ['gyro_spin'], gain: 0.4, rate: [1.35, 1.4], bus: 'cockpit' },
  'sys.gyroFail': { samples: ['relay_off'], gain: 0.4, rate: [1.1, 1.2], bus: 'cockpit' },
  'sys.legsRelease': { samples: ['lock_clank'], gain: 0.7, rate: [0.9, 0.95], bus: 'cockpit' },
  'sys.legsHiss': { samples: ['hiss_1', 'hiss_2'], gain: 0.6, rate: [0.95, 1.05], bus: 'cockpit' },
  'sys.legsBlocked': { samples: ['lock_clank'], gain: 0.4, rate: [0.7, 0.75], bus: 'cockpit' },
  'radio.squelch': { synth: 'squelch', gain: 0.35, rate: [0.97, 1.03], bus: 'ui' },

  // Weapons (own weapons are panned by hardpoint, other walkers by distance/direction)
  'weapon.laser': { synth: 'laser', gain: 0.35, rate: [0.95, 1.08], bus: 'world' },
  'weapon.particle': { synth: 'particle', gain: 0.7, rate: [0.95, 1.02], bus: 'world' },
  'weapon.autocannon': { samples: ['autocannon_shot'], gain: 0.45, rate: [0.94, 1.06], bus: 'world' },
  'weapon.railgun': { samples: ['cannon_shot'], gain: 0.85, rate: [1.05, 1.12], bus: 'world' },
  'weapon.railCharge': { synth: 'railCharge', gain: 0.35, rate: [1, 1], bus: 'world' },
  'weapon.shotgun': { synth: 'shotgun', gain: 0.6, rate: [0.95, 1.05], bus: 'world' },
  'weapon.rocket': { synth: 'rocket', gain: 0.35, rate: [0.9, 1.15], bus: 'world' },
  'weapon.speer': { synth: 'rocket', gain: 0.75, rate: [0.55, 0.6], bus: 'world' },
  'weapon.emp': { synth: 'emp', gain: 0.5, rate: [0.97, 1.03], bus: 'world' },
  'weapon.dryFire': { synth: 'tap', gain: 0.4, rate: [0.8, 0.85], bus: 'cockpit', cooldown: 0.25 },
  'weapon.chain': { synth: 'detent', gain: 0.45, rate: [1.1, 1.15], bus: 'cockpit' },
  'weapon.lock': { synth: 'lockTone', gain: 0.25, rate: [1, 1], bus: 'cockpit' },
  'weapon.lockBeep': { synth: 'lockBeep', gain: 0.22, rate: [1, 1], bus: 'cockpit' },
  'weapon.missileLaunch': { synth: 'rocket', samples: ['hiss_1', 'hiss_2', 'hiss_3'], gain: 0.5, rate: [0.75, 0.85], bus: 'world', cooldown: 0.05 },
  'hit.shield': { synth: 'shieldHum', gain: 0.8, rate: [0.9, 1.05], bus: 'cockpit', cooldown: 0.05 },
  'hit.armor': { synth: 'cockpitThud', samples: ['creak_1', 'creak_3'], gain: 0.9, rate: [0.85, 1.1], bus: 'cockpit', cooldown: 0.05 },
  'hit.sparks': { synth: 'sparks', gain: 0.5, rate: [0.9, 1.2], bus: 'cockpit', cooldown: 0.05 },
  'hit.smoke': { samples: ['hiss_1', 'hiss_2', 'hiss_3'], gain: 0.45, rate: [0.6, 0.7], bus: 'cockpit', cooldown: 1 },
  'weapon.shieldShift': { synth: 'buttonDown', gain: 0.35, rate: [1.2, 1.25], bus: 'cockpit' },

  // Impacts
  'impact.shield': { synth: 'shieldHit', gain: 0.45, rate: [0.9, 1.1], bus: 'world', cooldown: 0.03 },
  'impact.armor': { synth: 'armorHit', gain: 0.5, rate: [0.85, 1.15], bus: 'world', cooldown: 0.03 },
  'impact.ground': { synth: 'blast', gain: 0.35, rate: [1.3, 1.6], bus: 'world', cooldown: 0.03 },
  'impact.blast': { synth: 'blast', gain: 0.7, rate: [0.9, 1.05], bus: 'world', cooldown: 0.05 },
  'impact.explosion': { synth: 'explosion', gain: 1.0, rate: [0.95, 1.05], bus: 'world' },
  'impact.partFall': { samples: ['creak_1', 'creak_3'], gain: 0.6, rate: [0.6, 0.7], bus: 'world' },
};

/** Distance attenuation for world sounds: gain = 1 / (1 + distance / ref). */
export const WORLD_AUDIO = { ref: 60, minGain: 0.04 };

/** systems:event type → one or more sound events. */
export const SYSTEM_EVENT_SOUNDS = {
  batteryOn: ['sys.relayOn'],
  batteryOff: ['sys.relayOff'],
  // apuCrank: played by SystemsAudio (the start sound has to stop if the APU spins down)
  busSwitch: ['sys.contactor'],
  busTrip: ['sys.contactor'],
  busFault: ['sys.contactor', 'sys.relayOff'],
  ignition: ['sys.ignition'],
  ignitionFailed: ['sys.ignitionFail'],
  ignitionBlocked: ['sys.ignitionFail'],
  scram: ['sys.scram', 'sys.vent'],
  hydraulicsUp: ['sys.hydraulicsUp', 'sys.standUp'],
  monitorTest: ['sys.crtBoot'],
  gyroStart: ['sys.gyroSpin'],
  gyroFailed: ['sys.gyroFail'],
  legsReleased: ['sys.legsRelease', 'sys.legsHiss'],
  legsBlocked: ['sys.legsBlocked'],
};

export const SOUND_LOOPS = {
  airflow: { sample: 'airflow_loop', gain: 0.14, bus: 'cockpit' },
  servo: { sample: 'servo_loop', gain: 0.5, bus: 'cockpit' },
  motor: { sample: 'motor_loop', gain: 0.4, bus: 'cockpit' },
  reactor: { sample: 'reactor_loop', gain: 0.22, bus: 'cockpit' },
  apu: { sample: 'apu_run_loop', gain: 0.18, bus: 'cockpit', loopPoints: [1, 14.25] },
  coolant1: { sample: 'coolant_loop', gain: 0.18, bus: 'cockpit' },
  coolant2: { sample: 'coolant_loop', gain: 0.18, bus: 'cockpit' },
  hydraulics: { sample: 'hydraulic_loop', gain: 0.3, bus: 'cockpit' },
  alarmHeat: { sample: 'alarm_warble', gain: 0.22, bus: 'cockpit' },
  alarmCritical: { sample: 'alarm_critical', gain: 0.25, bus: 'cockpit' },
  beam: { synth: 'beamLoop', gain: 0.3, bus: 'world' },
  lockTone: { synth: 'lockSteady', gain: 0.18, bus: 'cockpit' },
  enemyLock: { synth: 'enemyLock', gain: 0.22, bus: 'cockpit' },
  incoming: { synth: 'incoming', gain: 0.2, bus: 'cockpit' },
  missileFlight: { synth: 'missileFlight', gain: 0.5, bus: 'world' },
  camStatic: { synth: 'camStatic', gain: 0.12, bus: 'cockpit' },
  wind: { synth: 'windLoop', gain: 0.35, bus: 'world' },
};

/** How system values drive the machinery loops (rates are playback-rate ranges). */
export const SYSTEM_AUDIO = {
  apuRate: [0.45, 1.0], // rpm 0 → 1 (running loop; spin-down drops the pitch)
  apuStartBlend: [6.8, 8.3], // s after START: the running loop fades in, the start sound ends
  coolantRate: [0.8, 1.0],
  pump2Detune: 1.07,
  reactorRate: [0.5, 1.0], // ignition spool → idle, plus reactorRateLoad at full power
  reactorRateLoad: 0.1,
  hydraulicsRate: [0.75, 1.05],
  hydraulicsHold: 0.15, // loop level once pressurised (no flow)
};

/** How the walker's motion drives the loops (multiplied with walker.sound). */
export const MOTION_AUDIO = {
  servoRateMin: 0.8,
  servoRateMax: 1.15,
  creakBrake: 3.2, // m/s² of deceleration that makes the frame groan
  settleSpeed: 4, // m/s: coming to a halt from above this plays the settle sound
  stepPanSpread: 0.18, // left/right foot stereo offset
  motorIdle: 0.3, // drive motor level when standing with the reactor running
  motorRate: [0.85, 1.25], // playback rate from standstill to full speed (× walker stepPitch^0.5)
};
