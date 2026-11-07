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
import { MenuStack } from '../ui/menu/MenuStack.js';
import { PauseMenu } from '../ui/menu/PauseMenu.js';
import { MIN_SHOW } from '../ui/menu/LoadingScreen.js';
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
import { HelpPanel } from '../ui/HelpPanel.js';
import { RadioMenu } from '../ui/RadioMenu.js';
import { damp } from '../util/math.js';
import { AIDirector } from '../ai/AIDirector.js';
import { AIDebugView } from '../render/AIDebugView.js';
import { MissionScript } from './MissionScript.js';
import { getDifficulty, DIFFICULTY } from '../data/difficulty.js';
import { Storage } from '../core/Storage.js';
import { startupOf, withStartSite } from './missionStartup.js';
import { HangarDoor } from '../world/HangarDoor.js';

const START_MODES = ['full', 'simple', 'auto'];
const COMPONENT_LABELS = { torso: 'TORSO', armL: 'ARM L', armR: 'ARM R', legs: 'BEINE', sensors: 'SENSOR' };

/**
 * In-mission state: walker sim and systems, pilot view, cockpit + controls,
 * startup procedure, audio, pause, stats.
 */
export class MissionState extends State {
  enter({ missionId, walkerId, practice = null }) {
    const game = this.game;
    const cfg = game.config;
    const params = new URLSearchParams(window.location.search);
    // Practice options from the mission preparation (menu); URL parameters stay for tests
    this.missionParams = { missionId, walkerId, practice };
    const pr = practice ?? {};
    // Start site (hangar base or drop zone) is added to the mission; validation ran before (missionStartup.js)
    const base = getMission(missionId);
    this.mission = withStartSite(pr.timeOfDay && pr.timeOfDay !== 'mission' ? { ...base, timeOfDay: pr.timeOfDay } : base);
    this.startup = startupOf(this.mission, { hot: params.get('start') === 'hot' || pr.startMode === 'hot' });
    const weather = pr.weather && pr.weather !== 'mission' ? pr.weather : params.get('weather');
    this.world = new World(this.mission, cfg.terrain, { bus: game.bus, scatterConfig: cfg.scatter, weather: WEATHER[weather] ? weather : null });
    const chosen = walkerId ?? params.get('walker');
    this.walker = getWalker(WALKERS[chosen] ? chosen : this.mission.playerStart.walker ?? 'bastion');

    const start = this.mission.playerStart;
    this.motion = new WalkerMotion(this.walker, this.world.sampler, cfg.feel, game.bus);
    this.motion.place(start.x, start.z, start.heading);
    // Terrain meshes stream in during the loading phase (warm-up), heights are there already
    this.world.terrain.update(start.x, start.z);
    this.world.objects.ensureAround(start.x, start.z);
    this.world.scatterView?.update(start.x, start.z);
    this.renderPose = { ...this.motion.pose };

    this.view = new PilotView(game.renderer.camera, game.renderer.cockpitCamera, cfg.view);
    this.cockpit = new Cockpit(this.walker, this.world.theater, cfg.cockpit);
    this.cockpit.setEnvironment(this.world.environment, this.world.lighting);
    this.controls = new CockpitControls(this.cockpit.layout, game.bus);
    this.cockpit.bindControls(this.controls, game.bus);
    this.floodlight = new Floodlight(this.world.scene, cfg.floodlight);

    // Startup procedure
    const urlMode = START_MODES.includes(pr.startMode) ? pr.startMode : params.get('startmode');
    // Scramble: simple procedure unless the URL (later the options) says otherwise
    this.startMode = START_MODES.includes(urlMode) ? urlMode : this.startup.mode === 'scramble' ? 'simple' : cfg.startup.mode;
    this.systems = new WalkerSystems(this.controls, game.bus, {
      randomEvents: cfg.startup.randomEvents,
      monitorIds: this.cockpit.monitors.map((m) => m.id),
      overrides: this.walker.systems,
      extraCircuit: !!this.walker.cockpit.extraCircuit,
      heat: { capacity: this.walker.heatCapacity, dissipation: this.walker.heatDissipation },
    });
    const hot = this.startup.mode === 'hot';
    if (hot) this.systems.forceHot();
    this.checklist = new StartupChecklist(this.startMode, { extraCircuit: this.systems.extraCircuit });
    if (hot) this.checklist.markAllDone();
    this.checklist.update(this.systems.flags);
    this.automation = new StartupAutomation(this.controls, this.startMode);
    if (this.startMode === 'simple' && !hot) this.automation.start('simple');
    this.radioLog = new RadioLog(game.container, game.settings.get('radioText'));
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
    if (pr.invulnerable) this.combat.player.damage.invulnerable = true;
    if (pr.infiniteAmmo) this.combat.player.weapons.infiniteAmmo = true;
    this.viewMode = 'cockpit'; // 'cockpit' | 'external'
    this.chase = new ChaseCamera(game.renderer.camera, this.world.sampler);

    this.cockpitAudio = new CockpitAudio(game.audio, game.bus, this.cockpit, this.walker);
    this.systemsAudio = new SystemsAudio(game.audio, game.bus, this.systems, this.walker);
    this.debugRig = new TestRig(game.renderer.camera, this.world.sampler, cfg.testRig);
    this.freeCam = false;

    this.hints = new MissionHints(game.container);
    this.hints.show();
    this.help = new HelpPanel(game.container, game.input, game.bus, game.settings.get('helpIntro'));
    this.radioMenu = new RadioMenu(game.container, { onCommand: (cmd) => this.radioCommand(cmd) });
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
    // Pause menu (ui/menu): scene dimmed, sound ducked, the simulation stands still
    this.pauseStack = new MenuStack({ game, container: game.container, className: 'pause-layer' });
    this.pauseStack.setVisible(false);

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

    // AI (A3): difficulty from the menu (URL ?difficulty= for tests)
    const diffId = pr.difficulty ?? params.get('difficulty');
    this.difficultyId = DIFFICULTY[diffId] ? diffId : Storage.load('difficulty', 'normal');
    this.ai = new AIDirector({
      mission: this.mission, world: this.world, entities: this.entities, combat: this.combat,
      difficulty: getDifficulty(this.difficultyId), radio: (msg) => this.radioMessage(msg),
      lit: () => this.floodlight.on, bus: game.bus, startup: this.startup,
    });
    // Start phase: deploy (legs released on main power) starts the mission clock and the AI
    this.deployed = false;
    this.missionTime = 0;
    this.door = null;
    if (this.startup.location === 'hangar') {
      const st = this.world.objects.structures.find((x) => x.id === 'start-0' && x.type === 'hangarBay');
      if (st) {
        this.door = new HangarDoor({
          objects: this.world.objects, st, sound: this.combat.sound,
          onPassable: (h) => this.ai.nav.invalidate(h.x, h.z, 40),
        });
        if (hot) this.door.openNow();
      }
    }
    this.systems.scrambleAlarm = this.startup.mode === 'scramble' && !hot;
    this.combat.ai = this.ai;
    this.aiDebug = new AIDebugView({ scene: this.world.scene, container: game.container, renderer: game.renderer, director: this.ai, sampler: this.world.sampler });
    this.script = new MissionScript({
      mission: this.mission, director: this.ai, combat: this.combat, data: this.data,
      radio: (msg) => this.radioMessage(msg), onFinish: (result) => this.finish(result),
    });
    // Loading phase: terrain meshes, shader compile, audio samples (ui/menu/LoadingScreen.js)
    this.warmup = { t: 0, phase: 'terrain', total: Math.max(1, this.world.terrain.queue.length) };
    if (!game.loading.visible) game.loading.show({ name: this.mission.name, place: `${this.world.theater.name} · ${this.walker.name}` });
    this.objectiveEl = document.createElement('div');
    this.objectiveEl.className = 'objective';
    this.objectiveEl.hidden = true;
    game.container.appendChild(this.objectiveEl);
    this.tmpVec = new THREE.Vector3();
    this.tmpProj = new THREE.Vector3();

    this.onCanvasClick = () => {
      if (!this.paused) game.input.requestPointerLock();
    };
    game.renderer.canvas.addEventListener('click', this.onCanvasClick);
    if (!hot) {
      if (this.startup.mode === 'scramble') {
        this.radioMessage({ from: 'LEITSTELLE', text: `ALARMSTART! Synthese-Kontakt im Anflug auf den Stützpunkt, geschätzt ${Math.round(this.startup.scrambleDelay)} s. Sofort hochfahren!` });
      }
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
    game.input.releasePointerLock();
    game.audio.setDuck(1);
    this.cockpitAudio.dispose();
    this.systemsAudio.dispose();
    this.camView.dispose();
    this.aiDebug.dispose();
    this.ai.dispose();
    this.objectiveEl.remove();
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
    this.help.destroy();
    this.radioMenu.destroy();
    this.cursor.destroy();
    this.pauseStack.destroy();
    game.loading.hide();
    this.cockpit.dispose();
    this.world.dispose();
    this.world = null;
  }

  setPaused(on) {
    if (on === this.paused) return;
    this.paused = on;
    this.game.audio.setDuck(on ? 0.2 : 1);
    if (on) {
      this.interaction.endHold();
      this.game.input.releasePointerLock();
      this.radioMenu.hide();
      this.pauseStack.setVisible(true);
      this.pauseStack.push(new PauseMenu({
        name: this.mission.name,
        briefing: this.mission.briefing,
        objectives: () => this.script.list(),
        resume: () => this.setPaused(false),
        restart: () => this.restart(),
        abort: () => this.finish('aborted'),
      }));
    } else {
      this.pauseStack.clear();
      this.pauseStack.setVisible(false);
      this.game.input.requestPointerLock();
      this.game.time.resetAccumulator();
    }
  }

  /** Radio menu choice (wingmen arrive with phase B). */
  radioCommand(cmd) {
    this.radioMessage({ from: 'FUNK', text: `${cmd.label}: keine Flügelleute im Einsatz.` });
  }

  radioMessage({ from, text }) {
    this.radioLog.push(from, text, this.stats?.duration ?? 0);
    this.game.audio.play('radio.squelch');
  }

  /** Deploy: legs released on main power — the walker is ready and may leave the start. */
  checkDeploy() {
    if (this.deployed) return;
    const s = this.systems.s;
    if (!this.systems.flags.legsReleased || s.power.source !== 'main') return;
    this.deployed = true;
    this.systems.scrambleAlarm = false;
    this.ai.deploy();
    this.door?.open();
    this.game.bus.emit('mission:deploy', { time: this.stats.duration });
    const nav = this.mission.navPoints?.[0];
    const m = this.motion;
    let text = 'Freigabe zum Ausrücken.';
    if (this.door?.state === 'opening') text = 'Tor öffnet. Freigabe zum Ausrücken.';
    if (nav) {
      const dx = nav.x - m.x;
      const dz = nav.z - m.z;
      const bearing = Math.round((((Math.atan2(dx, -dz) * 180) / Math.PI) + 360) % 360);
      text += ` Erster Navpunkt ${nav.id}, Kurs ${String(bearing).padStart(3, '0')}, ${Math.round(Math.hypot(dx, dz))} m.`;
    }
    this.radioMessage({ from: 'LEITSTELLE', text });
  }

  finish(result) {
    const units = this.combat.units;
    const player = this.combat.player;
    const damage = {};
    for (const [c, p] of Object.entries(player.damage.parts)) {
      damage[c] = { left: player.damage.fraction(c), lost: c.startsWith('arm') ? units.player.lostArms.has(c) : p.internal <= 0 };
    }
    this.game.states.change('debrief', {
      mission: getMission(this.missionParams.missionId),
      result,
      params: this.missionParams,
      stats: {
        kills: units.kills,
        killList: units.units.filter((u) => u.wreck && !u.isPlayer).map((u) => ({ name: `${u.walker.name} (${u.id})`, kind: u.wreck.kind, scrap: u.wreck.scrap })),
        duration: this.missionTime, // from deploy
        deployed: this.deployed,
        totalTime: this.stats.duration,
        distance: this.motion.distance,
        shots: this.combat.stats.shots,
        hits: this.combat.stats.hits,
        damage,
        avgFps: this.stats.fpsFrames ? this.stats.fpsSum / this.stats.fpsFrames : 0,
      },
    });
  }

  restart() {
    this.game.loading.show({ name: this.mission.name, place: this.world.theater.name });
    this.game.states.change('mission', this.missionParams);
  }

  /** Input context from what the player is doing (input/actions.js → CONTEXTS). */
  currentContext() {
    if (this.paused || this.radioMenu.open) return 'menu';
    if (this.freeCam) return 'freeCam';
    if (this.viewMode === 'external') return 'external';
    if (this.view.freeLook) return 'freeLook';
    if (this.combat.missiles.steering) return 'missileCam';
    return 'combat';
  }

  /** One frame of the loading phase; the simulation waits until it is done. */
  warmStep(dt) {
    const w = this.warmup;
    const game = this.game;
    const L = game.loading;
    L.update(dt);
    w.t += dt;
    const terrain = this.world.terrain;
    if (w.phase === 'terrain') {
      const t0 = performance.now();
      while (terrain.queue.length && performance.now() - t0 < 35) terrain.processQueue(2);
      L.set('terrain', 1 - terrain.queue.length / w.total);
      if (!terrain.queue.length) w.phase = 'models';
    } else if (w.phase === 'models') {
      const r = game.renderer.renderer;
      r.compile(this.world.scene, game.renderer.camera);
      r.compile(this.cockpit.scene, game.renderer.cockpitCamera);
      L.set('models', 1);
      w.phase = 'audio';
    } else {
      const a = game.audio;
      const frac = a.ready || !a.ctx || !a.bank ? 1 : a.bank.loaded / Math.max(1, a.bank.total);
      L.set('audio', frac);
      if ((frac >= 1 && L.age >= MIN_SHOW) || w.t > 8) {
        this.warmup = null;
        L.hide();
        game.time.resetAccumulator();
      }
    }
  }

  frame(dt) {
    const input = this.game.input;
    this.frameDt = dt;
    if (this.warmup) {
      input.setContext('menu');
      this.warmStep(dt);
      return;
    }
    input.setContext(this.currentContext());
    this.help.update(input, dt);

    // Menus: radio menu or pause (Esc closes; the key right after a pointer-lock
    // loss is ignored because that same Esc already opened the pause)
    if (this.paused) {
      // The Esc that released the pointer lock (and opened the pause) must not close it again
      if (!(input.pressed('menuBack') && performance.now() - this.lockLostAt < 300)) this.pauseStack.frame(dt);
      input.discardMotion();
      return;
    }
    if (this.radioMenu.open) {
      // The key that closes the menu (digit, Esc) must not act in combat this frame
      this.radioMenu.handle(input);
      input.discardMotion();
      return;
    }
    if (input.pressed('pause')) {
      this.setPaused(true);
      return;
    }
    if (input.pressed('radioMenu')) {
      this.radioMenu.show();
      return;
    }

    if (input.pressed('debugFreeCam')) this.toggleFreeCam();
    if (input.pressed('aiFreeze')) {
      this.ai.frozen = !this.ai.frozen;
      this.hints.flash(this.ai.frozen ? 'Gegner eingefroren' : 'Gegner aktiv');
    }
    if (input.pressed('aiSpawn')) {
      const g = this.ai.spawnDebugGroup();
      this.hints.flash(`KI-Gruppe ${g.id} abgesetzt (300 m voraus)`);
    }
    if (input.pressed('externalView')) this.viewMode = this.viewMode === 'cockpit' ? 'external' : 'cockpit';
    const external = this.viewMode === 'external';
    if (input.pressed('debugWireframe')) {
      this.wireframe = !this.wireframe;
      this.world.terrain.setWireframe(this.wireframe);
    }
    if (input.pressed('freeLookToggle')) this.view.toggleLatch();
    if (input.pressed('centerTorso')) this.motion.centerTorso();
    if (input.pressed('alignLegs')) this.motion.alignLegsToTorso();
    if (input.pressed('throttleStop')) this.motion.throttle.stop();
    if (input.pressed('checklist')) this.cockpit.clipboard?.toggle();
    if (input.pressed('jumpJets') && !this.walker.jumpJets) this.hints.flash('Keine Sprungdüsen an Bord');
    if (input.pressed('autoStart') && !this.systems.flags.legsReleased) {
      this.automation.start('auto');
      this.radioMessage(RADIO.autoStart);
    }

    this.view.setHold(input.held('freeLookHold') && !this.freeCam);
    if (this.view.freeLook && !external) this.interaction.activate();
    else this.interaction.deactivate();
    input.setContext(this.currentContext());

    this.combat.frame(input, { canAim: !this.freeCam && !(this.view.freeLook && !external) });
    this.camView.frame(input);
    this.hits.frame(input);

    let look = { x: 0, y: 0 };
    if (this.freeCam) {
      look = input.look(dt);
      this.debugRig.look(look.x, look.y);
    } else if (this.view.freeLook && external) {
      // Outside view: free look orbits the camera around the walker.
      look = input.look(dt);
      this.view.look(look.x, look.y);
      look = { x: 0, y: 0 };
    } else if (this.view.freeLook) {
      // Mouse (or right stick) moves the cockpit cursor; pushing past the screen edge turns the head.
      const m = input.cursorDelta(dt);
      const over = this.interaction.move(m.x, m.y);
      const sens = input.sensitivity;
      this.view.look(over.x * sens, over.y * sens);
      this.interaction.handleInput(input);
    } else {
      input.wheel();
      look = input.look(dt);
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
    if (this.paused || this.warmup) return;
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
    this.checkDeploy();
    if (this.deployed) this.missionTime += dt;
    this.door?.update(dt);
    this.entities.update(dt);
    this.combat.update(dt);
    this.ai.update(dt);
    this.script.update(dt);
    this.hits.update(dt);
    this.worldLink.update(dt);
    this.systems.update(dt);
    this.checklist.update(this.systems.flags);
    this.automation.update(dt, this.systems.flags);
    this.view.update(dt);
    this.stats.duration += dt;
  }

  render(alpha) {
    if (this.warmup) return;
    const game = this.game;
    const renderer = game.renderer;
    const a = this.paused ? 1 : alpha;

    const fdt = this.paused ? 0 : this.frameDt;
    const external = this.viewMode === 'external';
    this.entities.render(a, fdt, this.freeCam || external);
    this.aiDebug.setVisible(game.input.debugMode);
    this.aiDebug.update();
    const t = Math.floor(this.missionTime);
    const clock = this.deployed ? `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : 'STARTPHASE';
    const objective = this.script.text ? `${clock}  ·  ${this.script.text}` : clock;
    this.objectiveEl.hidden = false;
    if (this.objectiveEl.textContent !== objective) this.objectiveEl.textContent = objective;
    this.objectiveEl.classList.toggle('done', !!this.script.finished);

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
      this.hints.update({ reticle: renderer.project(this.combat.aimPoint, this.tmpProj), tag: 'AUSSENKAMERA', locked: game.input.pointerLocked || this.paused, target: this.targetBox() });
      return;
    }
    this.floodlight.update(this.renderPose, this.view.torsoQuat, this.view.aimDir);
    this.link.frame();
    updateCockpitData(this.data, fdt, { motion: this.motion, controls: this.controls, systems: this.systems, stick: this.stickVisual, combat: this.combat });
    this.data.units = game.settings.get('units');
    this.radioLog.seconds = game.settings.get('radioText');
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
      locked: game.input.pointerLocked || this.paused,
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
    const wrecks = this.combat.units.wreckLines();
    return [
      ...missionDebugLines(this), ...this.worldLink.debugLine(), ...this.combat.debugLines(), this.hits.debugLine(),
      ...this.ai.debugLines(), this.script.debugLine(), ...(wrecks.length ? ['Wracks:', ...wrecks.map((w) => `  ${w}`)] : []),
    ].filter((l) => l !== null);
  }
}

function clampUnit(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
