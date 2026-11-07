/* global __APP_VERSION__, __BUILD_DATE__ */
import { MenuPage } from './MenuPage.js';
import { MainMenu } from './MainMenu.js';

export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

/** Title: logo over the 3D scene, CRT power-on, "Taste drücken". Any key, click or pad button → main menu. */
export class TitleScreen extends MenuPage {
  constructor() {
    super('title', 'm-title');
    this.t = 0;
  }

  html() {
    return `
      <div class="m-title-block crt-on">
        <h1 class="m-logo">STEEL WARDEN</h1>
        <div class="m-sub">WIDERSTANDSKOMMANDO · WALKER-EINSATZSYSTEM</div>
        <div class="m-press">— Taste drücken —</div>
      </div>
      <div class="m-version">v${VERSION}${BUILD_DATE ? ` · ${BUILD_DATE}` : ''}</div>`;
  }

  focusables() {
    return [];
  }

  frame(dt) {
    this.t += dt;
    // Ignore the very first moment (the key that opened the page)
    if (this.t > 0.4 && this.game.input.anyPressed()) {
      this.stack.sound('confirm');
      this.stack.push(new MainMenu());
    }
  }

  back() {
    return false;
  }
}
