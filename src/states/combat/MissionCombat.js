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
/** Player signature from the systems state (data/systems.js → signature). */
function signatureOf(sys) {
  const sig = sys.cfg.signature;
  const s = sys.s;
  if (sys.flags.reactorRunning) return sig.reactor;
  if (s.apu.mode === 'crank' || s.apu.mode === 'run') return sig.apu;
  if (s.battery.on) return sig.battery;
  return sig.cold;
}

const NOISE = { S: 600, M: 750, L: 900 }; // m — how far other units hear a shot
const DEG = Math.PI / 180;
const RADIO = {
  blocked: { from: 'TECHNIK', text: 'Waffen gesichert oder ohne Reaktorleistung — Feuerfreigabe prüfen.' },
  armLost: { from: 'TECHNIK', text: 'Arm verloren! Waffen dort ausgefallen.' },
  legsLost: { from: 'TECHNIK', text: 'Beinantrieb zerstört — wir sind bewegungsunfähig.' },
  radarLater: { from: 'TECHNIK', text: 'Radarumschaltung aktiv/passiv folgt mit dem neuen Radar.' },
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
      obstacles: world.objects,
      emitters: () => this.emitters,
      gravity: world.sampler.gravity ?? 1,
    });
    // Sight lines: terrain and buildings block the lock
    this.targeting.los = (eye, point) => this.lineOfSight(eye, point);
    this.weather = world.weatherDef;
    this.targeting.rate = this.weather.lockRate ?? 1;
    world.objects.onStage = (st, stage) => this.structureStage(st, stage);
    this.offs = [];
    this.missiles = new MissileControl({
      game, controls, targeting: this.targeting, weapons: this.weapons, player: this.player, units: this.units, sound: this.sound,
    });
    this.missiles.emitters = () => this.emitters;
    this.tracking = new TargetTracking({ controls, motion: this.player.motion, targeting: this.targeting, walker: this.player.walker, radio: () => radio(RADIO.trackingOff) });
    this.missileEnds = []; // { serial, reason } for the missile camera
    this.onPlayerHit = null; // set by CockpitHits
    this.lastPodRadio = -Infinity;
    this.aimPoint = new THREE.Vector3();
    this.aimDir = new THREE.Vector3(0, 0, -1);
    this.eye = new THREE.Vector3();
    this.aimUnit = null;
    this.triggers = { chain: false, secondary: false, all: false };
    this.beamDraw = new Map(); // slot id (or unit:slot) → { from, to } this step
    this.enemyBeams = new Map(); // unit:slot → on (beam sound at the shooter)
    this.enemyBeamPos = new Map();
    this.lastBlockedRadio = -Infinity;
    this.lockAnnounced = false;
    this.time = 0;
    this.stats = { shots: 0, hits: 0 };
    this.player.condition.systems = systems;
    if (systems.flags.shieldsReady) this.player.damage.fillShields();
    this.onNoise = null; // (pos, radius, source) — the AI hears shots and explosions
    this.units.onNoise = (pos, r, src) => this.onNoise?.(pos, r, src);
    this.units.onPlayerBlast = (res, center) => {
      const side = hitSide(this.player.motion.pose.yaw, v3.subVectors(this.player.motion.pose, center).setY(0).normalize());
      this.onPlayerHit?.({ side, component: 'torso', res, show: true });
    };
    this.offs.push(
      game.bus.on('combat:armLost', ({ unit }) => unit === 'player' && radio(RADIO.armLost)),
      game.bus.on('combat:wreck', ({ unit, kind }) => unit === 'player' && kind === 'legs' && radio(RADIO.legsLost)),
    );
  }

  /** Units and buildings that emit radar (anti-radar missiles). */
  get emitters() {
    return [...this.units.all, ...this.world.objects.structures.filter((st) => st.emitting)];
  }

  /** Free sight line between two points (terrain, buildings, big rocks)? */
  lineOfSight(a, b) {
    const d = v3.subVectors(b, a);
    const len = d.length();
    if (len < 1) return true;
    d.divideScalar(len);
    const g = raycastTerrain(this.world.sampler, a, d, len - 2, 6);
    if (g !== null) return false;
    return !this.world.objects.blocked(a, b);
  }

  /** Target and radar range factor: sensor damage × SENSOREN level × disruption (MachineCondition). */
  get sensorsRange() {
    return this.player.condition.evaluate().sensorPerformance;
  }

  // ---- input (per frame) ----

  /**
   * Combat actions (input/actions.js). canAim: the torso aims (no free
   * look). Keys 1–4 choose the active chain, left mouse fires it, right
   * mouse fires the second chain, Shift + left mouse all weapons.
   */
  frame(input, { canAim }) {
    for (let i = 0; i < 4; i++) {
      if (input.pressed(`chain${i + 1}`)) this.chooseChain(i);
    }
    if (input.pressed('chainNext')) this.chooseChain(-1, 1);
    if (input.pressed('chainPrev')) this.chooseChain(-1, -1);
    if (input.pressed('shieldFront')) this.shiftShields(1);
    if (input.pressed('shieldRear')) this.shiftShields(-1);
    if (input.pressed('missileGuidance')) this.missiles.cycleMode();
    if (input.pressed('targetTracking') && this.controls.has('targetTracking')) this.controls.toggle('targetTracking');
    if (input.pressed('targetComponent')) this.cycleComponent();
    if (input.pressed('debugEmitting')) this.toggleEmitting();
    if (input.pressed('targetCycle')) this.targeting.cycle(this.units.all, this.eye, this.aimDir, this.sensorsRange);
    if (input.pressed('targetSelect')) this.targeting.select(this.units.all, this.eye, this.aimDir, this.sensorsRange);
    if (input.pressed('radarMode') || input.pressed('radarRange')) this.radio(RADIO.radarLater);

    // Mouse triggers only count with the pointer caught (a click to catch it must not fire)
    const pointerOk = input.pointerLocked || input.gamepad.connected;
    const t = this.triggers;
    const was = this.firing;
    t.chain = canAim && pointerOk && input.held('fireChain');
    t.secondary = canAim && pointerOk && input.held('fireSecondary');
    t.all = canAim && pointerOk && input.held('fireAll');
    if (this.firing && !was && !this.player.condition.evaluate().weaponsOnline) this.blocked();
  }

  /** Chooses chain i (or steps by `step`); clicks, or dry-clicks if there is no such chain. */
  chooseChain(i, step = 0) {
    const w = this.weapons;
    const ok = step ? !!w.nextChain(step) : w.selectChain(i);
    this.game.audio.play(ok ? 'weapon.chain' : 'weapon.dryFire');
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
    return t.chain || t.secondary || t.all;
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

  /** Before MissionEntities.update: the AI units move with this step's limits. */
  applyUnitLimits() {
    this.units.applyUnitLimits();
  }

  update(dt) {
    this.time += dt;
    const sys = this.systems;
    const preset = ENERGY_PRESETS[this.controls.has('energyPreset') ? this.controls.positionLabel('energyPreset') : 'AUSGL'] ?? ENERGY_PRESETS.AUSGL;
    // Reactor output, weapons and shields from the machine condition (a destroyed reactor stops all three)
    const cond = this.player.condition.evaluate();
    const power = cond.reactorOutput;
    this.units.update(dt, { enabled: cond.shieldsOnline, rate: power * (preset.shields / 0.34) });
    // Until the radar (A4): the player emits while the SENSOREN switch is on
    if (this.controls.has('sensors')) this.player.emitting = this.controls.value('sensors') === 1 && sys.s.power.bus;
    this.player.signature = signatureOf(sys);

    this.beamDraw.clear();
    this.missiles.updateModes();
    const heat = this.weapons.update(dt, {
      holdReason: (slot) => this.missiles.holdReason(slot),
      canFire: cond.weaponsOnline,
      power,
      weaponShare: preset.weapons,
      chain: this.triggers.chain,
      secondary: this.triggers.secondary,
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
    // Sandstorm: the lock flickers out now and then
    if (this.weather.lockDrop && this.targeting.target && Math.random() < this.weather.lockDrop * dt) {
      this.targeting.lockTime = Math.max(0, this.targeting.lockTime - 1);
      this.lockFlicker = this.time;
    }
    this.tracking.update(dt, this.eye);
    sys.trackingActive = this.tracking.active;
  }

  sideOf(slot) {
    return slot.hp.location === 'armL' || slot.id.startsWith('L') ? -1 : 1;
  }

  /** Player weapon fires one shot toward the crosshair aim point. */
  fire(slot, shotIndex) {
    const d = slot.def;
    const origin = this.player.mounts.muzzleWorld(slot.id, v1, true);
    const dir = v2.subVectors(this.aimPoint, origin).normalize();
    spreadDir(dir, d.spread);
    const extra = d.missile ? this.missiles.spawnParams(slot, this.eye, this.aimDir) : { aimPoint: this.aimPoint.clone() };
    const proj = this.launch(this.player, slot, shotIndex, origin, dir, extra);
    if (d.missile) this.missiles.launched(slot, proj);
  }

  /**
   * AI unit (or gun) fires one shot: from its muzzle toward its aim point.
   * shot: { target, mode } for missiles, { speed } for ballistic shells
   * (from the controller), origin/dir optional (guns pass their own).
   */
  fireFrom(owner, slot, shotIndex, aimPoint, shot = {}) {
    const d = slot.def;
    const origin = shot.origin ?? owner.mounts.muzzleWorld(slot.id, v1, true);
    const dir = shot.dir ? v2.copy(shot.dir) : v2.subVectors(aimPoint, origin).normalize();
    spreadDir(dir, d.spread);
    if (d.missile) {
      // Missiles leave the pod slightly upward
      dir.y += 0.08;
      dir.normalize();
    }
    return this.launch(owner, slot, shotIndex, origin, dir, d.missile ? { target: shot.target ?? null, mode: shot.mode ?? 'dumb' } : { aimPoint: aimPoint.clone(), speed: shot.speed ?? null });
  }

  /** Spawns the projectile, flash, sound and the noise other units hear. */
  launch(owner, slot, shotIndex, origin, dir, extra) {
    const d = slot.def;
    const proj = this.projectiles.spawn({ def: d, owner, origin, dir, ...extra });
    const own = owner === this.player;
    if (own) this.stats.shots++;
    if (shotIndex === 0 || d.kind === 'missile') {
      this.fx.muzzleFlash(origin, dir, d.visual.color, d.size === 'L');
      if (shotIndex === 0 || d.burstGap) {
        if (own) this.sound.own(d.sound, this.sideOf(slot));
        else this.sound.at(d.sound, origin);
      }
      if (d.missile && shotIndex === 0) {
        if (own) this.sound.own('weapon.missileLaunch', this.sideOf(slot), { gain: d.size === 'L' ? 1.2 : 0.7 });
        else this.sound.at('weapon.missileLaunch', origin, { gain: 0.9 });
      }
      if (shotIndex === 0) this.onNoise?.(origin, NOISE[d.size] ?? 700, owner);
    }
    return proj;
  }

  /** LUX-40: continuous ray from the muzzle toward the aim point, damage over time (player). */
  beamStep(slot, dt, on) {
    if (!on) return;
    this.beamFrom(this.player, slot, this.player.mounts.muzzleWorld(slot.id, new THREE.Vector3()), this.aimPoint, dt);
  }

  /** A beam of any shooter this step: hits units of the other side, buildings or ground. */
  beamFrom(owner, slot, from, aimPoint, dt) {
    const d = slot.def;
    const dir = v2.subVectors(aimPoint, from).normalize();
    const end = v3.copy(from).addScaledVector(dir, d.range);
    let best = null;
    for (const u of this.units.all) {
      if (u === owner || u.side === owner.side) continue;
      const hit = u.volumes.intersectSegment(from, end);
      if (hit && (!best || hit.t < best.hit.t)) best = { unit: u, hit };
    }
    let groundD = raycastTerrain(this.world.sampler, from, dir, d.range);
    const obs = this.world.objects.segment(from, end, { ignore: owner.structure ?? null });
    let to;
    if (obs && (!best || obs.t < best.hit.t) && (groundD === null || obs.t * d.range <= groundD)) {
      to = obs.point;
      this.hitObstacle(obs, d, dt);
      groundD = null;
      best = null;
    } else if (best && (groundD === null || best.hit.t * d.range <= groundD)) {
      to = best.hit.point;
      this.hitUnit(best.unit, best.hit, d, dir, dt);
    } else if (groundD !== null) {
      to = from.clone().addScaledVector(dir, groundD);
      if (Math.random() < dt * 20) this.fx.groundHit(to, 0.3);
    } else {
      to = end.clone();
    }
    this.beamDraw.set(owner === this.player ? slot.id : `${owner.id}:${slot.id}`, { from, to, color: d.visual.color });
    if (owner !== this.player && !slot.beamNoise) {
      slot.beamNoise = true;
      this.onNoise?.(from, NOISE[d.size] ?? 700, owner);
    }
  }

  onProjectileHit({ proj, unit, hit, point, ground, obstacle }) {
    const d = proj.def;
    const dir = v1.copy(proj.vel).normalize();
    if (unit) this.hitUnit(unit, hit, d, dir, proj.damageFactor ?? 1);
    if (obstacle) this.hitObstacle(obstacle, d, proj.damageFactor ?? 1);
    if (ground) {
      const big = d.kind === 'missile' || d.size === 'L';
      this.fx.groundHit(point, big ? 2 : 0.6);
      this.sound.at(big ? 'impact.blast' : 'impact.ground', point);
    }
    if (d.kind === 'missile' || d.visual.impactFx === 'plasma' || d.visual.impactFx === 'emp') {
      this.fx.blast(point, d.blastRadius ? d.blastRadius * 0.4 : d.size === 'L' ? 3 : 1.4, d.visual.impactFx === 'emp' ? 'emp' : d.visual.impactFx === 'plasma' ? 'plasma' : 'blast');
      if (d.kind === 'missile') this.sound.at('impact.blast', point, { gain: d.size === 'L' ? 1.4 : 0.6 });
    }
    if (d.blastRadius) this.splash(point, d, unit, proj.owner);
    if (d.kind === 'missile' || d.blastRadius) this.onNoise?.(point, 900, proj.owner);
  }

  /** A projectile or beam (scale = dt share) hits a building or rock. */
  hitObstacle(obs, d, scale) {
    const show = scale >= 1 || Math.random() < scale * 12;
    if (obs.structure) {
      const st = obs.structure;
      if (st.destructible && st.stage !== 'rubble') this.world.objects.damage(st, d.damage * scale * (d.vsArmor ?? 1));
      if (show) {
        this.fx.armorHit(obs.point, obs.normal, null, null, null, Math.min(2, (d.damage * Math.max(scale, 0.05)) / 25));
        this.sound.at('impact.armor', obs.point, { rate: 0.8 });
      }
    } else if (show) {
      this.fx.groundHit(obs.point, d.kind === 'missile' || d.size === 'L' ? 1.6 : 0.5);
      this.sound.at('impact.ground', obs.point);
    }
  }

  /** Building changed its stage: smoke, fire, explosion, radio. */
  structureStage(st, stage) {
    const top = new THREE.Vector3(0, st.bp.height * 0.8, 0);
    const center = new THREE.Vector3(st.x, st.y + st.bp.height * 0.4, st.z);
    if (stage === 'damaged') {
      this.fx.addEmitter(st.object, top, 'smoke', 1.5);
      this.sound.at('impact.partFall', center);
    } else if (stage === 'rubble') {
      const kind = st.def.onDestroy ?? 'smoke';
      const r = Math.max(4, st.bp.radius * 0.5);
      if (kind === 'explosion') {
        this.fx.explosion(center, r);
        this.sound.at('impact.explosion', center);
      } else {
        this.fx.blast(center, r, 'blast');
        this.sound.at('impact.blast', center, { gain: 1.3 });
      }
      const low = new THREE.Vector3(0, 1, 0);
      this.fx.addEmitter(st.object, low, kind === 'smoke' ? 'smoke' : 'fire', kind === 'smoke' ? 3 : 5);
      this.fx.addEmitter(st.object, low, 'smoke', 3);
      this.structureKills = (this.structureKills ?? 0) + 1;
    }
  }

  /** SPEER: blast damage on walkers near the impact (bypasses shields only partly). */
  splash(point, d, direct, owner) {
    for (const st of this.world.objects.near(point.x, point.z, d.blastRadius + 20)) {
      const dist = Math.hypot(st.x - point.x, st.z - point.z) - st.radius * 0.5;
      if (dist < d.blastRadius) this.world.objects.damage(st, d.damage * 0.5 * (1 - Math.max(0, dist) / d.blastRadius));
    }
    for (const u of this.units.all) {
      if (u === direct || u.side === owner?.side || u.wreck?.kind === 'reactor') continue;
      const dist = u.volumes.center(v2).distanceTo(point);
      if (dist > d.blastRadius) continue;
      const k = 1 - dist / d.blastRadius;
      const component = point.y < u.motion.pose.y - u.walker.cockpit.eyeHeight * 0.5 ? 'legs' : 'torso';
      const amount = d.damage * 0.5 * k * d.vsArmor;
      const changes = u.damage.applyRaw(component, amount);
      this.units.apply(u, changes);
      if (u.isPlayer) this.onPlayerHit?.({ side: hitSide(u.motion.pose.yaw, v3.subVectors(u.motion.pose, point).setY(0).normalize()), component, res: { shieldHit: false, armorHit: true, armorDamage: amount, changes }, show: true });
    }
  }

  /** Missile down (hit, crashed, expired) — the missile camera shows static. */
  onMissileEnd(p, reason) {
    if (p.owner === this.player && this.missileEnds.length < 64) this.missileEnds.push({ serial: p.serial, reason });
  }

  /** One hit (scale = dt share for beams, or the semi-active bonus) through the damage pipeline, with effects. */
  hitUnit(unit, hit, d, dir, scale) {
    if (!unit.isPlayer) this.stats.hits += scale >= 1 ? 1 : 0;
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
    let g = raycastTerrain(this.world.sampler, eye, aimDir, range);
    const obs = this.world.objects.segment(eye, end);
    if (obs && (g === null || obs.t * range < g)) g = obs.t * range;
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
    for (const u of this.units.all) if (!u.isPlayer && u.aimPoint && u.wreck?.kind !== 'reactor') u.mounts.aimArms(u.aimPoint);
    this.fx.update(dt); // first age the effects, then add this frame's beams and bolts
    const cam = this.game.renderer.camera.position;
    for (const [id, b] of this.beamDraw) this.fx.beam(id, b.from, b.to, b.color, cam);
    for (const [key, on] of this.enemyBeams) this.sound.beam(key, on, this.enemyBeamPos.get(key));
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
      condition: this.player.condition.evaluate(),
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
