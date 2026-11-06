import * as THREE from 'three';

/**
 * Outside view: behind and above the walker's torso. The pilot's free-look
 * angles orbit it; the camera eases after the walker and stays above ground.
 */
export class ChaseCamera {
  constructor(camera, sampler) {
    this.camera = camera;
    this.sampler = sampler;
    this.goal = new THREE.Vector3();
    this.target = new THREE.Vector3();
  }

  /** @param pose walker pose, eyeHeight for scale, orbit { yaw, pitch } in radians */
  apply(pose, eyeHeight, orbit, dt) {
    const yaw = pose.yaw + orbit.yaw;
    const pitch = 0.22 - orbit.pitch * 0.6;
    const dist = eyeHeight * 3.4;
    this.target.set(pose.x, pose.y - eyeHeight * 0.45, pose.z);
    // Behind = opposite of the torso's forward (-sin yaw, -cos yaw)
    this.goal.set(
      this.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      this.target.y + Math.sin(pitch) * dist,
      this.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    const ground = this.sampler.heightAt(this.goal.x, this.goal.z) + 1.5;
    if (this.goal.y < ground) this.goal.y = ground;
    this.camera.position.lerp(this.goal, dt > 0 ? 1 - Math.exp(-8 * dt) : 1);
    this.camera.lookAt(this.target);
  }
}
