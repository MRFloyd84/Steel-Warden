/**
 * Ground types and what they do to a walker (sampler.surfaceAt(x, z)).
 *
 *   speed        base speed factor
 *   perTon       extra slowdown per tonne (soft ground: heavy walkers sink in)
 *   minSpeed     lower limit of the speed factor
 *   heat         reactor heating in °C/s while standing in it (negative = cooling)
 *   legDamage    damage per second to the legs (lava)
 *   breakTonnage thin ice gives way under walkers at least this heavy
 *   sink         how far a walker sinks in (m) when the ice breaks; stuck for `stuck` s
 *   step         footstep sound event; splash/glow particles: fx
 *   color        terrain colour (blended with the theater palette by `mix`)
 */
export const SURFACES = {
  hard: { name: 'HART', speed: 1, step: 'footstep' },
  soft: { name: 'WEICH', speed: 1, perTon: 0.0045, minSpeed: 0.45, step: 'footstep.soft', color: null },
  water: { name: 'WASSER', speed: 0.8, perTon: 0.001, minSpeed: 0.6, heat: -9, step: 'footstep.water', fx: 'splash' },
  lava: { name: 'LAVA', speed: 0.75, heat: 22, legDamage: 6, step: 'footstep.lava', fx: 'embers' },
  thinIce: { name: 'DÜNNES EIS', speed: 1, breakTonnage: 50, sink: 2.2, stuck: 4, step: 'footstep.ice' },
  hot: { name: 'HEISS', speed: 1, heat: 4, step: 'footstep' },
};

/** Fluid surfaces drawn as their own meshes. */
export const FLUIDS = {
  water: { color: '#3d6e86', opacity: 0.78, wave: 0.18, glow: false },
  lava: { color: '#ff5a1a', hot: '#ffd36a', opacity: 1, wave: 0.12, glow: true },
  glow: { color: '#3ef0e0', opacity: 0.85, wave: 0, glow: true, offset: 0.12 },
};

export function getSurface(id) {
  return SURFACES[id] ?? SURFACES.hard;
}
