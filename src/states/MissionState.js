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
import { CockpitCursor } from '../ui/CockpitCursor.js';
import { CockpitInteraction } from '../ui/CockpitInteraction.js';
import { CockpitControls } from '../sim/CockpitControls.js';
import { CockpitAudio } from '../audio/CockpitAudio.js';
import { Floodlight } from '../render/Floodlight.js';
import { WalkerSystems } from '../sim/WalkerSystems.js';
import { StartupChecklist } from '../sim/StartupChecklist.js';
import { StartupAutomation } from '../sim/StartupAutomation.js';
import { SystemsAudio } from '../audio/SystemsAudio.js';
import { RadioLog } from '../ui/RadioLog.js';
import { RADIO } from '../data/systems.js';
import { SystemsLink } from './SystemsLink.js';
import { MissionEntities } from './MissionEntities.js';
import { missionDebugLines } from './missionDebug.js';
import { ChaseCamera } from '../render/ChaseCamera.js';
import { WALKERS } from '../data/walkers.js';
import { createCockpitData, updateCockpitData } from './cockpitData.js';
import { MissionCombat } from './combat/MissionCombat.js';
import { MissileCamView } from './combat/MissileCamView.js';
import { CockpitHits } from './combat/CockpitHits.js';
import { WEATHER } from '../data/weather.js';
import { WorldLink } from './WorldLink.js';
import { damp } from '../util/math.js';

const START_MODES = ['full', 'simple', 'auto'];
const COMPONENT_LABELS = { torso: 'TORSO', armL: 'ARM L', armR: 'ARM R', legs: 'BEINE', sensors: 'SENSOR' };

/**
 * In-mission state: walker sim and systems, pilot view, cockpit + controls,
 * startup procedure, audio, pause, stats.
 */
