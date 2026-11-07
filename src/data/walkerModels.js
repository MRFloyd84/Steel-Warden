/**
 * Construction plans for the procedural walker models (WalkerBuilder).
 * Metres. Model space: origin on the ground between the feet, -Z forward, +Y up.
 * Torso-local coordinates are relative to the torso pivot (twist/pitch centre).
 *
 * legs.style    'digitigrade' (knee bends back, three toes) | 'straight' | 'heavy'
 * legs.hipHeight standing hip height; thigh + shin must exceed it (knees stay bent)
 * torso.pivot   height of the torso pivot above ground in the standing pose
 * torso.profile side silhouette as [z, y] points (front = negative z), extruded
 *               across torso.width; taperTop narrows the top (1 = no taper)
 * canopy        cockpit glass; the pilot's eye sits at its centre, so
 *               torso.pivot + canopy.at[1] should equal walker.cockpit.eyeHeight
 * arms          shoulder joint (right side, mirrored), upper arm and weapon pod
 * shoulderPods  missile racks on the torso (right side, mirrored), tubes [cols, rows]
 * torsoMounts   hardpoint sockets on the torso front
 * extras        decoration: box | beam | jet, attached to 'torso', 'pelvis' or 'sensors'
 */
import { ENEMY_MODELS } from './enemyModels.js';

const GLASS = '#1c2a2a';
const JOINT = '#2a2c28';
const METAL = '#7c8078';

