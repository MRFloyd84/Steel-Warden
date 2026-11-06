import * as THREE from 'three';
import { labelFaceTexture } from './canvasKit.js';

const DEG = Math.PI / 180;

/** Colours for lit lamps/buttons and switch guards. */
export const LAMP_COLORS = {
  red: '#ff3b26',
  amber: '#ffae2e',
  green: '#5dff7a',
  white: '#f4f0dc',
};
const GUARD_COLORS = { red: '#a3271c', yellow: '#c79a1c' };

/**
 * Builds the 3D object for one layout control. Each returns a view with
 * visual setters (setValue / setLit / setGuardOpen / setPressed) and the
 * meshes the interaction system will raycast against. Geometry sits in
 * panel-local space: X right, Y up, Z out of the panel.
 */
export class ControlFactory {
  constructor() {
    this.mat = {
      housing: new THREE.MeshLambertMaterial({ color: '#1d1f1c', flatShading: true }),
      metal: new THREE.MeshLambertMaterial({ color: '#b9bcb3', flatShading: true }),
      knob: new THREE.MeshLambertMaterial({ color: '#141512', flatShading: true }),
      pointer: new THREE.MeshBasicMaterial({ color: '#e9e4cf' }),
      guard: {
        red: new THREE.MeshLambertMaterial({ color: GUARD_COLORS.red, flatShading: true }),
        yellow: new THREE.MeshLambertMaterial({ color: GUARD_COLORS.yellow, flatShading: true }),
      },
    };
    this.geo = {
      nut: new THREE.CylinderGeometry(0.008, 0.009, 0.004, 6).rotateX(Math.PI / 2),
      lever: new THREE.CylinderGeometry(0.0028, 0.0034, 0.028, 6).rotateX(Math.PI / 2).translate(0, 0, 0.014),
      tip: new THREE.CylinderGeometry(0.0045, 0.0045, 0.007, 6).rotateX(Math.PI / 2).translate(0, 0, 0.03),
      skirt: new THREE.CylinderGeometry(0.019, 0.02, 0.004, 12).rotateX(Math.PI / 2).translate(0, 0, 0.002),
      knob: new THREE.CylinderGeometry(0.0125, 0.014, 0.017, 8).rotateX(Math.PI / 2).translate(0, 0, 0.0125),
      pointer: new THREE.BoxGeometry(0.0028, 0.011, 0.0015).translate(0, 0.006, 0.0215),
    };
  }

  create(item) {
    switch (item.type) {
      case 'toggle': return this.toggle(item);
      case 'rotary': return this.rotary(item);
      case 'button': return this.button(item);
      case 'lamp': return this.lamp(item);
      default: throw new Error(`Unknown control type "${item.type}"`);
    }
  }

  toggle(item) {
    const object = new THREE.Group();
    const nut = new THREE.Mesh(this.geo.nut, this.mat.metal);
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(this.geo.lever, this.mat.metal), new THREE.Mesh(this.geo.tip, this.mat.metal));
    object.add(nut, pivot);
    const pickables = [nut, ...pivot.children];

    let guardPivot = null;
    if (item.guard) {
      guardPivot = this.buildGuard(this.mat.guard[item.guard]);
      object.add(guardPivot);
      pickables.push(...guardPivot.children);
    }

    const view = {
      setValue(v) {
        // Lever tilts toward the panel's top edge when on.
        pivot.rotation.x = v ? -28 * DEG : 28 * DEG;
      },
      setGuardOpen(open) {
        if (guardPivot) guardPivot.rotation.x = open ? 105 * DEG : 0;
      },
    };
    return { object, view, pickables };
  }

  /** Flip cover hinged at its lower edge: two side walls, a top and a front plate. */
  buildGuard(material) {
    const w = 0.028;
    const h = 0.05;
    const d = 0.038;
    const t = 0.0022;
    const pivot = new THREE.Group();
    pivot.position.set(0, -h / 2, 0);
    const parts = [
      new THREE.BoxGeometry(w, h, t).translate(0, h / 2, d),
      new THREE.BoxGeometry(t, h, d).translate(-w / 2, h / 2, d / 2),
      new THREE.BoxGeometry(t, h, d).translate(w / 2, h / 2, d / 2),
      new THREE.BoxGeometry(w, t, d).translate(0, h, d / 2),
    ];
    for (const g of parts) pivot.add(new THREE.Mesh(g, material));
    return pivot;
  }

  rotary(item) {
    const object = new THREE.Group();
    const skirt = new THREE.Mesh(this.geo.skirt, this.mat.housing);
    const dial = new THREE.Group();
    dial.add(new THREE.Mesh(this.geo.knob, this.mat.knob), new THREE.Mesh(this.geo.pointer, this.mat.pointer));
    object.add(skirt, dial);
    const n = item.positions.length;
    const view = {
      setValue(v) {
        dial.rotation.z = rotaryAngle(v, n);
      },
    };
    return { object, view, pickables: [skirt, ...dial.children] };
  }

  button(item) {
    const object = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.006).translate(0, 0, 0.003), this.mat.housing);
    const capMat = litMaterial(item.cap, 1, item.lampColor ?? 'amber');
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.01).translate(0, 0, 0.011), capMat);
    object.add(housing, cap);
    const view = {
      setLit(on) {
        capMat.emissiveIntensity = on ? 1.4 : 0;
      },
      setPressed(on) {
        cap.position.z = on ? -0.004 : 0;
      },
    };
    return { object, view, pickables: [housing, cap] };
  }

  lamp(item) {
    const [w, h] = item.size ?? [0.044, 0.022];
    const object = new THREE.Group();
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, h + 0.006, 0.005).translate(0, 0, 0.0025), this.mat.housing);
    const lensMat = litMaterial(item.text, w / h, item.color);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004).translate(0, 0, 0.006), lensMat);
    object.add(bezel, lens);
    const view = {
      setLit(on) {
        lensMat.emissiveIntensity = on ? 1.6 : 0;
      },
    };
    return { object, view, pickables: [lens] };
  }

  dispose() {
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of Object.values(this.mat)) {
      if (m.dispose) m.dispose();
      else for (const sub of Object.values(m)) sub.dispose();
    }
  }
}

/** Knob angle for position index v of n (left-most = +60°, clockwise to -60°). */
export function rotaryAngle(v, n) {
  if (n < 2) return 0;
  const span = n === 2 ? 90 : 120;
  return (span / 2 - (span * v) / (n - 1)) * DEG;
}

/**
 * Lens material: unlit it shows a dim tinted lens with dark lettering,
 * lit the emissive term floods it with the lamp colour.
 */
function litMaterial(text, aspect, colorName) {
  const lit = new THREE.Color(LAMP_COLORS[colorName] ?? colorName);
  const tex = labelFaceTexture(text ?? '', aspect);
  return new THREE.MeshLambertMaterial({
    map: tex,
    color: lit.clone().multiplyScalar(0.13),
    emissive: lit,
    emissiveMap: tex,
    emissiveIntensity: 0,
  });
}
