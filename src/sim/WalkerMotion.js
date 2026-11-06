import { Throttle } from './Throttle.js';
import { Spring } from '../util/Spring.js';
import { clamp, damp, DEG } from '../util/math.js';

/**
 * Walker locomotion on the fixed sim step: throttle-driven speed with
 * inertia, leg heading vs. torso twist/pitch, slope drag, stride bob,
 * footfall jolts and braking pitch. Produces a pose (torso frame at the
 * pilot's eye) that the renderer interpolates between steps.
 *
 * Angles: yaw in radians, positive = left (Three.js convention),
 * yaw 0 faces -Z ("north").
 */
export class WalkerMotion {
  constructor(walker, sampler, feel, bus) {
    this.w = walker;
    this.sampler = sampler;
    this.feel = feel;
    this.bus = bus;
    this.throttle = new Throttle(feel.throttleRate);

    this.x = 0;
    this.z = 0;
    this.legYaw = 0;
    this.speed = 0;
    this.accel = 0;
    this.twist = 0;
    this.twistTarget = 0;
    this.twistRate = 0; // rad/s actually turned (for servo sound)
    this.pitchRate = 0;
    this.pitch = 0;
    this.pitchTarget = 0;
    this.turnInput = 0;
    this.stepPhase = 0;
    this.stepCount = 0;
    this.motionAmount = 0;
    this.distance = 0;
    this.grade = 0;

    this.stride = feel.strideBase + walker.tonnage * feel.stridePerTon;
    this.bobAmp = feel.bobBase + walker.tonnage * feel.bobPerTon;
    this.swayAmp = walker.tonnage * feel.swayPerTon * DEG;
    this.pitchSpring = new Spring(feel.pitchSpring);
    this.rollSpring = new Spring(feel.pitchSpring);
    this.headY = new Spring(feel.headSpring);
    this.headZ = new Spring(feel.headSpring);

    // Set by WalkerSystems every step: what the machinery currently allows.
    this.limits = { throttleLocked: false, canMove: true, canTwist: true, speedFactor: 1, stance: 1 };
    this.standUpHeight = 0;
    this.slumpPitch = 0;

    this.pose = makePose();
    this.prevPose = makePose();
  }

  /** How far the walker sags when depressurised (from data/systems.js). */
  setStanceRange(height, pitchDeg) {
    this.standUpHeight = height;
    this.slumpPitch = pitchDeg * DEG;
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.legYaw = heading;
    this.speed = 0;
    this.twist = this.twistTarget = 0;
    this.pitch = this.pitchTarget = 0;
    this.writePose(this.pose);
    copyPose(this.prevPose, this.pose);
  }

  /** Mouse/stick aim in radians; moves the torso targets within limits. */
  aim(dx, dy) {
    const limit = this.w.torsoTwistLimit * DEG;
    const [pMin, pMax] = this.w.torsoPitchLimit;
    this.twistTarget = clamp(this.twistTarget - dx, -limit, limit);
    this.pitchTarget = clamp(this.pitchTarget - dy, pMin * DEG, pMax * DEG);
  }

  centerTorso() {
    this.twistTarget = 0;
    this.pitchTarget = 0;
  }

