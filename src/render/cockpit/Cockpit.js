import * as THREE from 'three';
import { getCockpitVariant } from '../../data/cockpits.js';
import { getPanelLayout } from '../../data/panelLayouts.js';
import { buildShell } from './CockpitShell.js';
import { buildPanels } from './PanelBuilder.js';
import { panelLocal } from './geometry.js';
import { ControlFactory } from './ControlFactory.js';
import { ThrottleLever, SideStick } from './Levers.js';
import { CrtScreen } from './CrtScreen.js';
import { buildNameplate } from './Nameplate.js';
import { getDisplay } from './displays/index.js';

export const LIGHT_MODES = ['off', 'night', 'day'];

/**
 * The pilot's cockpit as its own scene in torso-local space (eye at the
 * origin). Rendered in a second pass over the world, so it needs no fog
 * and keeps a tiny near plane without hurting terrain depth precision.
 *
 * controls: Map id -> { item, view, object, pickables } — the visuals only.
 * Positions live in sim/CockpitControls; bindControls() mirrors its events.
 */
export class Cockpit {
  constructor(walker, theater, config) {
    this.walker = walker;
    this.variant = getCockpitVariant(walker.cockpit.variant);
    this.layout = getPanelLayout(walker.cockpit.panelLayout);
    this.scene = new THREE.Scene();
    this.scene.name = 'cockpit';
    this.disposables = [];

    this.shell = buildShell(this.variant, theater);
    this.scene.add(this.shell.group);

    this.panels = buildPanels(this.variant, this.layout, config.panelPixelsPerMetre);
    this.scene.add(this.panels.group);

    this.factory = new ControlFactory();
    this.controls = new Map();
    this.extraParts = new Map(); // monitors, levers, nameplate
    this.monitors = [];
    this.pickables = [];
    this.mountItems(config);
    this.createLights();

    this.worldSun = new THREE.Vector3(0, 1, 0);
    this.worldSunColor = new THREE.Color(1, 1, 1);
    this.worldSunIntensity = 1;
    this.lightMode = 'day';
    this.applyLightMode(LIGHT_MODES[this.layout.items.find((i) => i.id === 'cockpitLight')?.initial ?? 2]);
  }

  /** Mirrors control state from the simulation onto the 3D parts. */
  bindControls(registry, bus) {
    for (const [id, entry] of this.controls) {
      if (!registry.has(id)) continue;
      const s = registry.get(id);
      entry.view.setValue?.(s.value);
      entry.view.setGuardOpen?.(s.guardOpen);
      entry.view.setLit?.(s.lit);
    }
    const view = (id) => this.controls.get(id)?.view;
    const offs = [
      bus.on('control:changed', ({ id, value }) => view(id)?.setValue?.(value)),
      bus.on('control:guard', ({ id, open }) => view(id)?.setGuardOpen?.(open)),
      bus.on('control:pressed', ({ id, pressed }) => view(id)?.setPressed?.(pressed)),
      bus.on('control:lamp', ({ id, lit }) => view(id)?.setLit?.(lit)),
    ];
    this.unbind = () => offs.forEach((off) => off());
  }

  /** Cockpit-space position of a part (for stereo panning of its sounds). */
  positionOf(id, out) {
    const entry = this.controls.get(id) ?? this.extraParts.get(id);
    if (!entry) return null;
    return entry.object.getWorldPosition(out);
  }

  mountItems(config) {
    let monitorIndex = 0;
    for (const item of this.layout.items) {
      const panel = this.panels.frames.get(item.panel);
      if (!panel) throw new Error(`Layout item "${item.id}" references unknown panel "${item.panel}"`);
      const [x, y] = panelLocal(panel.def, item.at);
      let object;
      let pickables = [];

      switch (item.type) {
        case 'monitor': {
          const crt = new CrtScreen({
            width: item.width,
            display: getDisplay(item.display),
            phosphor: item.phosphor,
            refreshHz: config.monitorHz,
            phaseOffset: (monitorIndex++ * 0.37) % 1,
          });
          this.monitors.push(crt);
          object = crt.object;
          pickables = crt.pickables;
          break;
        }
        case 'throttle':
          this.throttleLever = new ThrottleLever();
          object = this.throttleLever.object;
          pickables = this.throttleLever.pickables;
          break;
        case 'stick':
          this.stick = new SideStick();
          object = this.stick.object;
          pickables = this.stick.pickables;
          break;
        case 'nameplate':
          object = buildNameplate(this.walker, item.width);
          this.disposables.push(object.userData.dispose);
          break;
        default: {
          const built = this.factory.create(item);
          object = built.object;
          pickables = built.pickables;
          built.view.setValue?.(item.initial ?? 0);
          built.view.setGuardOpen?.(false);
          built.view.setLit?.(false);
          this.controls.set(item.id, { item, view: built.view, object, pickables });
        }
      }

      object.position.set(x, y, object.position.z);
      object.name = item.id;
      if (!this.controls.has(item.id)) this.extraParts.set(item.id, { item, object, pickables });
      for (const mesh of pickables) mesh.userData.controlId = item.id;
      this.pickables.push(...pickables);
      panel.frame.add(object);
    }
  }

  createLights() {
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x303030, 1);
    // Instrument flood lights under the glareshield and above the consoles
    this.flood = new THREE.PointLight(0xffffff, 1, 3, 2);
    this.flood.position.set(0, -0.27, -0.62);
    this.floodOverhead = new THREE.PointLight(0xffffff, 1, 2.5, 2);
    this.floodOverhead.position.set(0, 0.2, -0.05);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.ambient, this.flood, this.floodOverhead, this.sun);
  }

  /** World lighting for this mission (sun through the canopy, glass brightness). */
  setEnvironment(environment, lighting) {
    this.worldSun.copy(environment.sun.position).normalize();
    this.worldSunColor.set(lighting.sunColor);
    this.worldSunIntensity = lighting.sunIntensity;
    this.shell.glassMaterial.color.setScalar(0.35 + 0.65 * lighting.skyBrightness);
  }

  applyLightMode(mode) {
    this.lightMode = mode;
    const preset = this.variant.lighting[mode];
    this.ambient.color.set(preset.ambientColor);
    this.ambient.groundColor.set(preset.ambientColor).multiplyScalar(0.35);
    this.ambient.intensity = preset.ambient;
    for (const light of [this.flood, this.floodOverhead]) {
      light.color.set(preset.floodColor);
      light.intensity = preset.flood;
    }
    this.sunFactor = preset.sun;
  }

  /**
   * @param data       instrument snapshot (see MissionState.buildCockpitData)
   * @param torsoQuat  torso orientation in the world, for sunlight direction
   */
  update(dt, data, torsoQuat) {
    this.sun.position.copy(this.worldSun).applyQuaternion(tmpQ.copy(torsoQuat).invert()).multiplyScalar(5);
    this.sun.color.copy(this.worldSunColor);
    this.sun.intensity = this.worldSunIntensity * this.sunFactor;

    this.throttleLever?.set(data.throttle);
    this.stick?.set(data.stickX, data.stickY, data.stickTwist);
    for (const crt of this.monitors) crt.update(dt, data);
  }

  /** Frees all GPU resources; disposing shared resources twice is harmless. */
  dispose() {
    this.unbind?.();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose();
    });
    this.shell.glassMaterial.map.dispose();
    for (const d of this.panels.disposables) d.dispose();
    for (const crt of this.monitors) crt.dispose();
    for (const fn of this.disposables) fn();
    this.factory.dispose();
  }
}

const tmpQ = new THREE.Quaternion();
