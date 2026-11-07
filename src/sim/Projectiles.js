import * as THREE from 'three';
import { stepMissile } from './Guidance.js';

const POOL = 256;
const tmp = new THREE.Vector3();
const segEnd = new THREE.Vector3();

/**
 * Pooled projectiles (bolts, slugs, pellets, missiles). Fixed-size pool,
 * no allocation per shot. Each step a projectile moves along a segment that
 * is tested against the terrain and the walkers' hit volumes.
 *
 * Missiles fly with their own flight model and guidance (sim/Guidance.js);
 * ctx gives guidance access to the units and to the player's lock
 * (semi-active illumination).
 *
 * Hits are reported through onHit({ proj, unit|null, hit|null, point, ground, obstacle? }).
 */
export class Projectiles {
  constructor({ sampler, units, onHit, onEnd = null, illuminated = () => false, obstacles = null, emitters = null, gravity = 1 }) {
    this.sampler = sampler;
    this.obstacles = obstacles; // WorldObjects: buildings and big scatter
    this.gravity = gravity;
    this.units = units; // () => array of combat units { id, volumes, wreck }
    this.onHit = onHit;
    this.onEnd = onEnd; // (proj, reason: 'hit' | 'ground' | 'expired') — e.g. missile camera
    this.guideCtx = { units, emitters: emitters ?? units, illuminated, dt: 0, gravity };
    this.serial = 0;
    this.pool = Array.from({ length: POOL }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      aim: new THREE.Vector3(),
      def: null,
      owner: null,
      target: null,
      mode: 'dumb',
      component: null,
      lost: false,
      burnLeft: 0,
      searchT: 0,
      steer: { yaw: 0, pitch: 0 },
      damageFactor: 1,
      serial: 0,
      age: 0,
      life: 0,
      speed: 0,
    }));
    this.count = 0;
  }

  /**
   * Spawns a projectile; returns it or null if the pool is exhausted.
   * Missiles: mode ('dumb' | 'active' | 'semiActive' | 'antiRadar' | 'optical'),
   * target unit, component to home on, damageFactor (semi-active bonus).
   */
  spawn({ def, owner, origin, dir, target = null, mode = 'dumb', component = null, damageFactor = 1, aimPoint = null }) {
    const p = this.pool.find((x) => !x.active);
    if (!p) return null;
    p.active = true;
    p.def = def;
    p.owner = owner;
    p.target = target;
    p.mode = mode;
    p.component = component;
    p.damageFactor = damageFactor;
    p.lost = false;
    p.steer.yaw = 0;
    p.steer.pitch = 0;
    p.serial = ++this.serial;
    p.pos.copy(origin);
    p.prev.copy(origin);
    const m = def.missile;
    p.speed = m ? m.launchSpeed : def.projectileSpeed;
    p.burnLeft = m ? m.burnTime : 0;
    p.searchT = 0;
    p.vel.copy(dir).multiplyScalar(p.speed);
    p.aim.copy(aimPoint ?? tmp.copy(origin).addScaledVector(dir, def.range));
    p.age = 0;
    p.life = m ? m.burnTime + 14 : (def.range / Math.max(1, def.projectileSpeed)) * 1.25;
    this.count++;
    return p;
  }

  /** Active player missile by serial (for the camera), or null. */
  bySerial(serial) {
    return this.pool.find((p) => p.active && p.serial === serial) ?? null;
  }

  update(dt) {
    const units = this.units();
    this.guideCtx.dt = dt;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age > p.life) {
        this.kill(p, 'expired');
        continue;
      }
      if (p.def.missile) stepMissile(p, dt, this.guideCtx);
      p.prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      this.collide(p, units);
    }
  }

  collide(p, units) {
    // Terrain: first sample point below ground on the segment
    const ground = this.sampler.heightAt(p.pos.x, p.pos.z);
    let tGround = null;
    if (p.pos.y < ground) {
      const above0 = p.prev.y - this.sampler.heightAt(p.prev.x, p.prev.z);
      const above1 = p.pos.y - ground;
      tGround = above0 > 0 ? above0 / (above0 - above1) : 0;
    }
    let best = null;
    for (const u of units) {
      if (u === p.owner) continue;
      const hit = u.volumes.intersectSegment(p.prev, p.pos);
      if (hit && (!best || hit.t < best.hit.t)) best = { unit: u, hit };
    }
    // Buildings and rocks
    const obs = this.obstacles?.segment(p.prev, p.pos);
    if (obs && (!best || obs.t < best.hit.t) && (tGround === null || obs.t <= tGround)) {
      this.onHit({ proj: p, unit: null, hit: null, point: obs.point, ground: false, obstacle: obs });
      this.kill(p, 'hit');
      return;
    }
    if (best && (tGround === null || best.hit.t <= tGround)) {
      this.onHit({ proj: p, unit: best.unit, hit: best.hit, point: best.hit.point, ground: false });
      this.kill(p, 'hit');
    } else if (tGround !== null) {
      segEnd.copy(p.prev).lerp(p.pos, tGround);
      this.onHit({ proj: p, unit: null, hit: null, point: segEnd.clone(), ground: true });
      this.kill(p, 'ground');
    }
  }

  kill(p, reason = 'expired') {
    if (p.def?.missile) this.onEnd?.(p, reason);
    p.active = false;
    p.target = null;
    this.count--;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.count = 0;
  }
}
