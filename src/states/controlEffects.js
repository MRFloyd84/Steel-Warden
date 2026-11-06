import { LIGHT_MODES } from '../render/cockpit/Cockpit.js';

/**
 * Effects of cockpit controls that already have a system behind them.
 * Startup-procedure switches get their effects with the startup state
 * machine; radar range, weapons arming and energy preset are read directly
 * from the control state where they are used.
 */
const EFFECTS = {
  cockpitLight: (value, { cockpit }) => cockpit.applyLightMode(LIGHT_MODES[value]),
  floodlight: (value, { floodlight }) => floodlight.setOn(value === 1),
};

export function wireControlEffects(bus, controls, targets) {
  for (const [id, fn] of Object.entries(EFFECTS)) {
    if (controls.has(id)) fn(controls.value(id), targets);
  }
  return bus.on('control:changed', ({ id, value }) => EFFECTS[id]?.(value, targets));
}
