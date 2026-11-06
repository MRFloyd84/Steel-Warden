/**
 * Battery, auxiliary power unit and the main bus.
 *
 * APU: holding START cranks it; released above selfSustain it runs up by
 * itself, released earlier it spins down. Once the bus has moved to the
 * reactor, the APU shuts down after a short delay.
 * Bus: HILFS → fed by the APU, REAKT → fed by the reactor. REAKT without a
 * reactor is a bus fault: everything except the emergency light goes dark.
 */
export function updateElectrical(sys, dt) {
  const { s, c, cfg } = sys;
  const b = cfg.battery;
  const a = cfg.apu;
  const apu = s.apu;

  s.battery.on = c.value('batteryMaster') === 1;
  const startHeld = c.get('apuStart').pressed;

  if (!s.battery.on && (apu.mode === 'crank' || apu.mode === 'run')) {
    apu.mode = 'spindown';
    apu.emergency = false;
  }
  if (s.battery.on && startHeld && apu.mode !== 'crank' && apu.mode !== 'run') {
    apu.mode = 'crank';
    sys.emit('apuCrank');
  }

  switch (apu.mode) {
    case 'crank':
      apu.rpm = Math.min(1, apu.rpm + (apu.emergency ? a.emergencyCrankRate : a.crankRate) * dt);
      if (apu.emergency) {
        if (apu.rpm >= a.selfSustain) {
          apu.mode = 'run';
          apu.emergency = false;
        }
      } else if (!startHeld) {
        apu.mode = apu.rpm >= a.selfSustain ? 'run' : 'spindown';
      }
      break;
    case 'run':
      apu.rpm = Math.min(1, apu.rpm + a.runRate * dt);
      break;
    case 'spindown':
      apu.rpm = Math.max(0, apu.rpm - a.spinDownRate * dt);
      if (apu.rpm === 0) apu.mode = 'off';
      break;
    default:
      break;
  }
  apu.stable = apu.mode === 'run' && apu.rpm >= a.readyRpm ? apu.stable + dt : 0;

  // Power sources and bus
  const p = s.power;
  p.aux = apu.stable >= a.stableTime;
  p.main = s.reactor.power >= cfg.bus.busMinPower;
  const onReactor = c.value('mainBus') === 1;
  const fault = s.battery.on && onReactor && !p.main;
  if (fault && !p.fault) {
    p.faultAt = sys.time;
    sys.emit('busFault');
  }
  p.fault = fault;
  p.bus = s.battery.on && (onReactor ? p.main : p.aux);
  p.batteryBus = s.battery.on && !fault;
  p.source = p.bus ? (onReactor ? 'main' : 'aux') : p.batteryBus ? 'battery' : 'none';

  // Bus transfer done → APU runs out
  if (onReactor && p.main && apu.mode === 'run') {
    apu.transferT += dt;
    if (apu.transferT >= a.transferDelay) {
      apu.mode = 'spindown';
      sys.emit('apuShutdown');
    }
  } else {
    apu.transferT = 0;
  }

  let target = 0;
  if (s.battery.on) target = (p.source === 'main' ? b.charged : b.nominal) - (apu.mode === 'crank' ? b.crankSag : 0);
  s.battery.volts += (target - s.battery.volts) * Math.min(1, b.rate * dt);
}

/** Emergency APU start after a reactor shutdown (no button needed). */
export function emergencyApuStart(sys) {
  const apu = sys.s.apu;
  if (!sys.s.battery.on || apu.mode === 'run') return;
  apu.mode = 'crank';
  apu.emergency = true;
  sys.emit('apuCrank', { emergency: true });
}
