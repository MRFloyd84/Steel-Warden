import { Overlay, esc } from './Overlay.js';

/** The seven wingman orders (ai/Flight.js; keys Shift+1..7 in input/actions.js). */
export const RADIO_COMMANDS = [
  { id: 'formation', label: 'Formation' },
  { id: 'attackMyTarget', label: 'Mein Ziel angreifen' },
  { id: 'freeFire', label: 'Freies Feuer' },
  { id: 'goNav', label: 'Navpunkt anlaufen' },
  { id: 'holdPosition', label: 'Stellung halten' },
  { id: 'fallBack', label: 'Zurückfallen / zu mir' },
  { id: 'aimLegs', label: 'Beine zielen' },
];

const ORDER_LABELS = { wait: 'wartet', formation: 'Formation', attackMyTarget: 'greift an', freeFire: 'freies Feuer', goNav: 'Navpunkt', holdPosition: 'hält Stellung', fallBack: 'kommt zurück' };
const STATE_TEXT = { ok: '', immobile: ' · BEINE WEG', broken: ' · MORAL', lost: ' · AUSGEFALLEN' };

/**
 * Radio menu (F): digits 1–7 or up/down + Enter choose an order, Esc closes; after a choice
 * it closes by itself. Runs in the 'menu' input context while open. Shows the wingmen
 * (this.flight, set by MissionState) with walker, torso state and current order.
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
        <ol>${RADIO_COMMANDS.map((c, i) => `<li data-i="${i}"><kbd>${i + 1}</kbd> ${esc(c.label)}<span class="radio-key">Shift+${i + 1}</span></li>`).join('')}</ol>
        <div class="radio-foot"><kbd>Esc</kbd> schließen</div>
      </div>`;
    this.items = [...this.root.querySelectorAll('li')];
    this.note = this.root.querySelector('.radio-note');
    this.flight = null;
  }

  get open() {
    return this.visible;
  }

  show() {
    this.index = 0;
    this.mark();
    this.renderTeam();
    super.show();
  }

  /** Team lines: ZWEI · ANKER  MARDER  Torso 84 %  Formation. */
  renderTeam() {
    const team = this.flight?.status() ?? [];
    if (!team.length) {
      this.note.textContent = 'keine Flügelleute';
      return;
    }
    const order = this.flight.order;
    this.note.innerHTML = team.map((t) => `<div class="radio-wing ${t.state}">${esc(t.name)} · ${esc(t.callsign)} <span>${esc(t.walker)}</span> <span>${t.state === 'lost' ? '—' : `T ${Math.round(t.torso * 100)} %`}</span> <span>${esc(ORDER_LABELS[t.order] ?? t.order)}${STATE_TEXT[t.state] ?? ''}</span></div>`).join('')
      + `<div class="radio-wing-foot">Befehl: ${esc(ORDER_LABELS[order] ?? order)}${this.flight.aimLegs ? ' · Beine zielen' : ''}</div>`;
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
