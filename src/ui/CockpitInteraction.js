import * as THREE from 'three';

const DISPLAY_NAMES = {
  radar: 'RADAR', system: 'SYSTEMSTATUS', damage: 'SCHADENSMODELL', target: 'ZIELMONITOR', weapons: 'WAFFENSTATUS',
};
const EDGE_MARGIN = 6; // px kept between cursor and screen edge
const THROTTLE_PER_PX = 0.004;
const THROTTLE_DETENT_PX = 24; // extra drag needed to push through the zero detent

/**
 * Cockpit cursor interaction (free look). The mouse moves the cursor;
 * movement beyond the screen edge is returned as overflow and turns the
 * head. Each frame the cursor ray picks the first cockpit surface — panels
 * and the shell block, so you can't operate a switch through a console.
 *
 * Rules per control type:
 *   toggle   click flips; guarded: first click opens the cover, clicking the
 *            open cover closes it (and forces the switch off)
 *   rotary   click on the left/right half or mouse wheel steps a position
 *   button   held while the interact button is held (momentary)
 *   lamp     held = lamp test
 *   throttle drag up/down to move the lever, wheel for 5 % steps
 *   clipboard click brings the checklist up / puts it away
 */
export class CockpitInteraction {
  constructor({ cockpit, controls, camera, renderer, cursor, throttle, onClipboard }) {
    this.onClipboard = onClipboard;
    this.cockpit = cockpit;
    this.controls = controls;
    this.camera = camera;
    this.renderer = renderer;
    this.cursor = cursor;
    this.throttle = throttle;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3;
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.hover = null;
    this.held = null;
    this.dragDetent = 0;
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.x = this.renderer.cssWidth / 2;
    this.y = this.renderer.cssHeight / 2;
    this.cursor.show();
    this.cursor.place(this.x, this.y);
  }

  deactivate() {
    if (!this.active) return;
    this.endHold();
    this.active = false;
    this.hover = null;
    this.cursor.setInfo(null);
    this.cursor.hide();
  }

  /** Moves the cursor; returns the part of the motion that should turn the head (px). */
  move(dx, dy) {
    if (this.held?.kind === 'throttle') {
      this.dragThrottle(dy);
      return { x: 0, y: 0 };
    }
    const w = this.renderer.cssWidth;
    const h = this.renderer.cssHeight;
    const nx = this.x + dx;
    const ny = this.y + dy;
    this.x = Math.min(w - EDGE_MARGIN, Math.max(EDGE_MARGIN, nx));
    this.y = Math.min(h - EDGE_MARGIN, Math.max(EDGE_MARGIN, ny));
    this.cursor.place(this.x, this.y);
    return { x: nx - this.x, y: ny - this.y };
  }

  /** Discrete input for this frame. */
  handleInput(input) {
    if (!this.active) return;
    if (input.wasPressed('interact')) this.press();
    if (input.wasReleased('interact')) this.endHold();
    const wheel = input.mouse.consumeWheel();
    if (wheel && this.hover) this.wheel(wheel);
  }

