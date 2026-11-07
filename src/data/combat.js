/**
 * Combat tuning that is not per weapon or per walker.
 */
export const COMBAT = {
  // Component stages by remaining share of armour + internal structure
  stages: [
    { id: 'intact', label: 'INTAKT', min: 0.8 },
    { id: 'light', label: 'LEICHT', min: 0.55 },
    { id: 'medium', label: 'MITTEL', min: 0.3 },
    { id: 'heavy', label: 'SCHWER', min: 0.0001 },
    { id: 'destroyed', label: 'ZERSTÖRT', min: -Infinity },
  ],
  internalShare: 0.5, // internal structure = 50 % of the armour (torso: the reactor value)
  sideAngle: 45, // ± degrees counted as front / rear

  shields: {
    regenDelay: 1.2, // s after a hit on any side before shields recharge
    shiftStep: 0.1, // front share change per key press
    shiftSteps: 2, // ± steps from the walker's design split
    minShare: 0.25,
    maxShare: 0.85,
    offDecay: 2.5, // s until shields are empty after switching off
  },

  energy: {
    capacitorPerOutput: 0.3, // weapon capacitor size = reactorOutput × this
    chargePerOutput: 0.22, // charge/s = reactorOutput × reactor power × weapons share × this
  },

  heat: {
    degPerUnit: 5.5, // °C core temperature per heat unit at heatCapacity 100 (scales with √(100 / heatCapacity))
    referenceCapacity: 100,
    referenceDissipation: 7, // walker heatDissipation 7 = cooling as in the startup model
    barrelDecay: 0.6, // per-weapon heat display falls by this share per second
  },

  sequenceGap: 0.18, // s between two weapons of a 'sequence' chain
  blockedRadioCooldown: 6,

  consequences: {
    legsHeavySpeed: 0.6, // max speed factor with legs in stage 'heavy'
    sensorRange: [1, 0.85, 0.6, 0.35, 0.1], // radar range factor per sensors stage
    kneelDrop: 0.42, // share of hip height the walker sinks when the legs are destroyed
    kneelPitch: 9, // degrees nose-down
  },

  targeting: {
    coneDeg: 32, // half angle of the torso cone for locking
    keepConeDeg: 45, // lock is kept while inside this angle
    maxRange: 1600,
    podConvergeDeg: 8, // target pod: projectile weapons converge on the component when the crosshair is this close
    trackingManualPause: 0.6, // ZIELNACHF. pauses this long after manual aiming
    podRadioCooldown: 8,
    hiddenGrace: 1.5, // a locked target out of sight is dropped after this many seconds
  },

  explosion: { radius: 14, radiusPerTon: 0.3, damage: 30, damagePerTon: 1.1 }, // reactor explosion: radius/damage + per ton of the exploding walker
  synthGlowFade: 25, // s until the veins of a Synthesis wreck are dark
  salvage: { reactor: 0.1, legs: 1.0, weaponMount: 1.0 },
};

export function stageIndex(fraction) {
  const st = COMBAT.stages;
  for (let i = 0; i < st.length; i++) if (fraction >= st[i].min) return i;
  return st.length - 1;
}
