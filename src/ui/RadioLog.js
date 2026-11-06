import { Overlay, esc } from './Overlay.js';

const SHOW_SECONDS = 7;
const MAX_LINES = 3;

/** Radio text log (top left of the view). The squelch sound is played by the caller. */
export class RadioLog extends Overlay {
  constructor(container) {
    super(container, 'radio-log');
    this.lines = [];
    this.show();
  }

  push(from, text, now) {
    this.lines.push({ from, text, until: now + SHOW_SECONDS });
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.render();
  }

  update(now) {
    const before = this.lines.length;
    this.lines = this.lines.filter((l) => l.until > now);
    if (this.lines.length !== before) this.render();
  }

  render() {
    this.root.innerHTML = this.lines
      .map((l) => `<div class="radio-line"><span class="radio-from">${esc(l.from)}:</span> ${esc(l.text)}</div>`)
      .join('');
  }
}
