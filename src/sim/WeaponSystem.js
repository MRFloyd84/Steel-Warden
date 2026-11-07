import { getWeapon } from '../data/weapons.js';
import { COMBAT } from '../data/combat.js';

/**
 * Weapons of one walker: readiness, charging (SR-3, IMP-2), magazines and
 * reloading, the weapon capacitor fed by the reactor, beam timing (LUX-40),
 * per-weapon barrel heat, groups 1–4 and fire chains.
 *
 * It does not create projectiles itself: `fire(slot, shot)` and
 * `beam(slot, dt)` callbacks do that. update() returns the heat units
 * produced this step (for WalkerSystems' heat balance).
 */
export class WeaponSystem {
  constructor(walker, { loadout, groups, chains }) {
    this.walker = walker;
    const hpById = Object.fromEntries(walker.hardpoints.map((hp) => [hp.id, hp]));
    const entries = Object.entries(loadout);
    // Equipment (target pod) is carried but never fires.
    this.equipment = entries.filter(([, id]) => getWeapon(id).kind === 'equipment')
      .map(([hpId, id]) => ({ id: hpId, hp: hpById[hpId], def: getWeapon(id), disabled: false }));
    this.slots = entries.filter(([, id]) => getWeapon(id).kind !== 'equipment').map(([hpId, weaponId]) => {
      const def = getWeapon(weaponId);
      const mag = def.ammoPerMagazine;
      return {
        hp: hpById[hpId],
        id: hpId,
        def,
        group: groups[hpId] ?? 1,
        magazine: mag ?? null,
        reserve: mag ? Math.max(0, (def.ammoPerTon ?? mag) - mag) : null,
        cooldown: 0,
        reload: 0,
        charge: 0,
        beamOn: false,
        beamT: 0,
        beamCool: 0,
        burstLeft: 0,
        burstT: 0,
        heat: 0,
        disabled: false,
        firedAt: -Infinity,
        mode: def.guidance ? 'dumb' : null, // effective missile guidance, set by the mission
        hold: '', // why a ready weapon is held back (e.g. no lock)
      };
    });
    this.byId = Object.fromEntries(this.slots.map((s) => [s.id, s]));
    this.chains = chains.map((c) => ({ ...c, weapons: [...c.weapons], seqPos: 0 }));
    this.chainIndex = 0;
    this.secondaryIndex = secondaryChainIndex(this.chains, walker.secondaryChain, this.byId);
    this.seqGap = 0;
    this.capacitor = walker.reactorOutput * COMBAT.energy.capacitorPerOutput;
    this.capacitorMax = this.capacitor;
    this.time = 0;
    this.shotsFired = 0;
  }

  get activeChain() {
    return this.chains[this.chainIndex];
  }

  get secondaryChain() {
    return this.chains[this.secondaryIndex];
  }

  /** Keys 1–4: choose the active chain; returns false if there is no such chain. */
  selectChain(index) {
    if (index < 0 || index >= this.chains.length) return false;
    this.chainIndex = index;
    this.activeChain.seqPos = 0;
    return true;
  }

  nextChain(step = 1) {
    const n = this.chains.length;
    this.chainIndex = (this.chainIndex + step + n) % n;
    this.activeChain.seqPos = 0;
    return this.activeChain;
  }

  /** Weapons on a destroyed arm stop working for good. */
  disableLocation(location) {
    for (const e of this.equipment) if (e.hp.location === location) e.disabled = true;
    for (const s of this.slots) if (s.hp.location === location) {
      s.disabled = true;
      s.beamOn = false;
      s.charge = 0;
      s.burstLeft = 0;
    }
  }

  /** Short label of what keeps a weapon from firing ('' = ready). */
  has(equipmentId) {
    return this.equipment.some((e) => e.def.id === equipmentId && !e.disabled);
  }

  status(s) {
    if (s.disabled) return 'AUSFALL';
    if (s.hold) return s.hold;
    if (s.magazine !== null && s.magazine === 0 && s.reserve === 0 && s.reload <= 0) return 'LEER';
    if (s.reload > 0) return 'NACHLADEN';
    if (s.beamCool > 0) return 'KÜHLT';
    if (s.charge > 0) return 'LÄDT';
    if (s.cooldown > 0) return '';
    if (this.capacitor < s.def.energyCost) return 'ENERGIE';
    return '';
  }

