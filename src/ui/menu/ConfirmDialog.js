import { MenuPage, esc } from './MenuPage.js';

/**
 * Modal question or message as a page: text plus buttons
 * [{ label, action, primary }]. Esc = the button marked cancel (or close).
 */
export class ConfirmDialog extends MenuPage {
  constructor({ title, text, buttons = [{ label: 'OK', cancel: true }], tone = '' }) {
    super(`dialog:${title}`, `m-dialog-page ${tone}`);
    this.title = title;
    this.text = text;
    this.buttons = buttons;
  }

  html() {
    return `
      <div class="m-panel m-dialog">
        <h2>${esc(this.title)}</h2>
        <div class="m-dialog-text">${esc(this.text)}</div>
        <div class="m-buttons">${this.buttons.map((b, i) => `<button class="m-btn${b.primary ? ' primary' : ''}" data-focus="b${i}">${esc(b.label)}</button>`).join('')}</div>
      </div>`;
  }

  initialFocus() {
    const i = this.buttons.findIndex((b) => b.cancel);
    return `b${i >= 0 ? i : 0}`;
  }

  activate(el) {
    const b = this.buttons[Number(el.dataset.focus.slice(1))];
    this.stack.pop();
    b?.action?.();
    return true;
  }

  back() {
    const b = this.buttons.find((x) => x.cancel);
    this.stack.pop();
    b?.action?.();
    return true;
  }
}
