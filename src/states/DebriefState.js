import { State } from '../core/State.js';
import { MenuStack } from '../ui/menu/MenuStack.js';
import { DebriefPage } from '../ui/menu/DebriefPage.js';
import { getTheater } from '../data/theaters.js';

/** Mission results (ui/menu/DebriefPage.js); Erneut starts the same mission with the same settings. */
export class DebriefState extends State {
  enter({ mission, result, stats, params = null }) {
    const game = this.game;
    this.stack = new MenuStack({ game, container: game.container, className: 'debrief-layer' });
    this.stack.push(new DebriefPage({
      mission, result, stats, theaterName: getTheater(mission.theater).name,
      onRetry: () => {
        game.loading.show({ name: mission.name, place: getTheater(mission.theater).name });
        game.states.change('mission', params ?? { missionId: mission.id });
      },
      onMenu: () => game.states.change('menu', { page: 'main' }),
    }));
    // Black behind the panel
    game.renderer.renderer.setClearColor(0x000000, 1);
    game.renderer.renderer.clear();
  }

  exit() {
    this.stack.destroy();
  }

  frame(dt) {
    this.game.input.setContext('menu');
    this.stack.frame(dt);
  }
}
