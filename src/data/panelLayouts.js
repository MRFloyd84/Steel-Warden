/**
 * What sits on the cockpit panels. Each item names a panel of the cockpit
 * variant and a normalised position at: [u, v] (u = 0 left, v = 0 top edge).
 *
 * Item types:
 *   toggle    { label, positions: [off, on], guard?: 'red' | 'yellow', initial? }
 *   rotary    { label, positions: [...], initial? }
 *   button    { label, cap, lampColor, momentary }
 *   lamp      { text, color, size?: [w, h] }
 *   monitor   { display, width, phosphor: 'amber' | 'green' | 'color' }
 *   throttle  lever on a console; stick: side stick on a console
 *   nameplate { width } — walker name, manufacturer, serial
 *
 * Every switch id is a simulation state (sim/CockpitControls); initial values
 * describe a cold walker. All layouts carry the same startup switches, so
 * WalkerSystems works with every cockpit; 'assault' adds the second reactor circuit.
 */

// ---- Building blocks shared by the layouts ----

const OVERHEAD = [
  { id: 'batteryMaster', type: 'toggle', panel: 'overhead', at: [0.1, 0.42], label: 'BATTERIE', positions: ['AUS', 'EIN'], guard: 'yellow' },
  { id: 'apuStart', type: 'button', panel: 'overhead', at: [0.27, 0.42], label: 'HILFSAGG.', cap: 'START', lampColor: 'amber', momentary: true },
  { id: 'coolantPump1', type: 'toggle', panel: 'overhead', at: [0.42, 0.42], label: 'PUMPE 1', positions: ['AUS', 'EIN'] },
  { id: 'coolantPump2', type: 'toggle', panel: 'overhead', at: [0.55, 0.42], label: 'PUMPE 2', positions: ['AUS', 'EIN'] },
  { id: 'reactorMode', type: 'rotary', panel: 'overhead', at: [0.74, 0.44], label: 'BETRIEBSART', positions: ['AUS', 'VORH', 'BETR'] },
  { id: 'reactorIgnition', type: 'toggle', panel: 'overhead', at: [0.9, 0.42], label: 'ZÜNDUNG', positions: ['AUS', 'ZÜND'], guard: 'red' },
  { id: 'mainBus', type: 'toggle', panel: 'overhead', at: [0.1, 0.8], label: 'HAUPTBUS', positions: ['HILFS', 'REAKT'] },
  { id: 'lampApuReady', type: 'lamp', panel: 'overhead', at: [0.27, 0.82], text: 'HILFS BEREIT', color: 'green' },
  { id: 'lampPressure1', type: 'lamp', panel: 'overhead', at: [0.42, 0.82], text: 'DRUCK 1', color: 'green' },
  { id: 'lampPressure2', type: 'lamp', panel: 'overhead', at: [0.55, 0.82], text: 'DRUCK 2', color: 'green' },
  { id: 'lampPreheatOk', type: 'lamp', panel: 'overhead', at: [0.74, 0.82], text: 'VORHEIZ OK', color: 'green' },
  { id: 'hydraulics', type: 'toggle', panel: 'overhead', at: [0.9, 0.8], label: 'HYDRAULIK', positions: ['AUS', 'EIN'] },
];

const OVERHEAD_GROUPS = [
  { panel: 'overhead', rect: [0.02, 0.08, 0.18, 0.95], label: 'STROM' },
  { panel: 'overhead', rect: [0.19, 0.08, 0.64, 0.95], label: 'HILFSAGGREGAT · KÜHLUNG' },
  { panel: 'overhead', rect: [0.65, 0.08, 0.98, 0.95], label: 'REAKTOR' },
];

const GLARE = [
  { id: 'lampMasterWarning', type: 'lamp', panel: 'glare', at: [0.06, 0.5], text: 'WARNUNG', color: 'red', size: [0.08, 0.038] },
  { id: 'lampMasterCaution', type: 'lamp', panel: 'glare', at: [0.15, 0.5], text: 'VORSICHT', color: 'amber', size: [0.08, 0.038] },
  { id: 'lampHeat', type: 'lamp', panel: 'glare', at: [0.27, 0.5], text: 'HITZE', color: 'red', size: [0.07, 0.034] },
  { id: 'lampMissile', type: 'lamp', panel: 'glare', at: [0.73, 0.5], text: 'RAKETE', color: 'red', size: [0.07, 0.034] },
  { id: 'lampReactor', type: 'lamp', panel: 'glare', at: [0.85, 0.5], text: 'REAKTOR', color: 'amber', size: [0.07, 0.034] },
  { id: 'lampShield', type: 'lamp', panel: 'glare', at: [0.94, 0.5], text: 'SCHILD', color: 'amber', size: [0.07, 0.034] },
];

