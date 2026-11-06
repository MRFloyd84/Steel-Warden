import * as THREE from 'three';

/**
 * Torso-mounted searchlight. The light always stays in the scene and is
 * dimmed to zero when off — adding/removing lights would force every
 * terrain material to recompile.
 */
export class Floodlight {
  constructor(scene, cfg) {
    this.cfg = cfg;
    this.light = new THREE.SpotLight(cfg.color, 0, cfg.distance, (cfg.angle * Math.PI) / 180, cfg.penumbra, cfg.decay);
    this.offset = new THREE.Vector3().fromArray(cfg.mountOffset);
    this.tmp = new THREE.Vector3();
    scene.add(this.light, this.light.target);
    this.scene = scene;
    this.on = false;
  }

  setOn(on) {
    this.on = on;
    this.light.intensity = on ? this.cfg.intensity : 0;
  }

  /** @param pose walker pose, torsoQuat torso orientation, aimDir unit vector */
  update(pose, torsoQuat, aimDir) {
    this.tmp.copy(this.offset).applyQuaternion(torsoQuat);
    this.light.position.set(pose.x + this.tmp.x, pose.y + this.tmp.y, pose.z + this.tmp.z);
    this.light.target.position.copy(this.light.position).addScaledVector(aimDir, 40);
    // Aim slightly down so the beam lands on the ground ahead.
    this.light.target.position.y -= 6;
  }

  dispose() {
    this.scene.remove(this.light, this.light.target);
    this.light.dispose();
  }
}
