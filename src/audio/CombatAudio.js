import * as THREE from 'three';
import { WORLD_AUDIO } from '../data/sounds.js';

const rel = new THREE.Vector3();
const right = new THREE.Vector3();
const camVel = new THREE.Vector3();
const lastCam = new THREE.Vector3();
const SPEED_OF_SOUND = 340;
const FLIGHT_VOICES = 2;
const FLIGHT_RANGE = 320;

/**
 * Plays combat sounds positioned relative to the listener (the active
 * camera): gain falls with distance, pan follows the direction.
 * Own weapons use a fixed pan by hardpoint side instead.
 */
export class CombatAudio {
  constructor(audio, camera) {
    this.audio = audio;
    this.camera = camera;
    this.beamLoops = new Map();
    this.flight = [];
    this.camInit = false;
  }

  /**
   * Missile motors in flight: the nearest missiles get a roaring loop with
   * distance gain, pan and Doppler shift (closing → higher, receding → lower).
   */
  missiles(projectiles, dt) {
    const cam = this.camera.position;
    if (!this.camInit || dt <= 0) {
      lastCam.copy(cam);
      this.camInit = true;
    }
    camVel.subVectors(cam, lastCam).divideScalar(Math.max(dt, 1e-3));
    lastCam.copy(cam);
    const near = [];
    for (const p of projectiles.pool) {
      if (!p.active || !p.def.missile || p.age < 0.05) continue;
      const d = p.pos.distanceTo(cam);
      if (d < FLIGHT_RANGE) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d);
    right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    for (let i = 0; i < FLIGHT_VOICES; i++) {
      const n = near[i];
      if (!this.flight[i]) {
        if (!n) continue;
        this.flight[i] = this.audio.loop('missileFlight');
      }
      const v = this.flight[i];
      if (!n) {
        v.setGain(0, 0.1);
        continue;
      }
      rel.subVectors(n.p.pos, cam);
      const dir = rel.divideScalar(Math.max(n.d, 0.1));
      // Doppler: radial speeds of source (toward listener positive) and listener
      const vs = -n.p.vel.dot(dir);
      const vl = camVel.dot(dir);
      const rate = Math.max(0.5, Math.min(2, (SPEED_OF_SOUND + vl) / Math.max(60, SPEED_OF_SOUND - vs)));
      const burning = n.p.burnLeft > 0 ? 1 : 0.35;
      v.setGain(burning * Math.max(0.05, 1 / (1 + n.d / 25)), 0.05);
      v.setRate(rate * (n.p.def.size === 'L' ? 0.7 : 1), 0.05);
    }
  }

  at(name, point, opts = {}) {
    const cam = this.camera;
    rel.subVectors(point, cam.position);
    const dist = rel.length();
    const gain = Math.max(WORLD_AUDIO.minGain, 1 / (1 + dist / WORLD_AUDIO.ref));
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const pan = dist > 0.1 ? Math.max(-0.9, Math.min(0.9, rel.dot(right) / dist)) : 0;
    this.audio.play(name, { ...opts, gain: (opts.gain ?? 1) * gain, pan });
  }

  own(name, side, opts = {}) {
    this.audio.play(name, { ...opts, pan: side * 0.45 });
  }

  /** Continuous beam hum for a beam weapon (point: an enemy's beam, quieter with distance). */
  beam(slotId, on, point = null) {
    let v = this.beamLoops.get(slotId);
    if (!v && on) {
      v = this.audio.loop('beam');
      this.beamLoops.set(slotId, v);
    }
    let gain = 1;
    if (point) {
      const dist = rel.subVectors(point, this.camera.position).length();
      gain = Math.max(WORLD_AUDIO.minGain, 1 / (1 + dist / WORLD_AUDIO.ref)) * 0.8;
    }
    v?.setGain(on ? gain : 0, on ? 0.02 : 0.08);
  }

  dispose() {
    for (const v of this.beamLoops.values()) v.stop(0.1);
    this.beamLoops.clear();
    for (const v of this.flight) v?.stop(0.1);
    this.flight = [];
  }
}
