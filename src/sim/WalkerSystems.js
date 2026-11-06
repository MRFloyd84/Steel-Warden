import { SYSTEMS } from '../data/systems.js';
import { updateElectrical } from './systems/electrical.js';
import { updateCoolant, updateReactor, tryIgnite, tryIgniteCircuit2, resetIgnitionLockout } from './systems/reactor.js';
import {
  updateHydraulics, updateMonitors, startMonitorTest, monitorStatus,
  startGyro, updateGyro, updateSubsystems,
} from './systems/auxiliary.js';
import { updateLamps } from './systems/lamps.js';

/**
 * The walker's machinery with continuous values: battery voltage, APU rpm,
 * coolant pressures, reactor temperature/power, hydraulic pressure, gyro
 * alignment, sensor/shield/weapon readiness, leg lock.
 *
 * Input is only the cockpit control state and its control:* events; output
 * is lamps (controls.setLamp), drive limits for WalkerMotion, flags for the
 * checklist/instruments and systems:event { type } on the bus for sound,
 * light and radio. Nothing is hard-locked — wrong order simply has physical
 * consequences.
 */
export class WalkerSystems {
  constructor(controls, bus, { randomEvents = false, monitorIds = [], overrides = {}, extraCircuit = false } = {}) {
    this.c = controls;
    this.bus = bus;
    this.cfg = deepMerge(structuredClone(SYSTEMS), overrides);
    this.extraCircuit = extraCircuit && controls.has('reactor2Ignition');
    this.randomEvents = randomEvents;
    this.time = 0;
    this.s = createState(this.cfg, monitorIds);
    this.flags = {};
    this.applyingHot = false;
    this.offs = [
      bus.on('control:changed', (e) => this.onChanged(e)),
      bus.on('control:pressed', (e) => this.onPressed(e)),
      bus.on('control:guard', (e) => this.onGuard(e)),
    ];
    this.updateFlags();
  }

  emit(type, extra = {}) {
    this.bus.emit('systems:event', { type, ...extra });
  }

  onChanged({ id, value, prev, cause }) {
    if (this.applyingHot) return;
    switch (id) {
      case 'batteryMaster':
        this.emit(value ? 'batteryOn' : 'batteryOff');
        break;
      case 'reactorIgnition':
        if (value === 1 && prev === 0) tryIgnite(this);
        break;
      case 'reactor2Ignition':
        if (value === 1 && prev === 0 && this.extraCircuit) tryIgniteCircuit2(this);
        break;
      case 'mainBus':
        // A trip by the system has its own event (busTrip).
        if (cause !== 'system') this.emit('busSwitch', { toReactor: value === 1 });
        break;
      case 'coolantPump2':
        if (value === 1 && this.randomEvents && !this.s.random.pump2Tried) {
          this.s.random.pump2Tried = true;
          this.s.coolant.pump2Failed = true;
        } else if (value === 0) {
          this.s.coolant.pump2Failed = false;
        }
        break;
      case 'legLock':
        if (value === 1 && this.s.hydraulics.pressure < this.cfg.hydraulics.readyPressure) this.emit('legsBlocked');
        break;
      default:
        break;
    }
  }

  onPressed({ id, pressed }) {
    if (!pressed || this.applyingHot) return;
    if (id === 'systemTest') startMonitorTest(this);
    if (id === 'gyroAlign') startGyro(this);
  }

  onGuard({ id, open }) {
    if (id === 'reactorIgnition' && !open) resetIgnitionLockout(this);
  }

  update(dt) {
    this.time += dt;
    updateElectrical(this, dt);
    updateCoolant(this, dt);
    updateReactor(this, dt);
    updateHydraulics(this, dt);
    updateMonitors(this);
    updateGyro(this, dt);
    updateSubsystems(this, dt);
    this.updateFlags();
    updateLamps(this);
  }

  updateFlags() {
    const { s, c, cfg } = this;
    const r = s.reactor;
    const k = cfg.reactor;
    const f = this.flags;
    const mode = c.has('reactorMode') ? c.value('reactorMode') : 0;
    f.always = true;
    f.batteryOn = s.battery.on;
    f.batteryBus = !!s.power.batteryBus;
    f.apuReady = !!s.power.aux;
    f.busPowered = !!s.power.bus;
    f.coolantOk = s.coolant.p1 >= cfg.coolant.okPressure && s.coolant.p2 >= cfg.coolant.okPressure;
    f.preheatOk = (r.mode === 'cold' || r.mode === 'shutdown') && mode >= 1 && r.temp >= k.ignitionMinTemp && r.temp <= k.preheatMaxTemp && f.busPowered;
    f.reactorRunning = r.mode === 'running';
    f.onReactorBus = s.power.source === 'main';
    f.extraCircuit = this.extraCircuit;
    f.reactor2Running = s.reactor2.mode === 'running';
    f.reactorFull = f.reactorRunning && mode === 2 && r.power >= k.fullPower * 0.95 && (!this.extraCircuit || f.reactor2Running);
    f.hydraulicsReady = s.hydraulics.pressure >= cfg.hydraulics.readyPressure;
    f.monitorsTested = !!s.monitors.tested;
    f.gyroAligned = s.gyro.mode === 'aligned';
    f.sensorsReady = s.sensors.level >= 1;
    f.shieldsReady = s.shields.level >= 1;
    f.weaponsReady = s.weapons.level >= 1;
    f.legsReleased = s.legs.released;
    f.ignitionReset = !r.lockout;
    f.heatWarning = r.temp >= k.warnTemp;
    f.scrammed = r.mode === 'scram';
    f.restartNeeded = r.restartNeeded;
    f.lightsNormal = f.batteryBus;
  }

