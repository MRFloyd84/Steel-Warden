import './ui/style.css';
import { Game } from './core/Game.js';
import { MenuState } from './states/MenuState.js';
import { MissionState } from './states/MissionState.js';
import { DebriefState } from './states/DebriefState.js';
import { validateFactoryLoadouts } from './sim/loadout.js';
import { missionError } from './states/missionStartup.js';
import { getMission } from './data/missions.js';

// Fail loudly on broken weapon data before anything else runs.
validateFactoryLoadouts();

const game = new Game(document.getElementById('app'));

game.states.register('menu', new MenuState(game));
game.states.register('mission', new MissionState(game));
game.states.register('debrief', new DebriefState(game));

// Dev shortcut: ?mission=<id> skips the menu, ?debug switches debug mode on (overlay + debug keys).
const params = new URLSearchParams(window.location.search);
if (params.has('debug') && params.get('debug') !== '0') game.setDebugMode(true);
const quickMission = params.get('mission');
if (quickMission) {
  // An invalid mission (startup checks, states/missionStartup.js) lands in the menu with the reason
  let error = null;
  try {
    error = missionError(getMission(quickMission));
  } catch (e) {
    error = e.message;
  }
  if (error) game.states.change('menu', { error });
  else game.states.change('mission', { missionId: quickMission });
} else {
  game.states.change('menu');
}

game.start();

// Exposed for console tinkering during development.
window.steelWarden = game;
