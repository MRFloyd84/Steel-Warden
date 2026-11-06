const NAMES = {
  mfdSystem: 'SYSTEMSTATUS', mfdRadar: 'RADAR', mfdDamage: 'SCHADENSMODELL', mfdTarget: 'ZIELMONITOR', mfdWeapons: 'WAFFENSTATUS', mfdEnergy: 'ENERGIE',
};

/**
 * CRT power-on sequence: switch-on flicker, test pattern, then the
 * self-test lines one by one (OK / FEHLER). A quick reboot after a power
 * loss shows only a short "NEUSTART" bar.
 */
export function drawBoot(p, id, st) {
  const { w, h } = p;
  const k = st.timing;
  const t = st.t;

  if (t < k.flickerTime) {
    // Beam warming up: random bright bands and a pulsing raster
    p.rect(0, 0, w, h, Math.random() * 0.25, true);
    for (let i = 0; i < 5; i++) {
      const y = Math.random() * h;
      p.rect(0, y, w, 1 + Math.random() * 6, 0.3 + Math.random() * 0.7, true);
    }
    return;
  }

  if (!st.lines.length) {
    const f = Math.min(1, (t - k.flickerTime) / Math.max(0.1, st.len - k.flickerTime));
    p.text('NEUSTART', w / 2, h / 2 - 14, { size: 14, align: 'center' });
    p.rect(w * 0.2, h / 2 + 4, w * 0.6, 10, 0.6);
    p.rect(w * 0.2 + 2, h / 2 + 6, (w * 0.6 - 4) * f, 6, 0.9, true);
    return;
  }

  const patternEnd = k.flickerTime + k.patternTime;
  if (t < patternEnd) {
    drawPattern(p, id);
    return;
  }

  p.text('STEEL WARDEN · SELBSTTEST', 10, 14, { size: 11 });
  p.text(NAMES[id] ?? id, 10, 32, { size: 13 });
  p.line(10, 44, w - 10, 44, 0.5);
  const shown = Math.min(st.lines.length, Math.floor((t - patternEnd) / k.lineTime) + 1);
  const blink = Math.floor(t * 4) % 2 === 0;
  for (let i = 0; i < shown; i++) {
    const [label, ok] = st.lines[i];
    const y = 64 + i * 22;
    p.text(`${label} ${'.'.repeat(Math.max(2, 20 - label.length))}`, 14, y, { size: 12, alpha: 0.85 });
    p.text(ok ? 'OK' : 'FEHLER', w - 14, y, { size: 12, align: 'right', alpha: ok ? 1 : blink ? 1 : 0.35 });
  }
  if (shown === st.lines.length) {
    const failed = st.lines.some(([, ok]) => !ok);
    p.text(failed ? 'TEST MIT FEHLERN' : 'TEST BESTANDEN', w / 2, h - 22, { size: 13, align: 'center', alpha: failed && !blink ? 0.4 : 1 });
  }
}

function drawPattern(p, id) {
  const { w, h } = p;
  for (let x = 0; x <= w; x += 32) p.line(x, 0, x, h, 0.35);
  for (let y = 0; y <= h; y += 32) p.line(0, y, w, y, 0.35);
  p.rect(2, 2, w - 4, h - 4, 1);
  p.circle(w / 2, h / 2, h * 0.38, 0.9);
  p.line(w / 2 - 12, h / 2, w / 2 + 12, h / 2, 1);
  p.line(w / 2, h / 2 - 12, w / 2, h / 2 + 12, 1);
  // Brightness steps
  const steps = 8;
  const bw = (w * 0.7) / steps;
  for (let i = 0; i < steps; i++) p.rect(w * 0.15 + i * bw, h * 0.78, bw - 2, 16, (i + 1) / steps, true);
  p.text(NAMES[id] ?? id, w / 2, h * 0.2, { size: 12, align: 'center' });
}
