/**
 * Cockpit variants: the physical shell around the pilot.
 * Coordinates in metres, pilot eye at the origin, -Z forward, +Y up, +X right.
 *
 * canopy     ring of wall/window segments around the eye. Angles in degrees,
 *            0 = forward, positive = right. The wall radius follows a profile:
 *            radiusLow below yLow, radiusHigh above yHigh, linear between —
 *            so window frames lean back. Window segments cut glass between
 *            their own sill and top heights.
 * panels     instrument surfaces. normal points toward the pilot, up is the
 *            direction of the panel's top edge (text "up"). Controls are placed
 *            on them via panelLayouts.js using normalised [u, v] (v = 0 at top).
 * blocks     axis-aligned boxes (min/max), optional rot [x, y, z] degrees
 * beams      boxes from a to b with width/height; up orients the width
 * cables     tube bundles through the given points
 * lighting   interior light presets: off/night/day follow the INNENLICHT knob,
 *            emergency is the red battery-independent light of a cold walker
 * clipboard  checklist board: resting position, tilt (degrees) after facing
 *            the pilot, and how far in front of the eyes it is held
 */
export const COCKPITS = {
  standard: {
    canopy: {
      floor: -1.15,
      roof: 0.56,
      radiusLow: 1.08,
      radiusHigh: 0.84,
      yLow: -0.32,
      yHigh: 0.46,
      wallStepDeg: 15,
      segments: [
        { from: -110, to: -64, window: { sill: -0.18, top: 0.26 } },
        { from: -64, to: -21, window: { sill: -0.27, top: 0.42 } },
        { from: -21, to: 21, window: { sill: -0.27, top: 0.44 } },
        { from: 21, to: 64, window: { sill: -0.27, top: 0.42 } },
        { from: 64, to: 110, window: { sill: -0.18, top: 0.26 } },
        { from: 110, to: 250, window: null },
      ],
      strut: 0.05,
      tint: '#a9c4bb',
      glassOpacity: 0.12,
    },

    colors: {
      wall: '#3a3f37',
      wallDark: '#262923',
      frame: '#22251f',
      panel: '#30342e',
      floor: '#1c1e1a',
      glare: '#141612',
      seat: '#463d33',
      strap: '#6e5d2c',
      metal: '#5d625a',
    },

    panels: {
      main: { center: [0, -0.52, -0.72], size: [1.25, 0.5], normal: [0, 0.42, 0.91], up: [0, 0.91, -0.42] },
      leftWing: { center: [-0.707, -0.52, -0.663], size: [0.2, 0.5], normal: [0.52, 0.42, 0.745], up: [-0.24, 0.91, -0.344] },
      rightWing: { center: [0.707, -0.52, -0.663], size: [0.2, 0.5], normal: [-0.52, 0.42, 0.745], up: [0.24, 0.91, -0.344] },
      glare: { center: [0, -0.2625, -0.783], size: [1.2, 0.062], normal: [0, 0, 1], up: [0, 1, 0] },
      overhead: { center: [0, 0.43, -0.32], size: [0.72, 0.34], normal: [0, -0.85, 0.5], up: [0, 0.5, 0.85] },
      leftConsole: { center: [-0.55, -0.615, -0.22], size: [0.26, 0.6], normal: [0.2, 0.98, 0], up: [0, 0, -1] },
      rightConsole: { center: [0.55, -0.615, -0.22], size: [0.26, 0.6], normal: [-0.2, 0.98, 0], up: [0, 0, -1] },
    },

    blocks: [
      // glareshield hood over the main panel
      { min: [-0.74, -0.3, -0.98], max: [0.74, -0.228, -0.79], color: 'glare' },
      // console pedestals and knee well
      { min: [-0.69, -1.15, -0.54], max: [-0.41, -0.65, 0.1], color: 'wall' },
      { min: [0.41, -1.15, -0.54], max: [0.69, -0.65, 0.1], color: 'wall' },
      { min: [-0.62, -1.15, -0.98], max: [0.62, -0.77, -0.62], color: 'wallDark' },
      // seat
      { min: [-0.18, -1.15, 0.0], max: [0.18, -0.86, 0.35], color: 'frame' },
      { min: [-0.26, -0.86, -0.08], max: [0.26, -0.76, 0.38], color: 'seat' },
      { min: [-0.25, -0.78, 0.38], max: [0.25, 0.08, 0.48], color: 'seat', rot: [-8, 0, 0] },
      { min: [-0.14, 0.1, 0.38], max: [0.14, 0.3, 0.47], color: 'seat' },
      { min: [-0.31, -0.86, -0.05], max: [-0.25, -0.64, 0.4], color: 'seat' },
      { min: [0.25, -0.86, -0.05], max: [0.31, -0.64, 0.4], color: 'seat' },
      { min: [-0.04, -0.77, 0.02], max: [0.04, -0.745, 0.08], color: 'metal' },
      // footrests
      { min: [-0.3, -1.12, -0.86], max: [-0.12, -1.04, -0.66], color: 'metal', rot: [20, 0, 0] },
      { min: [0.12, -1.12, -0.86], max: [0.3, -1.04, -0.66], color: 'metal', rot: [20, 0, 0] },
      // equipment racks behind the seat
      { min: [-0.72, -0.6, 0.55], max: [-0.36, 0.12, 0.88], color: 'frame' },
      { min: [0.36, -0.6, 0.55], max: [0.72, -0.05, 0.88], color: 'frame' },
      { min: [0.4, -0.02, 0.6], max: [0.66, 0.2, 0.84], color: 'wallDark' },
      // roof ribs and grab handle
      { min: [-0.66, 0.52, 0.12], max: [0.66, 0.56, 0.18], color: 'frame' },
      { min: [-0.62, 0.52, 0.5], max: [0.62, 0.56, 0.56], color: 'frame' },
      { min: [-0.2, 0.47, -0.7], max: [0.2, 0.5, -0.66], color: 'metal' },
    ],

    beams: [
      // harness: shoulder straps down the backrest to the buckle, lap belts across the seat
      { a: [-0.11, 0.06, 0.37], b: [-0.1, -0.72, 0.3], w: 0.045, h: 0.006, up: [0, 0, 1], color: 'strap' },
      { a: [0.11, 0.06, 0.37], b: [0.1, -0.72, 0.3], w: 0.045, h: 0.006, up: [0, 0, 1], color: 'strap' },
      { a: [-0.1, -0.74, 0.3], b: [-0.02, -0.75, 0.05], w: 0.045, h: 0.006, up: [0, 1, 0], color: 'strap' },
      { a: [0.1, -0.74, 0.3], b: [0.02, -0.75, 0.05], w: 0.045, h: 0.006, up: [0, 1, 0], color: 'strap' },
      { a: [-0.25, -0.75, 0.22], b: [-0.04, -0.75, 0.05], w: 0.05, h: 0.006, up: [0, 1, 0], color: 'strap' },
      { a: [0.25, -0.75, 0.22], b: [0.04, -0.75, 0.05], w: 0.05, h: 0.006, up: [0, 1, 0], color: 'strap' },
    ],

    cables: [
      { r: 0.022, color: '#1b1b1a', points: [[-0.45, -0.78, -0.62], [-0.52, -1.08, -0.45], [-0.62, -1.12, 0.2], [-0.5, -0.9, 0.62]] },
      { r: 0.016, color: '#5a2219', points: [[-0.4, -0.8, -0.63], [-0.47, -1.1, -0.4], [-0.56, -1.13, 0.25], [-0.42, -0.95, 0.62]] },
      { r: 0.02, color: '#1b1b1a', points: [[0.45, -0.78, -0.62], [0.52, -1.08, -0.45], [0.62, -1.12, 0.2], [0.5, -0.92, 0.62]] },
      { r: 0.018, color: '#3b402b', points: [[0.3, 0.53, 0.05], [0.36, 0.54, 0.3], [0.45, 0.5, 0.55], [0.55, 0.3, 0.72]] },
      { r: 0.014, color: '#5a2219', points: [[-0.3, 0.53, 0.05], [-0.36, 0.54, 0.3], [-0.46, 0.48, 0.55], [-0.54, 0.2, 0.64]] },
    ],

    lighting: {
      off: { ambient: 0.12, ambientColor: '#55606a', flood: 0, floodColor: '#ffb060', sun: 0.35 },
      night: { ambient: 0.22, ambientColor: '#5a6070', flood: 0.55, floodColor: '#ff9a3a', sun: 0.25 },
      day: { ambient: 0.75, ambientColor: '#c6cabd', flood: 0.35, floodColor: '#ffd49a', sun: 0.45 },
      emergency: { ambient: 0.14, ambientColor: '#6a1d14', flood: 0.3, floodColor: '#ff3418', sun: 0.35 },
    },

    clipboard: { position: [-0.86, -0.3, -0.24], tilt: [-8, 0, 3], heldDistance: 0.36 },
  },
};


