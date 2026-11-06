import * as THREE from 'three';
import { State } from '../core/State.js';
import { World } from '../render/World.js';
import { TestRig } from '../render/TestRig.js';
import { PilotView } from '../render/PilotView.js';
import { Cockpit } from '../render/cockpit/Cockpit.js';
import { WalkerMotion, lerpPose } from '../sim/WalkerMotion.js';
import { getMission } from '../data/missions.js';
import { getWalker } from '../data/walkers.js';
import { MissionHints } from '../ui/MissionHints.js';
import { PauseScreen } from '../ui/PauseScreen.js';
import { DEG, damp } from '../util/math.js';

const compassDeg = (yaw) => ((((-yaw / DEG) % 360) + 360) % 360);
const AIM_DISTANCE = 800;

/** In-mission state: walker sim, pilot view, cockpit, pause handling, stats. */
export class MissionState extends State {
  enter({ missionId }) {
    const game = this.game;
    const cfg = game.config;
    this.mission = getMission(missionId);
    this.world = new World(this.mission, cfg.terrain);
    this.walker = getWalker(this.mission.playerStart.walker ?? 'bastion');

    const start = this.mission.playerStart;
    this.motion = new WalkerMotion(this.walker, this.world.sampler, cfg.feel, game.bus);
    this.motion.place(start.x, start.z, start.heading);
    this.world.preload(start.x, start.z);
    this.renderPose = { ...this.motion.pose };

    this.view = new PilotView(game.renderer.camera, game.renderer.cockpitCamera, cfg.view);
    this.cockpit = new Cockpit(this.walker, this.world.theater, cfg.cockpit);
    this.cockpit.setEnvironment(this.world.environment, this.world.lighting);
    this.debugRig = new TestRig(game.renderer.camera, this.world.sampler, cfg.testRig);
    this.freeCam = false;

    this.hints = new MissionHints(game.container, game.input.bindings);
    this.hints.show();
    this.pauseScreen = new PauseScreen(game.container, {
      onResume: () => this.setPaused(false),
      onAbort: () => this.finish('aborted'),
    });

    this.paused = false;
    this.wireframe = false;
    this.lockLostAt = -Infinity;
    this.frameDt = 0;
    this.stats = { duration: 0, fpsSum: 0, fpsFrames: 0 };
    this.stickVisual = { x: 0, y: 0, twist: 0 };
    this.aimRate = { x: 0, y: 0 };
    this.data = this.createCockpitData();
    this.tmpVec = new THREE.Vector3();
    this.tmpProj = new THREE.Vector3();

    this.onCanvasClick = () => {
      if (!this.paused) game.input.mouse.requestLock();
    };
    game.renderer.canvas.addEventListener('click', this.onCanvasClick);
    this.unsubLock = game.bus.on('pointer:lock', ({ locked }) => {
      if (!locked && !this.paused) {
        this.lockLostAt = performance.now();
        this.setPaused(true);
      }
    });
  }

  exit() {
    const game = this.game;
    game.renderer.canvas.removeEventListener('click', this.onCanvasClick);
    this.unsubLock();
    game.input.mouse.releaseLock();
    this.hints.destroy();
    this.pauseScreen.destroy();
    this.cockpit.dispose();
    this.world.dispose();
    this.world = null;
  }

  setPaused(on) {
    this.paused = on;
    if (on) {
      this.game.input.mouse.releaseLock();
      this.pauseScreen.show();
    } else {
      this.pauseScreen.hide();
      this.game.input.mouse.requestLock();
      this.game.time.resetAccumulator();
    }
  }

  finish(result) {
    this.game.states.change('debrief', {
      mission: this.mission,
      result,
      stats: {
        duration: this.stats.duration,
        distance: this.motion.distance,
        avgFps: this.stats.fpsFrames ? this.stats.fpsSum / this.stats.fpsFrames : 0,
      },
    });
  }