const LEFT_CONSOLE = [
  { id: 'cockpitLight', type: 'rotary', panel: 'leftConsole', at: [0.28, 0.12], label: 'INNENLICHT', positions: ['AUS', 'NACHT', 'TAG'], initial: 2 },
  { id: 'radarRange', type: 'rotary', panel: 'leftConsole', at: [0.72, 0.12], label: 'RADAR m', positions: ['250', '500', '1000', '2000'], initial: 1 },
  { id: 'radioChannel', type: 'rotary', panel: 'leftConsole', at: [0.28, 0.31], label: 'FUNK', positions: ['1', '2', '3', '4'] },
  { id: 'throttle', type: 'throttle', panel: 'leftConsole', at: [0.6, 0.6] },
];

const RIGHT_CONSOLE = [
  { id: 'energyPreset', type: 'rotary', panel: 'rightConsole', at: [0.3, 0.12], label: 'ENERGIE', positions: ['SCHILD', 'AUSGL', 'WAFFE'], initial: 1 },
  { id: 'floodlight', type: 'toggle', panel: 'rightConsole', at: [0.74, 0.12], label: 'SCHEINWERFER', positions: ['AUS', 'EIN'] },
  { id: 'stick', type: 'stick', panel: 'rightConsole', at: [0.45, 0.62] },
];

const STAT_LAMPS = [
  ['lampStatReactor', 'REAKTOR'], ['lampStatCoolant', 'KÜHLUNG'], ['lampStatHydraulic', 'HYDRAULIK'],
  ['lampStatGyro', 'GYRO'], ['lampStatSensors', 'SENSOREN'], ['lampStatLegs', 'BEINE'],
];

/** Status lamp column(s) on a panel: positions as [u, v] pairs in STAT_LAMPS order. */
function statusLamps(panel, positions, size) {
  return STAT_LAMPS.map(([id, text], i) => ({ id, type: 'lamp', panel, at: positions[i], text, color: 'amber', size }));
}

function mainSwitches(panel, [u1, u2, u3, u4], v) {
  return [
    { id: 'systemTest', type: 'button', panel, at: [u1, v], label: 'MONITORE', cap: 'TEST', lampColor: 'amber', momentary: true },
    { id: 'gyroAlign', type: 'button', panel, at: [u2, v], label: 'GYRO', cap: 'AUSR', lampColor: 'amber', momentary: true },
    { id: 'sensors', type: 'toggle', panel, at: [u3, v], label: 'SENSOREN', positions: ['AUS', 'EIN'] },
    { id: 'shields', type: 'toggle', panel, at: [u4, v], label: 'SCHILDE', positions: ['AUS', 'EIN'] },
  ];
}

function arming(panel, v) {
  return [
    { id: 'weaponsArm', type: 'toggle', panel, at: [0.3, v], label: 'WAFFEN', positions: ['SICHER', 'SCHARF'], guard: 'red' },
    { id: 'legLock', type: 'toggle', panel, at: [0.72, v], label: 'BEINSPERRE', positions: ['FEST', 'LÖSEN'], guard: 'yellow' },
  ];
}

const column = (u, v0, dv) => [0, 1, 2, 3, 4, 5].map((i) => [u, v0 + i * dv]);

// ---- Layouts ----

