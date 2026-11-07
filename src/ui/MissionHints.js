import { Overlay } from './Overlay.js';

/**
 * In-mission HTML layer: torso aim reticle (projected, so it slides off
 * centre during free look), free-look tag, pointer-lock hint and short
 * notes. The key reference is the help panel (H). The vector HUD proper
 * replaces the reticle later.
 */
export class MissionHints extends Overlay {
  constructor(container) {
    super(container, 'mission-hints');
    this.root.innerHTML = `
      <div class="crosshair" data-role="reticle"></div>
      <div class="target-box" data-role="target"><span class="target-label"></span></div>
      <div class="lock-ring" data-role="lock" hidden></div>
      <div class="comp-box" data-role="comp" hidden><span></span></div>
      <div class="view-tag" data-role="tag"></div>
      <div class="flash-note" data-role="flash" hidden></div>
      <div class="click-hint" data-role="click">Klicken zum Fortsetzen (Maus fangen)</div>`;
    this.flashEl = this.root.querySelector('[data-role="flash"]');
    this.reticle = this.root.querySelector('[data-role="reticle"]');
    this.targetEl = this.root.querySelector('[data-role="target"]');
    this.targetLabel = this.targetEl.querySelector('.target-label');
    this.targetEl.hidden = true;
    this.lastTargetLabel = '';
    this.compEl = this.root.querySelector('[data-role="comp"]');
    this.compLabel = this.compEl.querySelector('span');
    this.lockEl = this.root.querySelector('[data-role="lock"]');
    this.tag = this.root.querySelector('[data-role="tag"]');
    this.clickHint = this.root.querySelector('[data-role="click"]');
    this.tag.hidden = true;
    this.lastTag = null;
  }

  /** Short note in the middle of the screen (e.g. "Keine Sprungdüsen an Bord"). */
  flash(text, ms = 1800) {
    this.flashEl.textContent = text;
    this.flashEl.hidden = false;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this.flashEl.hidden = true), ms);
  }

  /** Kept for old callers: the key reference moved to the help panel (H). */
  toggleBar() {}

  /** @param reticle {x, y} in CSS pixels or null to hide */
  update({ reticle, tag, locked, target = null, aimOnUnit = false }) {
    if (target) {
      this.targetEl.hidden = false;
      const size = target.half * 2;
      this.targetEl.style.width = `${size.toFixed(0)}px`;
      this.targetEl.style.height = `${size.toFixed(0)}px`;
      this.targetEl.style.transform = `translate(${(target.x - target.half).toFixed(1)}px, ${(target.y - target.half).toFixed(1)}px)`;
      this.targetEl.classList.toggle('wreck', target.wreck);
      if (target.label !== this.lastTargetLabel) {
        this.targetLabel.textContent = target.label;
        this.lastTargetLabel = target.label;
      }
    } else {
      this.targetEl.hidden = true;
    }
    // Target pod: small frame on the chosen component
    const comp = target?.comp;
    this.compEl.hidden = !comp;
    if (comp) {
      this.compEl.style.transform = `translate(${(comp.x - 9).toFixed(1)}px, ${(comp.y - 9).toFixed(1)}px)`;
      this.compEl.classList.toggle('converging', comp.converging);
      if (this.compLabel.textContent !== comp.label) this.compLabel.textContent = comp.label;
    }
    // Missile lock: ring closes in on the target while locking, turns red when locked
    const lock = target?.lock;
    this.lockEl.hidden = !lock;
    if (lock) {
      const r = target.half * (1 + (1 - lock.progress) * 1.5) + 6;
      this.lockEl.style.width = this.lockEl.style.height = `${(r * 2).toFixed(0)}px`;
      this.lockEl.style.transform = `translate(${(target.x - r).toFixed(1)}px, ${(target.y - r).toFixed(1)}px)`;
      this.lockEl.classList.toggle('locked', lock.progress >= 1);
    }
    this.reticle.classList.toggle('on-target', aimOnUnit);
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
