import * as THREE from 'three';
import { CockpitDamageFx, SIDE_DIR } from '../../render/cockpit/CockpitDamageFx.js';
import { getWeapon } from '../../data/weapons.js';

const SIDES = ['front', 'right', 'rear', 'left'];
const HEAVY = 3;
const COMPONENT_WEIGHTS = [['torso', 0.45], ['armL', 0.15], ['armR', 0.15], ['legs', 0.17], ['sensors', 0.08]];
const PAN = { front: 0, rear: 0, left: -0.6, right: 0.6 };
const RADIO = {
  critical: { from: 'TECHNIK', text: 'Reaktorabschirmung kritisch! Torso schwer getroffen — raus aus dem Feuer!' },
  monitor: (name) => ({ from: 'TECHNIK', text: `Anzeige ${name} gestört — Selbsttest prüfen.` }),
  enemyLock: { from: 'TECHNIK', text: 'Feindliche Zielerfassung!' },
  incoming: { from: 'TECHNIK', text: 'Rakete im Anflug!' },
};
const MONITOR_NAMES = { mfdRadar: 'RADAR', mfdDamage: 'SCHADEN', mfdTarget: 'ZIEL', mfdWeapons: 'WAFFEN', mfdEnergy: 'ENERGIE', mfdSystem: 'SYSTEM' };
const v = new THREE.Vector3();
const dir = new THREE.Vector3();

/**
 * Hits on the player, felt inside the cockpit:
 *  - shield hit: blue glow from the hit side, glass tint, deep hum
 *  - armour hit: head jolt (spring), sparks from a panel on that side,
 *    monitors flicker; heavy hits may break a monitor (snow or black)
 *  - lasting heavy damage: sensors → radar snow, torso → cracks in the
 *    canopy and smoke, arm → its weapons red on the weapon monitor
 *  - critical (reactor shielding): red emergency light, horn, master
 *    warning, radio call
 * Plus the enemy lock warning — real from A3 (an AI walker locking on, a
 * guided missile homing on us), F9 debug: the nearest enemy locks on and
 * fires a guided missile — and debug hits (F8 / Shift+F8).
 */
export class CockpitHits {
  constructor({ game, combat, systems, cockpit, view, radio, config }) {
    this.game = game;
    this.combat = combat;
    this.systems = systems;
    this.cockpit = cockpit;
    this.view = view;
    this.radio = radio;
    this.cfg = config;
    this.player = combat.player;
    this.fx = new CockpitDamageFx(cockpit, config);
    this.heavySide = 0;
    this.time = 0;
    this.lastCriticalRadio = -Infinity;
    this.critical = false;
    this.enemy = null; // { source, t, phase: 'lock' | 'missile', serial }
    this.lockVoice = null;
    this.incomingVoice = null;
    this.incoming = null;
    this.locker = null;
    this.realWarn = null;
    this.lastLockRadio = -Infinity;
    this.lastIncomingRadio = -Infinity;
    combat.onPlayerHit = (hit) => this.onHit(hit);
    combat.threatSource = () => this.threat;
  }

  // ---- debug keys (per frame) ----

  frame(input) {
    if (input.pressed('debugHitHeavy')) this.debugHit(true);
    if (input.pressed('debugHit')) this.debugHit(false);
    if (input.pressed('debugEnemyLock')) this.startEnemyLock();
  }

  /** F8: random side, component and strength. Shift+F8: heavy hit, the four sides in turn. */
  debugHit(heavy) {
    const d = this.cfg.debug;
    const side = heavy ? SIDES[this.heavySide++ % 4] : SIDES[Math.floor(Math.random() * 4)];
    const damage = heavy ? d.heavyDamage : d.minDamage + Math.random() * (d.maxDamage - d.minDamage);
    const component = heavy ? 'torso' : pickComponent();
    this.applyHit({ side, component, damage, vsShield: 1, vsArmor: 1 });
    return { side, component, damage };
  }

  /** Runs a hit through the player's damage model (debug hits). */
  applyHit({ side, component, damage, vsShield, vsArmor }) {
    const u = this.player;
    if (u.wreck?.kind === 'reactor') return null;
    const res = u.damage.applyHit({ component, side, damage, vsShield, vsArmor });
    if (res.changes.length) this.combat.units.apply(u, res.changes);
    this.onHit({ side, component, res, show: true });
    return res;
  }

  // ---- reactions ----

