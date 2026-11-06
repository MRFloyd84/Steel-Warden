import * as THREE from 'three';
import { CombatFx } from '../../render/fx/CombatFx.js';
import { CombatAudio } from '../../audio/CombatAudio.js';
import { Projectiles } from '../../sim/Projectiles.js';
import { Targeting } from '../../sim/Targeting.js';
import { hitSide } from '../../sim/DamageModel.js';
import { raycastTerrain } from '../../sim/HitVolumes.js';
import { ENERGY_PRESETS } from '../../data/systems.js';
import { COMBAT } from '../../data/combat.js';
import { CombatUnits } from './CombatUnits.js';
import { MissileControl, angleTo } from './MissileControl.js';
import { TargetTracking } from './TargetTracking.js';

const AIM_DISTANCE = 800;
const DEG = Math.PI / 180;
const RADIO = {
  blocked: { from: 'TECHNIK', text: 'Waffen gesichert oder ohne Reaktorleistung — Feuerfreigabe prüfen.' },
  armLost: { from: 'TECHNIK', text: 'Arm verloren! Waffen dort ausgefallen.' },
  legsLost: { from: 'TECHNIK', text: 'Beinantrieb zerstört — wir sind bewegungsunfähig.' },
  noPod: { from: 'TECHNIK', text: 'Keine Zielkapsel an Bord — Komponentenwahl nicht möglich.' },
  podLost: { from: 'TECHNIK', text: 'Zielkapsel ausgefallen — Komponentenwahl nicht möglich.' },
  trackingOff: { from: 'TECHNIK', text: 'Zielnachführung aus — Ziel außerhalb des Torso-Schwenkbereichs.' },
};
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();

/**
 * Everything combat in a mission: the player's weapons and triggers, target
 * lock, projectiles and beams, hits through the damage pipeline, effects and
 * sounds. MissionState calls frame() (input), update() (fixed step) and
 * render() (per frame, after the walker models are posed).
 */
export class MissionCombat {
  constructor({ game, world, entities, systems, controls, radio }) {
    this.game = game;
    this.world = world;
    this.systems = systems;
    this.controls = controls;
    this.radio = radio;
    this.fx = new CombatFx(world.scene);
    this.sound = new CombatAudio(game.audio, game.renderer.camera);
    this.units = new CombatUnits({ entities, fx: this.fx, audio: this.sound, bus: game.bus, sampler: world.sampler });
    this.player = this.units.player;
    this.weapons = this.player.weapons;
    this.targeting = new Targeting();
    this.projectiles = new Projectiles({
      sampler: world.sampler,
      units: () => this.units.all,
      onHit: (h) => this.onProjectileHit(h),
      onEnd: (p, reason) => this.onMissileEnd(p, reason),
      illuminated: (p) => this.missiles.illuminated(p),
    });
    this.missiles = new MissileControl({
      game, controls, targeting: this.targeting, weapons: this.weapons, player: this.player, units: this.units, sound: this.sound,
    });
    this.tracking = new TargetTracking({ controls, motion: this.player.motion, targeting: this.targeting, walker: this.player.walker, radio: () => radio(RADIO.trackingOff) });
    this.missileEnds = []; // { serial, reason } for the missile camera
    this.onPlayerHit = null; // set by CockpitHits
    this.lastPodRadio = -Infinity;
    this.aimPoint = new THREE.Vector3();
    this.aimDir = new THREE.Vector3(0, 0, -1);
    this.eye = new THREE.Vector3();
    this.aimUnit = null;
    this.triggers = { chain: false, groups: [false, false, false, false], all: false };
    this.beamDraw = new Map(); // slot id → { from, to } this step
    this.lastBlockedRadio = -Infinity;
    this.lockAnnounced = false;
    this.time = 0;
    this.stats = { shots: 0, hits: 0 };
    if (systems.flags.shieldsReady) this.player.damage.fillShields();
    this.offs = [
      game.bus.on('combat:armLost', ({ unit }) => unit === 'player' && radio(RADIO.armLost)),
      game.bus.on('combat:wreck', ({ unit, kind }) => unit === 'player' && kind === 'legs' && radio(RADIO.legsLost)),
    ];
  }

