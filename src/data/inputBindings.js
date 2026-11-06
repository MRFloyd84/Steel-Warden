/**
 * Default input mapping. Users can override any section via localStorage key
 * "steelwarden:bindings" (a rebinding UI follows in the polish phase).
 *
 * keys:         action -> list of KeyboardEvent.code values
 * mouseButtons: action -> list of MouseEvent.button values (0 left, 1 middle, 2 right)
 * keyAxes:      composite axis -> [positive action, negative action]
 * gamepad:      axis/button indices follow the "standard" Gamepad mapping;
 *               HOTAS devices usually report other indices, hence remappable.
 *               Axis action "throttleAbs" maps an absolute throttle lever
 *               (-1 = full reverse, +1 = full ahead); "throttle" is a rate axis.
 *
 * In free look the mouse moves the cockpit cursor; "interact" (left mouse,
 * F, pad A) operates the control under it, the wheel turns knobs.
 */
export const DEFAULT_BINDINGS = {
  keys: {
    throttleUp: ['KeyW', 'ArrowUp'],
    throttleDown: ['KeyS', 'ArrowDown'],
    throttleStop: ['KeyX'],
    turnLeft: ['KeyA', 'ArrowLeft'],
    turnRight: ['KeyD', 'ArrowRight'],
    centerTorso: ['KeyE'],
    freeLookToggle: ['KeyV'],
    interact: ['KeyF'],
    checklist: ['KeyC'],
    fireGroup1: ['Digit1'],
    fireGroup2: ['Digit2'],
    fireGroup3: ['Digit3'],
    fireGroup4: ['Digit4'],
    nextChain: ['KeyR'],
    fireAll: ['KeyG'],
    targetSelect: ['KeyT'],
    shieldFront: ['Period'],
    shieldRear: ['Comma'],
    missileGuidance: ['KeyB'],
    targetTracking: ['KeyH'],
    missileCamera: ['KeyM'],
    targetComponent: ['Tab'],
    debugHit: ['F8'],
    debugEnemyLock: ['F9'],
    cockpitLight: ['KeyN'],
    moveUp: ['Space'],
    moveDown: ['KeyQ'],
    boost: ['ShiftLeft', 'ShiftRight'],
    toggleHints: ['F1'],
    toggleDebug: ['F3'],
    toggleWireframe: ['F4'],
    debugFreeCam: ['F7'],
    externalView: ['KeyK'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter'],
  },

  // Key + modifier combinations (checked with InputManager.comboPressed).
  combos: {
    autoStart: { key: 'KeyS', shift: true },
    targetCycle: { key: 'KeyT', shift: true },
    debugHitHeavy: { key: 'F8', shift: true },
    debugEmitting: { key: 'F9', shift: true },
  },

  mouseButtons: {
    interact: [0],
    fire: [0],
    freeLookHold: [2],
  },

  keyAxes: {
    throttle: ['throttleUp', 'throttleDown'],
    turn: ['turnRight', 'turnLeft'],
    // Debug free camera reuses the driving keys.
    move: ['throttleUp', 'throttleDown'],
    strafe: ['turnRight', 'turnLeft'],
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
      { axis: 0, action: 'turn', invert: false },
      { axis: 1, action: 'throttle', invert: true },
      { axis: 2, action: 'lookX', invert: false },
      { axis: 3, action: 'lookY', invert: false },
    ],
    buttons: {
      throttleStop: [1],
      centerTorso: [2],
      freeLookHold: [11],
      interact: [0],
      fire: [7],
      nextChain: [6],
      cockpitLight: [3],
      boost: [10],
      moveUp: [5],
      moveDown: [4],
      toggleDebug: [8],
      pause: [9],
      confirm: [0],
    },
  },
};

/** German labels for the controls screen (actions without a label are hidden). */
export const ACTION_LABELS = {
  throttleUp: 'Schub erhöhen',
  throttleDown: 'Schub verringern',
  throttleStop: 'Schub auf Null',
  turnLeft: 'Beine links drehen',
  turnRight: 'Beine rechts drehen',
  centerTorso: 'Torso zentrieren',
  freeLookToggle: 'Freier Blick (umschalten)',
  interact: 'Bedienen (im freien Blick)',
  checklist: 'Checkliste holen/weglegen',
  fireGroup1: 'Waffengruppe 1 feuern',
  fireGroup2: 'Waffengruppe 2 feuern',
  fireGroup3: 'Waffengruppe 3 feuern',
  fireGroup4: 'Waffengruppe 4 feuern',
  nextChain: 'Nächste Feuerkette',
  fireAll: 'Notfallkette: alle Waffen',
  targetSelect: 'Ziel aufschalten (Shift: durchschalten)',
  shieldFront: 'Schildenergie nach vorn',
  shieldRear: 'Schildenergie nach hinten',
  missileGuidance: 'Lenkart wechseln',
  targetTracking: 'Zielnachführung ein/aus',
  missileCamera: 'Monitor: Raketenkamera',
  targetComponent: 'Zielkomponente (Zielkapsel)',
  debugHit: 'Debug: Treffer auf mich (Shift: schwer)',
  debugEnemyLock: 'Debug: feindl. Aufschaltung (Shift: Ziel strahlt)',
  cockpitLight: 'Innenlicht Tag/Nacht',
  toggleHints: 'Tastenhilfe',
  toggleDebug: 'Debug-Overlay',
  toggleWireframe: 'Drahtgitter',
  debugFreeCam: 'Debug-Freiflug',
  externalView: 'Außenkamera',
  pause: 'Pause',
  confirm: 'Bestätigen',
};
