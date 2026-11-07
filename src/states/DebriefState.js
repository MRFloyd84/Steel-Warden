import { State } from '../core/State.js';
import { DebriefScreen } from '../ui/DebriefScreen.js';
import { getTheater } from '../data/theaters.js';

/** Shows mission results; the 3D scene is not rendered here. */
export class DebriefState extends State {
  enter({ mission, result, stats }) {
    this.screen = new DebriefScreen(this.game.container, {
      onContinue: () => this.game.states.change('menu'),
    });
    this.screen.showReport({ mission, theaterName: getTheater(mission.theater).name, result, stats });
    // Clear the last mission frame to black behind the dialog.
    this.game.renderer.renderer.setClearColor(0x000000, 1);
    this.game.renderer.renderer.clear();
  }

  exit() {
    this.screen.destroy();
  }

  frame() {
    const input = this.game.input;
    input.setContext('menu');
    if (input.pressed('menuConfirm')) this.game.states.change('menu');
  }
}
