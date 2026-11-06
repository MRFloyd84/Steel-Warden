import { ENERGY_PRESETS } from '../../../data/systems.js';

/**
 * Energy page (heavy cockpits): reactor output with circuit status, power
 * split from the ENERGIE knob, core temperature and coolant pressures.
 */
export const EnergyDisplay = {
  persistence: 0.45,

  draw(p, d) {
    const { w, h } = p;
    const s = d.sys;
    p.text('ENERGIE', 8, 12, { size: 12 });
    p.text(`${Math.round(d.reactorOutput * s.power)} MW`, w - 8, 12, { size: 12, align: 'right' });
    p.line(8, 22, w - 8, 22, 0.5);

    // Reactor output bar
    p.text('REAKTOR', 8, 38, { size: 10, alpha: 0.75 });
    p.rect(80, 32, w - 130, 12, 0.5);
    p.rect(82, 34, (w - 134) * Math.min(1, s.power), 8, 0.9, true);
    p.text(`${Math.round(s.power * 100)}%`, w - 8, 38, { size: 10, align: 'right' });
    if (d.extraCircuit) p.text(`KREIS 2 ${d.circuit2 ? 'EIN' : 'AUS'}`, 80, 56, { size: 10, alpha: d.circuit2 ? 1 : 0.5 });

    // Power split
    const split = ENERGY_PRESETS[d.energyPreset] ?? ENERGY_PRESETS.AUSGL;
    const rows = [['SCHILDE', split.shields], ['WAFFEN', split.weapons], ['ANTRIEB', split.drive]];
    const top = 78;
    const bw = 44;
    rows.forEach(([label, share], i) => {
      const x = 22 + i * (bw + 46);
      const bh = 90;
      p.rect(x, top, bw, bh, 0.5);
      const fill = bh * share * 1.6;
      p.rect(x + 2, top + bh - Math.min(bh - 2, fill), bw - 4, Math.min(bh - 2, fill), 0.85, true);
      p.text(label, x + bw / 2, top + bh + 12, { size: 9, align: 'center', alpha: 0.75 });
      p.text(`${Math.round(share * 100)}%`, x + bw / 2, top - 8, { size: 10, align: 'center' });
    });

    const warn = s.temp >= s.warnTemp;
    p.line(8, h - 34, w - 8, h - 34, 0.5);
    p.text(`KERN ${Math.round(s.temp)}°C`, 8, h - 16, { size: 11, alpha: warn && Math.floor(d.time * 4) % 2 ? 0.35 : 1 });
    p.text(`KÜHLM ${s.p1.toFixed(1)}/${s.p2.toFixed(1)} bar`, w - 8, h - 16, { size: 11, align: 'right' });
  },
};
