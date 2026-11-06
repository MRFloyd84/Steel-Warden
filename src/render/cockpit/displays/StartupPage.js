const SOURCE = { none: '—', battery: 'BATTERIE', aux: 'HILFSAGG.', main: 'REAKTOR' };

/**
 * Startup page of the system monitor: one bar per machine value from
 * WalkerSystems with its thresholds marked, plus the current phase.
 * Shown until the leg lock is released.
 */
export function drawStartupPage(p, sys) {
  const { w, h } = p;
  p.text('SYSTEMSTATUS', 8, 12, { size: 12 });
  p.text(`QUELLE ${SOURCE[sys.source] ?? sys.source}`, w - 8, 12, { size: 11, align: 'right' });
  p.line(8, 22, w - 8, 22, 0.5);

  const rows = [
    ['SPANNUNG', sys.volts, 0, 30, `${sys.volts.toFixed(1)} V`, [24]],
    ['HILFSAGG.', sys.apuRpm, 0, 1, `${Math.round(sys.apuRpm * 100)} %`, [sys.apuReadyRpm]],
    ['KÜHLM. 1', sys.p1, 0, sys.coolantMax, `${sys.p1.toFixed(1)} bar`, [sys.coolantOk]],
    ['KÜHLM. 2', sys.p2, 0, sys.coolantMax, `${sys.p2.toFixed(1)} bar`, [sys.coolantOk]],
    ['KERNTEMP', sys.temp, 0, 1000, `${Math.round(sys.temp)} °C`, [sys.ignitionMin, sys.preheatMax, sys.warnTemp, sys.scramTemp]],
    ['LEISTUNG', sys.power, 0, 1, `${Math.round(sys.power * 100)} %`, [sys.idlePower]],
    ['HYDRAULIK', sys.hydraulics, 0, sys.hydMax, `${Math.round(sys.hydraulics)} bar`, [sys.hydReady]],
  ];
  const x0 = 80;
  const bw = w - x0 - 74;
  let y = 36;
  for (const [label, value, min, max, text, marks] of rows) {
    const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
    p.text(label, 8, y, { size: 10, alpha: 0.75 });
    p.rect(x0, y - 6, bw, 12, 0.5);
    if (f > 0) p.rect(x0 + 2, y - 4, (bw - 4) * f, 8, 0.85, true);
    for (const m of marks) {
      const mx = x0 + bw * Math.max(0, Math.min(1, (m - min) / (max - min)));
      p.line(mx, y - 9, mx, y + 9, 1);
    }
    p.text(text, w - 8, y, { size: 10, align: 'right' });
    y += 24;
  }

  const blink = Math.floor(sys.time * 3) % 2 === 0;
  p.line(8, h - 34, w - 8, h - 34, 0.5);
  p.text(sys.phase, w / 2, h - 18, { size: 13, align: 'center', alpha: sys.alert && !blink ? 0.35 : 1 });
}