  get sensorsRange() {
    return COMBAT.consequences.sensorRange[this.player.damage.stage('sensors')];
  }

  // ---- input (per frame) ----

  frame(input, { canAim }) {
    const w = this.weapons;
    if (input.wasPressed('nextChain')) {
      w.nextChain();
      this.game.audio.play('weapon.chain');
    }
    if (input.wasPressed('shieldFront')) this.shiftShields(1);
    if (input.wasPressed('shieldRear')) this.shiftShields(-1);
    if (input.wasPressed('missileGuidance')) this.missiles.cycleMode();
    if (input.wasPressed('targetTracking') && this.controls.has('targetTracking')) this.controls.toggle('targetTracking');
    if (input.wasPressed('targetComponent')) this.cycleComponent();
    if (input.comboPressed('debugEmitting')) this.toggleEmitting();
    if (input.comboPressed('targetCycle')) this.targeting.cycle(this.units.all, this.eye, this.aimDir, this.sensorsRange);
    else if (input.wasPressed('targetSelect')) this.targeting.select(this.units.all, this.eye, this.aimDir, this.sensorsRange);

    const mouseFire = canAim && input.mouse.locked && input.isDown('fire');
    const padFire = canAim && input.gamepad.connected && input.bindings.gamepad.buttons.fire?.some((b) => input.gamepad.isDown(b));
    const t = this.triggers;
    const was = t.chain || t.all || t.groups.some(Boolean);
    t.chain = mouseFire || padFire;
    for (let g = 0; g < 4; g++) t.groups[g] = canAim && input.isDown(`fireGroup${g + 1}`);
    t.all = canAim && input.isDown('fireAll');
    const now = t.chain || t.all || t.groups.some(Boolean);
    if (now && !was && !this.systems.canFire) this.blocked();
  }

  /** Tab: next component of the target (needs a working target pod). */
  cycleComponent() {
    const t = this.targeting;
    if (!t.target) return;
    if (!this.weapons.has('target-pod')) {
      if (this.time - this.lastPodRadio > COMBAT.targeting.podRadioCooldown) {
        this.lastPodRadio = this.time;
        const had = this.weapons.equipment.some((e) => e.def.id === 'target-pod');
        this.radio(had ? RADIO.podLost : RADIO.noPod);
      }
      this.game.audio.play('weapon.dryFire');
      return;
    }
    t.cycleComponent();
    this.game.audio.play('weapon.chain');
  }

  /** Debug Shift+F9: the locked target (or the one under the crosshair) starts/stops emitting. */
  toggleEmitting() {
    const u = this.targeting.target ?? this.aimUnit;
    if (u) u.emitting = !u.emitting;
  }

  /** Pod component of the target or null (torso aim without pod). */
  get podComponent() {
    return this.targeting.target && this.weapons.has('target-pod') ? this.targeting.component : null;
  }

  /** Incoming threat for the radar (set by CockpitHits). */
  get threat() {
    return this.threatSource?.() ?? null;
  }

  /** Any trigger held this frame. */
  get firing() {
    const t = this.triggers;
    return t.chain || t.all || t.groups.some(Boolean);
  }

  shiftShields(dir) {
    this.player.damage.shiftShields(dir);
    this.game.audio.play('weapon.shieldShift');
  }

  blocked() {
    this.game.audio.play('weapon.dryFire');
    this.systems.cautionUntil = this.systems.time + 2;
    if (this.time - this.lastBlockedRadio > COMBAT.blockedRadioCooldown) {
      this.lastBlockedRadio = this.time;
      this.radio(RADIO.blocked);
    }
  }

  // ---- simulation (fixed step) ----

  /** After SystemsLink.update, before WalkerMotion.update. */
  applyPlayerLimits() {
    this.units.applyLimits(this.player);
  }

