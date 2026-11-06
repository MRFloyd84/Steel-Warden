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

export function getCockpitVariant(id) {
  const variant = COCKPITS[id];
  if (!variant) throw new Error(`Unknown cockpit variant "${id}"`);
  return variant;
}
