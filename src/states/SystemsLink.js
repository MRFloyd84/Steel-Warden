import { LIGHT_MODES } from '../render/cockpit/Cockpit.js';
import { RADIO } from '../data/systems.js';

/**
 * Connects WalkerSystems to everything it drives outside the simulation:
 * drive limits for WalkerMotion, cockpit lighting (emergency light without
 * battery, flicker at ignition), monitor flicker, the floodlight's power,
 * the clipboard's paper tint and radio messages.
 * Replaces the earlier event-only controlEffects.
 */
export class SystemsLink {
  constructor({ systems, controls, cockpit, floodlight, motion, bus, radio }) {
    this.systems = systems;
    this.controls = controls;
    this.cockpit = cockpit;
    this.floodlight = floodlight;
    this.motion = motion;
    this.radio = radio;
    const h = systems.cfg.hydraulics;
    motion.setStanceRange(h.standUpHeight, h.slumpPitch);
    this.offs = [
      bus.on('systems:event', ({ type }) => {
        const msg = { legsReleased: RADIO.ready, scram: RADIO.scram, busFault: RADIO.busFault, ignitionFailed: RADIO.ignitionFailed }[type];
        if (msg) radio(msg);
      }),
    ];
    this.applyDrive();
  }

  applyDrive() {
    Object.assign(this.motion.limits, this.systems.drive);
  }

  /**
   * Fixed step: limits must be current before WalkerMotion.update. The drive overload of the
   * previous step (one step = 1/60 s late) becomes reactor heat.
   */
  update() {
    this.applyDrive();
    this.systems.setDriveOverload(this.motion.driveOverload ?? 0);
  }

  /** Per rendered frame: lights, flicker, floodlight. */
  frame() {
    const { systems: sys, controls: c, cockpit } = this;
    const f = sys.flags;
    let mode = f.lightsNormal ? LIGHT_MODES[c.has('cockpitLight') ? c.value('cockpitLight') : 2] : 'emergency';
    const flicker = sys.flickering;
    if (flicker && Math.random() < 0.35) mode = Math.random() < 0.5 ? 'emergency' : 'off';
    if (mode !== cockpit.lightMode) cockpit.applyLightMode(mode);
    cockpit.setMonitorFlicker(flicker || (this.extraFlicker?.() && Math.random() < 0.3));
    cockpit.clipboard?.setLightMode(mode);

    const flood = c.has('floodlight') && c.value('floodlight') === 1 && f.busPowered;
    if (flood !== this.floodlight.on) this.floodlight.setOn(flood);
  }

  dispose() {
    this.offs.forEach((off) => off());
  }
}
