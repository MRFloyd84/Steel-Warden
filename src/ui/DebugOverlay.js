import { CONFIG } from '../data/config.js';

/** Text overlay (debug mode: ^, F2) refreshed a few times per second from a provider callback. */
export class DebugOverlay {
  constructor(container, provider) {
    this.provider = provider;
    this.el = document.createElement('pre');
    this.el.className = 'debug-overlay';
    this.el.hidden = true;
    container.appendChild(this.el);
    this.elapsed = 0;
  }

  setVisible(on) {
    this.el.hidden = !on;
    this.elapsed = Infinity;
  }

  toggle() {
    this.setVisible(this.el.hidden);
  }

  get visible() {
    return !this.el.hidden;
  }

  update(dt) {
    if (this.el.hidden) return;
    this.elapsed += dt * 1000;
    if (this.elapsed < CONFIG.debug.refreshMs) return;
    this.elapsed = 0;
    this.el.textContent = this.provider().join('\n');
  }
}
