import { RadarDisplay } from './RadarDisplay.js';
import { SystemDisplay } from './SystemDisplay.js';
import { DamageDisplay } from './DamageDisplay.js';
import { TargetDisplay } from './TargetDisplay.js';
import { WeaponDisplay } from './WeaponDisplay.js';
import { EnergyDisplay } from './EnergyDisplay.js';

/** Display modules referenced by monitor items in panelLayouts.js (display: '<name>'). */
export const DISPLAYS = {
  radar: RadarDisplay,
  system: SystemDisplay,
  damage: DamageDisplay,
  target: TargetDisplay,
  weapons: WeaponDisplay,
  energy: EnergyDisplay,
};

export function getDisplay(name) {
  const display = DISPLAYS[name];
  if (!display) throw new Error(`Unknown display "${name}"`);
  return display;
}
