import { Overlay } from './Overlay.js';

/** In-mission pause menu. */
export class PauseScreen extends Overlay {
  constructor(container, { onResume, onAbort }) {
    super(container, 'pause-screen');
    this.root.innerHTML = `
      <div class="small-panel crt">
        <h2>Einsatz angehalten</h2>
        <button class="btn primary" data-role="resume">Fortsetzen</button>
        <button class="btn" data-role="abort">Einsatz abbrechen</button>
      </div>`;
    this.root.querySelector('[data-role="resume"]').addEventListener('click', onResume);
    this.root.querySelector('[data-role="abort"]').addEventListener('click', onAbort);
  }
}