  update(dt) {
    this.time += dt;
    const sys = this.systems;
    const preset = ENERGY_PRESETS[this.controls.has('energyPreset') ? this.controls.positionLabel('energyPreset') : 'AUSGL'] ?? ENERGY_PRESETS.AUSGL;
    const power = sys.s.reactor.power;
    this.units.update(dt, { enabled: sys.flags.shieldsReady, rate: power * (preset.shields / 0.34) });

    this.beamDraw.clear();
    this.missiles.updateModes();
    const heat = this.weapons.update(dt, {
      holdReason: (slot) => this.missiles.holdReason(slot),
      canFire: sys.canFire,
      power,
      weaponShare: preset.weapons,
      chain: this.triggers.chain,
      groups: this.triggers.groups,
      all: this.triggers.all,
      fire: (slot, i) => this.fire(slot, i),
      beam: (slot, sdt, on) => this.beamStep(slot, sdt, on),
    });
    sys.addWeaponHeat(heat);
    for (const s of this.weapons.slots) {
      if (s.def.chargeTime > 0 && s.charge > 0 && s.charge <= dt + 1e-6) this.sound.own('weapon.railCharge', this.sideOf(s));
    }
    this.projectiles.update(dt);
    this.targeting.update(dt, this.eye, this.aimDir, this.sensorsRange);
    this.tracking.update(dt, this.eye);
    sys.trackingActive = this.tracking.active;
  }

  sideOf(slot) {
    return slot.hp.location === 'armL' || slot.id.startsWith('L') ? -1 : 1;
  }

  fire(slot, shotIndex) {
    const d = slot.def;
    const origin = this.player.mounts.muzzleWorld(slot.id, v1);
    v2.subVectors(this.aimPoint, origin).normalize();
    spreadDir(v2, d.spread);
    let proj;
    if (d.missile) {
      const params = this.missiles.spawnParams(slot, this.eye, this.aimDir);
      proj = this.projectiles.spawn({ def: d, owner: this.player, origin, dir: v2, ...params });
      this.missiles.launched(slot, proj);
    } else {
      proj = this.projectiles.spawn({ def: d, owner: this.player, origin, dir: v2, aimPoint: this.aimPoint.clone() });
    }
    this.stats.shots++;
    if (shotIndex === 0 || d.kind === 'missile') {
      this.fx.muzzleFlash(origin, v2, d.visual.color, d.size === 'L');
      if (shotIndex === 0 || d.burstGap) this.sound.own(d.sound, this.sideOf(slot));
      if (d.missile && shotIndex === 0) this.sound.own('weapon.missileLaunch', this.sideOf(slot), { gain: d.size === 'L' ? 1.2 : 0.7 });
    }
  }

  /** LUX-40: continuous ray from the muzzle toward the aim point, damage over time. */
  beamStep(slot, dt, on) {
    if (!on) return;
    const d = slot.def;
    const from = this.player.mounts.muzzleWorld(slot.id, new THREE.Vector3());
    const dir = v2.subVectors(this.aimPoint, from).normalize();
    const end = v3.copy(from).addScaledVector(dir, d.range);
    let best = null;
    for (const u of this.units.all) {
      if (u === this.player) continue;
      const hit = u.volumes.intersectSegment(from, end);
      if (hit && (!best || hit.t < best.hit.t)) best = { unit: u, hit };
    }
    const groundD = raycastTerrain(this.world.sampler, from, dir, d.range);
    let to;
    if (best && (groundD === null || best.hit.t * d.range <= groundD)) {
      to = best.hit.point;
      this.hitUnit(best.unit, best.hit, d, dir, dt);
    } else if (groundD !== null) {
      to = from.clone().addScaledVector(dir, groundD);
      if (Math.random() < dt * 20) this.fx.groundHit(to, 0.3);
    } else {
      to = end.clone();
    }
    this.beamDraw.set(slot.id, { from, to, color: d.visual.color });
  }

  onProjectileHit({ proj, unit, hit, point, ground }) {
    const d = proj.def;
    const dir = v1.copy(proj.vel).normalize();
    if (unit) this.hitUnit(unit, hit, d, dir, proj.damageFactor ?? 1);
    if (ground) {
      const big = d.kind === 'missile' || d.size === 'L';
      this.fx.groundHit(point, big ? 2 : 0.6);
      this.sound.at(big ? 'impact.blast' : 'impact.ground', point);
    }
    if (d.kind === 'missile' || d.visual.impactFx === 'plasma' || d.visual.impactFx === 'emp') {
      this.fx.blast(point, d.blastRadius ? d.blastRadius * 0.4 : d.size === 'L' ? 3 : 1.4, d.visual.impactFx === 'emp' ? 'emp' : d.visual.impactFx === 'plasma' ? 'plasma' : 'blast');
      if (d.kind === 'missile') this.sound.at('impact.blast', point, { gain: d.size === 'L' ? 1.4 : 0.6 });
    }
    if (d.blastRadius) this.splash(point, d, unit);
  }

