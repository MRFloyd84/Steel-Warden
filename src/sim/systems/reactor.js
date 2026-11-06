import { emergencyApuStart } from './electrical.js';

/**
 * Coolant pumps and the reactor.
 *
 * Reactor modes: cold → igniting → running → shutdown → cold, or → scram.
 * Ignition is edge-triggered by ZÜNDUNG going to ZÜND. It needs bus power,
 * BETRIEBSART on VORH/BETR and a core temperature inside the preheat window.
 * After a scram the ignition is locked out until its cover is closed once.
 */
export function updateCoolant(sys, dt) {
  const { s, c, cfg } = sys;
  const k = cfg.coolant;
  const run1 = c.value('coolantPump1') === 1 && s.power.bus;
  const run2 = c.value('coolantPump2') === 1 && s.power.bus && !s.coolant.pump2Failed;
  s.coolant.p1 = approach(s.coolant.p1, run1 ? k.maxPressure : 0, (run1 ? k.riseRate : k.decayRate) * dt);
  s.coolant.p2 = approach(s.coolant.p2, run2 ? k.maxPressure : 0, (run2 ? k.riseRate : k.decayRate) * dt);
  s.coolant.flow = (s.coolant.p1 + s.coolant.p2) / (2 * k.maxPressure);
}

export function updateReactor(sys, dt) {
  const { s, c, cfg } = sys;
  const k = cfg.reactor;
  const r = s.reactor;
  const mode = c.value('reactorMode'); // 0 AUS, 1 VORH, 2 BETR

  switch (r.mode) {
    case 'igniting':
      r.ignT += dt;
      r.power = Math.min(k.idlePower, r.power + (k.idlePower / k.ignitionTime) * dt);
      if (r.ignT >= k.ignitionTime) {
        r.mode = 'running';
        sys.emit('reactorRunning');
      }
      break;
    case 'running': {
      if (mode === 0 || c.value('reactorIgnition') === 0) {
        r.mode = 'shutdown';
        sys.emit('reactorShutdown');
        break;
      }
      // Assault walkers: without the second circuit only part of the full power is available.
      const cap = sys.extraCircuit && s.reactor2.mode !== 'running' ? k.singleCircuitMax : k.fullPower;
      const target = mode === 2 ? cap : k.idlePower;
      r.power = approach(r.power, target, k.powerRate * dt);
      break;
    }
    case 'shutdown':
      r.power = Math.max(0, r.power - k.powerRate * dt);
      if (r.power === 0) r.mode = 'cold';
      break;
    case 'scram':
      r.power = Math.max(0, r.power - k.scramPowerRate * dt);
      if (r.power === 0 && !r.lockout) r.mode = 'cold';
      break;
    default:
      break;
  }

  updateCircuit2(sys, dt);

  // Heat balance
  const core = r.power > 0 ? k.heatBase * Math.min(1, r.power / k.idlePower) + k.heatPerPower * r.power : 0;
  // The preheater also works after an emergency shutdown — the lockout only blocks ignition.
  const coldCore = r.mode === 'cold' || (r.mode === 'scram' && r.power === 0);
  r.heater = coldCore && s.power.bus && mode >= 1 && r.temp < k.preheatTarget;
  const heatIn = core + (r.heater ? k.preheatRate : 0);
  const cooling = k.coolingPerFlow * s.coolant.flow * sys.coolingFactor * Math.max(0, r.temp - k.coolantSetpoint)
    + k.passiveCooling * (r.temp - k.ambient);
  // Weapon heat (°C collected since the last step), smoothed rate for the displays
  r.weaponHeatRate += (r.pendingHeat / dt - r.weaponHeatRate) * Math.min(1, dt * 1.5);
  r.temp += (heatIn - cooling) * dt + r.pendingHeat;
  r.pendingHeat = 0;

  if (r.mode !== 'scram' && r.temp >= k.scramTemp) scram(sys);

  // A restart counts as complete once the reactor carries the bus at full power again.
  if (r.restartNeeded && r.mode === 'running' && mode === 2 && s.power.source === 'main') r.restartNeeded = false;
}

export function tryIgnite(sys) {
  const { s, c, cfg } = sys;
  const k = cfg.reactor;
  const r = s.reactor;
  if (r.mode === 'igniting' || r.mode === 'running') return;
  if (r.lockout) {
    r.failUntil = sys.time + k.failBlinkTime;
    sys.emit('ignitionBlocked');
    return;
  }
  const mode = c.value('reactorMode');
  let reason = null;
  if (!s.power.bus) reason = 'power';
  else if (mode === 0) reason = 'mode';
  else if (r.temp < k.ignitionMinTemp) reason = 'cold';
  else if (r.temp > k.preheatMaxTemp) reason = 'hot';
  if (reason) {
    r.failUntil = sys.time + k.failBlinkTime;
    sys.emit('ignitionFailed', { reason });
    return;
  }
  r.mode = 'igniting';
  r.ignT = 0;
  r.flickerUntil = sys.time + k.flickerTime;
  sys.emit('ignition');
}

/** Second reactor circuit (assault class): ignites only on a running reactor carrying the main bus. */
export function tryIgniteCircuit2(sys) {
  const { s } = sys;
  const r2 = s.reactor2;
  if (r2.mode !== 'off') return;
  if (s.reactor.mode !== 'running' || s.power.source !== 'main') {
    s.reactor.failUntil = sys.time + sys.cfg.reactor.failBlinkTime;
    sys.emit('ignitionFailed', { reason: 'circuit2' });
    return;
  }
  r2.mode = 'igniting';
  r2.t = 0;
  s.reactor.flickerUntil = sys.time + sys.cfg.reactor.flickerTime * 0.6;
  sys.emit('ignition', { circuit: 2 });
}

function updateCircuit2(sys, dt) {
  const { s, c } = sys;
  const r2 = s.reactor2;
  if (!sys.extraCircuit || r2.mode === 'off') return;
  if (s.reactor.mode !== 'running' || c.value('reactor2Ignition') === 0) {
    r2.mode = 'off';
    return;
  }
  if (r2.mode === 'igniting') {
    r2.t += dt;
    if (r2.t >= sys.cfg.reactor.circuit2Time) r2.mode = 'running';
  }
}

/** Emergency shutdown: power collapses, BETRIEBSART drops to AUS, bus trips to HILFS. */
export function scram(sys) {
  const { s, c } = sys;
  const r = s.reactor;
  r.mode = 'scram';
  r.lockout = true;
  r.scramAt = sys.time;
  r.restartNeeded = true;
  s.reactor2.mode = 'off';
  sys.emit('scram');
  c.setValue('reactorMode', 0, 'system');
  if (c.value('mainBus') === 1) {
    c.setValue('mainBus', 0, 'system');
    sys.emit('busTrip');
  }
  emergencyApuStart(sys);
}

/** Closing the ignition cover resets the scram lockout. */
export function resetIgnitionLockout(sys) {
  const r = sys.s.reactor;
  if (!r.lockout) return;
  r.lockout = false;
  sys.emit('ignitionReset');
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  return Math.max(target, v - step);
}
