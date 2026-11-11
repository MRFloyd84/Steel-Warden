/**
 * Central register of every input action.
 *
 *   id        what game code asks for: input.action('fireChain')
 *   label     German text for the controls screen and the in-game help
 *   category  group in the controls screen
 *   contexts  where the action is live (see CONTEXTS); 'global' = everywhere
 *   type      press  — once per key press (OS key repeat is ignored)
 *             hold   — true while held
 *             toggle — once per press, the game flips a state
 *   keys      default keyboard/mouse bindings, max. two slots. Tokens:
 *             KeyboardEvent.code ('KeyW', 'Digit1', 'Tab' …), mouse buttons
 *             ('Mouse0' left, 'Mouse1' middle, 'Mouse2' right), optional
 *             'Shift+' prefix. A Shift combination wins over the plain key
 *             in the same context (Shift+S does not also brake).
 *   pad       default gamepad buttons (standard mapping indices)
 *   help      shown in the short in-game help (H)
 *   intro     one of the eight keys shown at the start of the first mission
 *
 * No other module listens to keys: everything goes through these actions.
 * Pure data (no DOM) so tools/gen-controls.mjs can read it in Node.
 */

/** Contexts: the mission puts one of them on top, 'debug' is an extra layer. */
export const CONTEXTS = {
  combat: 'Kampf (Cockpit, normaler Blick)',
  freeLook: 'Freier Blick (Schalter bedienen)',
  missileCam: 'Raketenkamera (optische Rakete)',
  external: 'Außenkamera',
  menu: 'Menü (Funkmenü, Pause, Hauptmenü)',
  freeCam: 'Debug-Freiflug',
  debug: 'Debug-Modus (Zusatzschicht)',
};

export const CATEGORIES = {
  movement: 'Bewegung',
  weapons: 'Waffen',
  target: 'Ziel',
  systems: 'Systeme',
  view: 'Sicht und Bedienung',
  comms: 'Kommunikation',
  menu: 'Menü',
  debug: 'Debug',
};

const DRIVE = ['combat', 'freeLook', 'missileCam', 'external'];
const FIGHT = ['combat', 'missileCam', 'external'];
const AIMED = ['combat', 'external'];

