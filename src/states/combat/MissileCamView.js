import { MissileCamera } from '../../render/MissileCamera.js';
import { MissileCamDisplay } from '../../render/cockpit/displays/MissileCamDisplay.js';

/**
 * Which missile the nose camera shows, and where.
 *  - KAM button (M) switches the camera on/off by hand; it follows the
 *    newest own missile, KEIN SIGNAL with nothing in the air
 *  - an optical launch switches it on by itself until that missile is down
 *  - when the shown missile hits or crashes: white noise, then the next
 *    missile (or back to the normal page)
 * The picture replaces the target monitor (radar monitor in cockpits
 * without one).
 */
export class MissileCamView {
  constructor({ game, world, cockpit, controls, systems, combat, config }) {
    this.game = game;
    this.world = world;
    this.controls = controls;
    this.systems = systems;
    this.combat = combat;
    this.cfg = config;
    this.camera = new MissileCamera(game.renderer.renderer, config);
    this.monitor = cockpit.monitors.find((m) => m.id === 'mfdTarget') ?? cockpit.monitors.find((m) => m.id === 'mfdRadar') ?? null;
    this.manual = false;
    this.auto = false; // optical missile in the air
    this.serial = 0;
    this.staticUntil = -Infinity;
    this.time = 0;
    this.shown = null;
    this.data = { missile: null, canvas: this.camera.canvas, static: false, ground: 0, weapon: '', steering: false };
    this.staticVoice = null;
    this.offs = [
      game.bus.on('control:pressed', ({ id, pressed }) => {
        if (id === 'missileCamera' && pressed) this.toggle();
      }),
    ];
  }

  get active() {
    return this.manual || this.auto || this.time < this.staticUntil;
  }

  toggle() {
    if (!this.combat.missiles.hasLaunchers) {
      this.game.audio.play('weapon.dryFire');
      return;
    }
    this.manual = !this.manual;
  }

  /** M key: presses the KAM button like a click would. */
  frame(input) {
    if (!this.controls.has('missileCamera')) {
      if (input.wasPressed('missileCamera')) this.toggle();
      return;
    }
    const down = input.isDown('missileCamera');
    if (input.wasPressed('missileCamera')) this.controls.press('missileCamera');
    else if (this.keyHeld && !down) this.controls.release('missileCamera');
    this.keyHeld = down || input.wasPressed('missileCamera');
  }

  /** Per render frame, before the cockpit is drawn. */
  update(dt) {
    this.time += dt;
    const c = this.combat;
    const proj = c.projectiles;
    for (const e of c.missileEnds) {
      if (e.serial === this.serial && this.active) this.staticUntil = this.time + this.cfg.staticTime;
    }
    c.missileEnds.length = 0;

    const steering = c.missiles.steering;
    if (steering) {
      this.auto = true;
      this.serial = steering.serial;
    }
    let missile = proj.bySerial(this.serial);
    const inStatic = this.time < this.staticUntil;
    if (!missile && !inStatic) {
      // Follow the newest own missile still in the air
      const newest = proj.bySerial(c.missiles.lastGuidedSerial) ?? proj.bySerial(c.missiles.lastSerial);
      if (newest && (this.manual || newest.mode === 'optical')) {
        this.serial = newest.serial;
        missile = newest;
      } else {
        this.auto = false;
      }
    }
    if (inStatic) missile = null;
    this.shown = missile;

    const d = this.data;
    d.missile = missile;
    d.static = inStatic;
    d.steering = !!steering && steering === missile && c.firing;
    if (missile) {
      d.ground = missile.pos.y - this.world.sampler.heightAt(missile.pos.x, missile.pos.z);
      d.weapon = missile.def.short;
    }
    const on = this.active;
    if (this.monitor) this.monitor.override = on ? MissileCamDisplay : null;
    this.systems.missileCamOn = this.manual;

    // Static hiss while the picture is snow
    const hiss = on && (inStatic || !missile) ? (inStatic ? 1 : 0.25) : 0;
    if (hiss && !this.staticVoice) this.staticVoice = this.game.audio.loop('camStatic');
    this.staticVoice?.setGain(hiss, 0.03);
  }

  /** Renders the nose picture (call before the main camera's beforeRender). */
  render(dt) {
    if (!this.monitor || !this.shown) return;
    // Point particles are sized for the viewport they are drawn into
    const fx = this.combat.fx;
    this.camera.update(dt, this.shown, this.world.scene, (cam) => {
      this.world.beforeRender(cam);
      fx.setViewportHeight(this.camera.h);
    });
    fx.setViewportHeight(this.game.renderer.height);
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.staticVoice?.stop(0.05);
    if (this.monitor) this.monitor.override = null;
    this.camera.dispose();
  }
}