  /** SPEER: blast damage on walkers near the impact (bypasses shields only partly). */
  splash(point, d, direct) {
    for (const u of this.units.all) {
      if (u === direct || u.isPlayer || u.wreck?.kind === 'reactor') continue;
      const dist = u.volumes.center(v2).distanceTo(point);
      if (dist > d.blastRadius) continue;
      const k = 1 - dist / d.blastRadius;
      const component = point.y < u.motion.pose.y - u.walker.cockpit.eyeHeight * 0.5 ? 'legs' : 'torso';
      this.units.apply(u, u.damage.applyRaw(component, d.damage * 0.5 * k * d.vsArmor));
    }
  }

  /** Missile down (hit, crashed, expired) — the missile camera shows static. */
  onMissileEnd(p, reason) {
    if (p.owner === this.player && this.missileEnds.length < 64) this.missileEnds.push({ serial: p.serial, reason });
  }

  /** One hit (scale = dt share for beams, or the semi-active bonus) through the damage pipeline, with effects. */
  hitUnit(unit, hit, d, dir, scale) {
    this.stats.hits += scale >= 1 ? 1 : 0;
    if (unit.wreck?.kind === 'reactor') {
      if (scale >= 1 || Math.random() < scale * 10) this.fx.armorHit(hit.point, hit.normal, null, null, null, 0.3);
      return;
    }
    const side = hitSide(unit.motion.pose.yaw, dir);
    const res = unit.damage.applyHit({
      component: hit.component, side, damage: d.damage * scale, vsShield: d.vsShield, vsArmor: d.vsArmor, effect: d.effect,
    });
    const showFx = scale >= 1 || Math.random() < scale * 12;
    if (showFx) {
      if (res.shieldHit) {
        this.fx.shieldHit(hit.point, hit.normal, unit.walker.cockpit.eyeHeight * 0.32);
        this.sound.at('impact.shield', hit.point);
      }
      if (res.armorHit) {
        const strength = Math.min(2, (d.damage * Math.max(scale, 0.05)) / 25);
        this.fx.armorHit(hit.point, hit.normal, hit.mesh, hit.localPoint, hit.localNormal, strength);
        this.sound.at('impact.armor', hit.point);
      }
    }
    if (res.changes.length) this.units.apply(unit, res.changes);
    if (unit.isPlayer) this.onPlayerHit?.({ side, component: hit.component, res, show: showFx });
  }

  // ---- per frame ----

  /** Aim point under the crosshair (walkers, then terrain), arms, effects. */
  render(dt, { eye, aimDir }) {
    this.eye.copy(eye);
    this.aimDir.copy(aimDir);
    const range = COMBAT.targeting.maxRange;
    const end = v1.copy(eye).addScaledVector(aimDir, range);
    let best = null;
    for (const u of this.units.all) {
      if (u.isPlayer) continue;
      const hit = u.volumes.intersectSegment(eye, end);
      if (hit && (!best || hit.t < best.t)) best = { t: hit.t, unit: u };
    }
    const g = raycastTerrain(this.world.sampler, eye, aimDir, range);
    let dist = AIM_DISTANCE;
    this.aimUnit = null;
    if (best && (g === null || best.t * range <= g)) {
      dist = best.t * range;
      this.aimUnit = best.unit;
    } else if (g !== null) dist = g;
    this.aimPoint.copy(eye).addScaledVector(aimDir, dist);
    this.aimDistance = dist;
    // Target pod: projectile weapons converge on the chosen component when the crosshair is near it
    this.converging = false;
    const comp = this.podComponent;
    if (comp && !this.targeting.target.wreck) {
      const c = this.targeting.target.volumes.componentCenter(comp, v2);
      if (angleTo(eye, aimDir, c) <= COMBAT.targeting.podConvergeDeg) {
        this.aimPoint.copy(c);
        this.converging = true;
      }
    }

    this.player.mounts.aimArms(this.aimPoint);
    this.fx.update(dt); // first age the effects, then add this frame's beams and bolts
    const cam = this.game.renderer.camera.position;
    for (const [id, b] of this.beamDraw) this.fx.beam(id, b.from, b.to, b.color, cam);
    for (const s of this.weapons.slots) if (s.def.kind === 'beam') this.sound.beam(s.id, s.beamOn);
    this.fx.drawProjectiles(this.projectiles, cam);
    this.sound.missiles(this.projectiles, dt);
    this.missiles.updateTones(dt, this.game.audio, this.systems.flags.busPowered && this.systems.flags.sensorsReady);
  }

