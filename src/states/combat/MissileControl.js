import * as THREE from 'three';
import { GUIDANCE_MODES } from '../../data/weapons.js';
import { COMBAT } from '../../data/combat.js';
import { pickEmitter } from '../../sim/Guidance.js';

const LOCKED_MODES = new Set(['active', 'semiActive']);
const DEG = Math.PI / 180;
const to = new THREE.Vector3();

/**
 * The player's missile handling:
 *  - guidance mode from the LENKUNG rotary (B), applied per launcher — a
 *    launcher that can't fly the chosen mode fires unguided
 *  - launch rules: active/semi-active need the full lock, an optical launcher
 *    waits until its last missile is down
 *  - spawn parameters per mode (target, component, semi-active bonus)
 *  - semi-active illumination: the target stays locked and inside the cone
 *  - optical steering: mouse input goes into the flying missile while fire is held
 *  - lock tones: rising beeps while locking on, a steady tone once locked
 */
export class MissileControl {
  constructor({ game, controls, targeting, weapons, player, units, sound }) {
    this.game = game;
    this.controls = controls;
    this.targeting = targeting;
    this.weapons = weapons;
    this.player = player;
    this.units = units;
    this.sound = sound;
    this.launchers = weapons.slots.filter((s) => s.def.guidance);
    this.lastSerial = 0; // newest player missile (camera)
    this.lastGuidedSerial = 0; // newest guided one (preferred by the camera)
    this.optical = null; // the optical missile currently steered (pooled object + serial)
    this.opticalSerial = 0;
    this.lockState = 'none'; // 'none' | 'locking' | 'locked'
    this.beepT = 0;
    this.lockVoice = null;
  }

  get selectedMode() {
    return this.controls.has('missileGuidance') ? GUIDANCE_MODES[this.controls.value('missileGuidance')] ?? 'dumb' : 'dumb';
  }

  get hasLaunchers() {
    return this.launchers.length > 0;
  }

  /** B: next guidance mode (wraps around). */
  cycleMode() {
    if (!this.controls.has('missileGuidance')) return;
    const n = GUIDANCE_MODES.length;
    this.controls.setValue('missileGuidance', (this.controls.value('missileGuidance') + 1) % n, 'user');
  }

  /** Per step: effective mode per launcher. */
  updateModes() {
    const sel = this.selectedMode;
    for (const s of this.launchers) s.mode = s.def.guidance.includes(sel) ? sel : 'dumb';
  }

  /** Lock that a launcher in mode active/semi-active needs (full lock inside the cone). */
  lockedFor(slot) {
    const t = this.targeting;
    return !!t.target && t.inCone && t.lockTime >= slot.def.lockTime;
  }

  /** Why a triggered launcher may not fire right now ('' = may fire). */
  holdReason(slot) {
    if (!slot.def.guidance) return '';
    if (LOCKED_MODES.has(slot.mode) && this.radarLock && !this.radarLock()) return 'RADAR PASSIV';
    if (LOCKED_MODES.has(slot.mode) && !this.lockedFor(slot)) return 'AUFSCHALT.';
    if (slot.mode === 'optical' && slot.flying && slot.flying.active && slot.flying.serial === slot.flyingSerial) return 'LENKT';
    return '';
  }

  /** Projectiles.spawn parameters for a missile from this launcher. */
  spawnParams(slot, eye, aimDir) {
    const mode = slot.mode ?? 'dumb';
    const t = this.targeting;
    const out = { mode, target: null, component: null, damageFactor: 1 };
    if (LOCKED_MODES.has(mode)) {
      out.target = t.target;
      out.component = t.component;
      if (mode === 'semiActive') out.damageFactor = slot.def.missile.semiActiveBonus ?? 1;
    } else if (mode === 'antiRadar') {
      out.target = pickEmitter(this.emitters?.() ?? this.units.all, eye, aimDir, COMBAT.targeting.coneDeg, this.player);
    }
    return out;
  }

  /** Called after a player missile was spawned. */
  launched(slot, proj) {
    if (!proj) return;
    this.lastSerial = proj.serial;
    if (proj.mode !== 'dumb') this.lastGuidedSerial = proj.serial;
    if (proj.mode === 'optical') {
      slot.flying = proj;
      slot.flyingSerial = proj.serial;
      this.optical = proj;
      this.opticalSerial = proj.serial;
    }
  }

  /** Semi-active guidance: the player's lock still paints this missile's target. */
  illuminated(p) {
    const t = this.targeting;
    return p.owner === this.player && !!t.target && p.target === t.target && t.inCone;
  }

  /** The optical missile that is in the air (or null). */
  get steering() {
    const p = this.optical;
    if (p && p.active && p.serial === this.opticalSerial) return p;
    this.optical = null;
    return null;
  }

  /** Mouse/stick input (radians) into the optical missile; positive x = right, y = down. */
  steer(dx, dy, sensitivity) {
    const p = this.steering;
    if (!p) return false;
    const cap = p.def.missile.turnRate * DEG * 0.25;
    p.steer.yaw = clampAbs(p.steer.yaw - dx * sensitivity, cap);
    p.steer.pitch = clampAbs(p.steer.pitch - dy * sensitivity, cap);
    return true;
  }

  /** Lock tone state from the launchers that need a lock (per frame). */
  updateTones(dt, audio, powered) {
    const need = this.launchers.filter((s) => !s.disabled && LOCKED_MODES.has(s.mode));
    const t = this.targeting;
    let state = 'none';
    let progress = 0;
    if (need.length && t.target && t.inCone && powered && (!this.radarLock || this.radarLock())) {
      const lockTime = Math.min(...need.map((s) => s.def.lockTime));
      progress = Math.min(1, t.lockTime / Math.max(0.01, lockTime));
      state = progress >= 1 ? 'locked' : 'locking';
    }
    if (state === 'locking') {
      // Beeps come faster and higher the closer the lock is
      this.beepT -= dt;
      if (this.beepT <= 0) {
        this.beepT = 0.32 - progress * 0.22;
        audio.play('weapon.lockBeep', { rate: 0.8 + progress * 0.5 });
      }
    } else this.beepT = 0;
    if (state === 'locked' && !this.lockVoice) this.lockVoice = audio.loop('lockTone');
    this.lockVoice?.setGain(state === 'locked' ? 1 : 0, 0.02);
    this.lockState = state;
    this.lockProgress = progress;
  }

  dispose() {
    this.lockVoice?.stop(0.05);
  }
}

function clampAbs(v, max) {
  return v > max ? max : v < -max ? -max : v;
}

/** Angle (deg) between the torso axis and a point. */
export function angleTo(eye, aimDir, point) {
  to.subVectors(point, eye);
  const d = to.length();
  return d > 1e-6 ? Math.acos(Math.min(1, to.dot(aimDir) / d)) / DEG : 0;
}
