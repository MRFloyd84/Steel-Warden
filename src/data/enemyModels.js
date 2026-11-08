/**
 * Construction plans of the Synthesis machines — same joint layout and
 * format as data/walkerModels.js (so gait, IK and hit zones are shared),
 * but their own shape language: angular crystal hulls, asymmetric shards,
 * armour plates set off from the body with a gap, glowing energy veins.
 *
 * Extra kinds (on top of box/beam/jet):
 *   shard  crystal spike { at, size: [radius, height], rot, color, glow }
 *   plate  armour segment standing off the hull { at, size, rot }
 *   vein   glowing line { a, b, w } — self-lit, fades out on a wreck
 * legs.style 'insect': thin angular legs with claw feet; legs.gait 'jerky':
 *   feet snap forward and hold (insect-like rhythm).
 * paint.glow  colour of the veins and crystals
 */
const SYN_DARK = '#1d1a2c';
const SYN_JOINT = '#15131f';
const SYN_METAL = '#4a4466';

export const ENEMY_MODELS = {
  splitter: {
    paint: { base: '#3a3354', dark: SYN_DARK, accent: '#6b55a0', glass: '#122a2c', joint: SYN_JOINT, metal: SYN_METAL, glow: '#5ef2e6' },
    legs: { style: 'insect', gait: 'jerky', hipHeight: 4.0, hipWidth: 1.1, thigh: 2.6, shin: 2.7, thick: [0.35, 0.28], foot: [0.9, 0.25, 1.6], lift: 1.1 },
    pelvis: [1.4, 0.5, 1.0],
    torso: {
      pivot: 4.6, width: 1.6, taperTop: 0.45,
      profile: [[-2.2, 0.3], [-0.6, 1.2], [0.9, 1.0], [1.6, 0.2], [0.8, -0.5], [-1.2, -0.3]],
    },
    canopy: { at: [0, 0.75, -1.25], size: [0.9, 0.18, 0.5], tilt: 30 },
    arms: { shoulder: [0.95, 0.3, -0.2], upper: [0.3, 0.8, 0.3], pod: [0.35, 0.35, 1.5], drop: 0.8 },
    shoulderPods: null,
    torsoMounts: { torsoL: [-0.7, 0.4, -1.6], torsoC: [0, 0.75, -2.0] },
    extras: [
      { kind: 'shard', part: 'torso', at: [0.5, 1.4, 0.4], size: [0.35, 1.6], rot: [-30, 0, -20], color: 'accent', glow: true },
      { kind: 'shard', part: 'torso', at: [-0.2, 1.3, 0.9], size: [0.25, 1.1], rot: [-50, 0, 15], color: 'accent' },
      { kind: 'plate', part: 'torso', at: [-1.05, 0.4, -0.3], size: [0.12, 0.8, 1.6], rot: [0, 8, -10] },
      { kind: 'vein', part: 'torso', a: [0, 0.8, -1.35], b: [0, 0.9, 1.0], w: 0.08 },
      { kind: 'vein', part: 'torso', a: [-0.75, 0.2, -0.8], b: [-0.6, 0.9, 0.6], w: 0.06 },
    ],
  },

  sichel: {
    paint: { base: '#342e4c', dark: SYN_DARK, accent: '#7a5cc4', glass: '#122a2c', joint: SYN_JOINT, metal: SYN_METAL, glow: '#5ef2e6' },
    legs: { style: 'insect', gait: 'jerky', hipHeight: 5.6, hipWidth: 1.4, thigh: 3.4, shin: 3.6, thick: [0.55, 0.45], foot: [1.2, 0.35, 2.0], lift: 1.0 },
    pelvis: [2.2, 0.8, 1.4],
    torso: {
      pivot: 6.5, width: 2.8, taperTop: 0.5,
      profile: [[-2.6, 0.2], [-1.4, 1.9], [0.6, 2.3], [1.9, 1.2], [1.8, -0.6], [0.0, -1.0], [-1.8, -0.6]],
    },
    canopy: { at: [0, 1.5, -1.7], size: [1.4, 0.2, 0.6], tilt: 35 },
    arms: { shoulder: [1.75, 0.8, 0], upper: [0.5, 1.2, 0.5], pod: [0.6, 0.6, 2.4], drop: 1.2 },
    shoulderPods: null,
    torsoMounts: { torsoC: [0, -0.5, -1.95] },
    extras: [
      // Sickle crest: one big asymmetric blade on the left shoulder
      { kind: 'shard', part: 'torso', at: [-0.9, 2.8, 0.2], size: [0.5, 3.0], rot: [-25, 0, 28], color: 'accent', glow: true },
      { kind: 'shard', part: 'torso', at: [0.8, 2.4, 0.8], size: [0.3, 1.4], rot: [-40, 0, -20], color: 'base' },
      { kind: 'plate', part: 'torso', at: [1.75, 0.6, -0.4], size: [0.15, 1.6, 2.2], rot: [0, -6, 12] },
      { kind: 'plate', part: 'torso', at: [-1.7, 0.2, 0.4], size: [0.15, 1.2, 1.8], rot: [0, 8, -8] },
      { kind: 'vein', part: 'torso', a: [0, 1.6, -1.8], b: [0, 2.2, 1.2], w: 0.1 },
      { kind: 'vein', part: 'torso', a: [1.2, 0.1, -1.2], b: [1.3, 1.5, 0.8], w: 0.08 },
      { kind: 'vein', part: 'torso', a: [-1.2, 0.0, -1.0], b: [-1.1, 1.4, 1.0], w: 0.08 },
      { kind: 'shard', part: 'sensors', at: [0.3, 2.6, -0.6], size: [0.18, 1.2], rot: [-10, 0, -8], color: 'glass', glow: true },
    ],
  },

  monolith: {
    paint: { base: '#2c2840', dark: SYN_DARK, accent: '#5a47a0', glass: '#122a2c', joint: SYN_JOINT, metal: SYN_METAL, glow: '#b48cff' },
    legs: { style: 'heavy', gait: 'jerky', hipHeight: 6.6, hipWidth: 2.0, thigh: 3.8, shin: 4.0, thick: [1.3, 1.1], foot: [2.0, 0.6, 2.6], lift: 0.8 },
    pelvis: [3.6, 1.2, 2.2],
    torso: {
      pivot: 8.0, width: 5.2, taperTop: 0.7,
      profile: [[-2.8, -0.8], [-2.6, 2.0], [-1.0, 3.6], [1.8, 3.4], [2.6, 1.6], [2.4, -1.4], [-1.4, -1.6]],
    },
    canopy: { at: [0, 2.4, -2.55], size: [1.6, 0.22, 0.5], tilt: 20 },
    arms: { shoulder: [3.1, 1.6, 0], upper: [1.0, 1.6, 1.0], pod: [1.2, 1.1, 3.2], drop: 1.8 },
    shoulderPods: { at: [1.9, 3.9, 0.6], size: [1.5, 1.0, 1.8], tubes: [3, 2] },
    torsoMounts: { torsoC: [0, 0.6, -2.4] },
    extras: [
      // Stacked armour slabs that hover a hand's width off the hull
      { kind: 'plate', part: 'torso', at: [0, 1.0, -2.9], size: [4.2, 2.2, 0.3], rot: [8, 0, 3] },
      { kind: 'plate', part: 'torso', at: [-2.85, 1.2, 0], size: [0.3, 2.6, 3.4], rot: [0, 0, -6] },
      { kind: 'plate', part: 'torso', at: [2.85, 0.8, 0.3], size: [0.3, 2.0, 3.0], rot: [0, 4, 9] },
      { kind: 'shard', part: 'torso', at: [-1.4, 4.0, 0.8], size: [0.6, 2.4], rot: [-20, 0, 18], color: 'accent', glow: true },
      { kind: 'shard', part: 'torso', at: [-0.4, 4.1, 1.2], size: [0.45, 1.8], rot: [-35, 0, 6], color: 'accent' },
      { kind: 'vein', part: 'torso', a: [-1.8, 2.0, -2.6], b: [1.8, 2.1, -2.6], w: 0.12 },
      { kind: 'vein', part: 'torso', a: [0, -0.8, -2.5], b: [0, 3.2, -1.2], w: 0.12 },
    ],
  },

  obelisk: {
    paint: { base: '#302b46', dark: SYN_DARK, accent: '#6b55a0', glass: '#122a2c', joint: SYN_JOINT, metal: SYN_METAL, glow: '#5ef2e6' },
    legs: { style: 'insect', gait: 'jerky', hipHeight: 6.0, hipWidth: 2.2, thigh: 3.6, shin: 3.9, thick: [0.8, 0.65], foot: [1.6, 0.45, 2.4], lift: 0.7 },
    pelvis: [3.4, 1.0, 2.4],
    torso: {
      pivot: 7.2, width: 3.6, taperTop: 0.35,
      // Tall pointed obelisk with the mortar in the chest
      profile: [[-2.0, -0.8], [-1.6, 3.0], [-0.4, 6.5], [0.6, 6.2], [1.8, 2.4], [2.0, -1.0], [0, -1.4]],
    },
    canopy: { at: [0, 1.8, -1.85], size: [1.2, 0.2, 0.4], tilt: 25 },
    arms: { shoulder: [2.1, 1.0, 0.2], upper: [0.6, 1.2, 0.6], pod: [0.6, 0.6, 2.0], drop: 1.2 },
    shoulderPods: null,
    torsoMounts: { torsoC: [0, 0.2, -2.05] },
    extras: [
      { kind: 'vein', part: 'torso', a: [0, 0.2, -1.9], b: [0, 6.0, 0.1], w: 0.14 },
      { kind: 'vein', part: 'torso', a: [-1.2, 0.0, -1.4], b: [-0.4, 4.8, 0.2], w: 0.08 },
      { kind: 'plate', part: 'torso', at: [1.95, 1.6, 0.2], size: [0.2, 2.6, 2.8], rot: [0, -4, 10] },
      { kind: 'shard', part: 'sensors', at: [0.1, 6.9, 0.1], size: [0.35, 1.6], color: 'glass', glow: true },
      { kind: 'shard', part: 'torso', at: [-1.5, 3.6, 0.6], size: [0.3, 1.6], rot: [0, 0, 35], color: 'accent' },
    ],
  },

  // Drone: data placeholder (air units follow later)
  schwarm: {
    paint: { base: '#3a3354', dark: SYN_DARK, accent: '#6b55a0', glass: '#122a2c', joint: SYN_JOINT, metal: SYN_METAL, glow: '#5ef2e6' },
    legs: { style: 'insect', gait: 'jerky', hipHeight: 1.0, hipWidth: 0.5, thigh: 0.7, shin: 0.7, thick: [0.1, 0.1], foot: [0.2, 0.1, 0.3], lift: 0.2 },
    pelvis: [0.6, 0.3, 0.6],
    torso: { pivot: 1.2, width: 1.0, taperTop: 0.5, profile: [[-1, 0], [0, 0.6], [1, 0], [0, -0.3]] },
    canopy: { at: [0, 0.2, -0.9], size: [0.3, 0.1, 0.2], tilt: 0 },
    arms: { shoulder: [0.5, 0, 0], upper: [0.1, 0.2, 0.1], pod: [0.1, 0.1, 0.4], drop: 0.2 },
    shoulderPods: null,
    torsoMounts: {},
    extras: [],
  },
};