export class MissionState extends State {
  enter({ missionId, walkerId }) {
    const game = this.game;
    const cfg = game.config;
    const params = new URLSearchParams(window.location.search);
    this.mission = getMission(missionId);
    const weather = params.get('weather');
    this.world = new World(this.mission, cfg.terrain, { bus: game.bus, scatterConfig: cfg.scatter, weather: WEATHER[weather] ? weather : null });
    const chosen = walkerId ?? params.get('walker');
    this.walker = getWalker(WALKERS[chosen] ? chosen : this.mission.playerStart.walker ?? 'bastion');

    const start = this.mission.playerStart;
    this.motion = new WalkerMotion(this.walker, this.world.sampler, cfg.feel, game.bus);
    this.motion.place(start.x, start.z, start.heading);
    this.world.preload(start.x, start.z);
    this.renderPose = { ...this.motion.pose };

    this.view = new PilotView(game.renderer.camera, game.renderer.cockpitCamera, cfg.view);
    this.cockpit = new Cockpit(this.walker, this.world.theater, cfg.cockpit);
    this.cockpit.setEnvironment(this.world.environment, this.world.lighting);
    this.controls = new CockpitControls(this.cockpit.layout, game.bus);
    this.cockpit.bindControls(this.controls, game.bus);
    this.floodlight = new Floodlight(this.world.scene, cfg.floodlight);

    // Startup procedure
    const urlMode = params.get('startmode');
    this.startMode = START_MODES.includes(urlMode) ? urlMode : cfg.startup.mode;
    this.systems = new WalkerSystems(this.controls, game.bus, {
      randomEvents: cfg.startup.randomEvents,
      monitorIds: this.cockpit.monitors.map((m) => m.id),
      overrides: this.walker.systems,
      extraCircuit: !!this.walker.cockpit.extraCircuit,
      heat: { capacity: this.walker.heatCapacity, dissipation: this.walker.heatDissipation },
    });
    const hot = params.get('start') === 'hot';
    if (hot) this.systems.forceHot();
    this.checklist = new StartupChecklist(this.startMode, { extraCircuit: this.systems.extraCircuit });
    if (hot) this.checklist.markAllDone();
    this.checklist.update(this.systems.flags);
    this.automation = new StartupAutomation(this.controls, this.startMode);
    if (this.startMode === 'simple' && !hot) this.automation.start('simple');
    this.radioLog = new RadioLog(game.container);
    this.link = new SystemsLink({
      systems: this.systems,
      controls: this.controls,
      cockpit: this.cockpit,
      floodlight: this.floodlight,
      motion: this.motion,
      bus: game.bus,
      radio: (msg) => this.radioMessage(msg),
    });
    this.motion.place(start.x, start.z, start.heading); // again, now with the real stance
    this.entities = new MissionEntities({
      scene: this.world.scene,
      sampler: this.world.sampler,
      feel: cfg.feel,
      mission: this.mission,
      player: { walker: this.walker, motion: this.motion },
    });
    this.combat = new MissionCombat({
      game, world: this.world, entities: this.entities, systems: this.systems, controls: this.controls,
      radio: (msg) => this.radioMessage(msg),
    });
    this.link.extraFlicker = () => this.combat.readout().sensorsFlicker;
    this.viewMode = 'cockpit'; // 'cockpit' | 'external'
    this.chase = new ChaseCamera(game.renderer.camera, this.world.sampler);

    this.cockpitAudio = new CockpitAudio(game.audio, game.bus, this.cockpit, this.walker);
    this.systemsAudio = new SystemsAudio(game.audio, game.bus, this.systems, this.walker);
    this.debugRig = new TestRig(game.renderer.camera, this.world.sampler, cfg.testRig);
    this.freeCam = false;

    this.hints = new MissionHints(game.container, game.input.bindings);
    this.hints.show();
    this.cursor = new CockpitCursor(game.container);
    this.interaction = new CockpitInteraction({
      cockpit: this.cockpit,
      controls: this.controls,
      camera: game.renderer.cockpitCamera,
      renderer: game.renderer,
      cursor: this.cursor,
      throttle: this.motion.throttle,
      onClipboard: () => this.cockpit.clipboard?.toggle(),
    });
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
    this.data = createCockpitData(this.walker, this.mission, this.systems);
    this.camView = new MissileCamView({
      game, world: this.world, cockpit: this.cockpit, controls: this.controls, systems: this.systems, combat: this.combat, config: cfg.missileCam,
    });
    this.data.missileCam = this.camView.data;
    this.hits = new CockpitHits({
      game, combat: this.combat, systems: this.systems, cockpit: this.cockpit, view: this.view,
      radio: (msg) => this.radioMessage(msg), config: cfg.hitFeedback,
    });
    this.worldLink = new WorldLink({
      game, world: this.world, motion: this.motion, entities: this.entities, combat: this.combat,
      systems: this.systems, cockpit: this.cockpit, radio: (msg) => this.radioMessage(msg),
    });
    this.data.worldLink = this.worldLink;
    this.tmpVec = new THREE.Vector3();
    this.tmpProj = new THREE.Vector3();

    this.onCanvasClick = () => {
      if (!this.paused) game.input.mouse.requestLock();
    };
    game.renderer.canvas.addEventListener('click', this.onCanvasClick);
    if (!hot) {
      const intro = { simple: RADIO.coldStartSimple, auto: RADIO.coldStartAuto }[this.startMode] ?? RADIO.coldStart;
      this.radioMessage(intro);
    }
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
    game.audio.setPaused(false);
    this.cockpitAudio.dispose();
    this.systemsAudio.dispose();
    this.camView.dispose();
    this.hits.dispose();
    this.worldLink.dispose();
    this.combat.dispose();
    this.automation.stop();
    this.link.dispose();
    this.systems.dispose();
    this.radioLog.destroy();
    this.floodlight.dispose();
    this.entities.dispose();
    this.hints.destroy();
    this.cursor.destroy();
    this.pauseScreen.destroy();
    this.cockpit.dispose();
    this.world.dispose();
    this.world = null;
  }

  setPaused(on) {
    this.paused = on;
    this.game.audio.setPaused(on);
    if (on) {
      this.interaction.endHold();
      this.game.input.mouse.releaseLock();
      this.pauseScreen.show();
    } else {
      this.pauseScreen.hide();
      this.game.input.mouse.requestLock();
      this.game.time.resetAccumulator();
    }
  }

