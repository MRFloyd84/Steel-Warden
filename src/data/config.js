/**
 * Global engine settings and motion feel. Tune freely — walker balance
 * values live in walkers.js, this file only shapes how things feel.
 */
export const CONFIG = {
  sim: {
    fixedStep: 1 / 60,
    maxStepsPerFrame: 5,
  },

  render: {
    // < 1 renders fewer pixels and upscales with hard edges (period look + speed).
    renderScale: 0.75,
    fov: 72,
    near: 0.5,
    far: 4000,
    antialias: false,
  },

  terrain: {
    chunkSize: 160, // metres per chunk edge
    // Segments per chunk edge for each LOD; LOD0 spacing = chunkSize / 40 = 4 m.
    lodSegments: [40, 20, 10],
    // Chebyshev ring distance (in chunks) up to which each LOD is used.
    lodRings: [1, 3],
    viewRadius: 6, // chunks around the camera
    buildsPerFrame: 3,
    skirtDepth: 14, // hides cracks between neighbouring LODs
  },

  cockpit: {
    near: 0.02, // separate render pass, so the world keeps its depth precision
    far: 30,
    monitorHz: 15, // CRT redraw rate (staggered across monitors)
    panelPixelsPerMetre: 1000,
  },

  view: {
    neutralPitch: -7, // degrees; resting head angle shows more of the panel
    freeLookYaw: 135,
    freeLookPitchUp: 75,
    freeLookPitchDown: 60,
    recenterRate: 7,
  },

  feel: {
    throttleRate: 0.55, // lever travel per second while a key is held
    brakeFactor: 1.6, // deceleration relative to walker acceleration
    turnAtSpeed: 0.7, // turn rate multiplier at full speed
    strideBase: 3, // metres per step = strideBase + tonnage * stridePerTon
    stridePerTon: 0.04,
    bobBase: 0.04, // vertical bob amplitude in metres
    bobPerTon: 0.0012,
    swayPerTon: 0.012, // roll sway in degrees per tonne
    footfallKick: 0.006, // head drop impulse per tonne (m/s)
    brakePitch: 0.012, // torso pitch in radians per m/s² of acceleration
    turnRoll: 0.06, // lean in radians at full turn rate and speed
    pitchSpring: { stiffness: 22, damping: 3.2 }, // underdamped: settles with a wobble
    headSpring: { stiffness: 160, damping: 13 },
    uphillDrag: 1.6, // speed loss per unit of grade
    downhillBoost: 0.4,
    maxGrade: 1.1, // steeper than this blocks movement
  },

  // Debug free camera (F7).
  testRig: {
    eyeHeight: 9,
    groundSpeed: 14,
    flySpeed: 60,
    boostFactor: 4,
    responsiveness: 4,
    minFlyClearance: 2,
  },

  debug: {
    refreshMs: 250,
  },
};