// ---- Shared interior parts for the other variants ----

const LIGHTING = COCKPITS.standard.lighting;
const COLORS = COCKPITS.standard.colors;

/** Seat, harness and footrests; `floor` moves floor-standing parts. */
function seatAndHarness(floor) {
  return {
    blocks: [
      { min: [-0.18, floor, 0.0], max: [0.18, -0.86, 0.35], color: 'frame' },
      { min: [-0.26, -0.86, -0.08], max: [0.26, -0.76, 0.38], color: 'seat' },
      { min: [-0.25, -0.78, 0.38], max: [0.25, 0.08, 0.48], color: 'seat', rot: [-8, 0, 0] },
      { min: [-0.14, 0.1, 0.38], max: [0.14, 0.3, 0.47], color: 'seat' },
      { min: [-0.31, -0.86, -0.05], max: [-0.25, -0.64, 0.4], color: 'seat' },
      { min: [0.25, -0.86, -0.05], max: [0.31, -0.64, 0.4], color: 'seat' },
      { min: [-0.04, -0.77, 0.02], max: [0.04, -0.745, 0.08], color: 'metal' },
      { min: [-0.3, floor + 0.03, -0.86], max: [-0.12, floor + 0.11, -0.66], color: 'metal', rot: [20, 0, 0] },
      { min: [0.12, floor + 0.03, -0.86], max: [0.3, floor + 0.11, -0.66], color: 'metal', rot: [20, 0, 0] },
    ],
    beams: COCKPITS.standard.beams,
  };
}

