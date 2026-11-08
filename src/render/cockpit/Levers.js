import * as THREE from 'three';
import { colored, merge } from './geometry.js';

/** Lever travel shared with the gate markings painted on the console. */
export const THROTTLE_SWING = (35 * Math.PI) / 180;
export const THROTTLE_ARM = 0.13;

const vc = (g, c) => colored(g, c);
const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/**
 * Throttle lever on a console. Panel-local frame: X right, Y forward
 * (panel top edge), Z up out of the console. Pivots below the surface.
 */
export class ThrottleLever {
  constructor() {
    this.material = lambert();
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.z = -0.03;
    this.object.add(this.pivot);

    const arm = THROTTLE_ARM + 0.03;
    const geo = merge([
      vc(new THREE.BoxGeometry(0.012, 0.012, arm).translate(0, 0, arm / 2), '#8e928a'),
      // Handle: angled grip block with a thumb plate and a red button
      vc(new THREE.BoxGeometry(0.05, 0.034, 0.03).translate(0, 0, arm + 0.012), '#1c1d1a'),
      vc(new THREE.BoxGeometry(0.056, 0.012, 0.024).translate(0, -0.021, arm + 0.008), '#2a2c27'),
      vc(new THREE.BoxGeometry(0.012, 0.01, 0.006).translate(-0.012, 0.006, arm + 0.03), '#b0261b'),
      vc(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 6).rotateX(Math.PI / 2).translate(0.012, 0.004, arm + 0.03), '#c9c3a8'),
    ]);
    this.pivot.add(new THREE.Mesh(geo, this.material));

    // Gate cover plate with the slot
    const plate = merge([
      vc(new THREE.BoxGeometry(0.008, 0.19, 0.006).translate(-0.012, 0, 0.003), '#262823'),
      vc(new THREE.BoxGeometry(0.008, 0.19, 0.006).translate(0.012, 0, 0.003), '#262823'),
    ]);
    this.object.add(new THREE.Mesh(plate, this.material));
    this.pickables = [...this.pivot.children];
  }

  /** @param t throttle in [-1, 1] */
  set(t) {
    this.pivot.rotation.x = -t * THROTTLE_SWING;
  }

  dispose() {
    this.object.traverse((o) => o.geometry?.dispose());
    this.material.dispose();
  }
}

/**
 * Side stick: rubber boot, shaft and grip with hat switch and trigger.
 * set(x, y, twist) with inputs in [-1, 1]: x = right, y = forward.
 */
export class SideStick {
  constructor() {
    this.material = lambert();
    this.object = new THREE.Group();
    const boot = merge([
      vc(new THREE.CylinderGeometry(0.022, 0.038, 0.04, 8).rotateX(Math.PI / 2).translate(0, 0, 0.02), '#151614'),
    ]);
    this.object.add(new THREE.Mesh(boot, this.material));

    this.gimbal = new THREE.Group();
    this.gimbal.position.z = 0.01;
    this.object.add(this.gimbal);
    this.twistNode = new THREE.Group();
    this.gimbal.add(this.twistNode);

    const grip = merge([
      vc(new THREE.CylinderGeometry(0.008, 0.009, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.05), '#7f837a'),
      vc(new THREE.BoxGeometry(0.036, 0.042, 0.11).translate(0, -0.004, 0.15), '#1b1c19'),
      vc(new THREE.BoxGeometry(0.03, 0.05, 0.02).translate(0, 0.006, 0.212), '#24261f'),
      vc(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6).rotateX(Math.PI / 2).translate(0, 0.012, 0.226), '#c9c3a8'),
      vc(new THREE.BoxGeometry(0.01, 0.006, 0.02).translate(0, 0.026, 0.18), '#b0261b'),
    ]);
    this.twistNode.add(new THREE.Mesh(grip, this.material));
    this.pickables = [...this.twistNode.children];
  }

  set(x, y, twist) {
    // Forward push tips the grip toward +Y, right tips it toward +X.
    this.gimbal.rotation.set(-y * 0.32, x * 0.32, 0, 'XYZ');
    this.twistNode.rotation.z = -twist * 0.35;
  }

  dispose() {
    this.object.traverse((o) => o.geometry?.dispose());
    this.material.dispose();
  }
}

/**
 * A grip of the cockpit model (node with its pivot at the grip base, model space: Y up,
 * -Z forward) driven like the levers above: 'throttle' swings fore/aft with the throttle,
 * 'stick' tilts with the stick input and twists. Geometry and material belong to the shared
 * model; nothing to dispose here.
 */
export class ModelGrip {
  constructor(node, kind) {
    this.object = node;
    this.kind = kind;
    this.pickables = [];
    node.traverse((o) => {
      if (o.isMesh) this.pickables.push(o);
    });
  }

  set(a, b = 0, twist = 0) {
    if (this.kind === 'throttle') this.object.rotation.set(-a * 0.42, 0, 0);
    else this.object.rotation.set(-b * 0.3, -twist * 0.35, -a * 0.3, 'XZY');
  }

  dispose() {}
}