  setViewportHeight(px) {
    this.fx.setViewportHeight(px);
  }

  /** Data for cockpit displays and the HUD. */
  readout() {
    const p = this.player.damage;
    const t = this.targeting.target;
    return {
      weapons: this.weapons.readout(),
      shields: { front: p.shieldFraction('front'), rear: p.shieldFraction('rear'), left: p.shieldFraction('left'), right: p.shieldFraction('right') },
      frontShare: p.frontShare,
      parts: p.parts,
      target: t ? {
        unit: t,
        name: t.walker.name,
        cls: t.walker.class,
        tonnage: t.walker.tonnage,
        distance: this.targeting.distance ?? 0,
        lockTime: this.targeting.lockTime,
        component: this.podComponent,
        converging: this.converging,
        wreck: t.wreck?.kind ?? null,
      } : null,
      sensorsRange: this.sensorsRange,
      sensorsFlicker: p.stage('sensors') >= 2,
      lockState: this.missiles.lockState,
      lockProgress: this.missiles.lockProgress ?? 0,
      guidance: this.missiles.selectedMode,
      hasPod: this.weapons.has('target-pod'),
      tracking: this.tracking.active,
    };
  }

  debugLines() {
    const t = this.targeting.target;
    const lines = [`Kampf: Geschosse ${this.projectiles.count}  Schüsse ${this.stats.shots}  Treffer ${this.stats.hits}  Abschüsse ${this.units.kills}  Partikel ${this.fx.stats.sparks}/${this.fx.stats.smoke}  Kondensator ${(this.weapons.capacitor).toFixed(0)}`];
    lines.push(`Lenkung ${this.missiles.selectedMode}  Aufschaltung ${this.missiles.lockState}  Kapsel ${this.podComponent ?? '-'}  Nachführung ${this.tracking.active ? 'an' : 'aus'}  Strahler ${this.units.all.filter((u) => u.emitting).map((u) => u.id).join(',') || '-'}`);
    lines.push(`Hitze Kern ${this.systems.s.reactor.temp.toFixed(0)}°C  Waffen +${this.systems.s.reactor.weaponHeatRate.toFixed(1)} °C/s  Ziel ${t ? `${t.walker.name} ${Math.round(this.targeting.distance ?? 0)} m lock ${this.targeting.lockTime.toFixed(1)} s` : '-'}`);
    if (t) {
      const parts = Object.entries(t.damage.parts).map(([k, v]) => `${k} ${Math.round(v.armor)}+${Math.round(v.internal)} ${COMBAT.stages[v.stage].label}`).join(' · ');
      const sh = ['front', 'rear', 'left', 'right'].map((s) => Math.round(t.damage.shields.value[s])).join('/');
      lines.push(`  ${parts}`);
      lines.push(`  Schilde V/H/L/R ${sh}${t.wreck ? `  Wrack: ${t.wreck.kind}` : ''}`);
    }
    return lines;
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.sound.dispose();
    this.missiles.dispose();
    this.fx.dispose();
    this.projectiles.clear();
  }
}

/** Random direction within a cone of `deg` half angle around dir (in place). */
function spreadDir(dir, deg) {
  if (!deg) return dir;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * deg * DEG;
  const up = Math.abs(dir.y) < 0.9 ? v3.set(0, 1, 0) : v3.set(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(dir, up).normalize();
  const y = new THREE.Vector3().crossVectors(x, dir);
  return dir.addScaledVector(x, Math.cos(a) * r).addScaledVector(y, Math.sin(a) * r).normalize();
}
