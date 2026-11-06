/** Polls the first connected gamepad / joystick once per frame. */
export class GamepadInput {
  constructor(bus) {
    this.bus = bus;
    this.index = null;
    this.id = '';
    this.axes = [];
    this.buttons = [];
    this.prevButtons = [];

    window.addEventListener('gamepadconnected', (e) => {
      if (this.index === null) this.attach(e.gamepad);
      bus.emit('gamepad:connected', { id: e.gamepad.id });
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.index) {
        this.index = null;
        this.id = '';
        this.axes = [];
        this.buttons = [];
        this.prevButtons = [];
      }
      bus.emit('gamepad:disconnected', { id: e.gamepad.id });
    });
  }

  get connected() {
    return this.index !== null;
  }

  attach(pad) {
    this.index = pad.index;
    this.id = pad.id;
  }

  poll() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = this.index !== null ? pads[this.index] : null;
    if (!pad) {
      pad = Array.from(pads).find((p) => p) ?? null;
      if (pad) this.attach(pad);
    }
    this.prevButtons = this.buttons;
    if (!pad) {
      this.buttons = [];
      this.axes = [];
      return;
    }
    this.axes = Array.from(pad.axes);
    this.buttons = pad.buttons.map((b) => b.pressed);
  }

  axis(i) {
    return this.axes[i] ?? 0;
  }

  isDown(i) {
    return this.buttons[i] === true;
  }

  wasPressed(i) {
    return this.buttons[i] === true && this.prevButtons[i] !== true;
  }
}
