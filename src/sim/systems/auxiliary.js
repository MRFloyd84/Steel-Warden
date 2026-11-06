/**
 * Hydraulics, monitors, gyro, sensors, shields, weapons and the leg lock.
 */
export function updateHydraulics(sys, dt) {
  const { s, c, cfg } = sys;
  const k = cfg.hydraulics;
  const h = s.hydraulics;
  const on = c.value('hydraulics') === 1 && s.power.bus;
  const onMain = s.power.source === 'main';
  const target = on ? (onMain ? k.maxPressure : k.auxMaxPressure) : 0;
  const rate = on ? (onMain ? k.mainRate : k.auxRate) : k.decayRate;
  const prev = h.pressure;
  h.pressure = prev < target ? Math.min(target, prev + rate * dt) : Math.max(target, prev - k.decayRate * dt);
  h.rising = (h.pressure - prev) / dt;
  if (prev < k.readyPressure && h.pressure >= k.readyPressure) sys.emit('hydraulicsUp');
}

/**
 * Monitors: the battery monitor comes on with the battery; all others stay
 * dark until MONITORE TEST boots them one after another. Once tested, a
 * monitor reboots quickly after a power loss.
 */
export function updateMonitors(sys) {
  const { s, cfg } = sys;
  const k = cfg.monitors;
  const t = sys.time;
  const order = s.monitors.order;
  for (const id of order) {
    const m = s.monitors.units[id];
    const powered = id === k.batteryMonitor ? s.power.batteryBus : s.power.bus;
    if (powered && !m.powered && m.avail) startBoot(m, t, k.quickBootTime, []);
    if (powered && !m.powered && id === k.batteryMonitor && !m.avail) {
      startBoot(m, t, k.quickBootTime, []);
      m.pending = true;
    }
    m.powered = powered;
    if (m.pending && t >= m.bootAt + m.len) {
      m.pending = false;
      if (powered) m.avail = true;
    }
  }
  s.monitors.testing = order.some((id) => s.monitors.units[id].pending);
  s.monitors.tested = order.length > 0 && order.every((id) => s.monitors.units[id].avail);
}

export function startMonitorTest(sys) {
  const { s, cfg } = sys;
  const k = cfg.monitors;
  if (!s.power.bus || s.monitors.testing) return;
  const bootLen = k.flickerTime + k.patternTime + 0.4;
  s.monitors.order.forEach((id, i) => {
    const m = s.monitors.units[id];
    const lines = (k.selfTest[id] ?? []).map(([label, flag]) => [label, flag === 'always' || !!sys.flags[flag]]);
    if (m.fault) lines.push(['BILDRÖHRE', false]);
    if (id === k.batteryMonitor || id === 'mfdSystem') {
      const faults = Object.values(s.monitors.units).filter((u) => u.fault && u !== m).length;
      if (faults) lines.push([`ANZEIGEN (${faults})`, false]);
    }
    startBoot(m, sys.time + i * k.stagger, bootLen + lines.length * k.lineTime, lines);
    m.pending = true;
  });
  sys.emit('monitorTest');
}

function startBoot(m, at, len, lines) {
  m.bootAt = at;
  m.len = len;
  m.lines = lines;
}

/** What a monitor shows right now: off, boot sequence or its normal page. */
export function monitorStatus(sys, id) {
  const m = sys.s.monitors.units[id];
  if (!m || !m.powered || m.fault === 'dead') return OFF;
  const t = sys.time;
  if (m.bootAt !== null && t >= m.bootAt && t < m.bootAt + m.len) {
    return { mode: 'boot', t: t - m.bootAt, len: m.len, lines: m.lines, timing: sys.cfg.monitors, noise: m.fault === 'noise' };
  }
  if (m.fault === 'noise' && m.avail) return NOISE;
  return m.avail ? ON : OFF;
}
const OFF = { mode: 'off' };
const NOISE = { mode: 'noise' };
const ON = { mode: 'on' };

export function startGyro(sys) {
  const { s } = sys;
  const g = s.gyro;
  if (!s.power.bus || g.mode === 'aligning' || g.mode === 'aligned') return;
  if (sys.randomEvents && !s.random.gyroTried) {
    s.random.gyroTried = true;
    g.willFail = true;
  }
  if (g.mode === 'failed') g.align = 0;
  g.mode = 'aligning';
  sys.emit('gyroStart');
}

export function updateGyro(sys, dt) {
  const { s, cfg } = sys;
  const g = s.gyro;
  if (g.mode !== 'aligning') return;
  if (!s.power.bus) {
    g.mode = 'off';
    return;
  }
  g.align = Math.min(1, g.align + dt / cfg.gyro.alignTime);
  if (g.willFail && g.align >= cfg.gyro.failAt) {
    g.willFail = false;
    g.mode = 'failed';
    sys.emit('gyroFailed');
  } else if (g.align >= 1) {
    g.mode = 'aligned';
    sys.emit('gyroAligned');
  }
}

export function updateSubsystems(sys, dt) {
  const { s, c, cfg } = sys;
  const sensorsOn = c.value('sensors') === 1 && s.power.bus;
  s.sensors.level = sensorsOn ? Math.min(1, s.sensors.level + dt / cfg.sensors.bootTime) : 0;

  const shieldsOn = c.value('shields') === 1 && s.power.source === 'main';
  s.shields.level = shieldsOn
    ? Math.min(1, s.shields.level + dt / cfg.shields.chargeTime)
    : Math.max(0, s.shields.level - dt / cfg.shields.decayTime);

  const weaponsOn = c.value('weaponsArm') === 1 && s.power.bus;
  s.weapons.level = weaponsOn ? Math.min(1, s.weapons.level + dt / cfg.weapons.armTime) : 0;

  // Leg lock: released hydraulically once LÖSEN is selected and pressure is up.
  const wantRelease = c.value('legLock') === 1;
  const pressure = s.hydraulics.pressure >= cfg.hydraulics.readyPressure;
  if (!wantRelease && s.legs.released) {
    s.legs.released = false;
    sys.emit('legsLocked');
  } else if (wantRelease && !s.legs.released && pressure) {
    s.legs.released = true;
    sys.emit('legsReleased');
  }
}
