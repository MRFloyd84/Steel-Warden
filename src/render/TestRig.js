import * as THREE from 'three';
import { clamp, damp } from '../util/math.js';

/**
 * Debug free camera (F7) for inspecting terrain and, later, walker models:
 * ground mode follows the surface, fly mode moves freely. Runs at the
 * fixed step; the camera interpolates between the last two sim positions.
 */
export class TestRig {
  constructor(camera, sampler, config) {
    this.camera = camera;
    this.sampler = sampler;
    this.cfg = config;
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.fly = false;
    this.distance = 0;
    this.target = new THREE.Vector3();
  }

  place(x, z, heading) {
    this.pos.set(x, this.sampler.heightAt(x, z) + this.cfg.eyeHeight, z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.yaw = heading;
    this.pitch = 0;
  }

  /** Start free flight from an existing camera position and heading. */
  placeAt(position, yaw, pitch) {
    this.pos.copy(position);
    this.prev.copy(position);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.fly = true;
  }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.4, 1.4);
  }

  toggleFly() {
    this.fly = !this.fly;
    if (!this.fly) this.vel.y = 0;
  }

  update(dt, input) {
    const c = this.cfg;
    const move = input.axis('move');
    const strafe = input.axis('strafe');
    const speed = (this.fly ? c.flySpeed : c.groundSpeed) * (input.isDown('boost') ? c.boostFactor : 1);

    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    // Camera looks down -Z at yaw 0.
    const fx = -sy;
    const fz = -cy;
    const rx = cy;
    const rz = -sy;

    this.target.set((fx * move + rx * strafe) * speed, 0, (fz * move + rz * strafe) * speed);
    if (this.fly) {
      const pitchLift = Math.sin(this.pitch) * move * speed;
      this.target.y = pitchLift + input.axis('vertical') * speed;
    }
    this.vel.lerp(this.target, damp(c.responsiveness, dt));

    this.prev.copy(this.pos);
    this.pos.addScaledVector(this.vel, dt);

    const ground = this.sampler.heightAt(this.pos.x, this.pos.z);
    if (this.fly) {
      this.pos.y = Math.max(this.pos.y, ground + c.minFlyClearance);
    } else {
      this.pos.y = ground + c.eyeHeight;
    }

    const dx = this.pos.x - this.prev.x;
    const dz = this.pos.z - this.prev.z;
    this.distance += Math.sqrt(dx * dx + dz * dz);
  }

  /** Writes the interpolated transform into the camera. */
  apply(alpha) {
    this.camera.position.lerpVectors(this.prev, this.pos, alpha);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get heading() {
    let deg = (-this.yaw * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    return deg;
  }
}
