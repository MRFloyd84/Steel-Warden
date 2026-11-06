import * as THREE from 'three';
import { clamp, damp, DEG } from '../util/math.js';

/**
 * Composes the two cameras from the walker's torso pose and the pilot's
 * head: the world camera sees the terrain through the torso frame, the
 * cockpit camera sits in torso-local space. Free look turns only the head,
 * so the cockpit stays put around you while you look about.
 */
export class PilotView {
  constructor(worldCamera, cockpitCamera, viewConfig) {
    this.world = worldCamera;
    this.cockpit = cockpitCamera;
    this.cfg = viewConfig;
    this.yaw = 0;
    this.pitch = 0;
    this.freeLook = false;
    this.freeLookLatched = false;
    this.torsoQuat = new THREE.Quaternion();
    this.headQuat = new THREE.Quaternion();
    this.aimDir = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.headOffset = new THREE.Vector3();
  }

  toggleLatch() {
    this.freeLookLatched = !this.freeLookLatched;
  }

  setHold(held) {
    this.freeLook = held || this.freeLookLatched;
  }

  look(dx, dy) {
    const c = this.cfg;
    this.yaw = clamp(this.yaw - dx, -c.freeLookYaw * DEG, c.freeLookYaw * DEG);
    this.pitch = clamp(this.pitch - dy, -c.freeLookPitchDown * DEG, c.freeLookPitchUp * DEG);
  }

  update(dt) {
    if (this.freeLook) return;
    const k = damp(this.cfg.recenterRate, dt);
    this.yaw += (0 - this.yaw) * k;
    this.pitch += (0 - this.pitch) * k;
  }

  /** @param pose interpolated walker pose (see WalkerMotion.writePose) */
  apply(pose) {
    this.euler.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    this.torsoQuat.setFromEuler(this.euler);
    this.euler.set(this.pitch + this.cfg.neutralPitch * DEG, this.yaw, 0, 'YXZ');
    this.headQuat.setFromEuler(this.euler);

    // Head lag: the body moves, the head trails a little behind.
    this.headOffset.set(0, pose.headY, pose.headZ);
    this.cockpit.position.copy(this.headOffset);
    this.cockpit.quaternion.copy(this.headQuat);

    this.world.position.copy(this.headOffset).applyQuaternion(this.torsoQuat);
    this.world.position.x += pose.x;
    this.world.position.y += pose.y;
    this.world.position.z += pose.z;
    this.world.quaternion.copy(this.torsoQuat).multiply(this.headQuat);

    // Weapon aim follows the torso (without bob/sway) for the reticle.
    this.euler.set(pose.aimPitch, pose.yaw, 0, 'YXZ');
    this.aimDir.set(0, 0, -1).applyEuler(this.euler);
  }
}
