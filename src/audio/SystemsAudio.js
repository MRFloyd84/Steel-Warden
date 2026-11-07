import { SYSTEM_EVENT_SOUNDS, SYSTEM_AUDIO } from '../data/sounds.js';

/**
 * Machinery sound of the startup systems. One-shots come from
 * systems:event, loops follow the continuous values: APU rpm, coolant
 * pressures, reactor power, hydraulic flow, heat and emergency alarms.
 */
export class SystemsAudio {
  constructor(audio, bus, systems, walker) {
    this.audio = audio;
    this.systems = systems;
    this.hum = walker.sound.reactorHum;
    this.offs = [
      bus.on('systems:event', ({ type }) => {
        if (type === 'apuCrank') this.startApu();
        for (const name of SYSTEM_EVENT_SOUNDS[type] ?? []) audio.play(name);
      }),
    ];
    this.apuStart = null; // start sound playing
    this.apuStartAt = null; // systems time of START
    this.loops = {};
    for (const name of ['apu', 'coolant1', 'coolant2', 'reactor', 'hydraulics', 'alarmHeat', 'alarmCritical']) {
      this.loops[name] = audio.loop(name);
    }
  }

  startApu() {
    this.apuStart?.stop(0.3);
    this.apuStart = this.audio.play('sys.apuStart');
    this.apuStartAt = this.systems.time;
  }

  update() {
    const { s, flags: f, cfg, time } = this.systems;
    const a = SYSTEM_AUDIO;
    const L = this.loops;
    const lerp = ([lo, hi], t) => lo + (hi - lo) * Math.max(0, Math.min(1, t));

    // APU: the start sound carries the spool-up, the running loop fades in at its end.
    // Spinning down (START released too early, battery off, transfer to main power):
    // start sound cut, the loop follows rpm in level and pitch.
    const rpm = s.apu.rpm;
    let blend = 1;
    if (this.apuStartAt !== null) {
      const up = s.apu.mode === 'crank' || s.apu.mode === 'run';
      const t = time - this.apuStartAt;
      if (!up) {
        this.apuStart?.stop(0.6);
        this.apuStart = null;
        this.apuStartAt = null;
      } else {
        const [b0, b1] = a.apuStartBlend;
        blend = Math.max(0, Math.min(1, (t - b0) / (b1 - b0)));
        if (t > b1 + 1) {
          this.apuStart = null;
          this.apuStartAt = null;
        }
      }
    }
    L.apu.setGain(rpm ** 1.5 * blend, 0.15);
    L.apu.setRate(lerp(a.apuRate, rpm), 0.15);

    const c1 = s.coolant.p1 / cfg.coolant.maxPressure;
    const c2 = s.coolant.p2 / cfg.coolant.maxPressure;
    L.coolant1.setGain(c1, 0.3);
    L.coolant1.setRate(lerp(a.coolantRate, c1), 0.3);
    L.coolant2.setGain(c2, 0.3);
    L.coolant2.setRate(lerp(a.coolantRate, c2) * a.pump2Detune, 0.3);

    // Reactor: deep spool-up during ignition, then hum rising with load
    const p = s.reactor.power;
    const idle = cfg.reactor.idlePower;
    L.reactor.setGain(p > 0 ? (0.35 + 0.65 * Math.min(1, p / idle) * (0.7 + 0.3 * p)) * this.hum : 0, 0.25);
    L.reactor.setRate(lerp(a.reactorRate, p / idle) + a.reactorRateLoad * p, 0.3);

    const h = s.hydraulics;
    const hydFrac = h.pressure / cfg.hydraulics.maxPressure;
    const flow = Math.max(0, h.rising) / cfg.hydraulics.mainRate;
    L.hydraulics.setGain(Math.min(1, flow * 1.4 + (hydFrac > 0.05 ? a.hydraulicsHold : 0)), 0.12);
    L.hydraulics.setRate(lerp(a.hydraulicsRate, hydFrac), 0.2);

    const al = cfg.alarms;
    const critical = (f.scrammed && time - s.reactor.scramAt < al.scramAlarmTime)
      || (s.power.fault && time - s.power.faultAt < al.faultAlarmTime)
      || time < (this.systems.criticalAlarmUntil ?? -Infinity); // critical hit damage (CockpitHits)
    L.alarmHeat.setGain(f.heatWarning && !critical && f.batteryBus ? 1 : 0, 0.05);
    L.alarmCritical.setGain(critical && s.battery.on ? 1 : 0, 0.05);
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.apuStart?.stop(0.3);
    for (const v of Object.values(this.loops)) v.stop(0.3);
  }
}
