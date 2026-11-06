/**
 * Default input mapping. Users can override any section via localStorage key
 * "steelwarden:bindings" (a rebinding UI follows in phase 10).
 *
 * keys:      action -> list of KeyboardEvent.code values
 * keyAxes:   composite axis -> [positive action, negative action]
 * gamepad:   axis/button indices follow the "standard" Gamepad mapping;
 *            HOTAS devices usually report non-standard indices, hence remappable.
 */
export const DEFAULT_BINDINGS = {
  keys: {
    moveForward: ['KeyW', 'ArrowUp'],
    moveBack: ['KeyS', 'ArrowDown'],
    strafeLeft: ['KeyA', 'ArrowLeft'],
    strafeRight: ['KeyD', 'ArrowRight'],
    moveUp: ['Space'],
    moveDown: ['KeyC'],
    boost: ['ShiftLeft', 'ShiftRight'],
    toggleFly: ['KeyF'],
    toggleDebug: ['F3'],
    toggleWireframe: ['F4'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter'],
  },

  keyAxes: {
    move: ['moveForward', 'moveBack'],
    strafe: ['strafeRight', 'strafeLeft'],
    vertical: ['moveUp', 'moveDown'],
  },

  mouse: {
    sensitivity: 0.0022, // radians per pixel
    invertY: false,
  },

  gamepad: {
    deadzone: 0.15,
    lookSpeed: 2.2, // radians per second at full deflection
    axes: [
      { axis: 0, action: 'strafe', invert: false },
      { axis: 1, action: 'move', invert: true },
      { axis: 2, action: 'lookX', invert: false },
      { axis: 3, action: 'lookY', invert: false },
    ],
    buttons: {
      boost: [10],
      moveUp: [5],
      moveDown: [4],
      toggleFly: [3],
      toggleDebug: [8],
      pause: [9],
      confirm: [0],
    },
  },
};

/** German labels for the controls screen. */
export const ACTION_LABELS = {
  moveForward: 'Vorwärts',
  moveBack: 'Rückwärts',
  strafeLeft: 'Seitwärts links',
  strafeRight: 'Seitwärts rechts',
  moveUp: 'Steigen (Flugmodus)',
  moveDown: 'Sinken (Flugmodus)',
  boost: 'Schnell',
  toggleFly: 'Boden-/Flugmodus',
  toggleDebug: 'Debug-Overlay',
  toggleWireframe: 'Drahtgitter',
  pause: 'Pause',
  confirm: 'Bestätigen',
};