export const ACTIONS = [
  // ---- movement ----
  { id: 'throttleUp', label: 'Schub erhöhen', category: 'movement', contexts: DRIVE, type: 'hold', keys: ['KeyW', 'ArrowUp'], help: true, intro: true },
  { id: 'throttleDown', label: 'Schub verringern', category: 'movement', contexts: DRIVE, type: 'hold', keys: ['KeyS', 'ArrowDown'], help: true },
  { id: 'throttleStop', label: 'Schub auf Null', category: 'movement', contexts: DRIVE, type: 'press', keys: ['KeyX'], pad: [1], help: true },
  { id: 'turnLeft', label: 'Beine links drehen', category: 'movement', contexts: DRIVE, type: 'hold', keys: ['KeyA', 'ArrowLeft'], help: true, intro: true },
  { id: 'turnRight', label: 'Beine rechts drehen', category: 'movement', contexts: DRIVE, type: 'hold', keys: ['KeyD', 'ArrowRight'], help: true },
  { id: 'centerTorso', label: 'Torso zentrieren', category: 'movement', contexts: AIMED, type: 'press', keys: ['KeyC'], pad: [0], help: true },
  { id: 'alignLegs', label: 'Beine auf Torsorichtung ausrichten', category: 'movement', contexts: AIMED, type: 'press', keys: ['Shift+KeyC'], help: true },
  { id: 'jumpJets', label: 'Sprungdüsen (nur wenn vorhanden)', category: 'movement', contexts: AIMED, type: 'hold', keys: ['Space'] },

  // ---- weapons ----
  { id: 'fireChain', label: 'Aktive Feuerkette feuern', category: 'weapons', contexts: FIGHT, type: 'hold', keys: ['Mouse0'], pad: [7], help: true, intro: true },
  { id: 'fireSecondary', label: 'Zweite Kette feuern (Raketen)', category: 'weapons', contexts: FIGHT, type: 'hold', keys: ['Mouse2'], pad: [6], help: true, intro: true },
  { id: 'fireAll', label: 'Notfallkette: alle Waffen', category: 'weapons', contexts: FIGHT, type: 'hold', keys: ['Shift+Mouse0'], help: true },
  { id: 'chain1', label: 'Feuerkette 1 wählen', category: 'weapons', contexts: AIMED, type: 'press', keys: ['Digit1'], help: true },
  { id: 'chain2', label: 'Feuerkette 2 wählen', category: 'weapons', contexts: AIMED, type: 'press', keys: ['Digit2'] },
  { id: 'chain3', label: 'Feuerkette 3 wählen', category: 'weapons', contexts: AIMED, type: 'press', keys: ['Digit3'] },
  { id: 'chain4', label: 'Feuerkette 4 wählen', category: 'weapons', contexts: AIMED, type: 'press', keys: ['Digit4'] },
  { id: 'chainPrev', label: 'Vorige Feuerkette', category: 'weapons', contexts: AIMED, type: 'press', pad: [12] },
  { id: 'chainNext', label: 'Nächste Feuerkette', category: 'weapons', contexts: AIMED, type: 'press', pad: [13] },

  // ---- target ----
  { id: 'targetSelect', label: 'Ziel unter Fadenkreuz bzw. nächstes', category: 'target', contexts: AIMED, type: 'press', keys: ['KeyT'], pad: [5], help: true, intro: true },
  { id: 'targetCycle', label: 'Ziele durchschalten', category: 'target', contexts: AIMED, type: 'press', keys: ['Shift+KeyT'], help: true },
  { id: 'targetComponent', label: 'Komponente am Ziel (Zielkapsel)', category: 'target', contexts: ['combat'], type: 'press', keys: ['Tab'], help: true },
  { id: 'targetTracking', label: 'Zielnachführung an/aus', category: 'target', contexts: ['combat'], type: 'toggle', keys: ['KeyG'], pad: [2], help: true },
  { id: 'missileGuidance', label: 'Lenkart durchschalten', category: 'target', contexts: ['combat'], type: 'press', keys: ['KeyL'], help: true },
  { id: 'missileCamera', label: 'Raketenkamera (zuschauen)', category: 'target', contexts: ['combat', 'external'], type: 'toggle', keys: ['KeyM'], help: true },

  // ---- systems ----
  { id: 'shieldFront', label: 'Schildenergie nach vorn', category: 'systems', contexts: ['combat', 'missileCam'], type: 'press', keys: ['KeyQ'], pad: [14], help: true },
  { id: 'shieldRear', label: 'Schildenergie nach hinten', category: 'systems', contexts: ['combat', 'missileCam'], type: 'press', keys: ['KeyE'], pad: [15], help: true },
  { id: 'radarMode', label: 'Radar aktiv/passiv (ab A4)', category: 'systems', contexts: ['combat'], type: 'toggle', keys: ['KeyR'] },
  { id: 'radarRange', label: 'Radarreichweite (ab A4)', category: 'systems', contexts: ['combat'], type: 'press', keys: ['Shift+KeyR'] },
  { id: 'autoStart', label: 'Automatischer Start', category: 'systems', contexts: ['combat', 'freeLook'], type: 'press', keys: ['Shift+KeyS'], help: true },

  // ---- view ----
  { id: 'freeLookToggle', label: 'Freier Blick umschalten', category: 'view', contexts: ['combat', 'freeLook', 'external'], type: 'toggle', keys: ['KeyV'], help: true, intro: true },
  { id: 'freeLookHold', label: 'Freier Blick (halten)', category: 'view', contexts: ['combat', 'freeLook', 'external'], type: 'hold', keys: ['Mouse1'], pad: [4], help: true },
  { id: 'interact', label: 'Schalter bedienen', category: 'view', contexts: ['freeLook'], type: 'hold', keys: ['Mouse0'], pad: [0], help: true },
  { id: 'externalView', label: 'Außenkamera', category: 'view', contexts: ['combat', 'external'], type: 'toggle', keys: ['Shift+KeyV'], help: true },
  { id: 'checklist', label: 'Klemmbrett / Checkliste', category: 'view', contexts: ['combat', 'freeLook'], type: 'toggle', keys: ['KeyK'], help: true },

  // ---- communication ----
  { id: 'radioMenu', label: 'Funkmenü', category: 'comms', contexts: ['combat', 'freeLook', 'external'], type: 'press', keys: ['KeyF'], pad: [3], help: true },
  // The seven wingman orders (ui/RadioMenu.js RADIO_COMMANDS, ai/Flight.js) — also in the radio menu
  ...['Formation', 'Mein Ziel angreifen', 'Freies Feuer', 'Navpunkt anlaufen', 'Stellung halten', 'Zurückfallen / zu mir', 'Beine zielen (an/aus)'].map((label, i) => ({
    id: `wing${i + 1}`, label: `Team: ${label}`, category: 'comms', contexts: ['combat', 'freeLook', 'external'], type: 'press', keys: [`Shift+Digit${i + 1}`], help: i === 0 || i === 1,
  })),
  { id: 'help', label: 'Tastenhilfe ein/aus', category: 'comms', contexts: ['global'], type: 'toggle', keys: ['KeyH'], pad: [8], help: true, intro: true },
  { id: 'pause', label: 'Pause', category: 'comms', contexts: ['combat', 'freeLook', 'missileCam', 'external', 'freeCam'], type: 'press', keys: ['Escape'], pad: [9], help: true, intro: true },

  // ---- menus (radio menu, pause, main menu) ----
  { id: 'menuUp', label: 'Menü: hoch', category: 'menu', contexts: ['menu'], type: 'press', keys: ['ArrowUp', 'KeyW'], pad: [12] },
  { id: 'menuDown', label: 'Menü: runter', category: 'menu', contexts: ['menu'], type: 'press', keys: ['ArrowDown', 'KeyS'], pad: [13] },
  { id: 'menuLeft', label: 'Menü: links / Wert kleiner', category: 'menu', contexts: ['menu'], type: 'press', keys: ['ArrowLeft', 'KeyA'], pad: [14] },
  { id: 'menuRight', label: 'Menü: rechts / Wert größer', category: 'menu', contexts: ['menu'], type: 'press', keys: ['ArrowRight', 'KeyD'], pad: [15] },
  { id: 'menuTabPrev', label: 'Menü: Reiter zurück', category: 'menu', contexts: ['menu'], type: 'press', keys: ['KeyQ', 'PageUp'], pad: [4] },
  { id: 'menuTabNext', label: 'Menü: Reiter vor', category: 'menu', contexts: ['menu'], type: 'press', keys: ['KeyE', 'PageDown'], pad: [5] },
  { id: 'menuConfirm', label: 'Menü: bestätigen', category: 'menu', contexts: ['menu'], type: 'press', keys: ['Enter', 'NumpadEnter', 'Space'], pad: [0] },
  { id: 'menuBack', label: 'Menü: zurück / schließen', category: 'menu', contexts: ['menu'], type: 'press', keys: ['Escape'], pad: [1] },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({
    id: `menuChoice${n}`, label: `Menü: Eintrag ${n}`, category: 'menu', contexts: ['menu'], type: 'press', keys: [`Digit${n}`, `Numpad${n}`],
  })),

  // ---- debug (only with debug mode on) ----
  { id: 'debugMode', label: 'Debug-Modus an/aus', category: 'debug', contexts: ['global'], type: 'toggle', keys: ['Backquote'] },
  { id: 'debugOverlay', label: 'Debug: Overlay', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['F2'] },
  { id: 'debugWireframe', label: 'Debug: Drahtgitter', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['F4'] },
  { id: 'debugFreeCam', label: 'Debug: Freiflug', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['Shift+F4'] },
  { id: 'debugHit', label: 'Debug: Treffer auf mich', category: 'debug', contexts: ['debug'], type: 'press', keys: ['F8'] },
  { id: 'debugHitHeavy', label: 'Debug: schwerer Treffer (Seiten der Reihe nach)', category: 'debug', contexts: ['debug'], type: 'press', keys: ['Shift+F8'] },
  { id: 'debugEnemyLock', label: 'Debug: feindliche Aufschaltung', category: 'debug', contexts: ['debug'], type: 'press', keys: ['F9'] },
  { id: 'debugEmitting', label: 'Debug: Ziel strahlt an/aus', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['Shift+F9'] },
  { id: 'aiFreeze', label: 'Debug: Gegner einfrieren', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['Shift+F2', 'NumpadMultiply'] },
  { id: 'aiSpawn', label: 'Debug: KI-Gruppe vor mir absetzen', category: 'debug', contexts: ['debug'], type: 'press', keys: ['Insert', 'NumpadAdd'] },
  { id: 'debugTextures', label: 'Debug: Detailtexturen an/aus', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['Home'] },
  { id: 'debugSurfaceMask', label: 'Debug: Bodenart-Maske als Farbe', category: 'debug', contexts: ['debug'], type: 'toggle', keys: ['End'] },
  { id: 'camForward', label: 'Freiflug: vorwärts', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['KeyW', 'ArrowUp'] },
  { id: 'camBack', label: 'Freiflug: zurück', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['KeyS', 'ArrowDown'] },
  { id: 'camLeft', label: 'Freiflug: links', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['KeyA', 'ArrowLeft'] },
  { id: 'camRight', label: 'Freiflug: rechts', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['KeyD', 'ArrowRight'] },
  { id: 'camUp', label: 'Freiflug: hoch', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['Space'], pad: [5] },
  { id: 'camDown', label: 'Freiflug: runter', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['KeyQ'], pad: [4] },
  { id: 'camBoost', label: 'Freiflug: schnell', category: 'debug', contexts: ['freeCam'], type: 'hold', keys: ['ShiftLeft'], pad: [10] },
];

