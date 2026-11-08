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
    contactShadows: true, // dark blob under walkers (Optionen → Grafik)
    effects: 1, // particle share (Optionen → Grafik)
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

  // Mission area fence (holographic band at the border)
  area: { height: 22, step: 12, color: '#5fe0c8', showDist: 200 },

  // Scatter objects and buildings
  scatter: {
    nearDistance: 200, // full models up to here, simple stand-ins beyond
    viewDistance: 560,
    capacity: 2500, // instances per model and detail level
    structureDistance: 1100,
    densityScale: 1, // Optionen → Grafik → Objektdichte
  },

  // Startup procedure. mode: 'full' (every switch yourself), 'simple'
  // (battery → reactor → systems → weapons → legs, the rest runs by itself)
  // or 'auto' (Shift+S runs the whole procedure). URL: ?start=hot skips it,
  // ?startmode=simple|auto|full overrides the mode.
  startup: {
    mode: 'full',
    randomEvents: false, // pump 2 fails on the first try (switch KÜHLPUMPEN off and on), gyro needs two runs
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
    turnStepRadius: 2.5, // m — turning on the spot steps like walking this fast per rad/s
    // Mass (walker tonnage, walkers.js) — 0.5.0 phase 2, docs/MOTION-0.5.0.md
    massRef: 50, // t: a walker of this mass uses the base values above
    springMassRange: [0.4, 2.5], // clamp of massRef / tonnage for the torso springs
    turnLagBase: 0.06, // s: the legs reach their turn rate with this time constant …
    turnLagPerTon: 0.0045, // … plus this per tonne (KESTREL ≈ 0.17 s, KOLOSS ≈ 0.51 s)
    brakeMassExp: 0.2, // braking × (massRef / tonnage)^exp: heavy walkers carry their momentum longer
    // Stability (MachineCondition.movementStability: legs, hydraulics, gyro) — 1 = calm
    unrestSway: 1.0, // roll sway × (1 + this × (1 − stability))
    unrestKick: 0.8, // footfall head kick × (1 + this × (1 − stability))
    unrestDamping: 0.45, // torso spring damping × (1 − this × (1 − stability)): wobbles longer
    limpRoll: 2.2, // degrees of lean toward the damaged side per step at full limp
    // Recoil of the player's weapons: pitch impulse = recoil × weight × type / tonnage / max(1, fireRate)
    recoil: 2.0,
    recoilType: { ballistic: 1, energy: 0.35, missile: 0.25, universal: 0.35 },
    recoilGyroDamping: 0.6, // share of the recoil the stabilisation (gyro) takes out
    // Stabiliser against sustained fire (WalkerMotion.updateRecoil): follows the mean recoil with
    // recoilCompTime while shots come closer than recoilHoldGap, runs down with recoilReleaseTime
    recoilCompTime: 1.0,
    recoilHoldGap: 0.25,
    recoilReleaseTime: 0.1,
  },

  // Torso-mounted searchlight (SCHEINWERFER switch).
  floodlight: {
    color: '#fff2d8',
    intensity: 60,
    distance: 260,
    angle: 22, // degrees, half cone
    penumbra: 0.45,
    decay: 1,
    mountOffset: [0, -1.6, -1.2], // relative to the eye, torso frame
  },

  // Cockpit reactions to hits on the player (strengths, durations in s).
  hitFeedback: {
    shieldFlash: { intensity: 6, time: 0.6, color: '#6fc4ff', glassTint: 0.6 },
    shake: { perDamage: 0.006, tonnageRef: 50, maxOffset: 0.09, maxAngle: 4, stiffness: 120, damping: 9 },
    sparks: { count: 18, minDamage: 6 },
    monitorFlicker: 0.35,
    monitorFailChance: 0.18, // per armour hit on the torso above minDamage
    monitorFailMinDamage: 20,
    cracksPerHeavyHit: 2, // canopy cracks added per torso hit while the torso is 'heavy'
    maxCracks: 14,
    smoke: { fogNear: 0.4, fogFarClear: 30, fogFarHeavy: 2.2, color: '#5d5a52', particles: 3, buildTime: 6 }, // heavy torso damage
    critical: { torsoInternal: 0.5, lightColor: '#ff2a1a', lightIntensity: 2.2, pulseHz: 1.2 }, // reactor below this share = critical
    criticalRadioCooldown: 20,
    debug: { minDamage: 12, maxDamage: 45, heavyDamage: 90 }, // F8 random hit, Shift+F8 heavy hit (sides in turn)
    enemyLock: { lockTime: 3.5, weapon: 'habicht-8', missileDamage: 35 }, // F9: nearest enemy locks on, then fires one missile
  },

  missileCam: {
    resolution: [160, 120],
    fov: 50,
    hz: 15,
    staticTime: 0.6, // white noise after impact
    steerSensitivity: 1.6, // mouse → missile turn
  },

  // Debug free camera (debug mode, Shift+F4).
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
