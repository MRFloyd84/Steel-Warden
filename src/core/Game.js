import { CONFIG } from '../data/config.js';
import { EventBus } from './EventBus.js';
import { StateMachine } from './StateMachine.js';
import { Time } from './Time.js';
import { Renderer } from '../render/Renderer.js';
import { InputManager } from '../input/InputManager.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';

/** Owns the shared services and drives the main loop. */
export class Game {
  constructor(container) {
    this.container = container;
    this.config = CONFIG;
    this.bus = new EventBus();
    this.time = new Time(CONFIG.sim.fixedStep, CONFIG.sim.maxStepsPerFrame);
    this.renderer = new Renderer(container, CONFIG.render);
    this.input = new InputManager(this.renderer.canvas, this.bus);
    this.states = new StateMachine(this);
    this.debug = new DebugOverlay(container, () => this.collectDebugInfo());
    this.running = false;
    this.loop = this.loop.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    const dt = this.time.beginFrame(now);
    this.renderer.beginFrame();
    this.input.poll();

    if (this.states.applyPending()) this.time.resetAccumulator();
    const state = this.states.current;

    if (this.input.wasPressed('toggleDebug')) this.debug.toggle();

    if (state) {
      state.frame(dt);
      this.time.consumeSteps((step) => state.update(step));
      state.render(this.time.alpha);
    }

    this.input.endFrame();
    this.debug.update(dt);
  }

  collectDebugInfo() {
    const info = this.renderer.info;
    const lines = [
      `FPS ${this.time.fps.toFixed(0).padStart(3)}  ${this.time.frameMs.toFixed(1)} ms`,
      `Draw ${info.render.calls}  Tris ${(info.render.triangles / 1000).toFixed(1)}k  Geo ${info.memory.geometries}`,
      `Render ${this.renderer.width}x${this.renderer.height} (x${this.renderer.renderScale})`,
      `State ${this.states.currentName ?? '-'}  Dropped steps ${this.time.droppedSteps}`,
      `Pad ${this.input.gamepad.connected ? this.input.gamepad.id.slice(0, 28) : 'none'}`,
    ];
    const state = this.states.current;
    if (state) lines.push('', ...state.debugInfo());
    return lines;
  }
}
