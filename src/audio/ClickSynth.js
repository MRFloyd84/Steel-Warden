import { hash2 } from '../util/noise.js';

/**
 * Procedural mechanical clicks, rendered once into AudioBuffers. Each is a
 * short noise transient plus a few damped resonances (metal body, plastic
 * cap) and an optional low thump — enough to tell switch types apart.
 *
 * Partial: [frequency Hz, amplitude, decay time constant s]
 */
const RECIPES = {
  toggle: {
    length: 0.09,
    noise: { amp: 0.9, decay: 0.0025, highpass: 0.6 },
    partials: [[2900, 0.5, 0.012], [5200, 0.3, 0.007], [1350, 0.25, 0.02], [190, 0.45, 0.025]],
    second: { at: 0.006, amp: 0.5 }, // the snap-over of the spring
  },
  detent: {
    length: 0.045,
    noise: { amp: 0.7, decay: 0.0015, highpass: 0.7 },
    partials: [[3600, 0.35, 0.006], [880, 0.2, 0.01]],
  },
  tap: {
    length: 0.05,
    noise: { amp: 0.4, decay: 0.002, highpass: 0.3 },
    partials: [[620, 0.35, 0.012], [1500, 0.15, 0.008]],
  },
  buttonDown: {
    length: 0.07,
    noise: { amp: 0.5, decay: 0.003, highpass: 0.4 },
    partials: [[640, 0.5, 0.016], [1420, 0.3, 0.01], [150, 0.35, 0.02]],
  },
  buttonUp: {
    length: 0.05,
    noise: { amp: 0.35, decay: 0.002, highpass: 0.6 },
    partials: [[980, 0.35, 0.01], [2300, 0.2, 0.006]],
  },
  // Radio squelch: band-limited noise burst with a short decay
  squelch: {
    length: 0.28,
    noise: { amp: 0.9, decay: 0.12, highpass: 0.2 },
    partials: [[1800, 0.08, 0.05]],
  },
  guard: {
    length: 0.12,
    noise: { amp: 0.6, decay: 0.004, highpass: 0.5 },
    partials: [[1180, 0.45, 0.03], [2650, 0.25, 0.015], [320, 0.3, 0.035]],
  },
};

export function renderClicks(ctx) {
  const buffers = {};
  let seed = 11;
  for (const [name, r] of Object.entries(RECIPES)) {
    buffers[name] = renderClick(ctx, r, seed++);
  }
  return buffers;
}

function renderClick(ctx, r, seed) {
  const sr = ctx.sampleRate;
  const n = Math.ceil(r.length * sr);
  const buffer = ctx.createBuffer(1, n, sr);
  const out = buffer.getChannelData(0);
  const strikes = [{ at: 0, amp: 1 }];
  if (r.second) strikes.push(r.second);

  for (const strike of strikes) {
    const start = Math.floor(strike.at * sr);
    let prevNoise = 0;
    for (let i = start; i < n; i++) {
      const t = (i - start) / sr;
      // First-order high-pass on white noise keeps the transient crisp.
      const white = hash2(i, strike.at * 1000, seed) * 2 - 1;
      const hp = white - prevNoise * r.noise.highpass;
      prevNoise = white;
      let v = hp * r.noise.amp * Math.exp(-t / r.noise.decay);
      for (const [f, a, d] of r.partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
      out[i] += v * strike.amp;
    }
  }

  // Normalise to -3 dBFS and fade the last millisecond.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.7 / (peak || 1);
  const fade = Math.floor(0.001 * sr);
  for (let i = 0; i < n; i++) {
    out[i] *= g * (i > n - fade ? (n - i) / fade : 1);
  }
  return buffer;
}
