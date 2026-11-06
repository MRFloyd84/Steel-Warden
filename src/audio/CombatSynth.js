import { hash2 } from '../util/noise.js';

/**
 * Procedural combat sounds rendered once into AudioBuffers: lasers, the
 * beam loop, particle cannon, rockets, shotgun, EMP, rail charge, impacts
 * on shields and armour, blasts and the reactor explosion.
 */
export function renderCombatSounds(ctx) {
  const sr = ctx.sampleRate;
  let seed = 101;
  const make = (len, fn, peak = 0.75, loop = false) => {
    const n = Math.ceil(len * sr);
    const buf = ctx.createBuffer(1, n, sr);
    const out = buf.getChannelData(0);
    const s = seed++;
    const noise = (i) => hash2(i, 3, s) * 2 - 1;
    let lp = 0;
    let lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const v = fn(t, i, noise, (x, k) => (lp += (x - lp) * k), (x, k) => (lp2 += (x - lp2) * k));
      out[i] = v;
    }
    normalise(out, peak, sr, loop);
    return buf;
  };
  const phase = { p: 0 };
  const osc = (f, dt) => {
    phase.p += 2 * Math.PI * f * dt;
    return Math.sin(phase.p);
  };
  const dt = 1 / sr;

  const sounds = {};

  // Pulse laser: falling chirp with a bright edge
  phase.p = 0;
  sounds.laser = make(0.16, (t, i, n) => {
    const f = 2600 * Math.exp(-t * 18) + 380;
    return (osc(f, dt) * 0.8 + Math.sign(Math.sin(phase.p * 0.5)) * 0.2 + n(i) * 0.15 * Math.exp(-t * 60)) * Math.exp(-t * 16);
  });

  // Beam loop: buzzing 110 Hz saw with shimmer — exactly 55 periods, loops seamlessly
  sounds.beamLoop = make(0.5, (t, i, n, lp) => {
    const saw = ((t * 110) % 1) * 2 - 1;
    const am = 0.8 + 0.2 * Math.sin(2 * Math.PI * 12 * t);
    return (saw * 0.6 + Math.sin(2 * Math.PI * 880 * t) * 0.15 + lp(n(i), 0.3) * 0.25) * am;
  }, 0.6, true);

  // Particle cannon: rising whine, then a hollow boom
  phase.p = 0;
  sounds.particle = make(0.9, (t, i, n, lp) => {
    const whine = t < 0.22 ? osc(600 + t * 6000, dt) * (t / 0.22) * 0.5 : 0;
    const bt = t - 0.22;
    const boom = bt > 0 ? (lp(n(i), 0.08) * 2.5 + Math.sin(2 * Math.PI * (70 - bt * 30) * bt) * 0.8) * Math.exp(-bt * 6) : 0;
    return whine + boom;
  });

  // Rail gun capacitor charge (1.2 s rising tone)
  phase.p = 0;
  sounds.railCharge = make(1.25, (t) => osc(180 + t * t * 1800, dt) * Math.min(1, t * 4) * 0.6 * (t < 1.18 ? 1 : (1.25 - t) / 0.07));

  // Rocket launch: band-limited whoosh
  sounds.rocket = make(0.7, (t, i, n, lp, lp2) => {
    const x = lp(n(i), 0.25) - lp2(n(i), 0.04);
    return x * 3 * Math.min(1, t * 40) * Math.exp(-t * 4.5);
  });

  // Shotgun: dense low crack and thump
  sounds.shotgun = make(0.45, (t, i, n, lp) => (lp(n(i), 0.35) * 1.5 + Math.sin(2 * Math.PI * 85 * t) * 0.9) * Math.exp(-t * 11));

  // EMP launcher: descending warble
  phase.p = 0;
  sounds.emp = make(0.6, (t) => osc(900 * Math.exp(-t * 3) * (1 + 0.15 * Math.sin(2 * Math.PI * 30 * t)), dt) * Math.exp(-t * 4));

  // Shield impact: electric zap with ringing
  phase.p = 0;
  sounds.shieldHit = make(0.35, (t, i, n) => (n(i) * 0.5 * Math.exp(-t * 30) + osc(1350 + 300 * Math.sin(2 * Math.PI * 40 * t), dt) * 0.5) * Math.exp(-t * 10));

  // Armour impact: metallic clang
  sounds.armorHit = make(0.4, (t, i, n) => {
    const ring = Math.sin(2 * Math.PI * 1720 * t) * 0.35 + Math.sin(2 * Math.PI * 2630 * t) * 0.25 + Math.sin(2 * Math.PI * 4180 * t) * 0.15;
    return (ring * Math.exp(-t * 9) + n(i) * Math.exp(-t * 45) * 0.8) + Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 20) * 0.5;
  });

  // Ground impact / missile blast
  sounds.blast = make(0.9, (t, i, n, lp) => (lp(n(i), 0.06) * 3 + Math.sin(2 * Math.PI * 55 * t) * 0.6) * Math.min(1, t * 200) * Math.exp(-t * 4));

  // Reactor explosion: long rumble
  sounds.explosion = make(3.2, (t, i, n, lp, lp2) => {
    const crack = n(i) * Math.exp(-t * 25) * 0.8;
    const body = lp(n(i), 0.03) * 4 * Math.exp(-t * 1.2);
    const rumble = lp2(n(i), 0.004) * 12 * Math.exp(-t * 0.8);
    return crack + body + rumble;
  }, 0.9);

  // Lock tone
  sounds.lockTone = make(0.12, (t) => Math.sin(2 * Math.PI * 1500 * t) * (t < 0.1 ? 1 : (0.12 - t) / 0.02) * 0.6);
  return sounds;
}

function normalise(out, peak, sr, loop) {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  const g = peak / (max || 1);
  const fade = loop ? 0 : Math.floor(0.002 * sr);
  for (let i = 0; i < out.length; i++) {
    let k = g;
    if (i < fade) k *= i / fade;
    if (i > out.length - fade) k *= (out.length - i) / fade;
    out[i] *= k;
  }
}
