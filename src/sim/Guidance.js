import * as THREE from 'three';

const DEG = Math.PI / 180;
const GRAVITY = 9.81;
const goal = new THREE.Vector3();
const axis = new THREE.Vector3();
const tmp = new THREE.Vector3();
const q = new THREE.Quaternion();

/**
 * Missile flight and guidance, one step.
 *
 * Flight: launch speed, thrust up to maxSpeed while the motor burns, then
 * ballistic (gravity, slight drag, a third of the agility left).
 * Guidance turns the flight direction toward a wish direction by at most
 * turnRate °/s:
 *   dumb        no wish direction
 *   active      own seeker: follows the target while it stays inside seekerCone
 *   semiActive  only while ctx.illuminated(p) (player keeps lock + cone); once lost, never again
 *   antiRadar   homes on the nearest emitting unit inside seekerCone (searches every 0.25 s)
 *   optical     the player's steering input (p.steer, consumed up to the turn rate)
 * Loft (SPEER, guided): climbs for the first 1.5 s before turning onto the target.
 */
export function stepMissile(p, dt, ctx) {
  const m = p.def.missile;
  const burning = p.burnLeft > 0;
  if (burning) {
    p.burnLeft -= dt;
    p.speed = Math.min(m.maxSpeed, p.speed + m.thrust * dt);
  } else {
    p.speed = Math.max(20, p.speed * (1 - 0.02 * dt));
  }
  const dir = tmp.copy(p.vel).normalize();
  const turn = m.turnRate * DEG * dt * (burning ? 1 : 0.35);

  if (p.mode === 'optical') {
    // Player steering: yaw around world up, pitch around the missile's right axis
    const yaw = clampAbs(p.steer.yaw, turn);
    const pitch = clampAbs(p.steer.pitch, turn);
    p.steer.yaw -= yaw; // the rest carries over (turn rate limit)
    p.steer.pitch -= pitch;
    if (yaw) dir.applyQuaternion(q.setFromAxisAngle(axis.set(0, 1, 0), yaw));
    if (pitch) {
      axis.crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
      if (axis.lengthSq() > 0.5) dir.applyQuaternion(q.setFromAxisAngle(axis, pitch));
    }
  } else {
    const wish = wishDirection(p, ctx, dir);
    if (wish) turnToward(dir, wish, turn);
  }

  p.vel.copy(dir).multiplyScalar(p.speed);
  if (!burning) p.vel.y -= GRAVITY * (ctx.gravity ?? 1) * dt * 3; // falls once the motor is out
  p.speed = p.vel.length();
}

function wishDirection(p, ctx, dir) {
  const m = p.def.missile;
  if (p.mode === 'dumb' || p.lost) return null;
  if (m.loft && p.age < 1.5) return goal.set(dir.x, 0, dir.z).normalize().setY(0.9).normalize();

  if (p.mode === 'antiRadar') {
    if (!p.target?.emitting || p.target.wreck?.kind === 'reactor') {
      p.target = null;
      p.searchT -= ctx.dt;
      if (p.searchT <= 0) {
        p.searchT = 0.25;
        p.target = findEmitter(p, ctx.emitters(), dir);
      }
    }
    if (!p.target) return null;
  }
  const t = p.target;
  if (!t || t.wreck?.kind === 'reactor') {
    p.lost = true;
    return null;
  }
  if (p.mode === 'semiActive' && !ctx.illuminated(p)) {
    p.lost = true; // once the lock is broken the missile flies on straight
    return null;
  }
  t.volumes.componentCenter(p.component ?? 'torso', goal).sub(p.pos);
  const dist = goal.length();
  if (dist < 1e-3) return null;
  goal.divideScalar(dist);
  if (p.mode === 'active' && Math.acos(Math.min(1, goal.dot(dir))) > m.seekerCone * DEG) {
    p.lost = true; // left the seeker's field of view
    return null;
  }
  return goal;
}

function findEmitter(p, units, dir) {
  let best = null;
  let bestAngle = p.def.missile.seekerCone * DEG;
  for (const u of units) {
    if (u === p.owner || !u.emitting || u.wreck?.kind === 'reactor') continue;
    u.volumes.componentCenter('torso', goal).sub(p.pos);
    const a = Math.acos(Math.min(1, goal.normalize().dot(dir)));
    if (a < bestAngle) {
      bestAngle = a;
      best = u;
    }
  }
  return best;
}

function turnToward(dir, wish, maxAngle) {
  const angle = Math.acos(Math.max(-1, Math.min(1, dir.dot(wish))));
  if (angle < 1e-5) return;
  axis.crossVectors(dir, wish);
  if (axis.lengthSq() < 1e-10) return;
  axis.normalize();
  dir.applyQuaternion(q.setFromAxisAngle(axis, Math.min(angle, maxAngle)));
}

function clampAbs(v, max) {
  return v > max ? max : v < -max ? -max : v;
}

/** Nearest emitting unit inside a cone (anti-radar launch: the player's torso cone). */
export function pickEmitter(units, eye, aimDir, coneDeg, owner) {
  let best = null;
  let bestAngle = coneDeg * DEG;
  for (const u of units) {
    if (u === owner || !u.emitting || u.wreck?.kind === 'reactor') continue;
    u.volumes.componentCenter('torso', goal).sub(eye);
    const a = Math.acos(Math.min(1, goal.normalize().dot(aimDir)));
    if (a < bestAngle) {
      bestAngle = a;
      best = u;
    }
  }
  return best;
}
