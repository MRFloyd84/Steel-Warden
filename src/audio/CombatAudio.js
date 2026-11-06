import * as THREE from 'three';
import { WORLD_AUDIO } from '../data/sounds.js';

const rel = new THREE.Vector3();
const right = new THREE.Vector3();

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

  /** Continuous beam hum for one of the player's beam weapons. */
  beam(slotId, on) {
    let v = this.beamLoops.get(slotId);
    if (!v && on) {
      v = this.audio.loop('beam');
      this.beamLoops.set(slotId, v);
    }
    v?.setGain(on ? 1 : 0, on ? 0.02 : 0.08);
  }

  dispose() {
    for (const v of this.beamLoops.values()) v.stop(0.1);
    this.beamLoops.clear();
  }
}
