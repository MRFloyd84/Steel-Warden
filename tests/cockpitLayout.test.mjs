/**
 * Modelled cockpit (docs/COCKPIT-MODEL-PLAN.md): the panel layout on the model carries the same
 * switches as the class cockpits, every item sits on a panel of the model variant, and the
 * startup works headless with the model layout (WalkerSystems only sees the switch ids).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPanelLayout } from '../src/data/panelLayouts.js';
import { getCockpitVariant, COCKPIT_MODEL } from '../src/data/cockpits.js';
import { CockpitControls } from '../src/sim/CockpitControls.js';
import { EventBus } from '../src/core/EventBus.js';
import { WalkerSystems } from '../src/sim/WalkerSystems.js';
import { StartupAutomation } from '../src/sim/StartupAutomation.js';
import { WALKERS, WALKER_ORDER } from '../src/data/walkers.js';

const ids = (layout) => new Set(layout.items.filter((i) => i.id).map((i) => i.id));
const VISUAL_ONLY = new Set(['nameplate']); // decoration, no switch state

test('model layout has every switch of the class layouts (assault: plus circuit 2)', () => {
  const model = ids(getPanelLayout('model'));
  const assault = ids(getPanelLayout('modelAssault'));
  for (const id of WALKER_ORDER) {
    const w = WALKERS[id];
    const own = ids(getPanelLayout(w.cockpit.panelLayout));
    const target = w.cockpit.extraCircuit ? assault : model;
    for (const sw of own) {
      if (VISUAL_ONLY.has(sw)) continue;
      assert.ok(target.has(sw), `${id}: "${sw}" fehlt im Modell-Layout`);
    }
  }
  assert.ok(assault.has('reactor2Ignition'));
  assert.ok(!model.has('reactor2Ignition'));
});

test('every model layout item sits on a panel of the model variant, inside the panel', () => {
  const v = getCockpitVariant('model');
  for (const name of ['model', 'modelAssault']) {
    const layout = getPanelLayout(name);
    const seen = new Set();
    for (const it of layout.items) {
      assert.ok(!seen.has(it.id), `${name}: doppelte id ${it.id}`);
      seen.add(it.id);
      if (it.grip) {
        assert.ok(['gripL', 'gripR'].includes(it.grip), it.id);
        continue;
      }
      assert.ok(v.panels[it.panel], `${name}: ${it.id} auf unbekanntem Paneel ${it.panel}`);
      assert.ok(it.at.every((c) => c >= 0 && c <= 1), `${name}: ${it.id} at ${it.at}`);
    }
    for (const g of layout.groups ?? []) assert.ok(v.panels[g.panel], `${name}: Gruppe auf ${g.panel}`);
  }
  // class scale around the eye stays small (one model for all classes)
  for (const k of Object.values(v.classScale)) assert.ok(k > 0.85 && k < 1.15);
  assert.ok(COCKPIT_MODEL.scale > 0);
});

test('automatic start works with the model layout (KESTREL, KOLOSS with circuit 2)', () => {
  for (const id of ['kestrel', 'koloss']) {
    const w = WALKERS[id];
    const bus = new EventBus();
    const controls = new CockpitControls(getPanelLayout(w.cockpit.extraCircuit ? 'modelAssault' : 'model'), bus);
    const systems = new WalkerSystems(controls, bus, {
      randomEvents: false,
      overrides: w.systems,
      extraCircuit: !!w.cockpit.extraCircuit,
      heat: { capacity: w.heatCapacity, dissipation: w.heatDissipation },
    });
    const auto = new StartupAutomation(controls, 'auto');
    auto.start('auto');
    let ready = false;
    for (let t = 0; t < 240 && !ready; t += 1 / 60) {
      systems.update(1 / 60);
      auto.update(1 / 60, systems.flags);
      ready = systems.flags.legsReleased && systems.flags.reactorFull;
    }
    assert.ok(ready, `${id}: Start mit Modell-Layout nicht fertig`);
  }
});