  canShoot(s) {
    if (s.disabled || s.reload > 0 || s.cooldown > 0 || s.burstLeft > 0) return false;
    if (s.magazine !== null && s.magazine <= 0) return false;
    return this.capacitor >= s.def.energyCost;
  }

  /**
   * ctx: { canFire, power (0..1 reactor), weaponShare (energy split),
   *        chain (bool, active chain), secondary (bool, second chain), all (bool),
   *        groups [4 bools] (unused by the player since chains are chosen with 1–4),
   *        holdReason(slot) → '' or why a ready weapon waits, beamHold(slot) → true holds a beam (AI),
   *        fire(slot, shotIndex), beam(slot, dt, on) }
   */
  update(dt, ctx) {
    this.time += dt;
    let heat = 0;
    const charge = this.walker.reactorOutput * ctx.power * ctx.weaponShare * COMBAT.energy.chargePerOutput;
    this.capacitor = Math.min(this.capacitorMax, this.capacitor + charge * dt);
    this.seqGap = Math.max(0, this.seqGap - dt);

    // Which weapons are triggered
    const wanted = new Set();
    const sequenced = new Set(); // picked from a sequence chain: next one only after the gap
    if (ctx.all) for (const s of this.slots) wanted.add(s);
    for (let g = 0; g < 4; g++) if (ctx.groups?.[g]) for (const s of this.slots) if (s.group === g + 1) wanted.add(s);
    const fireChain = (chain) => {
      if (!chain) return;
      if (chain.mode === 'salvo') for (const id of chain.weapons) wanted.add(this.byId[id]);
      else {
        const s = this.pickSequence(chain);
        if (s) {
          wanted.add(s);
          sequenced.add(s);
        }
      }
    };
    if (ctx.chain) fireChain(this.activeChain);
    // Same chain on both triggers: fire it once
    if (ctx.secondary && (this.secondaryChain !== this.activeChain || !ctx.chain)) fireChain(this.secondaryChain);

    for (const s of this.slots) {
      const d = s.def;
      s.cooldown = Math.max(0, s.cooldown - dt);
      s.beamCool = Math.max(0, s.beamCool - dt);
      s.heat *= Math.exp(-COMBAT.heat.barrelDecay * dt);
      if (s.reload > 0) {
        s.reload -= dt;
        if (s.reload <= 0) {
          const take = Math.min(d.ammoPerMagazine, s.reserve);
          s.magazine = take;
          s.reserve -= take;
          s.reload = 0;
        }
      }

      // Burst continuation (missile salvos fire one after another)
      if (s.burstLeft > 0) {
        s.burstT -= dt;
        while (s.burstLeft > 0 && s.burstT <= 0 && ctx.canFire) {
          ctx.fire(s, d.burst - s.burstLeft);
          s.burstLeft--;
          s.burstT += d.burstGap ?? 0;
        }
        if (s.burstLeft === 0) this.finishShot(s);
        continue;
      }

      const triggered = wanted.has(s) && ctx.canFire && !s.disabled;

      if (d.kind === 'beam') {
        const can = triggered && s.beamCool <= 0 && this.capacitor > 0 && !ctx.beamHold?.(s);
        if (can) {
          s.beamOn = true;
          s.beamT += dt;
          this.capacitor = Math.max(0, this.capacitor - d.energyCost * dt);
          heat += d.heatPerShot * dt;
          s.heat += d.heatPerShot * dt;
          s.firedAt = this.time;
          ctx.beam(s, dt, true);
          if (s.beamT >= d.beamTime) this.stopBeam(s, 1);
        } else if (s.beamOn) {
          this.stopBeam(s, s.beamT / d.beamTime);
          ctx.beam(s, dt, false);
        }
        continue;
      }

      if (!triggered) {
        s.charge = 0;
        s.hold = '';
        continue;
      }
      if (!this.canShoot(s)) continue;
      s.hold = ctx.holdReason?.(s) ?? '';
      if (s.hold) continue;
      if (d.chargeTime > 0) {
        s.charge += dt;
        if (s.charge < d.chargeTime) continue;
        s.charge = 0;
      }

      // Fire one shot (or start a burst)
      this.capacitor -= d.energyCost;
      heat += d.heatPerShot;
      s.heat += d.heatPerShot;
      s.firedAt = this.time;
      this.shotsFired++;
      if (sequenced.has(s)) this.seqGap = COMBAT.sequenceGap;
      const gap = d.burstGap ?? 0;
      if (d.burst > 1 && gap > 0) {
        ctx.fire(s, 0);
        s.burstLeft = d.burst - 1;
        s.burstT = gap;
      } else {
        for (let i = 0; i < d.burst; i++) ctx.fire(s, i);
        this.finishShot(s);
      }
    }
    return heat;
  }