  /** Called for every hit on the player (MissionCombat.hitUnit and debug hits). */
  onHit({ side, component, res, show }) {
    const c = this.cfg;
    const audio = this.game.audio;
    const pan = PAN[side] ?? 0;
    if (res.shieldHit && show) {
      const k = Math.max(0.3, res.shieldDamage / 25);
      this.fx.shieldHit(side, k);
      audio.play('hit.shield', { pan, gain: Math.min(1.2, 0.5 + k * 0.4) });
    }
    if (!res.armorHit) return;
    const dmg = res.armorDamage;
    const k = dmg / 25;
    if (show) {
      const sh = c.shake;
      const tonnage = this.player.walker.tonnage;
      const scale = sh.tonnageRef / tonnage;
      const offset = Math.min(sh.maxOffset, sh.perDamage * dmg * scale);
      const angle = Math.min(sh.maxAngle, sh.perDamage * dmg * scale * 40) * (Math.PI / 180);
      this.view.kick(SIDE_DIR[side], offset, angle, sh);
      audio.play('hit.armor', { pan, gain: Math.min(1.3, 0.4 + k * 0.5) });
      if (dmg >= c.sparks.minDamage) {
        this.fx.sparkBurst(side, k);
        audio.play('hit.sparks', { pan });
      }
      for (const crt of this.cockpit.monitors) crt.extraFlicker = Math.max(crt.extraFlicker, c.monitorFlicker * Math.min(2, k));
    }
    // Heavy hits may break a monitor
    if (dmg >= c.monitorFailMinDamage && Math.random() < c.monitorFailChance) this.breakMonitor();
    // Canopy cracks while the torso is heavily damaged
    if (component === 'torso' && this.player.damage.stage('torso') >= HEAVY) this.fx.addCracks(c.cracksPerHeavyHit);
    if (this.critical && component === 'torso') this.systems.criticalAlarmUntil = this.systems.time + 3;
  }

  /** A random working monitor fails (snow or black); returns its id. */
  breakMonitor(id = null, kind = null) {
    const working = this.cockpit.monitors.map((m) => m.id).filter((mid) => !this.systems.s.monitors.units[mid]?.fault);
    const pick = id ?? working[Math.floor(Math.random() * working.length)];
    if (!pick) return null;
    const how = kind ?? (Math.random() < 0.55 ? 'noise' : 'dead');
    if (this.systems.failMonitor(pick, how)) {
      this.game.audio.play('sys.ignitionFail', { gain: 0.7 });
      this.radio(RADIO.monitor(MONITOR_NAMES[pick] ?? pick));
    }
    return pick;
  }

  // ---- enemy lock (debug F9) ----

  startEnemyLock() {
    if (this.enemy) return;
    const eye = this.combat.eye;
    let best = null;
    for (const u of this.combat.units.enemies) {
      if (u.wreck) continue;
      const d = u.volumes.center(v).distanceTo(eye);
      if (!best || d < best.d) best = { u, d };
    }
    if (!best) return;
    this.enemy = { source: best.u, t: 0, phase: 'lock', serial: 0 };
    this.radio(RADIO.enemyLock);
  }

  updateEnemy(dt) {
    const e = this.enemy;
    let warn = null;
    if (e) {
      e.t += dt;
      if (e.phase === 'lock') {
        warn = 'lock';
        if (e.source.wreck) this.enemy = null;
        else if (e.t >= this.cfg.enemyLock.lockTime) this.launchEnemyMissile(e);
      } else if (this.combat.projectiles.bySerial(e.serial)) warn = 'missile';
      else this.enemy = null;
    }
    // Real threats (A3): an AI walker holds a lock on us, a guided missile is on its way
    this.incoming = this.findIncoming();
    this.locker = this.combat.ai?.lockingPlayer?.unit ?? null;
    if (this.incoming) warn = 'missile';
    else if (this.locker && !warn) warn = 'lock';
    if (!e) {
      if (warn === 'lock' && this.realWarn !== 'lock' && this.time - this.lastLockRadio > 8) {
        this.lastLockRadio = this.time;
        this.radio(RADIO.enemyLock);
      }
      if (warn === 'missile' && this.realWarn !== 'missile' && this.time - this.lastIncomingRadio > 6) {
        this.lastIncomingRadio = this.time;
        this.radio(RADIO.incoming);
      }
    }
    this.realWarn = warn;
    this.systems.missileWarning = warn;
  }

