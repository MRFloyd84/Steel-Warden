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
 * Every switch id becomes a simulation state from the interaction step on;
 * initial values describe a cold walker.
 */
export const PANEL_LAYOUTS = {
  standard: {
    groups: [
      { panel: 'overhead', rect: [0.02, 0.08, 0.18, 0.95], label: 'STROM' },
      { panel: 'overhead', rect: [0.19, 0.08, 0.64, 0.95], label: 'HILFSAGGREGAT · KÜHLUNG' },
      { panel: 'overhead', rect: [0.65, 0.08, 0.98, 0.95], label: 'REAKTOR' },
      { panel: 'main', rect: [0.02, 0.69, 0.31, 0.97], label: 'SYSTEME' },
      { panel: 'main', rect: [0.69, 0.69, 0.98, 0.97], label: 'SENSORIK' },
      { panel: 'rightWing', rect: [0.06, 0.55, 0.94, 0.95], label: 'FREIGABE' },
    ],

    items: [
      // Monitors
      { id: 'mfdDamage', type: 'monitor', panel: 'main', at: [0.17, 0.4], width: 0.3, display: 'damage', phosphor: 'color' },
      { id: 'mfdRadar', type: 'monitor', panel: 'main', at: [0.5, 0.27], width: 0.27, display: 'radar', phosphor: 'green' },
      { id: 'mfdSystem', type: 'monitor', panel: 'main', at: [0.5, 0.73], width: 0.27, display: 'system', phosphor: 'amber' },
      { id: 'mfdTarget', type: 'monitor', panel: 'main', at: [0.83, 0.4], width: 0.3, display: 'target', phosphor: 'green' },
      { id: 'mfdWeapons', type: 'monitor', panel: 'rightWing', at: [0.5, 0.25], width: 0.17, display: 'weapons', phosphor: 'amber' },

      // Overhead — startup sequence, row 1
      { id: 'batteryMaster', type: 'toggle', panel: 'overhead', at: [0.1, 0.42], label: 'BATTERIE', positions: ['AUS', 'EIN'], guard: 'yellow' },
      { id: 'apuStart', type: 'button', panel: 'overhead', at: [0.27, 0.42], label: 'HILFSAGG.', cap: 'START', lampColor: 'amber', momentary: true },
      { id: 'coolantPump1', type: 'toggle', panel: 'overhead', at: [0.42, 0.42], label: 'PUMPE 1', positions: ['AUS', 'EIN'] },
      { id: 'coolantPump2', type: 'toggle', panel: 'overhead', at: [0.55, 0.42], label: 'PUMPE 2', positions: ['AUS', 'EIN'] },
      { id: 'reactorMode', type: 'rotary', panel: 'overhead', at: [0.74, 0.44], label: 'BETRIEBSART', positions: ['AUS', 'VORH', 'BETR'] },
      { id: 'reactorIgnition', type: 'toggle', panel: 'overhead', at: [0.9, 0.42], label: 'ZÜNDUNG', positions: ['AUS', 'ZÜND'], guard: 'red' },
      // Overhead — row 2
      { id: 'mainBus', type: 'toggle', panel: 'overhead', at: [0.1, 0.8], label: 'HAUPTBUS', positions: ['HILFS', 'REAKT'] },
      { id: 'lampApuReady', type: 'lamp', panel: 'overhead', at: [0.27, 0.82], text: 'HILFS BEREIT', color: 'green' },
      { id: 'lampPressure1', type: 'lamp', panel: 'overhead', at: [0.42, 0.82], text: 'DRUCK 1', color: 'green' },
      { id: 'lampPressure2', type: 'lamp', panel: 'overhead', at: [0.55, 0.82], text: 'DRUCK 2', color: 'green' },
      { id: 'lampPreheatOk', type: 'lamp', panel: 'overhead', at: [0.74, 0.82], text: 'VORHEIZ OK', color: 'green' },
      { id: 'hydraulics', type: 'toggle', panel: 'overhead', at: [0.9, 0.8], label: 'HYDRAULIK', positions: ['AUS', 'EIN'] },

      // Main panel — below the side monitors
      { id: 'systemTest', type: 'button', panel: 'main', at: [0.1, 0.86], label: 'MONITORE', cap: 'TEST', lampColor: 'amber', momentary: true },
      { id: 'gyroAlign', type: 'button', panel: 'main', at: [0.23, 0.86], label: 'GYRO', cap: 'AUSR', lampColor: 'amber', momentary: true },
      { id: 'sensors', type: 'toggle', panel: 'main', at: [0.77, 0.86], label: 'SENSOREN', positions: ['AUS', 'EIN'] },
      { id: 'shields', type: 'toggle', panel: 'main', at: [0.9, 0.86], label: 'SCHILDE', positions: ['AUS', 'EIN'] },

      // Glareshield annunciators
      { id: 'lampMasterWarning', type: 'lamp', panel: 'glare', at: [0.06, 0.5], text: 'WARNUNG', color: 'red', size: [0.08, 0.038] },
      { id: 'lampMasterCaution', type: 'lamp', panel: 'glare', at: [0.15, 0.5], text: 'VORSICHT', color: 'amber', size: [0.08, 0.038] },
      { id: 'lampHeat', type: 'lamp', panel: 'glare', at: [0.27, 0.5], text: 'HITZE', color: 'red', size: [0.07, 0.034] },
      { id: 'lampMissile', type: 'lamp', panel: 'glare', at: [0.73, 0.5], text: 'RAKETE', color: 'red', size: [0.07, 0.034] },
      { id: 'lampReactor', type: 'lamp', panel: 'glare', at: [0.85, 0.5], text: 'REAKTOR', color: 'amber', size: [0.07, 0.034] },
      { id: 'lampShield', type: 'lamp', panel: 'glare', at: [0.94, 0.5], text: 'SCHILD', color: 'amber', size: [0.07, 0.034] },

      // Left wing — system status column and nameplate
      { id: 'lampStatReactor', type: 'lamp', panel: 'leftWing', at: [0.5, 0.1], text: 'REAKTOR', color: 'amber', size: [0.13, 0.024] },
      { id: 'lampStatCoolant', type: 'lamp', panel: 'leftWing', at: [0.5, 0.2], text: 'KÜHLUNG', color: 'amber', size: [0.13, 0.024] },
      { id: 'lampStatHydraulic', type: 'lamp', panel: 'leftWing', at: [0.5, 0.3], text: 'HYDRAULIK', color: 'amber', size: [0.13, 0.024] },
      { id: 'lampStatGyro', type: 'lamp', panel: 'leftWing', at: [0.5, 0.4], text: 'GYRO', color: 'amber', size: [0.13, 0.024] },
      { id: 'lampStatSensors', type: 'lamp', panel: 'leftWing', at: [0.5, 0.5], text: 'SENSOREN', color: 'amber', size: [0.13, 0.024] },
      { id: 'lampStatLegs', type: 'lamp', panel: 'leftWing', at: [0.5, 0.6], text: 'BEINE', color: 'amber', size: [0.13, 0.024] },
      { id: 'nameplate', type: 'nameplate', panel: 'leftWing', at: [0.5, 0.84], width: 0.17 },

      // Right wing — arming
      { id: 'weaponsArm', type: 'toggle', panel: 'rightWing', at: [0.3, 0.76], label: 'WAFFEN', positions: ['SICHER', 'SCHARF'], guard: 'red' },
      { id: 'legLock', type: 'toggle', panel: 'rightWing', at: [0.72, 0.76], label: 'BEINSPERRE', positions: ['FEST', 'LÖSEN'], guard: 'yellow' },

      // Left console
      { id: 'cockpitLight', type: 'rotary', panel: 'leftConsole', at: [0.28, 0.12], label: 'INNENLICHT', positions: ['AUS', 'NACHT', 'TAG'], initial: 2 },
      { id: 'radarRange', type: 'rotary', panel: 'leftConsole', at: [0.72, 0.12], label: 'RADAR m', positions: ['250', '500', '1000', '2000'], initial: 1 },
      { id: 'radioChannel', type: 'rotary', panel: 'leftConsole', at: [0.28, 0.31], label: 'FUNK', positions: ['1', '2', '3', '4'] },
      { id: 'throttle', type: 'throttle', panel: 'leftConsole', at: [0.6, 0.6] },

      // Right console
      { id: 'energyPreset', type: 'rotary', panel: 'rightConsole', at: [0.3, 0.12], label: 'ENERGIE', positions: ['SCHILD', 'AUSGL', 'WAFFE'], initial: 1 },
      { id: 'floodlight', type: 'toggle', panel: 'rightConsole', at: [0.74, 0.12], label: 'SCHEINWERFER', positions: ['AUS', 'EIN'] },
      { id: 'stick', type: 'stick', panel: 'rightConsole', at: [0.45, 0.62] },
    ],
  },
};

export function getPanelLayout(id) {
  const layout = PANEL_LAYOUTS[id];
  if (!layout) throw new Error(`Unknown panel layout "${id}"`);
  return layout;
}