/** Composite axes from two hold actions (positive, negative). */
export const KEY_AXES = {
  throttle: ['throttleUp', 'throttleDown'],
  turn: ['turnRight', 'turnLeft'],
  camMove: ['camForward', 'camBack'],
  camStrafe: ['camRight', 'camLeft'],
  camVertical: ['camUp', 'camDown'],
};

/** Device settings that are not bindings of a single action. */
export const INPUT_DEFAULTS = {
  mouse: { sensitivity: 0.0022, invertY: false }, // radians per pixel
  gamepad: {
    deadzone: 0.15,
    lookSpeed: 2.2, // radians per second at full deflection
    cursorSpeed: 900, // cockpit cursor px per second (free look)
    // Standard profile: left stick throttle rate + turn, right stick torso
    axes: [
      { axis: 0, action: 'turn', invert: false },
      { axis: 1, action: 'throttle', invert: true },
      { axis: 2, action: 'lookX', invert: false },
      { axis: 3, action: 'lookY', invert: false },
    ],
  },
};

/** Axis actions a gamepad/HOTAS axis can be assigned to. */
export const AXIS_ACTIONS = {
  throttle: 'Schub (Rate)',
  throttleAbs: 'Schubhebel (absolut, HOTAS)',
  turn: 'Beine drehen',
  lookX: 'Torso seitlich',
  lookY: 'Torso hoch/runter',
};

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