  /** Raycast under the cursor; call after the cockpit camera is placed. */
  updateHover() {
    if (!this.active) return;
    this.ndc.set((this.x / this.renderer.cssWidth) * 2 - 1, -(this.y / this.renderer.cssHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.cockpit.scene, true);
    const hit = hits.find((h) => !h.object.userData.noPick && (h.object.visible || h.object.userData.pickProxy));
    const id = hit?.object.userData.controlId ?? null;
    this.hover = id ? { id, part: hit.object.userData.part ?? null, point: hit.point.clone() } : null;
    this.cursor.setInfo(this.describe(this.held?.id ?? id));
  }

  press() {
    const h = this.hover;
    if (!h) return;
    const c = this.controls;
    if (h.id === 'clipboard') {
      this.onClipboard?.();
      return;
    }
    if (h.id === 'throttle') {
      this.held = { id: h.id, kind: 'throttle' };
      this.dragDetent = 0;
      return;
    }
    if (!c.has(h.id)) return;
    const s = c.get(h.id);
    switch (s.type) {
      case 'toggle':
        if (s.def.guard && !s.guardOpen) c.setGuard(h.id, true);
        else if (s.def.guard && h.part === 'guard') c.setGuard(h.id, false);
        else c.toggle(h.id);
        break;
      case 'rotary':
        c.step(h.id, this.sideOf(h) < 0 ? -1 : 1);
        break;
      case 'button':
      case 'lamp':
        c.press(h.id);
        this.held = { id: h.id, kind: 'press' };
        break;
      default:
        break;
    }
  }

  endHold() {
    if (!this.held) return;
    if (this.held.kind === 'press') this.controls.release(this.held.id);
    this.held = null;
  }

  wheel(notches) {
    const id = this.hover.id;
    if (id === 'throttle') {
      this.throttle.value = clamp(this.throttle.value - notches * 0.05, -1, 1);
      return;
    }
    if (this.controls.has(id) && this.controls.get(id).type === 'rotary') this.controls.step(id, notches > 0 ? -1 : 1);
  }

  dragThrottle(dy) {
    const t = this.throttle;
    const prev = t.value;
    let next = clamp(prev - dy * THROTTLE_PER_PX, -1, 1);
    // The lever stops at zero; pushing on through the gate takes extra travel.
    if (prev === 0 && next !== 0) {
      this.dragDetent += Math.abs(dy);
      if (this.dragDetent < THROTTLE_DETENT_PX) next = 0;
    } else if (prev !== 0 && Math.sign(next) !== Math.sign(prev)) {
      next = 0;
      this.dragDetent = 0;
      t.detentHold = true;
    }
    if (next !== 0) t.detentHold = false;
    t.value = next;
  }

  /**
   * Which half of a knob was clicked, judged on screen (as the pilot sees
   * it) — in the knob's own frame an oblique view can flip the answer.
   */
  sideOf(hover) {
    const entry = this.cockpit.controls.get(hover.id);
    entry.object.getWorldPosition(this.tmp).project(this.camera);
    const centreX = (this.tmp.x * 0.5 + 0.5) * this.renderer.cssWidth;
    return this.x - centreX;
  }

  describe(id) {
    if (!id) return null;
    const active = !!this.held;
    if (id === 'throttle') return { title: `SCHUBHEBEL ${Math.round(this.throttle.value * 100)} %`, hint: 'ziehen: auf/ab · Mausrad: 5 %', active };
    if (id === 'stick') return { title: 'STEUERKNÜPPEL', hint: 'folgt Maus und Lenkung' };
    if (id === 'clipboard') return { title: 'CHECKLISTE', hint: 'Klick: heranholen / weglegen · Taste C' };
    if (id === 'nameplate') return { title: 'TYPENSCHILD', hint: this.cockpit.walker.name };
    const extra = this.cockpit.extraParts.get(id);
    if (extra?.item.type === 'monitor') return { title: DISPLAY_NAMES[extra.item.display] ?? extra.item.display };
    if (!this.controls.has(id)) return null;

    const s = this.controls.get(id);
    const d = s.def;
    switch (s.type) {
      case 'toggle': {
        const title = `${d.label}: ${this.controls.positionLabel(id)}`;
        if (!d.guard) return { title, hint: 'Klick: umschalten', active };
        if (!s.guardOpen) return { title, hint: 'Schutzkappe zu · Klick: öffnen', active };
        return { title, hint: 'Klick: umschalten · Kappe anklicken: schließen', active };
      }
      case 'rotary':
        return { title: `${d.label}: ${this.controls.positionLabel(id)}`, hint: 'Klick links/rechts oder Mausrad', active };
      case 'button':
        return { title: `${d.label} · ${d.cap}`, hint: s.lit ? 'leuchtet · gedrückt halten' : 'gedrückt halten', active };
      case 'lamp':
        return { title: `${d.text}: ${s.lit ? 'AN' : 'AUS'}`, hint: 'gedrückt halten: Lampentest', active };
      default:
        return null;
    }
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