  frame(dt) {
    const input = this.game.input;
    this.frameDt = dt;
    // Esc both exits pointer lock (which pauses) and arrives as a key —
    // ignore the key right after the lock was lost so we don't unpause.
    if (input.wasPressed('pause') && performance.now() - this.lockLostAt > 250) {
      this.setPaused(!this.paused);
    }
    if (this.paused) {
      input.mouse.consumeDelta();
      return;
    }

    if (input.wasPressed('debugFreeCam')) this.toggleFreeCam();
    if (input.wasPressed('toggleWireframe')) {
      this.wireframe = !this.wireframe;
      this.world.terrain.setWireframe(this.wireframe);
    }
    if (input.wasPressed('toggleHints')) this.hints.toggleBar();
    if (input.wasPressed('cockpitLight')) this.cockpit.toggleNightLighting();
    if (input.wasPressed('freeLookToggle')) this.view.toggleLatch();
    if (input.wasPressed('centerTorso')) this.motion.centerTorso();
    if (input.wasPressed('throttleStop')) this.motion.throttle.stop();

    const look = input.lookDelta(dt);
    this.view.setHold(input.isDown('freeLookHold'));
    if (this.freeCam) {
      this.debugRig.look(look.x, look.y);
    } else if (this.view.freeLook) {
      this.view.look(look.x, look.y);
    } else {
      this.motion.aim(look.x, look.y);
    }

    // Stick deflection: turn input sideways, aim rate fore/aft and twist.
    const k = damp(10, dt);
    const aiming = !this.view.freeLook && !this.freeCam && dt > 0;
    this.aimRate.x += ((aiming ? look.x / dt : 0) - this.aimRate.x) * k;
    this.aimRate.y += ((aiming ? look.y / dt : 0) - this.aimRate.y) * k;
    const turn = this.freeCam ? 0 : input.axis('turn');
    this.stickVisual.x += (turn - this.stickVisual.x) * k;
    this.stickVisual.y += (clampUnit(this.aimRate.y * 0.6) - this.stickVisual.y) * k;
    this.stickVisual.twist += (clampUnit(this.aimRate.x * 0.6) - this.stickVisual.twist) * k;

    this.stats.fpsSum += this.game.time.fps;
    this.stats.fpsFrames++;
  }

  toggleFreeCam() {
    this.freeCam = !this.freeCam;
    if (this.freeCam) {
      const cam = this.game.renderer.camera;
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      this.debugRig.placeAt(cam.position, e.y, e.x);
    }
  }

  update(dt) {
    if (this.paused) return;
    const input = this.game.input;
    if (this.freeCam) {
      this.debugRig.update(dt, input);
      this.motion.update(dt, { throttleRate: 0, throttleAbs: null, turn: 0 });
      this.world.update(this.debugRig.pos);
    } else {
      this.motion.update(dt, {
        throttleRate: input.axis('throttle'),
        throttleAbs: input.absoluteAxis('throttleAbs'),
        turn: input.axis('turn'),
      });
      this.world.update(this.motion.pose);
    }
    this.view.update(dt);
    this.stats.duration += dt;
  }

  render(alpha) {
    const game = this.game;
    const renderer = game.renderer;
    const a = this.paused ? 1 : alpha;

    if (this.freeCam) {
      this.debugRig.apply(a);
      this.world.beforeRender(renderer.camera);
      renderer.render(this.world.scene);
      this.hints.update({ reticle: null, tag: 'DEBUG-FREIFLUG', locked: true });
      return;
    }

    lerpPose(this.renderPose, this.motion.prevPose, this.motion.pose, a);
    this.view.apply(this.renderPose);
    this.updateCockpitData(this.paused ? 0 : this.frameDt);
    this.cockpit.update(this.paused ? 0 : this.frameDt, this.data, this.view.torsoQuat);
    this.world.beforeRender(renderer.camera);
    renderer.renderWithCockpit(this.world.scene, this.cockpit.scene);

    const p = this.renderPose;
    this.tmpVec.set(p.x, p.y, p.z).addScaledVector(this.view.aimDir, AIM_DISTANCE);
    const reticle = renderer.project(this.tmpVec, this.tmpProj);
    this.hints.update({
      reticle,
      tag: this.view.freeLook ? 'FREIER BLICK' : null,
      locked: game.input.mouse.locked || this.paused,
    });
  }

