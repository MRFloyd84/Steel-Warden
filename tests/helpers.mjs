/**
 * Headless fixtures for the node tests: real cockpit controls, real WalkerSystems and a real
 * DamageModel — no browser, no rendering. Everything is deterministic (randomEvents off).
 */
import { getPanelLayout } from '../src/data/panelLayouts.js';
import { CockpitControls } from '../src/sim/CockpitControls.js';
import { EventBus } from '../src/core/EventBus.js';
import { WalkerSystems } from '../src/sim/WalkerSystems.js';
import { DamageModel } from '../src/sim/DamageModel.js';
import { MachineCondition } from '../src/sim/MachineCondition.js';
import { WALKERS } from '../src/data/walkers.js';
import { ENEMIES } from '../src/data/enemies.js';

export const DT = 1 / 60;

export function walker(id) {
  return WALKERS[id] ?? ENEMIES[id];
}

/** A combat unit as CombatUnits.prep builds it (only the parts MachineCondition reads). */
export function makeUnit(id = 'bastion') {
  const w = walker(id);
  const u = { walker: w, damage: new DamageModel(w), wreck: null, immobile: false, lostArms: new Set() };
  u.condition = new MachineCondition(u);
  return u;
}

/** Player: unit + cockpit controls + machinery, cold (or hot with forceHot). */
export function makePlayer(id = 'bastion', { hot = false } = {}) {
  const w = walker(id);
  const bus = new EventBus();
  const controls = new CockpitControls(getPanelLayout(w.cockpit.panelLayout), bus);
  const systems = new WalkerSystems(controls, bus, {
    randomEvents: false,
    overrides: w.systems,
    extraCircuit: !!w.cockpit.extraCircuit,
    heat: { capacity: w.heatCapacity, dissipation: w.heatDissipation },
  });
  if (hot) systems.forceHot();
  const unit = makeUnit(id);
  unit.condition.systems = systems;
  return { w, bus, controls, systems, unit };
}

export function run(systems, seconds, each = null) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    systems.update(DT);
    if (each?.(i * DT) === true) return i * DT;
  }
  return null;
}

/** Hit that ignores shields (vsShield 0) — damage lands fully on the component. */
export function armourHit(component, damage) {
  return { component, side: 'front', damage, vsShield: 0, vsArmor: 1 };
}