  radioMessage({ from, text }) {
    this.radioLog.push(from, text, this.stats?.duration ?? 0);
    this.game.audio.play('radio.squelch');
  }

  finish(result) {
    this.game.states.change('debrief', {
      mission: this.mission,
      result,
      stats: {
        kills: this.combat.units.kills,
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
    if (input.wasPressed('externalView')) this.viewMode = this.viewMode === 'cockpit' ? 'external' : 'cockpit';
    const external = this.viewMode === 'external';
    if (input.wasPressed('toggleWireframe')) {
      this.wireframe = !this.wireframe;
      this.world.terrain.setWireframe(this.wireframe);
    }
    if (input.wasPressed('toggleHints')) this.hints.toggleBar();
    if (input.wasPressed('cockpitLight') && this.controls.has('cockpitLight')) {
      // Shortcut for the INNENLICHT knob: toggles between NACHT and TAG.
      this.controls.setValue('cockpitLight', this.controls.value('cockpitLight') === 2 ? 1 : 2);
    }
    if (input.wasPressed('freeLookToggle')) this.view.toggleLatch();
    if (input.wasPressed('centerTorso')) this.motion.centerTorso();
    if (input.wasPressed('throttleStop')) this.motion.throttle.stop();
    if (input.wasPressed('checklist')) this.cockpit.clipboard?.toggle();
    if (input.comboPressed('autoStart') && !this.systems.flags.legsReleased) {
      this.automation.start('auto');
      this.radioMessage(RADIO.autoStart);
    }

    this.view.setHold(input.isDown('freeLookHold') && !this.freeCam);
    if (this.view.freeLook && !external) this.interaction.activate();
    else this.interaction.deactivate();

    this.combat.frame(input, { canAim: !this.freeCam && !(this.view.freeLook && !external) });
    this.camView.frame(input);
    this.hits.frame(input);

    let look = { x: 0, y: 0 };
    if (this.freeCam) {
      look = input.lookDelta(dt);
      this.debugRig.look(look.x, look.y);
    } else if (this.view.freeLook && external) {
      // Outside view: free look orbits the camera around the walker.
      look = input.lookDelta(dt);
      this.view.look(look.x, look.y);
      look = { x: 0, y: 0 };
    } else if (this.view.freeLook) {
      // Mouse moves the cockpit cursor; pushing past the screen edge turns the head.
      const m = input.mouse.consumeDelta();
      const over = this.interaction.move(m.x, m.y);
      const pad = input.gamepadLook(dt);
      const sens = input.bindings.mouse.sensitivity;
      this.view.look(over.x * sens + pad.x, over.y * sens + pad.y);
      this.interaction.handleInput(input);
    } else {
      input.mouse.consumeWheel();
      look = input.lookDelta(dt);
      // Optical missile: while fire is held the mouse steers the missile, the torso stays put
      if (this.combat.firing && this.combat.missiles.steer(look.x, look.y, this.game.config.missileCam.steerSensitivity)) {
        look = { x: 0, y: 0 };
      } else {
        this.motion.aim(look.x, look.y);
        if (look.x || look.y) this.combat.tracking.manual();
      }
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
    this.link.update();
    this.combat.applyPlayerLimits();
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
    this.entities.update(dt);
    this.combat.update(dt);
    this.hits.update(dt);
    this.worldLink.update(dt);
    this.systems.update(dt);
    this.checklist.update(this.systems.flags);
    this.automation.update(dt, this.systems.flags);
    this.view.update(dt);
    this.stats.duration += dt;
  }

  render(alpha) {
    const game = this.game;
    const renderer = game.renderer;
    const a = this.paused ? 1 : alpha;

    const fdt = this.paused ? 0 : this.frameDt;
    const external = this.viewMode === 'external';
    this.entities.render(a, fdt, this.freeCam || external);

    if (this.freeCam) {
      this.combat.render(fdt, { eye: this.combat.eye, aimDir: this.combat.aimDir });
      this.debugRig.apply(a);
      this.worldLink.frame(fdt, renderer.camera, this.debugRig.pos, false);
      this.world.beforeRender(renderer.camera);
      renderer.render(this.world.scene);
      this.worldLink.afterRender();
      this.hints.update({ reticle: null, tag: 'DEBUG-FREIFLUG', locked: true });
      return;
    }

    lerpPose(this.renderPose, this.motion.prevPose, this.motion.pose, a);
    this.view.apply(this.renderPose);
    const p = this.renderPose;
    this.combat.setViewportHeight(renderer.height);
    this.combat.render(fdt, { eye: this.tmpVec.set(p.x, p.y, p.z), aimDir: this.view.aimDir });
    this.camView.update(fdt);
    this.hits.setViewportHeight(renderer.height);
    this.hits.render(fdt, this.systems.flags.batteryBus);
    if (external) {
      this.chase.apply(this.renderPose, this.walker.cockpit.eyeHeight, this.view, fdt);
      this.link.frame();
      this.worldLink.frame(fdt, renderer.camera, this.renderPose, false);
      this.world.beforeRender(renderer.camera);
      renderer.render(this.world.scene);
      this.worldLink.afterRender();
      if (!this.paused) {
        this.cockpitAudio.update(this.motion, this.systems.flags.busPowered, this.systems.s.reactor.power);
        this.systemsAudio.update();
      }
      this.radioLog.update(this.stats.duration);
      this.hints.update({ reticle: renderer.project(this.combat.aimPoint, this.tmpProj), tag: 'AUSSENKAMERA', locked: game.input.mouse.locked || this.paused, target: this.targetBox() });
      return;
    }
    this.floodlight.update(this.renderPose, this.view.torsoQuat, this.view.aimDir);
    this.link.frame();
    updateCockpitData(this.data, fdt, { motion: this.motion, controls: this.controls, systems: this.systems, stick: this.stickVisual, combat: this.combat });
    this.cockpit.update(fdt, this.data, this.view.torsoQuat, this.checklist, renderer.cockpitCamera);
    this.worldLink.frame(fdt, renderer.camera, this.renderPose, true);
    this.camView.render(fdt);
    this.world.beforeRender(renderer.camera);
    renderer.renderWithCockpit(this.world.scene, this.cockpit.scene);
    this.worldLink.afterRender();
    this.interaction.updateHover();
    if (!this.paused) {
      this.cockpitAudio.update(this.motion, this.systems.flags.busPowered, this.systems.s.reactor.power);
      this.systemsAudio.update();
    }
    this.radioLog.update(this.stats.duration);

    const reticle = renderer.project(this.combat.aimPoint, this.tmpProj);
    this.hints.update({
      reticle,
      tag: this.view.freeLook ? 'FREIER BLICK · BEDIENEN' : null,
      locked: game.input.mouse.locked || this.paused,
      target: this.targetBox(),
      aimOnUnit: !!this.combat.aimUnit,
    });
  }

  /** Screen box of the locked target for the HUD frame. */
  targetBox() {
    const t = this.combat.targeting.target;
    if (!t) return null;
    const r = this.game.renderer;
    const c = t.volumes.componentCenter('torso', new THREE.Vector3());
    const top = c.clone();
    top.y += t.walker.cockpit.eyeHeight * 0.55;
    const pc = r.project(c, new THREE.Vector3());
    const pt = r.project(top, new THREE.Vector3());
    if (!pc || !pt) return null;
    const half = Math.max(14, Math.abs(pc.y - pt.y));
    const box = { x: pc.x, y: pc.y - half * 0.2, half, label: `${t.walker.name}  ${Math.round(this.combat.targeting.distance ?? 0)} m`, wreck: !!t.wreck };
    const comp = this.combat.podComponent;
    if (comp && !t.wreck) {
      const cc = r.project(t.volumes.componentCenter(comp, c), new THREE.Vector3());
      if (cc) box.comp = { x: cc.x, y: cc.y, label: COMPONENT_LABELS[comp], converging: this.combat.converging };
    }
    const m = this.combat.missiles;
    if (m.lockState !== 'none') box.lock = { progress: m.lockProgress };
    return box;
  }

  debugInfo() {
    return [...missionDebugLines(this), ...this.worldLink.debugLine(), ...this.combat.debugLines(), this.hits.debugLine()];
  }
}

function clampUnit(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
