import { State } from '../core/State.js';
import { World } from '../render/World.js';
import { MenuScreen } from '../ui/MenuScreen.js';
import { MISSIONS } from '../data/missions.js';

/** Main menu over a slow orbital flyover of the first test theater. */
export class MenuState extends State {
  enter() {
    const game = this.game;
    this.screen = new MenuScreen(game.container, game.input.bindings, {
      onStart: (missionId) => game.states.change('mission', { missionId }),
    });
    this.screen.show();

    this.world = new World(MISSIONS[0], game.config.terrain);
    this.angle = 0.6;
    this.orbitRadius = 260;
    this.focus = { x: 0, z: 0 };
    this.world.preload(0, 0);
  }

  exit() {
    this.screen.destroy();
    this.world.dispose();
    this.world = null;
  }

  frame() {
    const input = this.game.input;
    if (input.wasPressed('moveBack')) this.screen.move(1);
    if (input.wasPressed('moveForward')) this.screen.move(-1);
    if (input.wasPressed('confirm')) this.screen.start();
  }

  update(dt) {
    this.angle += dt * 0.035;
  }

  render() {
    const cam = this.game.renderer.camera;
    const x = Math.cos(this.angle) * this.orbitRadius;
    const z = Math.sin(this.angle) * this.orbitRadius;
    const ground = this.world.sampler.heightAt(x, z);
    cam.position.set(x, Math.max(ground, 0) + 70, z);
    // Look tangentially along the orbit for a slow panning view.
    cam.lookAt(x - Math.sin(this.angle) * 200, ground + 30, z + Math.cos(this.angle) * 200);
    this.world.update(cam.position);
    this.world.beforeRender(cam);
    this.game.renderer.render(this.world.scene);
  }

  debugInfo() {
    const t = this.world.terrain.stats;
    return [`Menu flyover  chunks ${t.chunks} (LOD ${t.perLod.join('/')})  queue ${t.queued}`];
  }
}
