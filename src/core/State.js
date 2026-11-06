/**
 * Base class for game states. The loop calls:
 *   frame(dt)    once per rendered frame — discrete input (toggles, menus)
 *   update(dt)   0..n times per frame with a fixed step — simulation
 *   render(a)    once per frame; a = interpolation factor between sim steps
 */
export class State {
  constructor(game) {
    this.game = game;
  }

  enter(_params) {}
  exit() {}
  frame(_dt) {}
  update(_dt) {}
  render(_alpha) {}

  /** Lines shown in the debug overlay while this state is active. */
  debugInfo() {
    return [];
  }
}
