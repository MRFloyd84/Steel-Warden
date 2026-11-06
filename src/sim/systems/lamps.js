/**
 * Lamp outputs. Lamps only light with battery power (no bus fault); the
 * system status column on the left wing lights while a system is NOT ready.
 */
export function updateLamps(sys) {
  const { s, c, cfg, flags: f } = sys;
  const t = sys.time;
  const blink = Math.floor(t * cfg.alarms.blinkHz * 2) % 2 === 0;
  const r = s.reactor;
  const set = (id, on) => {
    if (c.has(id)) c.setLamp(id, !!on);
  };

  c.setLampPower(s.power.batteryBus);

  const ok = cfg.coolant.okPressure;
  set('lampApuReady', f.apuReady);
  set('lampPressure1', s.coolant.p1 >= ok);
  set('lampPressure2', s.coolant.p2 >= ok);
  set('lampPreheatOk', f.preheatOk);

  // Illuminated button caps
  set('apuStart', s.apu.mode === 'crank');
  set('systemTest', s.monitors.testing);
  set('gyroAlign', s.gyro.mode === 'aligning' || (s.gyro.mode === 'failed' && blink));

  const ignitionFail = t < r.failUntil;
  const scramRecent = f.scrammed && t - r.scramAt < 15;
  const hydraulicsOnAux = c.value('hydraulics') === 1 && s.power.source === 'aux';
  const legsWaiting = c.value('legLock') === 1 && !s.legs.released;
  set('lampHeat', f.heatWarning);
  set('lampReactor', (ignitionFail && blink) || f.scrammed);
  set('lampMasterWarning', (f.heatWarning || scramRecent || s.power.fault) && blink);
  set('lampMasterCaution', ignitionFail || hydraulicsOnAux || legsWaiting);
  set('lampShield', c.value('shields') === 1 && !f.shieldsReady);
  set('lampMissile', false);

  set('lampStatReactor', !f.reactorRunning);
  set('lampStatCoolant', !f.coolantOk);
  set('lampStatHydraulic', !f.hydraulicsReady);
  set('lampStatGyro', !f.gyroAligned);
  set('lampStatSensors', !f.sensorsReady);
  set('lampStatLegs', !f.legsReleased);
}
