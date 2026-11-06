import * as THREE from 'three';

const POOL = 256;
const tmp = new THREE.Vector3();
const want = new THREE.Vector3();
const segEnd = new THREE.Vector3();

/**
 * Pooled projectiles (bolts, slugs, pellets, missiles). Fixed-size pool,
 * no allocation per shot. Each step a projectile moves along a segment that
 * is tested against the terrain and the walkers' hit volumes.
 *
 * Missiles: 'track' steers toward the locked target once the lock was held
 * long enough, 'lofted' (SPEER) climbs first and then dives onto the target
 * or the aim point.
 *
 * Hits are reported through onHit({ proj, unit|null, hit|null, point, ground }).
 */
export class Projectiles {
  constructor({ sampler, units, onHit }) {
    this.sampler = sampler;
    this.units = units; // () => array of combat units { id, volumes, wreck }
    this.onHit = onHit;
    this.pool = Array.from({ length: POOL }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      aim: new THREE.Vector3(),
      def: null,
      owner: null,
      target: null,
      guided: false,
      age: 0,
      life: 0,
      speed: 0,
    }));
    this.count = 0;
  }

  /** Spawns a projectile; returns it or null if the pool is exhausted. */
  spawn({ def, owner, origin, dir, target = null, guided = false, aimPoint = null }) {
    const p = this.pool.find((x) => !x.active);
    if (!p) return null;
    p.active = true;
    p.def = def;
    p.owner = owner;
    p.target = target;
    p.guided = guided;
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.speed = def.projectileSpeed;
    p.vel.copy(dir).multiplyScalar(p.speed);
    if (def.guidance === 'lofted') {
      // Climb steeply first
      p.vel.y = Math.max(p.vel.y, 0) + p.speed * 0.9;
      p.vel.setLength(p.speed);
    }
    p.aim.copy(aimPoint ?? tmp.copy(origin).addScaledVector(dir, def.range));
    p.age = 0;
    p.life = (def.range / Math.max(1, def.projectileSpeed)) * (def.guidance === 'lofted' ? 2.2 : 1.25);
    this.count++;
    return p;
  }

  update(dt) {
    const units = this.units();
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age > p.life) {
        this.kill(p);
        continue;
      }
      if (p.def.kind === 'missile') this.steer(p, dt);
      p.prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      this.collide(p, units);
    }
  }

  steer(p, dt) {
    const d = p.def;
    let goal = null;
    if (p.guided && p.target && !p.target.wreck) goal = p.target.volumes.componentCenter('torso', want);
    else if (d.guidance === 'lofted') goal = want.copy(p.aim);
    if (!goal) return;
    if (d.guidance === 'lofted' && p.age < 1.2) return; // still climbing
    tmp.subVectors(goal, p.pos).normalize().multiplyScalar(p.speed);
    const k = 1 - Math.exp(-(d.turnRate ?? 1.5) * dt);
    p.vel.lerp(tmp, k).setLength(p.speed);
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
    if (best && (tGround === null || best.hit.t <= tGround)) {
      this.onHit({ proj: p, unit: best.unit, hit: best.hit, point: best.hit.point, ground: false });
      this.kill(p);
    } else if (tGround !== null) {
      segEnd.copy(p.prev).lerp(p.pos, tGround);
      this.onHit({ proj: p, unit: null, hit: null, point: segEnd.clone(), ground: true });
      this.kill(p);
    }
  }

  kill(p) {
    p.active = false;
    p.target = null;
    this.count--;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.count = 0;
  }
}
