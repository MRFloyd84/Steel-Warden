import * as THREE from 'three';
import { raycastTerrain } from '../sim/HitVolumes.js';

const DEG = Math.PI / 180;
const LIGHT = { day: 1, dusk: 0.75, dawn: 0.75, night: 0.45 };
const CLOSE = 70; // m — noticed all around, whatever the cone says
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const d = new THREE.Vector3();

/**
 * What an AI unit can know about a target (A3 — the full radar comes with A4):
 *
 *   sight     range (unit's ai.sight.range × difficulty × daylight × weather), a cone
 *             around the torso heading (all around within 70 m), free line of sight
 *             (terrain raycast + buildings and big rocks)
 *   emitting  an emitting target (player: SENSOREN switch on) is located up to
 *             ai.detectEmitting — position known, but not seen (no direct fire)
 *   noise     shots and explosions tell units nearby a position (AIDirector.noise)
 *
 * Night: a lit floodlight makes the player visible as by day.
 */
export class Perception {
  constructor({ world, mission, difficulty, lit = () => false }) {
    this.world = world;
    this.difficulty = difficulty;
    this.lit = lit;
    this.light = LIGHT[mission.timeOfDay] ?? 1;
    const fog = world.weatherDef?.fog?.far ?? 1;
    this.weather = Math.max(0.3, Math.min(1, fog * 1.15));
    this.checks = 0;
  }

  /** Factor on sight ranges from light, weather and difficulty. */
  rangeFactor(target) {
    const light = target?.isPlayer && this.lit() ? 1 : this.light;
    return light * this.weather * this.difficulty.sight;
  }

  /** Free line between two points (terrain, buildings, rocks); ignore: a structure (own gun). */
  lineOfSight(p0, p1, ignore = null) {
    this.checks++;
    const dir = d.subVectors(p1, p0);
    const len = dir.length();
    if (len < 1) return true;
    dir.divideScalar(len);
    if (raycastTerrain(this.world.sampler, p0, dir, len - 3, 6) !== null) return false;
    return !this.world.objects.blocked(p0, p1, ignore);
  }

  /**
   * Can a walker see the target? eye: world point, yaw: torso heading,
   * sight: { range, coneDeg }. Returns 'seen' | 'located' | null.
   */
  look(eye, yaw, sight, detectEmitting, target, ignore = null) {
    const t = target.volumes.componentCenter('torso', b);
    const dx = t.x - eye.x;
    const dz = t.z - eye.z;
    const dist = Math.hypot(dx, dz);
    const range = sight.range * this.rangeFactor(target);
    let seen = false;
    if (dist <= range) {
      const off = Math.abs(wrap(Math.atan2(-dx, -dz) - yaw));
      if (dist < CLOSE || off <= (sight.coneDeg / 2) * DEG) seen = this.lineOfSight(a.copy(eye), t, ignore);
    }
    if (seen) return 'seen';
    if (target.emitting && dist <= detectEmitting) return 'located';
    return null;
  }
}

export function wrap(x) {
  return Math.atan2(Math.sin(x), Math.cos(x));
}