export const WALKER_MODELS = {
  kestrel: {
    paint: { base: '#8a8468', dark: '#4c4a3d', accent: '#c2862b', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'digitigrade', hipHeight: 4.3, hipWidth: 0.9, thigh: 2.5, shin: 2.8, thick: [0.5, 0.38], foot: [0.8, 0.28, 1.5], lift: 0.8 },
    pelvis: [1.6, 0.6, 1.1],
    torso: {
      pivot: 4.9, width: 2.0, taperTop: 0.75,
      profile: [[-1.6, 0.2], [-1.2, 1.6], [0.2, 1.75], [1.2, 1.2], [1.3, -0.3], [0.4, -0.6], [-1.0, -0.4]],
    },
    canopy: { at: [0, 1.3, -1.32], size: [1.3, 0.7, 0.8], tilt: 35 },
    arms: { shoulder: [1.15, 0.7, -0.1], upper: [0.35, 0.9, 0.35], pod: [0.42, 0.42, 1.5], drop: 1.0 },
    shoulderPods: null,
    torsoMounts: { torsoC: [0, -0.1, -1.4] },
    extras: [
      { kind: 'beam', part: 'sensors', a: [0.5, 1.7, 0.6], b: [0.65, 2.9, 1.0], w: 0.06 },
      { kind: 'box', part: 'sensors', at: [0, 1.85, 0.3], size: [0.6, 0.25, 0.6], color: 'dark' },
      { kind: 'jet', part: 'torso', at: [-0.5, 0.5, 1.35], size: [0.45, 0.9, 0.5] },
      { kind: 'jet', part: 'torso', at: [0.5, 0.5, 1.35], size: [0.45, 0.9, 0.5] },
      { kind: 'box', part: 'torso', at: [0, 1.1, -0.2], size: [2.06, 0.08, 1.2], color: 'accent' },
    ],
  },

  marder: {
    paint: { base: '#6e6a5a', dark: '#3e3c33', accent: '#a8402b', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'digitigrade', hipHeight: 4.7, hipWidth: 1.0, thigh: 2.8, shin: 3.0, thick: [0.6, 0.45], foot: [0.9, 0.3, 1.6], lift: 0.85 },
    pelvis: [1.8, 0.7, 1.2],
    torso: {
      pivot: 5.4, width: 2.4, taperTop: 0.7,
      profile: [[-2.0, 0.4], [-1.0, 1.8], [0.8, 1.7], [1.5, 0.8], [1.4, -0.4], [0.2, -0.8], [-1.2, -0.5]],
    },
    canopy: { at: [0, 1.5, -1.3], size: [1.2, 0.45, 1.0], tilt: 50 },
    arms: { shoulder: [1.4, 0.6, 0], upper: [0.45, 1.0, 0.45], pod: [0.6, 0.55, 2.2], drop: 1.0 },
    shoulderPods: null,
    torsoMounts: { torsoL: [-0.75, 0.0, -1.72], torsoR: [0.75, 0.0, -1.72] },
    extras: [
      { kind: 'box', part: 'torso', at: [0, 1.85, 0.6], size: [0.18, 0.45, 1.4], color: 'accent' },
      { kind: 'beam', part: 'sensors', a: [-0.6, 1.6, 0.9], b: [-0.8, 2.6, 1.4], w: 0.06 },
      { kind: 'beam', part: 'sensors', a: [0.6, 1.6, 0.9], b: [0.8, 2.6, 1.4], w: 0.06 },
      { kind: 'box', part: 'torso', at: [0, 0.9, 1.5], size: [1.6, 0.6, 0.2], color: 'dark' },
    ],
  },

  bastion: {
    paint: { base: '#5f6650', dark: '#3a3e33', accent: '#b8962e', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'straight', hipHeight: 6.0, hipWidth: 1.4, thigh: 3.4, shin: 3.6, thick: [0.9, 0.75], foot: [1.3, 0.45, 2.2], lift: 1.0 },
    pelvis: [2.6, 1.0, 1.6],
    torso: {
      pivot: 7.0, width: 3.6, taperTop: 0.85,
      profile: [[-2.0, -0.6], [-2.0, 1.4], [-1.4, 2.6], [1.2, 2.7], [1.7, 1.6], [1.7, -1.0], [-1.2, -1.1]],
    },
    canopy: { at: [0, 2.2, -1.68], size: [1.8, 0.75, 0.5], tilt: 30 },
    arms: { shoulder: [2.15, 1.3, 0], upper: [0.7, 1.4, 0.7], pod: [0.8, 0.8, 2.6], drop: 1.5 },
    shoulderPods: { at: [1.3, 2.95, 0.3], size: [1.0, 0.7, 1.4], tubes: [2, 2] },
    torsoMounts: {},
    extras: [
      { kind: 'beam', part: 'sensors', a: [-1.2, 2.6, 0.9], b: [-1.35, 4.0, 1.2], w: 0.08 },
      { kind: 'box', part: 'torso', at: [0, 1.0, 1.75], size: [2.6, 1.6, 0.3], color: 'dark' },
      { kind: 'box', part: 'torso', at: [0, 1.25, -2.05], size: [0.6, 0.3, 0.2], color: 'metal' },
      { kind: 'box', part: 'torso', at: [-1.82, 0.4, -0.5], size: [0.06, 1.2, 1.6], color: 'accent' },
      { kind: 'box', part: 'torso', at: [1.82, 0.4, -0.5], size: [0.06, 1.2, 1.6], color: 'accent' },
    ],
  },

  halberd: {
    paint: { base: '#646b58', dark: '#3b3f35', accent: '#c9a23a', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'straight', hipHeight: 6.2, hipWidth: 1.5, thigh: 3.5, shin: 3.7, thick: [1.0, 0.8], foot: [1.4, 0.45, 2.3], lift: 0.95 },
    pelvis: [2.8, 1.0, 1.7],
    torso: {
      pivot: 7.4, width: 3.4, taperTop: 0.9,
      profile: [[-2.2, -0.6], [-2.2, 1.6], [-1.5, 2.7], [1.4, 2.8], [2.0, 1.4], [2.0, -1.0], [-1.0, -1.2]],
    },
    canopy: { at: [0, 2.4, -1.76], size: [1.6, 0.6, 0.45], tilt: 25 },
    arms: { shoulder: [2.0, 0.9, 0.1], upper: [0.6, 1.3, 0.6], pod: [0.7, 0.7, 2.2], drop: 1.4 },
    shoulderPods: { at: [1.6, 3.4, 0.2], size: [1.6, 1.3, 2.0], tubes: [3, 3] },
    torsoMounts: {},
    extras: [
      { kind: 'beam', part: 'sensors', a: [-0.4, 2.8, 1.0], b: [-0.5, 5.2, 1.4], w: 0.08 },
      { kind: 'beam', part: 'sensors', a: [0.4, 2.8, 1.0], b: [0.5, 4.6, 1.3], w: 0.06 },
      { kind: 'box', part: 'torso', at: [0, 0.6, 2.05], size: [2.4, 1.8, 0.2], color: 'dark' },
      { kind: 'box', part: 'torso', at: [0, 1.6, -2.25], size: [3.0, 0.15, 0.1], color: 'accent' },
    ],
  },

  goliath: {
    paint: { base: '#525a56', dark: '#2f3431', accent: '#b8962e', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'heavy', hipHeight: 6.8, hipWidth: 1.9, thigh: 3.9, shin: 4.0, thick: [1.3, 1.15], foot: [2.0, 0.6, 2.8], lift: 0.9 },
    pelvis: [3.6, 1.3, 2.2],
    torso: {
      pivot: 8.2, width: 5.0, taperTop: 0.85,
      profile: [[-2.6, -0.9], [-2.7, 1.8], [-2.0, 3.4], [1.6, 3.5], [2.4, 2.2], [2.4, -1.2], [-1.6, -1.4]],
    },
    canopy: { at: [0, 3.0, -2.25], size: [2.0, 0.35, 0.4], tilt: 15 },
    arms: { shoulder: [2.95, 1.6, 0], upper: [1.0, 1.6, 1.0], pod: [1.15, 1.1, 3.2], drop: 1.8 },
    shoulderPods: null,
    torsoMounts: { torsoL: [-1.4, 0.6, -2.78], torsoR: [1.4, 0.6, -2.78], torsoC: [0, 0.0, -2.75] },
    extras: [
      { kind: 'box', part: 'torso', at: [-1.2, 3.9, 1.6], size: [0.5, 1.2, 0.5], color: 'dark' },
      { kind: 'box', part: 'torso', at: [1.2, 3.9, 1.6], size: [0.5, 1.2, 0.5], color: 'dark' },
      { kind: 'box', part: 'torso', at: [0, -0.4, -2.8], size: [3.8, 0.5, 0.25], color: 'accent' },
      { kind: 'box', part: 'pelvis', at: [0, -0.6, -1.25], size: [3.0, 1.2, 0.25], color: 'base' },
      { kind: 'beam', part: 'sensors', a: [1.8, 3.4, 0.4], b: [2.0, 5.0, 0.8], w: 0.1 },
    ],
  },

  koloss: {
    paint: { base: '#5a5446', dark: '#33302a', accent: '#9e2f22', glass: GLASS, joint: JOINT, metal: METAL },
    legs: { style: 'heavy', hipHeight: 7.4, hipWidth: 2.2, thigh: 4.2, shin: 4.4, thick: [1.5, 1.35], foot: [2.3, 0.7, 3.1], lift: 0.85 },
    pelvis: [4.2, 1.5, 2.6],
    torso: {
      pivot: 9.0, width: 5.8, taperTop: 0.9,
      profile: [[-2.8, -1.0], [-2.9, 2.2], [-2.2, 3.2], [2.0, 3.3], [2.8, 2.0], [2.8, -1.3], [-1.8, -1.6]],
    },
    canopy: { at: [0, 4.6, -2.15], size: [1.8, 0.5, 0.4], tilt: 20 },
    arms: { shoulder: [3.3, 1.8, 0.1], upper: [1.1, 1.8, 1.1], pod: [1.3, 1.25, 3.6], drop: 2.0 },
    shoulderPods: { at: [2.0, 3.95, 0.6], size: [1.7, 1.4, 2.2], tubes: [3, 3] },
    torsoMounts: { torsoL: [-1.6, 0.5, -2.98], torsoR: [1.6, 0.5, -2.98] },
    extras: [
      // Commander's tower carrying the cockpit high above the hull
      { kind: 'box', part: 'torso', at: [0, 4.0, -1.0], size: [2.2, 1.6, 2.2], color: 'base' },
      { kind: 'box', part: 'torso', at: [0, 4.85, -1.0], size: [2.4, 0.15, 2.4], color: 'dark' },
      { kind: 'beam', part: 'sensors', a: [0.7, 4.9, -0.3], b: [0.9, 6.6, 0.1], w: 0.1 },
      { kind: 'box', part: 'sensors', at: [-0.6, 5.1, -0.6], size: [0.7, 0.35, 0.7], color: 'dark' },
      { kind: 'box', part: 'torso', at: [0, 1.0, 2.85], size: [4.4, 2.4, 0.2], color: 'dark' },
      { kind: 'box', part: 'torso', at: [0, 2.6, -2.6], size: [4.0, 0.2, 0.2], color: 'accent' },
      { kind: 'box', part: 'pelvis', at: [0, -0.7, -1.45], size: [3.6, 1.4, 0.3], color: 'base' },
    ],
  },
};

export function getWalkerModel(id) {
  const m = WALKER_MODELS[id] ?? ENEMY_MODELS[id];
  if (!m) throw new Error(`Unknown walker model "${id}"`);
  return m;
}