export const PANEL_LAYOUTS = {
  standard: {
    groups: [
      ...OVERHEAD_GROUPS,
      { panel: 'main', rect: [0.02, 0.69, 0.31, 0.97], label: 'SYSTEME' },
      { panel: 'main', rect: [0.69, 0.69, 0.98, 0.97], label: 'SENSORIK' },
      { panel: 'rightWing', rect: [0.06, 0.55, 0.94, 0.95], label: 'FREIGABE' },
    ],
    items: [
      { id: 'mfdDamage', type: 'monitor', panel: 'main', at: [0.17, 0.4], width: 0.3, display: 'damage', phosphor: 'color' },
      { id: 'mfdRadar', type: 'monitor', panel: 'main', at: [0.5, 0.27], width: 0.27, display: 'radar', phosphor: 'green' },
      { id: 'mfdSystem', type: 'monitor', panel: 'main', at: [0.5, 0.73], width: 0.27, display: 'system', phosphor: 'amber' },
      { id: 'mfdTarget', type: 'monitor', panel: 'main', at: [0.83, 0.4], width: 0.3, display: 'target', phosphor: 'green' },
      { id: 'mfdWeapons', type: 'monitor', panel: 'rightWing', at: [0.5, 0.25], width: 0.17, display: 'weapons', phosphor: 'amber' },
      ...OVERHEAD,
      ...mainSwitches('main', [0.1, 0.23, 0.77, 0.9], 0.86),
      ...GLARE,
      ...statusLamps('leftWing', column(0.5, 0.1, 0.1), [0.13, 0.024]),
      { id: 'nameplate', type: 'nameplate', panel: 'leftWing', at: [0.5, 0.84], width: 0.17 },
      ...arming('rightWing', 0.76),
      ...LEFT_CONSOLE,
      ...RIGHT_CONSOLE,
    ],
  },

  // Light walkers: three monitors (damage, radar, system); target and weapon pages follow later as MFD pages.
  compact: {
    groups: [
      ...OVERHEAD_GROUPS,
      { panel: 'main', rect: [0.02, 0.74, 0.34, 0.98], label: 'SYSTEME' },
      { panel: 'main', rect: [0.66, 0.74, 0.98, 0.98], label: 'SENSORIK' },
      { panel: 'rightWing', rect: [0.06, 0.22, 0.94, 0.62], label: 'FREIGABE' },
    ],
    items: [
      { id: 'mfdDamage', type: 'monitor', panel: 'main', at: [0.19, 0.4], width: 0.28, display: 'damage', phosphor: 'color' },
      { id: 'mfdRadar', type: 'monitor', panel: 'main', at: [0.5, 0.4], width: 0.29, display: 'radar', phosphor: 'green' },
      { id: 'mfdSystem', type: 'monitor', panel: 'main', at: [0.81, 0.4], width: 0.28, display: 'system', phosphor: 'amber' },
      ...OVERHEAD,
      ...mainSwitches('main', [0.1, 0.25, 0.75, 0.9], 0.88),
      ...GLARE,
      ...statusLamps('leftWing', column(0.5, 0.1, 0.1), [0.12, 0.022]),
      { id: 'nameplate', type: 'nameplate', panel: 'leftWing', at: [0.5, 0.86], width: 0.15 },
      ...arming('rightWing', 0.44),
      ...LEFT_CONSOLE,
      ...RIGHT_CONSOLE,
    ],
  },

  // Heavy walkers: four main monitors plus energy and weapon monitors on the wings.
  heavy: heavyLayout(false),
  // Assault walkers: heavy layout plus the second reactor circuit.
  assault: heavyLayout(true),
};

function heavyLayout(extraCircuit) {
  const items = [
    { id: 'mfdDamage', type: 'monitor', panel: 'main', at: [0.14, 0.42], width: 0.3, display: 'damage', phosphor: 'color' },
    { id: 'mfdRadar', type: 'monitor', panel: 'main', at: [0.38, 0.42], width: 0.28, display: 'radar', phosphor: 'green' },
    { id: 'mfdSystem', type: 'monitor', panel: 'main', at: [0.62, 0.42], width: 0.28, display: 'system', phosphor: 'amber' },
    { id: 'mfdTarget', type: 'monitor', panel: 'main', at: [0.86, 0.42], width: 0.3, display: 'target', phosphor: 'green' },
    { id: 'mfdEnergy', type: 'monitor', panel: 'leftWing', at: [0.5, 0.27], width: 0.2, display: 'energy', phosphor: 'amber' },
    { id: 'mfdWeapons', type: 'monitor', panel: 'rightWing', at: [0.5, 0.27], width: 0.2, display: 'weapons', phosphor: 'amber' },
    ...OVERHEAD,
    ...mainSwitches('main', [0.08, 0.2, 0.8, 0.92], 0.88),
    ...GLARE,
    ...statusLamps('leftWing', [[0.27, 0.56], [0.73, 0.56], [0.27, 0.64], [0.73, 0.64], [0.27, 0.72], [0.73, 0.72]], [0.11, 0.026]),
    { id: 'nameplate', type: 'nameplate', panel: 'leftWing', at: [0.5, 0.88], width: 0.18 },
    ...arming('rightWing', 0.76),
    ...LEFT_CONSOLE,
    ...RIGHT_CONSOLE,
  ];
  if (extraCircuit) {
    items.push(
      { id: 'reactor2Ignition', type: 'toggle', panel: 'leftConsole', at: [0.72, 0.33], label: 'KREIS 2', positions: ['AUS', 'ZÜND'], guard: 'red' },
      { id: 'lampReactor2', type: 'lamp', panel: 'glare', at: [0.4, 0.5], text: 'KREIS 2', color: 'green', size: [0.07, 0.034] },
    );
  }
  return {
    groups: [
      ...OVERHEAD_GROUPS,
      { panel: 'main', rect: [0.02, 0.77, 0.27, 0.98], label: 'SYSTEME' },
      { panel: 'main', rect: [0.73, 0.77, 0.98, 0.98], label: 'SENSORIK' },
      { panel: 'rightWing', rect: [0.06, 0.58, 0.94, 0.95], label: 'FREIGABE' },
      { panel: 'leftWing', rect: [0.06, 0.5, 0.94, 0.78], label: 'STATUS' },
    ],
    items,
  };
}

export function getPanelLayout(id) {
  const layout = PANEL_LAYOUTS[id];
  if (!layout) throw new Error(`Unknown panel layout "${id}"`);
  return layout;
}
