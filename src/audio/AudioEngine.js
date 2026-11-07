import { SampleBank } from './SampleBank.js';
import { renderClicks } from './ClickSynth.js';
import { renderCombatSounds } from './CombatSynth.js';
import { AUDIO_MIX, SOUND_EVENTS, SOUND_LOOPS } from '../data/sounds.js';

/**
 * Web Audio front end. Browsers only allow audio after a user gesture, so
 * the context is created on the first click or key press. Until the
 * samples are decoded, one-shots are skipped and loops start late.
 *
 *   play('switch.toggle', { pan: -0.4 })    one-shot event from data/sounds.js
 *   const v = loop('servo'); v.setGain(0.3)  continuous voice
 */
export class AudioEngine {
  constructor(bus) {
    this.bus = bus;
    this.ctx = null;
    this.ready = false;
    this.voices = 0;
    this.lastPlayed = new Map();
    this.pendingLoops = new Set();
    const unlock = () => {
      this.unlock();
      if (this.ctx?.state === 'suspended' && !this.paused) this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get state() {
    if (!this.ctx) return 'gesperrt';
    if (!this.ready) return 'lädt';
    return this.ctx.state;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.ratio.value = 8;
    this.master = ctx.createGain();
    this.master.gain.value = AUDIO_MIX.master;
    this.master.connect(this.limiter).connect(ctx.destination);
    this.buses = {};
    for (const [name, level] of Object.entries(AUDIO_MIX.buses)) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master);
      this.buses[name] = g;
    }
    this.clicks = { ...renderClicks(ctx), ...renderCombatSounds(ctx) };
    this.bank = new SampleBank(ctx);
    this.bank.loadAll().then(() => {
      this.ready = true;
      for (const voice of this.pendingLoops) voice.start();
      this.pendingLoops.clear();
      this.bus.emit('audio:ready', { loaded: this.bank.loaded, failed: this.bank.failed });
    });
  }

  setPaused(on) {
    this.paused = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
  }

  /** Plays a one-shot event. opts: gain, rate (multiplier), pan (-1..1). */
  play(name, opts = {}) {
    if (!this.ready || this.paused) return;
    const def = SOUND_EVENTS[name];
    if (!def) {
      console.warn(`[audio] unknown event "${name}"`);
      return;
    }
    const now = this.ctx.currentTime;
    if (def.cooldown) {
      const last = this.lastPlayed.get(name) ?? -Infinity;
      if (now - last < def.cooldown) return;
    }
    this.lastPlayed.set(name, now);

    const [rMin, rMax] = def.rate ?? [1, 1];
    const rate = (rMin + Math.random() * (rMax - rMin)) * (opts.rate ?? 1);
    const out = this.ctx.createGain();
    out.gain.value = (def.gain ?? 1) * (opts.gain ?? 1);
    let tail = out;
    if (opts.pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(panner);
      tail = panner;
    }
    tail.connect(this.buses[def.bus ?? 'cockpit']);

    const buffers = [];
    if (def.synth) buffers.push(this.clicks[def.synth]);
    if (def.samples) buffers.push(this.bank.get(def.samples[Math.floor(Math.random() * def.samples.length)]));
    let remaining = 0;
    const sources = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(out);
      remaining++;
      this.voices++;
      src.onended = () => {
        this.voices--;
        src.disconnect();
        if (--remaining === 0) tail.disconnect();
      };
      src.start(now);
      sources.push(src);
    }
    if (remaining === 0) {
      tail.disconnect();
      return null;
    }
    // Handle to cut a long one-shot short (fade out)
    const ctx = this.ctx;
    return {
      stop(fade = 0.2) {
        out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        for (const src of sources) {
          try {
            src.stop(ctx.currentTime + fade);
          } catch {
            // already ended
          }
        }
      },
    };
  }

  /** Continuous voice for a loop from SOUND_LOOPS; starts once samples are ready. */
  loop(name) {
    const def = SOUND_LOOPS[name];
    if (!def) throw new Error(`Unknown loop "${name}"`);
    const voice = new LoopVoice(this, def);
    if (this.ready) voice.start();
    else this.pendingLoops.add(voice);
    return voice;
  }
}

class LoopVoice {
  constructor(engine, def) {
    this.engine = engine;
    this.def = def;
    this.level = 0;
    this.rate = 1;
    this.src = null;
    this.stopped = false;
  }

  start() {
    const e = this.engine;
    if (this.stopped || !e.ctx || !e.ready) return;
    const buffer = this.def.synth ? e.clicks[this.def.synth] : e.bank.get(this.def.sample);
    if (!buffer) return;
    const ctx = e.ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.def.gain * this.level;
    this.gain.connect(e.buses[this.def.bus ?? 'cockpit']);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const b = this.def.synth ? null : this.def.loopPoints ? { start: this.def.loopPoints[0], end: this.def.loopPoints[1] } : e.bank.bounds(this.def.sample);
    if (b) {
      src.loopStart = b.start;
      src.loopEnd = b.end;
    }
    src.playbackRate.value = this.rate;
    src.connect(this.gain);
    // Random start offset so several instances of one loop never phase.
    src.start(ctx.currentTime, (b?.start ?? 0) + Math.random() * ((b ? b.end - b.start : buffer.duration) * 0.5));
    this.src = src;
    e.voices++;
  }

  /** Level relative to the loop's base gain; tau = smoothing time constant. */
  setGain(level, tau = 0.08) {
    this.level = level;
    if (this.gain) this.gain.gain.setTargetAtTime(this.def.gain * level, this.engine.ctx.currentTime, tau);
  }

  setRate(rate, tau = 0.1) {
    this.rate = rate;
    if (this.src) this.src.playbackRate.setTargetAtTime(rate, this.engine.ctx.currentTime, tau);
  }

  stop(fade = 0.15) {
    this.stopped = true;
    this.engine.pendingLoops.delete(this);
    if (!this.src) return;
    const ctx = this.engine.ctx;
    const src = this.src;
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    src.stop(ctx.currentTime + fade);
    src.onended = () => {
      src.disconnect();
      this.gain.disconnect();
      this.engine.voices--;
    };
    this.src = null;
  }
}
