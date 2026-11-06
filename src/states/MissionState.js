import { State } from '../core/State.js';
import { World } from '../render/World.js';
import { TestRig } from '../render/TestRig.js';
import { getMission } from '../data/missions.js';
import { MissionHints } from '../ui/MissionHints.js';
import { PauseScreen } from '../ui/PauseScreen.js';

/** In-mission state: world simulation, camera, pause handling, stats. */
export class MissionState extends State {
  enter({ missionId }) {
    const game = this.game;
    this.mission = getMission(missionId);
    this.world = new World(this.mission, game.config.terrain);

    const start = this.mission.playerStart;
    this.rig = new TestRig(game.renderer.camera, this.world.sampler, game.config.testRig);
    this.rig.place(start.x, start.z, start.heading);
    this.world.preload(start.x, start.z);

    this.hints = new MissionHints(game.container);
    this.hints.show();
    this.pauseScreen = new PauseScreen(game.container, {
      onResume: () => this.setPaused(false),
      onAbort: () => this.finish('aborted'),
    });

    this.paused = false;
    this.wireframe = false;
    this.lockLostAt = -Infinity;
    this.stats = { duration: 0, distance: 0, fpsSum: 0, fpsFrames: 0 };

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
        distance: this.rig.distance,
        avgFps: this.stats.fpsFrames ? this.stats.fpsSum / this.stats.fpsFrames : 0,
      },
    });
  }

  frame(dt) {
    const input = this.game.input;
    // Esc both exits pointer lock (which pauses) and may arrive as a key —
    // ignore the key if the lock was just lost so we don't instantly unpause.
    if (input.wasPressed('pause') && performance.now() - this.lockLostAt > 250) {
      this.setPaused(!this.paused);
    }
    if (this.paused) {
      input.mouse.consumeDelta();
      return;
    }

    if (input.wasPressed('toggleFly')) this.rig.toggleFly();
    if (input.wasPressed('toggleWireframe')) {
      this.wireframe = !this.wireframe;
      this.world.terrain.setWireframe(this.wireframe);
    }

    const look = input.lookDelta(dt);
    this.rig.look(look.x, look.y);

    this.stats.fpsSum += this.game.time.fps;
    this.stats.fpsFrames++;
  }

  update(dt) {
    if (this.paused) return;
    this.rig.update(dt, this.game.input);
    this.world.update(this.rig.pos);
    this.stats.duration += dt;
  }

  render(alpha) {
    const camera = this.game.renderer.camera;
    this.rig.apply(this.paused ? 1 : alpha);
    this.world.beforeRender(camera);
    this.game.renderer.render(this.world.scene);

    const ground = this.world.sampler.heightAt(this.rig.pos.x, this.rig.pos.z);
    this.hints.update({
      fly: this.rig.fly,
      speed: this.rig.speed,
      heading: this.rig.heading,
      altitude: ground,
      locked: this.game.input.mouse.locked || this.paused,
    });
  }

  debugInfo() {
    const p = this.rig.pos;
    const t = this.world.terrain.stats;
    const ground = this.world.sampler.heightAt(p.x, p.z);
    return [
      `Mission ${this.mission.id}  theater ${this.mission.theater}  ${this.mission.timeOfDay}`,
      `Pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ground ${ground.toFixed(1)}`,
      `Slope ${this.world.sampler.slopeAt(p.x, p.z).toFixed(2)}  mode ${this.rig.fly ? 'fly' : 'ground'}`,
      `Chunks ${t.chunks} (LOD ${t.perLod.join('/')})  queue ${t.queued}`,
      `Entities 0  Wireframe ${this.wireframe ? 'on' : 'off'} [F4]`,
    ];
  }
}