  /** Limits WalkerMotion has to respect. */
  get drive() {
    const s = this.s;
    const hyd = this.flags.hydraulicsReady;
    return {
      throttleLocked: !s.legs.released,
      canMove: s.legs.released && hyd && s.reactor.power > 0.05,
      canTwist: s.legs.released && hyd,
      speedFactor: Math.max(0, Math.min(1, s.reactor.power / this.cfg.reactor.fullPower)),
      stance: Math.max(0, Math.min(1, s.hydraulics.pressure / this.cfg.hydraulics.readyPressure)),
    };
  }

  monitorStatus(id) {
    return monitorStatus(this, id);
  }

  /** Lights flicker briefly after ignition. */
  get flickering() {
    return this.time < this.s.reactor.flickerUntil;
  }

  /** ?start=hot — every switch in final position, every system ready. */
  forceHot() {
    const c = this.c;
    this.applyingHot = true;
    for (const id of ['batteryMaster', 'reactorIgnition', 'weaponsArm', 'legLock']) if (c.has(id)) c.setGuard(id, true, 'system');
    if (c.has('reactor2Ignition')) c.setGuard('reactor2Ignition', true, 'system');
    const finalPositions = {
      reactor2Ignition: 1,
      batteryMaster: 1, coolantPump1: 1, coolantPump2: 1, reactorMode: 2, reactorIgnition: 1,
      mainBus: 1, hydraulics: 1, sensors: 1, shields: 1, weaponsArm: 1, legLock: 1,
    };
    for (const [id, v] of Object.entries(finalPositions)) if (c.has(id)) c.setValue(id, v, 'system');
    this.applyingHot = false;

    const s = this.s;
    const cfg = this.cfg;
    const k = cfg.reactor;
    s.battery.on = true;
    s.battery.volts = cfg.battery.charged;
    s.coolant.p1 = s.coolant.p2 = cfg.coolant.maxPressure;
    s.coolant.flow = 1;
    s.reactor.mode = 'running';
    s.reactor.power = k.fullPower;
    s.reactor2.mode = this.extraCircuit ? 'running' : 'off';
    s.reactor.temp = k.coolantSetpoint + (k.heatBase + k.heatPerPower * k.fullPower) / k.coolingPerFlow;
    s.hydraulics.pressure = cfg.hydraulics.maxPressure;
    for (const m of Object.values(s.monitors.units)) {
      m.avail = true;
      m.powered = true;
      m.bootAt = null;
    }
    s.monitors.tested = true;
    s.gyro.mode = 'aligned';
    s.gyro.align = 1;
    s.sensors.level = s.shields.level = s.weapons.level = 1;
    s.legs.released = true;
    s.power.main = s.power.bus = s.power.batteryBus = true;
    s.power.source = 'main';
    this.updateFlags();
    updateLamps(this);
  }

  /** One-line summary for the debug overlay. */
  debugLine() {
    const s = this.s;
    const r = s.reactor;
    return `Sys ${s.battery.volts.toFixed(1)}V ${s.power.source}${s.power.fault ? '!' : ''}  APU ${(s.apu.rpm * 100).toFixed(0)}% ${s.apu.mode}  `
      + `K ${s.coolant.p1.toFixed(1)}/${s.coolant.p2.toFixed(1)}  R ${r.mode} ${r.temp.toFixed(0)}°C ${(r.power * 100).toFixed(0)}%${r.lockout ? ' SPERRE' : ''}${this.extraCircuit ? ` K2 ${s.reactor2.mode}` : ''}  `
      + `H ${s.hydraulics.pressure.toFixed(0)}  G ${(s.gyro.align * 100).toFixed(0)}%  S/Sch/W ${s.sensors.level.toFixed(1)}/${s.shields.level.toFixed(1)}/${s.weapons.level.toFixed(1)}  `
      + `Beine ${s.legs.released ? 'frei' : 'fest'}`;
  }

  dispose() {
    this.offs.forEach((off) => off());
  }
}

function createState(cfg, monitorIds) {
  const units = {};
  for (const id of cfg.monitors.bootOrder) {
    if (monitorIds.length && !monitorIds.includes(id)) continue;
    units[id] = { powered: false, avail: false, pending: false, bootAt: null, len: 0, lines: [] };
  }
  const order = cfg.monitors.bootOrder.filter((id) => units[id]);
  return {
    battery: { on: false, volts: 0 },
    apu: { rpm: 0, mode: 'off', stable: 0, transferT: 0, emergency: false },
    power: { aux: false, main: false, bus: false, batteryBus: false, fault: false, faultAt: -Infinity, source: 'none' },
    coolant: { p1: 0, p2: 0, flow: 0, pump2Failed: false },
    reactor: {
      temp: cfg.reactor.ambient, power: 0, mode: 'cold', ignT: 0, heater: false,
      lockout: false, failUntil: -Infinity, flickerUntil: -Infinity, scramAt: -Infinity, restartNeeded: false,
    },
    reactor2: { mode: 'off', t: 0 },
    hydraulics: { pressure: 0, rising: 0 },
    monitors: { units, order, testing: false, tested: false },
    gyro: { align: 0, mode: 'off', willFail: false },
    sensors: { level: 0 },
    shields: { level: 0 },
    weapons: { level: 0 },
    legs: { released: false },
    random: { pump2Tried: false, gyroTried: false },
  };
}

/** Merges plain-object overrides into target (arrays and values replace). */
function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}
