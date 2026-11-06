import { Overlay, esc } from './Overlay.js';

/**
 * Minimal phase-1 readout (crosshair, mode, speed, heading). The real
 * cockpit instruments replace this in phase 3.
 */
export class MissionHints extends Overlay {
  constructor(container) {
    super(container, 'mission-hints');
    this.root.innerHTML = `
      <div class="crosshair"></div>
      <div class="hint-bar" data-role="bar"></div>
      <div class="click-hint" data-role="click">Klick ins Bild, um die Maus zu fangen</div>`;
    this.bar = this.root.querySelector('[data-role="bar"]');
    this.clickHint = this.root.querySelector('[data-role="click"]');
    this.lastText = '';
  }

  update({ fly, speed, heading, altitude, locked }) {
    const text = `${fly ? 'FLUG' : 'BODEN'}  ${(speed * 3.6).toFixed(0).padStart(3)} km/h  KURS ${heading.toFixed(0).padStart(3, '0')}°  HÖHE ${altitude.toFixed(0)} m   [F] Modus  [Shift] Schnell  [Esc] Pause`;
    if (text !== this.lastText) {
      this.bar.innerHTML = esc(text);
      this.lastText = text;
    }
    this.clickHint.hidden = locked;
  }
}