/** Console pedestal pair for consoles at ±x between z0 and z1. */
function pedestals(x0, x1, floor, top, z0, z1) {
  return [
    { min: [-x1, floor, z0], max: [-x0, top, z1], color: 'wall' },
    { min: [x0, floor, z0], max: [x1, top, z1], color: 'wall' },
  ];
}

/** Light walkers: tight bubble canopy with a wide field of view, few instruments. */
const compactSeat = seatAndHarness(-1.05);
COCKPITS.compact = {
  canopy: {
    floor: -1.05, roof: 0.48, radiusLow: 0.95, radiusHigh: 0.72, yLow: -0.3, yHigh: 0.42, wallStepDeg: 15,
    segments: [
      { from: -130, to: -75, window: { sill: -0.35, top: 0.34 } },
      { from: -75, to: -25, window: { sill: -0.28, top: 0.42 } },
      { from: -25, to: 25, window: { sill: -0.28, top: 0.42 } },
      { from: 25, to: 75, window: { sill: -0.28, top: 0.42 } },
      { from: 75, to: 130, window: { sill: -0.35, top: 0.34 } },
      { from: 130, to: 230, window: null },
    ],
    strut: 0.035, tint: '#b4c8bd', glassOpacity: 0.1,
  },
  colors: { ...COLORS, wall: '#41443b', panel: '#33362f' },
  panels: {
    main: { center: [0, -0.5, -0.64], size: [1.0, 0.44], normal: [0, 0.42, 0.91], up: [0, 0.91, -0.42] },
    leftWing: { center: [-0.574, -0.5, -0.588], size: [0.18, 0.44], normal: [0.52, 0.42, 0.745], up: [-0.24, 0.91, -0.344] },
    rightWing: { center: [0.574, -0.5, -0.588], size: [0.18, 0.44], normal: [-0.52, 0.42, 0.745], up: [0.24, 0.91, -0.344] },
    glare: { center: [0, -0.2625, -0.705], size: [0.95, 0.055], normal: [0, 0, 1], up: [0, 1, 0] },
    overhead: { center: [0, 0.37, -0.3], size: [0.64, 0.3], normal: [0, -0.85, 0.5], up: [0, 0.5, 0.85] },
    leftConsole: { center: [-0.47, -0.6, -0.2], size: [0.22, 0.55], normal: [0.2, 0.98, 0], up: [0, 0, -1] },
    rightConsole: { center: [0.47, -0.6, -0.2], size: [0.22, 0.55], normal: [-0.2, 0.98, 0], up: [0, 0, -1] },
  },
  blocks: [
    { min: [-0.6, -0.29, -0.84], max: [0.6, -0.235, -0.71], color: 'glare' },
    ...pedestals(0.36, 0.58, -1.05, -0.63, -0.48, 0.08),
    { min: [-0.5, -1.05, -0.84], max: [0.5, -0.74, -0.55], color: 'wallDark' },
    ...compactSeat.blocks,
    { min: [-0.6, -0.55, 0.5], max: [-0.32, 0.05, 0.78], color: 'frame' },
    { min: [-0.55, 0.45, 0.1], max: [0.55, 0.48, 0.15], color: 'frame' },
  ],
  beams: compactSeat.beams,
  cables: [
    { r: 0.018, color: '#1b1b1a', points: [[-0.38, -0.72, -0.55], [-0.45, -1.0, -0.4], [-0.52, -1.02, 0.2], [-0.42, -0.85, 0.55]] },
    { r: 0.016, color: '#5a2219', points: [[0.38, -0.72, -0.55], [0.45, -1.0, -0.4], [0.52, -1.02, 0.2], [0.42, -0.85, 0.55]] },
  ],
  lighting: LIGHTING,
  clipboard: { position: [-0.74, -0.27, -0.22], tilt: [-8, 0, 3], heldDistance: 0.34 },
};

