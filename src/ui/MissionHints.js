import { Overlay, esc, keyLabel } from './Overlay.js';

/**
 * In-mission HTML layer: torso aim reticle (projected, so it slides off
 * centre during free look), free-look tag, pointer-lock hint and a key
 * reference bar (F1). The vector HUD proper replaces the reticle later.
 */
export class MissionHints extends Overlay {
  constructor(container, bindings) {
    super(container, 'mission-hints');
    const k = (action) => keyLabel(bindings.keys[action][0]);
    const hints = [
      `[${k('throttleUp')}/${k('throttleDown')}] Schub`,
      `[${k('throttleStop')}] Stopp`,
      `[${k('turnLeft')}/${k('turnRight')}] Beine`,
      'Maus: Torso',
      `[RMT/${k('freeLookToggle')}] Umsehen`,
      `[${k('centerTorso')}] Zentrieren`,
      `[${k('cockpitLight')}] Licht`,
      `[${k('debugFreeCam')}] Freiflug`,
      `[${k('toggleHints')}] Hilfe`,
    ];
    this.root.innerHTML = `
      <div class="crosshair" data-role="reticle"></div>
      <div class="view-tag" data-role="tag"></div>
      <div class="hint-bar" data-role="bar">${esc(hints.join('   '))}</div>
      <div class="click-hint" data-role="click">Klick ins Bild, um die Maus zu fangen</div>`;
    this.reticle = this.root.querySelector('[data-role="reticle"]');
    this.tag = this.root.querySelector('[data-role="tag"]');
    this.bar = this.root.querySelector('[data-role="bar"]');
    this.clickHint = this.root.querySelector('[data-role="click"]');
    this.tag.hidden = true;
    this.lastTag = null;
  }

  toggleBar() {
    this.bar.hidden = !this.bar.hidden;
  }

  /** @param reticle {x, y} in CSS pixels or null to hide */
  update({ reticle, tag, locked }) {
    if (reticle) {
      this.reticle.hidden = false;
      this.reticle.style.transform = `translate(${reticle.x.toFixed(1)}px, ${reticle.y.toFixed(1)}px)`;
    } else {
      this.reticle.hidden = true;
    }
    if (tag !== this.lastTag) {
      this.tag.textContent = tag ?? '';
      this.tag.hidden = !tag;
      this.lastTag = tag;
    }
    this.clickHint.hidden = locked;
  }
}
