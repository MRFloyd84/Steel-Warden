/**
 * Target page. Without a locked target it shows the idle acquisition
 * pattern; the wireframe target view arrives with weapons and enemies.
 */
export const TargetDisplay = {
  persistence: 0.6,

  draw(p, d) {
    const { w, h } = p;
    const cx = w / 2;
    const cy = h * 0.48;
    const r = h * 0.3;
    p.text('ZIELMONITOR', 8, 12, { size: 11 });
    p.line(8, 22, w - 8, 22, 0.4);
    if (d.sensors < 1) {
      p.text('KEINE SENSORDATEN', w / 2, h / 2, { size: 13, align: 'center', alpha: 0.7 });
      return;
    }

    // Rotating acquisition brackets
    const a = d.time * 0.8;
    for (let i = 0; i < 4; i++) {
      const ang = a + (i * Math.PI) / 2;
      p.circle(cx, cy, r, 0.8, false, ang, ang + 0.5);
    }
    p.line(cx - 8, cy, cx + 8, cy, 0.6);
    p.line(cx, cy - 8, cx, cy + 8, 0.6);
    p.circle(cx, cy, r * 0.45, 0.25);

    const blink = Math.floor(d.time * 1.5) % 2 === 0;
    p.text('KEIN ZIEL', cx, h - 40, { size: 14, align: 'center', alpha: blink ? 1 : 0.55 });
    p.text('ERFASSUNG BEREIT', cx, h - 20, { size: 10, align: 'center', alpha: 0.6 });
  },
};