/** Heavy and assault walkers: wide consoles, extra monitors, armoured vision slits. */
const heavySeat = seatAndHarness(-1.2);
COCKPITS.heavy = {
  canopy: {
    floor: -1.2, roof: 0.62, radiusLow: 1.25, radiusHigh: 1.02, yLow: -0.2, yHigh: 0.26, wallStepDeg: 15,
    segments: [
      { from: -75, to: -48, window: { sill: -0.02, top: 0.13 } },
      { from: -48, to: -40, window: null },
      { from: -40, to: -12, window: { sill: -0.1, top: 0.2 } },
      { from: -12, to: 12, window: { sill: -0.12, top: 0.22 } },
      { from: 12, to: 40, window: { sill: -0.1, top: 0.2 } },
      { from: 40, to: 48, window: null },
      { from: 48, to: 75, window: { sill: -0.02, top: 0.13 } },
      { from: 75, to: 285, window: null },
    ],
    strut: 0.09, tint: '#93ada5', glassOpacity: 0.16,
  },
  colors: { ...COLORS, wall: '#363a34', panel: '#2b2f2a' },
  panels: {
    main: { center: [0, -0.55, -0.82], size: [1.5, 0.52], normal: [0, 0.42, 0.91], up: [0, 0.91, -0.42] },
    leftWing: { center: [-0.857, -0.55, -0.745], size: [0.26, 0.52], normal: [0.52, 0.42, 0.745], up: [-0.24, 0.91, -0.344] },
    rightWing: { center: [0.857, -0.55, -0.745], size: [0.26, 0.52], normal: [-0.52, 0.42, 0.745], up: [0.24, 0.91, -0.344] },
    glare: { center: [0, -0.285, -0.895], size: [1.4, 0.07], normal: [0, 0, 1], up: [0, 1, 0] },
    overhead: { center: [0, 0.48, -0.36], size: [0.8, 0.36], normal: [0, -0.85, 0.5], up: [0, 0.5, 0.85] },
    leftConsole: { center: [-0.64, -0.63, -0.25], size: [0.32, 0.65], normal: [0.2, 0.98, 0], up: [0, 0, -1] },
    rightConsole: { center: [0.64, -0.63, -0.25], size: [0.32, 0.65], normal: [-0.2, 0.98, 0], up: [0, 0, -1] },
  },
  blocks: [
    { min: [-0.9, -0.33, -1.12], max: [0.9, -0.24, -0.9], color: 'glare' },
    ...pedestals(0.48, 0.8, -1.2, -0.67, -0.58, 0.1),
    { min: [-0.75, -1.2, -1.12], max: [0.75, -0.81, -0.72], color: 'wallDark' },
    ...heavySeat.blocks,
    { min: [-0.85, -0.65, 0.6], max: [-0.45, 0.2, 0.95], color: 'frame' },
    { min: [0.45, -0.65, 0.6], max: [0.85, 0.05, 0.95], color: 'frame' },
    // Armour around the vision slits
    { min: [-0.85, 0.24, -1.1], max: [0.85, 0.34, -0.92], color: 'wallDark' },
    { min: [-0.78, 0.58, 0.12], max: [0.78, 0.62, 0.2], color: 'frame' },
    { min: [-0.24, 0.52, -0.95], max: [0.24, 0.56, -0.9], color: 'metal' },
  ],
  beams: heavySeat.beams,
  cables: [
    ...COCKPITS.standard.cables,
    { r: 0.026, color: '#1b1b1a', points: [[0.0, 0.58, -0.6], [0.3, 0.6, 0.0], [0.6, 0.45, 0.6], [0.7, 0.0, 0.85]] },
  ],
  lighting: LIGHTING,
  clipboard: { position: [-1.02, -0.26, -0.32], tilt: [-8, 0, 3], heldDistance: 0.38 },
};

export function getCockpitVariant(id) {
  const variant = COCKPITS[id];
  if (!variant) throw new Error(`Unknown cockpit variant "${id}"`);
  return variant;
}
