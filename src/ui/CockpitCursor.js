import { Overlay, esc } from './Overlay.js';

/** Cockpit cursor (free look) with a hover label showing name, state and a usage hint. */
export class CockpitCursor extends Overlay {
  constructor(container) {
    super(container, 'cockpit-cursor-layer');
    this.root.innerHTML = `
      <div class="cockpit-cursor" data-role="cursor"></div>
      <div class="cockpit-tip" data-role="tip"><div class="tip-title"></div><div class="tip-hint"></div></div>`;
    this.cursor = this.root.querySelector('[data-role="cursor"]');
    this.tip = this.root.querySelector('[data-role="tip"]');
    this.tipTitle = this.tip.querySelector('.tip-title');
    this.tipHint = this.tip.querySelector('.tip-hint');
    this.tip.hidden = true;
    this.lastKey = '';
  }

  place(x, y) {
    const t = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.cursor.style.transform = t;
    // Keep the label on screen: flip to the left near the right edge.
    const flip = x > window.innerWidth - 260;
    this.tip.style.transform = `translate(${(flip ? x - 18 : x + 18).toFixed(1)}px, ${(y + 14).toFixed(1)}px)${flip ? ' translateX(-100%)' : ''}`;
  }

  /** @param info null or { title, hint, active } */
  setInfo(info) {
    const key = info ? `${info.title}|${info.hint}|${info.active}` : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cursor.classList.toggle('over', !!info);
    this.cursor.classList.toggle('active', !!info?.active);
    if (!info) {
      this.tip.hidden = true;
      return;
    }
    this.tip.hidden = false;
    this.tipTitle.innerHTML = esc(info.title);
    this.tipHint.innerHTML = esc(info.hint ?? '');
    this.tipHint.hidden = !info.hint;
  }
}
