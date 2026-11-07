import { Overlay, esc } from './Overlay.js';

/** The seven wingman commands (they act from phase B on). */
export const RADIO_COMMANDS = [
  { id: 'formation', label: 'Formation' },
  { id: 'attackMyTarget', label: 'Mein Ziel angreifen' },
  { id: 'freeFire', label: 'Freies Feuer' },
  { id: 'goNav', label: 'Navpunkt anlaufen' },
  { id: 'holdPosition', label: 'Stellung halten' },
  { id: 'fallBack', label: 'Zurückfallen / zu mir' },
  { id: 'aimLegs', label: 'Beine zielen' },
];

/**
 * Radio menu (F): digits 1–7 or up/down + Enter choose a command, Esc
 * closes; after a choice it closes by itself. Runs in the 'menu' input
 * context while open. Until phase B there are no wingmen.
 */
export class RadioMenu extends Overlay {
  constructor(container, { onCommand }) {
    super(container, 'radio-menu');
    this.onCommand = onCommand;
    this.index = 0;
    this.root.innerHTML = `
      <div class="radio-panel crt">
        <div class="radio-title">FUNK · FLÜGELLEUTE</div>
        <div class="radio-note">keine Flügelleute</div>
        <ol>${RADIO_COMMANDS.map((c, i) => `<li data-i="${i}"><kbd>${i + 1}</kbd> ${esc(c.label)}</li>`).join('')}</ol>
        <div class="radio-foot"><kbd>Esc</kbd> schließen</div>
      </div>`;
    this.items = [...this.root.querySelectorAll('li')];
  }

  get open() {
    return this.visible;
  }

  show() {
    this.index = 0;
    this.mark();
    super.show();
  }

  mark() {
    this.items.forEach((el, i) => el.classList.toggle('selected', i === this.index));
  }

  /** Menu actions for this frame (context 'menu'). */
  handle(input) {
    for (let n = 1; n <= RADIO_COMMANDS.length; n++) {
      if (input.pressed(`menuChoice${n}`)) return this.choose(n - 1);
    }
    if (input.pressed('menuDown')) this.index = (this.index + 1) % RADIO_COMMANDS.length;
    if (input.pressed('menuUp')) this.index = (this.index - 1 + RADIO_COMMANDS.length) % RADIO_COMMANDS.length;
    this.mark();
    if (input.pressed('menuConfirm')) return this.choose(this.index);
    if (input.pressed('menuBack')) this.hide();
    return null;
  }

  choose(i) {
    this.hide();
    this.onCommand(RADIO_COMMANDS[i]);
    return RADIO_COMMANDS[i];
  }
}
