import './ui/style.css';
import { Game } from './core/Game.js';
import { MenuState } from './states/MenuState.js';
import { MissionState } from './states/MissionState.js';
import { DebriefState } from './states/DebriefState.js';
import { validateFactoryLoadouts } from './sim/loadout.js';

// Fail loudly on broken weapon data before anything else runs.
validateFactoryLoadouts();

const game = new Game(document.getElementById('app'));

game.states.register('menu', new MenuState(game));
game.states.register('mission', new MissionState(game));
game.states.register('debrief', new DebriefState(game));

// Dev shortcut: ?mission=<id> skips the menu, ?debug=1 shows the overlay.
const params = new URLSearchParams(window.location.search);
if (params.get('debug') === '1') game.debug.setVisible(true);
const quickMission = params.get('mission');
if (quickMission) {
  game.states.change('mission', { missionId: quickMission });
} else {
  game.states.change('menu');
}

game.start();

// Exposed for console tinkering during development.
window.steelWarden = game;