  /** Nearest guided enemy missile homing on the player, or null. */
  findIncoming() {
    let best = null;
    let bestD = Infinity;
    const me = this.player.motion;
    for (const p of this.combat.projectiles.pool) {
      if (!p.active || !p.def.missile || p.owner === this.player || p.target !== this.player || p.lost || p.mode === 'dumb') continue;
      const d = Math.hypot(p.pos.x - me.x, p.pos.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  launchEnemyMissile(e) {
    const base = getWeapon(this.cfg.enemyLock.weapon);
    const def = { ...base, damage: this.cfg.enemyLock.missileDamage, spread: 0 };
    const origin = e.source.volumes.componentCenter('torso', new THREE.Vector3());
    origin.y += e.source.walker.cockpit.eyeHeight * 0.3;
    const target = this.player.volumes.componentCenter('torso', v);
    dir.subVectors(target, origin).normalize();
    dir.y += 0.15; // launched slightly upward
    dir.normalize();
    origin.addScaledVector(dir, 4);
    const p = this.combat.projectiles.spawn({ def, owner: e.source, origin, dir, target: this.player, mode: 'active' });
    if (!p) {
      this.enemy = null;
      return;
    }
    this.combat.sound.at('weapon.missileLaunch', origin, { gain: 1.2 });
    e.phase = 'missile';
    e.serial = p.serial;
    this.radio(RADIO.incoming);
  }

  /** Bearing of the threat for the radar wedge (world dx/dz from the player), or null. */
  get threat() {
    const e = this.enemy;
    const me = this.player.motion.pose;
    if (!e) {
      const pos = this.incoming?.pos ?? this.locker?.motion.pose ?? null;
      return pos ? { dx: pos.x - me.x, dz: pos.z - me.z, kind: this.incoming ? 'missile' : 'lock' } : null;
    }
    const p = e.phase === 'missile' ? this.combat.projectiles.bySerial(e.serial) : null;
    const pos = p ? p.pos : e.source.motion.pose;
    return { dx: pos.x - me.x, dz: pos.z - me.z, kind: e.phase };
  }

  // ---- per step / per frame ----

  update(dt) {
    this.time += dt;
    this.updateEnemy(dt);
    const dm = this.player.damage;
    const critical = this.player.condition.evaluate().critical;
    if (critical && !this.critical) {
      this.systems.criticalAlarmUntil = this.systems.time + 6;
      if (this.time - this.lastCriticalRadio > this.cfg.criticalRadioCooldown) {
        this.lastCriticalRadio = this.time;
        this.radio(RADIO.critical);
      }
    }
    this.critical = critical;
    this.systems.criticalDamage = critical;
    this.fx.setCritical(critical);
    const smoke = dm.stage('torso') >= HEAVY ? 1 : 0;
    if (smoke && !this.smokeOn) this.game.audio.play('hit.smoke');
    this.smokeOn = smoke;
    this.fx.setSmoke(smoke);
  }

  /** Per render frame: effects and warning tones. */
  render(dt, powered) {
    this.fx.update(dt);
    const w = this.systems.missileWarning;
    const audio = this.game.audio;
    if (w === 'lock' && !this.lockVoice) this.lockVoice = audio.loop('enemyLock');
    if (w === 'missile' && !this.incomingVoice) this.incomingVoice = audio.loop('incoming');
    this.lockVoice?.setGain(w === 'lock' && powered ? 1 : 0, 0.02);
    this.incomingVoice?.setGain(w === 'missile' && powered ? 1 : 0, 0.02);
  }

  setViewportHeight(px) {
    this.fx.setViewportHeight(px);
  }

  /** Debug overlay line. */
  debugLine() {
    const d = this.player.damage;
    const sh = ['front', 'rear', 'left', 'right'].map((s) => Math.round(d.shields.value[s])).join('/');
    const parts = Object.entries(d.parts).map(([k, p]) => `${k} ${Math.round(p.armor)}+${Math.round(p.internal)}`).join(' ');
    const faults = this.systems.monitorFaults.map((f) => `${f.id}:${f.kind}`).join(' ');
    return `Ich: Schilde ${sh}  ${parts}${this.critical ? '  KRITISCH' : ''}${this.enemy ? `  Bedrohung ${this.enemy.phase}` : ''}${faults ? `  Monitore ${faults}` : ''}  Risse ${this.fx.cracks}`;
  }

  dispose() {
    this.lockVoice?.stop(0.05);
    this.incomingVoice?.stop(0.05);
    this.fx.dispose();
    this.combat.onPlayerHit = null;
  }
}

function pickComponent() {
  let r = Math.random();
  for (const [c, w] of COMPONENT_WEIGHTS) {
    if ((r -= w) <= 0) return c;
  }
  return 'torso';
}