  createCockpitData() {
    const w = this.walker;
    return {
      walkerName: w.name,
      maxSpeed: w.maxSpeed,
      maxReverseSpeed: w.maxReverseSpeed,
      twistLimit: w.torsoTwistLimit,
      armor: w.armor,
      health: { torso: 1, armL: 1, armR: 1, legs: 1, sensors: 1, reactor: 1 },
      shields: { front: 1, rear: 1, left: 1, right: 1 },
      hardpoints: w.hardpoints.map((hp) => ({ ...hp, weapon: null })),
      loadoutWeight: 0,
      maxLoadoutWeight: w.maxLoadoutWeight,
      navPoints: (this.mission.navPoints ?? []).map((n, i) => ({ ...n, active: i === 0, dx: 0, dz: 0, dist: 0, bearingDeg: 0 })),
      time: 0,
    };
  }

  updateCockpitData(dt) {
    const m = this.motion;
    const d = this.data;
    d.time += dt;
    d.throttle = m.throttle.value;
    d.speed = m.speed;
    d.torsoYaw = m.torsoYaw;
    d.headingDeg = compassDeg(m.torsoYaw);
    d.legHeadingDeg = compassDeg(m.legYaw);
    d.twist = m.twist;
    d.twistDeg = m.twist / DEG;
    d.pitchDeg = m.pitch / DEG;
    d.grade = m.grade;
    d.stickX = this.stickVisual.x;
    d.stickY = this.stickVisual.y;
    d.stickTwist = this.stickVisual.twist;

    const range = this.cockpit.controls.get('radarRange');
    d.radarRange = range ? Number(range.item.positions[range.value]) : 1000;
    d.weaponsArmed = this.cockpit.controls.get('weaponsArm')?.value === 1;
    for (const nav of d.navPoints) {
      nav.dx = nav.x - m.x;
      nav.dz = nav.z - m.z;
      nav.dist = Math.hypot(nav.dx, nav.dz);
      nav.bearingDeg = ((Math.atan2(nav.dx, -nav.dz) / DEG) + 360) % 360;
    }
  }

  debugInfo() {
    const m = this.motion;
    const p = m.pose;
    const t = this.world.terrain.stats;
    const ground = this.world.sampler.heightAt(p.x, p.z);
    return [
      `Mission ${this.mission.id}  ${this.mission.theater}/${this.mission.timeOfDay}  walker ${this.walker.id}`,
      `Pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ground ${ground.toFixed(1)}  grade ${m.grade.toFixed(2)}`,
      `Throttle ${m.throttle.value.toFixed(2)}${m.throttle.detentHold ? ' (Raste)' : ''}  speed ${(m.speed * 3.6).toFixed(1)} km/h`,
      `Legs ${compassDeg(m.legYaw).toFixed(0)}°  twist ${(m.twist / DEG).toFixed(1)}°  pitch ${(m.pitch / DEG).toFixed(1)}°`,
      `Head ${(this.view.yaw / DEG).toFixed(0)}/${(this.view.pitch / DEG).toFixed(0)}°  freeLook ${this.view.freeLook ? 'on' : 'off'}  light ${this.cockpit.lightMode}`,
      `Chunks ${t.chunks} (LOD ${t.perLod.join('/')})  queue ${t.queued}  cam ${this.freeCam ? 'free' : 'cockpit'}`,
      `Entities 1  Wireframe ${this.wireframe ? 'on' : 'off'} [F4]`,
    ];
  }
}

function clampUnit(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