  finishShot(s) {
    const d = s.def;
    s.cooldown = d.fireRate > 0 ? 1 / d.fireRate : 0;
    if (s.magazine !== null && !this.infiniteAmmo) {
      s.magazine -= d.kind === 'missile' ? d.burst : 1;
      if (s.magazine <= 0) {
        s.magazine = 0;
        if (s.reserve > 0) s.reload = d.reloadTime;
      }
    }
  }

  stopBeam(s, usedShare) {
    s.beamOn = false;
    s.beamCool = s.def.cooldown * Math.max(0.25, usedShare);
    s.beamT = 0;
  }

  /** Sequence chains: the next weapon in the chain that can fire, one at a time. */
  pickSequence(chain) {
    if (this.seqGap > 0) return null;
    const n = chain.weapons.length;
    for (let i = 0; i < n; i++) {
      const s = this.byId[chain.weapons[(chain.seqPos + i) % n]];
      if (s.def.kind === 'beam' ? !s.disabled && s.beamCool <= 0 : this.canShoot(s) || s.charge > 0) {
        if (s.charge <= 0 && s.def.kind !== 'beam') chain.seqPos = (chain.seqPos + i + 1) % n;
        return s;
      }
    }
    return null;
  }

  /** Plain readout for the weapon monitor. */
  readout() {
    const chain = this.activeChain;
    return {
      chainIndex: this.chainIndex,
      chainName: chain?.name ?? '',
      chainMode: chain?.mode ?? 'salvo',
      chains: this.chains.map((c) => c.name),
      secondaryIndex: this.secondaryIndex,
      secondaryName: this.secondaryChain?.name ?? '',
      capacitor: this.capacitor / this.capacitorMax,
      slots: this.slots.map((s) => ({
        id: s.id,
        short: s.def.short,
        group: s.group,
        inChain: chain?.weapons.includes(s.id) ?? false,
        magazine: s.magazine,
        reserve: s.reserve,
        ready: s.def.kind === 'beam' ? s.beamCool <= 0 && !s.disabled : this.canShoot(s),
        load: loadShare(s),
        heat: Math.min(1, s.heat / Math.max(4, s.def.heatPerShot * 2.5)),
        status: this.status(s),
        mode: s.mode,
        location: s.hp.location,
        disabled: s.disabled,
        empty: s.magazine === 0 && s.reserve === 0 && s.reload <= 0,
        beamOn: s.beamOn,
      })),
    };
  }
}

/** 0..1 how far the weapon is back to ready (cooldown, reload, charge, beam). */
function loadShare(s) {
  const d = s.def;
  if (s.disabled) return 0;
  if (s.reload > 0) return 1 - s.reload / d.reloadTime;
  if (d.kind === 'beam') return s.beamOn ? 1 - s.beamT / d.beamTime : s.beamCool > 0 ? 1 - s.beamCool / d.cooldown : 1;
  if (s.charge > 0) return s.charge / d.chargeTime;
  if (s.cooldown > 0 && d.fireRate > 0) return 1 - s.cooldown * d.fireRate;
  return 1;
}

/**
 * Chain for the second trigger (right mouse button): the walker's
 * secondaryChain (by name), else the first chain with a missile launcher,
 * else chain 2.
 */
function secondaryChainIndex(chains, name, byId) {
  if (name) {
    const i = chains.findIndex((c) => c.name === name);
    if (i >= 0) return i;
  }
  const withMissiles = chains.findIndex((c) => c.weapons.some((id) => byId[id]?.def.missile));
  if (withMissiles >= 0) return withMissiles;
  return Math.min(1, chains.length - 1);
}