  /** @param input { throttleRate, throttleAbs, turn } */
  update(dt, input) {
    const w = this.w;
    const f = this.feel;
    copyPose(this.prevPose, this.pose);

    const lim = this.limits;
    if (lim.throttleLocked) this.throttle.value = 0;
    else this.throttle.update(dt, input.throttleRate, input.throttleAbs);
    const turn = lim.canMove ? input.turn : 0;
    this.turnInput = turn;

    // Leg heading
    const speedFrac = Math.abs(this.speed) / w.maxSpeed;
    const turnRate = w.turnRate * DEG * (1 + (f.turnAtSpeed - 1) * speedFrac);
    this.legYaw -= turn * turnRate * dt;

    // Speed with slope influence
    const fx = -Math.sin(this.legYaw);
    const fz = -Math.cos(this.legYaw);
    const ground = this.sampler.heightAt(this.x, this.z);
    const dir = Math.sign(this.speed) || Math.sign(this.throttle.value) || 1;
    const ahead = this.sampler.heightAt(this.x + fx * 3 * dir, this.z + fz * 3 * dir);
    this.grade = (ahead - ground) / 3;
    const t = this.throttle.value;
    let target = t >= 0 ? t * w.maxSpeed : t * w.maxReverseSpeed;
    const slope = clamp(1 - Math.max(0, this.grade) * f.uphillDrag + Math.max(0, -this.grade) * f.downhillBoost, 0.2, 1.2);
    target *= slope * lim.speedFactor;
    if (this.grade > f.maxGrade || !lim.canMove) target = 0;

    const prevSpeed = this.speed;
    const speedingUp = Math.abs(target) > Math.abs(this.speed) && Math.sign(target) !== -Math.sign(this.speed);
    const rate = w.acceleration * (speedingUp ? 1 : f.brakeFactor);
    const diff = target - this.speed;
    this.speed += clamp(diff, -rate * dt, rate * dt);
    this.accel = (this.speed - prevSpeed) / dt;

    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.distance += Math.abs(this.speed) * dt;

    // Torso twist and pitch move toward their targets at the walker's rates
    if (!lim.canTwist) {
      this.twistTarget = this.twist;
      this.pitchTarget = this.pitch;
    }
    const twistStep = w.torsoTwistRate * DEG * dt;
    const twistDelta = clamp(this.twistTarget - this.twist, -twistStep, twistStep);
    this.twist += twistDelta;
    this.twistRate = twistDelta / dt;
    const pitchStep = w.torsoPitchRate * DEG * dt;
    const pitchDelta = clamp(this.pitchTarget - this.pitch, -pitchStep, pitchStep);
    this.pitch += pitchDelta;
    this.pitchRate = pitchDelta / dt;

    this.updateGait(dt);

    // Weight: braking pitches the torso forward and it rocks back; turning leans
    this.pitchSpring.step(dt, this.accel * f.brakePitch);
    this.rollSpring.step(dt, turn * speedFrac * f.turnRoll);
    this.headY.step(dt);
    this.headZ.step(dt);
    this.headZ.kick(-this.accel * 0.004);

    this.writePose(this.pose);
  }

  updateGait(dt) {
    const speedAbs = Math.abs(this.speed);
    this.motionAmount += (Math.min(1, speedAbs / (this.w.maxSpeed * 0.3)) - this.motionAmount) * damp(4, dt);
    this.stepPhase += (speedAbs / this.stride) * Math.PI * dt;
    const steps = Math.floor(this.stepPhase / Math.PI);
    if (steps !== this.stepCount) {
      this.stepCount = steps;
      const strength = this.motionAmount;
      this.headY.kick(-this.w.tonnage * this.feel.footfallKick * strength);
      this.bus.emit('walker:footfall', {
        foot: steps % 2 === 0 ? 'left' : 'right',
        tonnage: this.w.tonnage,
        strength,
      });
    }
  }

  writePose(p) {
    const ground = this.sampler.heightAt(this.x, this.z);
    const s = Math.sin(this.stepPhase);
    p.x = this.x;
    p.z = this.z;
    const sag = 1 - this.limits.stance;
    p.y = ground + this.w.cockpit.eyeHeight - sag * this.standUpHeight + this.bobAmp * Math.abs(s) * this.motionAmount;
    p.yaw = this.legYaw + this.twist;
    p.pitch = this.pitch + this.pitchSpring.value - sag * this.slumpPitch;
    p.roll = this.swayAmp * s * this.motionAmount + this.rollSpring.value;
    p.aimPitch = this.pitch;
    p.headY = this.headY.value;
    p.headZ = this.headZ.value;
  }

  // ---- readouts for instruments and sound ----
  get torsoYaw() {
    return this.legYaw + this.twist;
  }

  get atTwistLimit() {
    return Math.abs(this.twist) >= this.w.torsoTwistLimit * DEG - 1e-4;
  }
}

function makePose() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, aimPitch: 0, headY: 0, headZ: 0 };
}

function copyPose(dst, src) {
  for (const k in src) dst[k] = src[k];
}

/** Interpolates two poses; yaw is unwrapped so it never spins the long way. */
export function lerpPose(out, a, b, t) {
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  let dy = b.yaw - a.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  out.yaw = a.yaw + dy * t;
  return out;
}
