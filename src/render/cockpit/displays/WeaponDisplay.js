const TYPE_SHORT = { energy: 'EN', ballistic: 'BAL', missile: 'RAK', universal: 'UNI' };

/** Weapons page: hardpoints from walker data with mount state and groups. */
export const WeaponDisplay = {
  persistence: 0.4,

  draw(p, d) {
    const { w, h } = p;
    p.text('WAFFEN', 8, 14, { size: 13 });
    p.text('GRP 1 2 3 4', w - 8, 14, { size: 11, align: 'right', alpha: 0.7 });
    p.line(8, 26, w - 8, 26, 0.5);

    const rowH = Math.min(30, (h - 70) / Math.max(1, d.hardpoints.length));
    let y = 42;
    for (const hp of d.hardpoints) {
      p.text(hp.id, 10, y, { size: 13 });
      p.text(`${hp.size} ${TYPE_SHORT[hp.type] ?? hp.type}`, 58, y, { size: 11, alpha: 0.7 });
      p.text(hp.weapon ?? '— LEER —', w - 10, y, { size: 12, align: 'right', alpha: hp.weapon ? 1 : 0.45 });
      y += rowH;
    }

    p.line(8, h - 30, w - 8, h - 30, 0.5);
    p.text(`ZULADUNG ${d.loadoutWeight.toFixed(1)} / ${d.maxLoadoutWeight.toFixed(1)} t`, 10, h - 14, { size: 11 });
    p.text(d.weaponsArmed ? 'SCHARF' : 'GESICHERT', w - 10, h - 14, { size: 11, align: 'right', alpha: d.weaponsArmed ? 1 : 0.6 });
  },
};
