import { State } from '../core/State.js';
import { MenuStack } from '../ui/menu/MenuStack.js';
import { TitleScreen } from '../ui/menu/TitleScreen.js';
import { MainMenu } from '../ui/menu/MainMenu.js';
import { ConfirmDialog } from '../ui/menu/ConfirmDialog.js';
import { MenuScene } from '../render/MenuScene.js';

/**
 * Title and menus over a 3D scene (render/MenuScene.js). Screens live on a
 * MenuStack (ui/menu/). enter({ page: 'main' }) skips the title (back from a
 * mission), enter({ error }) shows a message (invalid mission).
 */
export class MenuState extends State {
  enter({ error = null, page = 'title' } = {}) {
    const game = this.game;
    game.loading.hide();
    this.scene = new MenuScene(game);
    this.fx = document.createElement('div');
    this.fx.className = 'menu-fx';
    game.container.appendChild(this.fx);
    this.stack = new MenuStack({ game, container: game.container });
    this.stack.scene = this.scene;
    this.stack.push(new TitleScreen());
    if (page === 'main' || error) this.stack.push(new MainMenu());
    if (error) this.stack.push(new ConfirmDialog({ title: 'Einsatz ungültig', text: error, tone: 'error', buttons: [{ label: 'Zurück', cancel: true }] }));
  }

  exit() {
    this.stack.destroy();
    this.fx.remove();
    this.scene.dispose();
    this.scene = null;
  }

  frame(dt) {
    this.game.input.setContext('menu');
    this.stack.frame(dt);
    this.dt = dt;
  }

  update(dt) {
    this.scene?.update(dt);
  }

  render() {
    this.scene?.render();
  }

  debugInfo() {
    const t = this.scene.world.terrain.stats;
    return [`Menü: ${this.stack.pages.map((p) => p.key).join(' › ')}  Fokus ${this.stack.focused?.dataset.focus ?? '-'}  Szene ${this.scene.kind}/${this.scene.mission.theater}/${this.scene.mission.timeOfDay}  chunks ${t.chunks} queue ${t.queued}`];
  }
}
