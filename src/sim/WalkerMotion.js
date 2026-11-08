import { SURFACES } from '../data/surfaces.js';
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
 *
 * Mass (walker tonnage) shapes the feel on top of the walker's own rates: torso springs
 * (heavier = slower, longer swing), leg turn lag, braking. The machine condition comes in
 * through `limits` (CombatUnits.applyLimits): speedFactor (drive power incl. energy split
 * and legs), accelFactor (energy split), stability (legs, hydraulics, gyro) and limp.
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
    this.driveOverload = 0; // 0..1, drive work above nominal (overloadOf)
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
    // Torso springs scaled by mass, same damping ratio: k × s, c × √s with s = massRef / tonnage
    const [sMin, sMax] = feel.springMassRange ?? [1, 1];
    const s = clamp((feel.massRef ?? walker.tonnage) / walker.tonnage, sMin, sMax);
    const spring = { stiffness: feel.pitchSpring.stiffness * s, damping: feel.pitchSpring.damping * Math.sqrt(s) };
    this.springDamping = spring.damping;
    this.pitchSpring = new Spring(spring);
    this.rollSpring = new Spring(spring);
    // Legs reach their turn rate with a lag that grows with mass; braking carries more momentum
    this.turnLag = (feel.turnLagBase ?? 0) + walker.tonnage * (feel.turnLagPerTon ?? 0);
    this.turnState = 0;
    this.brakeFactor = (feel.brakeFactor ?? 1) * ((feel.massRef ?? walker.tonnage) / walker.tonnage) ** (feel.brakeMassExp ?? 0);
    this.limpSide = 1;
    this.headY = new Spring(feel.headSpring);
    this.headZ = new Spring(feel.headSpring);
    this.recoilPending = 0; // rad/s kicked since the last step
    this.recoilRate = 0; // low-passed kick rate (rad/s²)
    this.recoilComp = 0;
    this.recoilGap = Infinity; // s since the last shot
    this.recoilShot = false;

    // Ground: type under the feet (data/surfaces.js), thin ice breaking, collisions
    this.obstacles = null; // WorldObjects (buildings, big scatter)
    this.surface = 'hard';
    this.sink = 0; // current sink depth (broken ice)
    this.sinkTarget = 0;
    this.stuck = 0; // seconds left unable to move
    this.iceBroken = false;
    this.radius = 2.5 + walker.tonnage * 0.04;
    this.collided = false;

    // Set by WalkerSystems every step: what the machinery currently allows.
    this.limits = { throttleLocked: false, canMove: true, canTwist: true, speedFactor: 1, stance: 1, accelFactor: 1, stability: 1, limp: 0 };
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
    this.turnState = 0;
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

  /**
   * Shift+C: the legs turn (at their turn rate) until they point where the
   * torso looks; the torso keeps its world heading meanwhile.
   */
  alignLegsToTorso() {
    if (Math.abs(this.twist) > 0.01) this.aligning = true;
  }

  centerTorso() {
    this.aligning = false;
    this.alignCarry = false;
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
    let turn = lim.canMove ? input.turn : 0;
    const speedFrac0 = Math.abs(this.speed) / w.maxSpeed;
    const rateNow = w.turnRate * DEG * (1 + (f.turnAtSpeed - 1) * speedFrac0);
    if (turn) {
      this.aligning = false; // manual turning takes over
      this.alignCarry = false;
    } else if (this.aligning) {
      // Legs turn toward the torso. They lag with their mass: once the twist left is what they
      // still turn while slowing down (turnState × rate × lag), the command stops and they coast in.
      const coast = Math.abs(this.turnState) * rateNow * this.turnLag;
      if (Math.abs(this.twist) <= Math.max(coast, 0.3 * DEG)) {
        this.aligning = false;
        this.alignCarry = this.turnState !== 0;
      } else turn = -Math.sign(this.twist);
    }
    // Turn command → actual leg turning with the mass lag (first order, exact for the step)
    this.turnState += (turn - this.turnState) * (this.turnLag > 0 ? 1 - Math.exp(-dt / this.turnLag) : 1);
    if (Math.abs(this.turnState) < 1e-4 && !turn) this.turnState = 0;
    this.turnInput = this.turnState;
    const yawBefore = this.legYaw;

    // Leg heading
    const speedFrac = Math.abs(this.speed) / w.maxSpeed;
    const turnRate = w.turnRate * DEG * (1 + (f.turnAtSpeed - 1) * speedFrac);
    this.legYaw -= this.turnState * turnRate * dt;
    if (this.alignCarry && Math.abs(this.turnState) < 0.02) {
      // coasted out: a rest (e.g. the walker was still slowing down, so the legs turned faster
      // than predicted) is taken out with another short turn
      this.alignCarry = this.turnState !== 0 && Math.abs(this.twist) <= 0.5 * DEG;
      if (Math.abs(this.twist) > 0.5 * DEG) this.aligning = true;
    }
    if (this.aligning || this.alignCarry) {
      // Keep the torso's world heading: twist shrinks by what the legs turned (also while they coast out)
      const turned = this.legYaw - yawBefore;
      this.twist -= turned;
      this.twistTarget -= turned;
    }

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
    this.groundFactor = this.updateGround(dt);
    target *= slope * lim.speedFactor * this.groundFactor;
    if (this.grade > f.maxGrade || !lim.canMove || this.stuck > 0) target = 0;

    const prevSpeed = this.speed;
    const speedingUp = Math.abs(target) > Math.abs(this.speed) && Math.sign(target) !== -Math.sign(this.speed);
    // Energy split / damage set how hard the legs can push (accelFactor); braking is the legs'
    // own resistance and does not depend on the drive share (Phase 2.1)
    const rate = w.acceleration * (speedingUp ? (lim.accelFactor ?? 1) : this.brakeFactor);
    const diff = target - this.speed;
    this.speed += clamp(diff, -rate * dt, rate * dt);
    this.accel = (this.speed - prevSpeed) / dt;
    this.driveOverload = this.overloadOf(lim, slope, speedingUp, t >= 0 ? w.maxSpeed : w.maxReverseSpeed);

    const px = this.x;
    const pz = this.z;
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    // Buildings and big rocks push the walker back and eat its speed
    this.collided = false;
    if (this.obstacles) {
      const pos = { x: this.x, z: this.z };
      if (this.obstacles.resolveWalker(pos, this.radius)) {
        this.x = pos.x;
        this.z = pos.z;
        const moved = Math.hypot(this.x - px, this.z - pz) / Math.max(1e-4, Math.abs(this.speed) * dt);
        this.speed *= Math.min(1, moved);
        this.collided = true;
      }
    }
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

    // Weight: braking pitches the torso forward and it rocks back; turning leans.
    // Low stability (legs, hydraulics, gyro) damps the torso less: it wobbles longer.
    const unrest = 1 - clamp(lim.stability ?? 1, 0, 1);
    const damping = this.springDamping * (1 - (f.unrestDamping ?? 0) * unrest);
    this.pitchSpring.c = damping;
    this.rollSpring.c = damping;
    const held = this.updateRecoil(dt);
    this.pitchSpring.step(dt, this.accel * f.brakePitch - held / this.pitchSpring.k);
    this.rollSpring.step(dt, this.turnState * speedFrac * f.turnRoll);
    this.headY.step(dt);
    this.headZ.step(dt, (-held * 0.6) / this.headZ.k);
    this.headZ.kick(-this.accel * 0.004);

    this.writePose(this.pose);
  }

  /**
   * Share 0..1 of the actual drive work above the nominal walker (only possible with extra
   * drive energy, speedFactor / accelFactor > 1): speed above the nominal top speed for the
   * ground and slope, or acceleration above the nominal acceleration. Measured from what the
   * legs really do — standing or walking at nominal pace with ANTRIEB set gives 0.
   * SystemsLink turns it into reactor heat (docs/VALIDATION-0.5.0.md).
   */
  overloadOf(lim, slope, speedingUp, maxSpeed) {
    let over = 0;
    const sf = lim.speedFactor ?? 1;
    if (sf > 1 && lim.canMove) {
      const nominal = maxSpeed * slope * (this.groundFactor ?? 1);
      if (nominal > 0) over = (Math.abs(this.speed) - nominal) / (nominal * (sf - 1));
    }
    const af = lim.accelFactor ?? 1;
    if (af > 1 && speedingUp) over = Math.max(over, (Math.abs(this.accel) - this.w.acceleration) / (this.w.acceleration * (af - 1)));
    return clamp(over, 0, 1);
  }

  /** Ground type under the walker; returns its speed factor. Thin ice breaks under heavy walkers. */
  updateGround(dt) {
    const surf = this.sampler.surfaceAt ? this.sampler.surfaceAt(this.x, this.z) : 'hard';
    const def = SURFACES[surf] ?? SURFACES.hard;
    const tons = this.w.tonnage;
    if (surf === 'thinIce') {
      if (!this.iceBroken && tons >= def.breakTonnage) {
        this.iceBroken = true;
        this.sinkTarget = def.sink;
        this.stuck = def.stuck;
        this.bus.emit('walker:iceBreak', { tonnage: tons });
      }
    } else if (this.iceBroken) {
      this.iceBroken = false;
      this.sinkTarget = 0;
    }
    this.stuck = Math.max(0, this.stuck - dt);
    this.sink += clamp(this.sinkTarget - this.sink, -dt * 1.5, dt * 3);
    this.surface = surf;
    let k = def.speed ?? 1;
    if (def.perTon) k -= def.perTon * tons;
    if (this.iceBroken) k = Math.min(k, 0.55);
    return Math.max(def.minSpeed ?? 0.3, k);
  }

  updateGait(dt) {
    // Turning on the spot also makes the legs step.
    const yawSpeed = Math.abs(this.turnInput) * this.w.turnRate * DEG * this.feel.turnStepRadius;
    const speedAbs = Math.abs(this.speed) + yawSpeed;
    this.motionAmount += (Math.min(1, speedAbs / (this.w.maxSpeed * 0.3)) - this.motionAmount) * damp(4, dt);
    this.stepPhase += (speedAbs / this.stride) * Math.PI * dt;
    const steps = Math.floor(this.stepPhase / Math.PI);
    if (steps !== this.stepCount) {
      this.stepCount = steps;
      const strength = this.motionAmount;
      const unrest = 1 - clamp(this.limits.stability ?? 1, 0, 1);
      const limp = this.limits.limp ?? 0;
      // Damaged legs: every other step lands hard and throws the torso sideways
      this.limpSide = steps % 2 === 0 ? 1 : -1;
      const hard = limp > 0 && this.limpSide > 0 ? 1 + limp : 1;
      this.headY.kick(-this.w.tonnage * this.feel.footfallKick * strength * (1 + (this.feel.unrestKick ?? 0) * unrest) * hard);
      if (limp > 0) this.rollSpring.kick(this.limpSide * limp * (this.feel.limpRoll ?? 0) * DEG * strength * 3);
      this.bus.emit('walker:footfall', {
        foot: steps % 2 === 0 ? 'left' : 'right',
        tonnage: this.w.tonnage,
        strength,
        surface: this.iceBroken ? 'water' : this.surface,
      });
    }
  }

  writePose(p) {
    const ground = this.sampler.heightAt(this.x, this.z);
    const s = Math.sin(this.stepPhase);
    p.x = this.x;
    p.z = this.z;
    const sag = 1 - this.limits.stance;
    p.y = ground + this.w.cockpit.eyeHeight - sag * this.standUpHeight + this.bobAmp * Math.abs(s) * this.motionAmount - this.sink;
    p.yaw = this.legYaw + this.twist;
    p.pitch = this.pitch + this.pitchSpring.value - sag * this.slumpPitch;
    const unrest = 1 - clamp(this.limits.stability ?? 1, 0, 1);
    p.roll = this.swayAmp * (1 + (this.feel.unrestSway ?? 0) * unrest) * s * this.motionAmount + this.rollSpring.value;
    p.aimPitch = this.pitch;
    p.legYaw = this.legYaw;
    p.sink = this.sink;
    p.stepPhase = this.stepPhase;
    p.motionAmount = this.motionAmount;
    p.speed = this.speed;
    p.headY = this.headY.value;
    p.headZ = this.headZ.value;
  }

  /**
   * Recoil of a fired weapon (fixed step): pitches the torso up and pushes the head back.
   * @param impulse  rad/s on the torso pitch spring (MissionCombat computes it from weapon
   *                 weight, type and fire rate, walker tonnage and the stabilisation)
   */
  /**
   * One shot's torso kick (rad/s). `comp` 0..1 is the stabilisation (weaponStabilization):
   * under sustained fire it holds the torso against the mean recoil (see updateRecoil), so
   * rapid fire shakes but does not leave the torso pitched while the trigger is held.
   */
  recoil(impulse, comp = 0) {
    if (!(impulse > 0)) return;
    this.pitchSpring.kick(impulse);
    this.headZ.kick(impulse * 0.6);
    // only shots that follow another one within recoilHoldGap count as sustained fire
    if (this.recoilGap <= (this.feel.recoilHoldGap ?? 0.25)) this.recoilPending += impulse;
    this.recoilShot = true;
    this.recoilComp = clamp(comp, 0, 1);
  }

  /**
   * Stabiliser against sustained fire (Phase 2.1): the mean kick rate (low-pass, recoilCompTime)
   * would hold the springs at rate / stiffness; the spring targets are moved by the stabilised
   * share of that. Single shots and slow weapons (shots further apart than recoilHoldGap) are
   * not taken out,
   * and once the trigger is released the filter runs down (recoilReleaseTime) and the targets
   * return to 0.
   */
  updateRecoil(dt) {
    const f = this.feel;
    // Rises slowly while shots keep coming; once no shot came for recoilHoldGap (trigger
    // released, or a slow weapon between shots) it runs down fast, so nothing is left over.
    this.recoilGap = this.recoilShot ? 0 : this.recoilGap + dt;
    this.recoilShot = false;
    const tau = this.recoilGap > (f.recoilHoldGap ?? 0.25) ? f.recoilReleaseTime ?? 0.1 : f.recoilCompTime ?? 1;
    this.recoilRate += (this.recoilPending / dt - this.recoilRate) * (1 - Math.exp(-dt / tau));
    this.recoilPending = 0;
    if (this.recoilRate < 1e-6) this.recoilRate = 0;
    return this.recoilRate * this.recoilComp;
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
  return {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, aimPitch: 0, headY: 0, headZ: 0,
    legYaw: 0, stepPhase: 0, motionAmount: 0, speed: 0, sink: 0,
  };
}

function copyPose(dst, src) {
  for (const k in src) dst[k] = src[k];
}

/** Interpolates two poses; yaw is unwrapped so it never spins the long way. */
export function lerpPose(out, a, b, t) {
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of ['yaw', 'legYaw']) {
    let d = b[k] - a[k];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    out[k] = a[k] + d * t;
  }
  return out;
}
