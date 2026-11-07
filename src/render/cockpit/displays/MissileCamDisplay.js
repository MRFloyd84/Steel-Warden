import { GUIDANCE_LABELS } from '../../../data/weapons.js';

/**
 * Missile camera page (replaces the target monitor while active): the
 * monochrome nose picture with noise, crosshair, height above ground and
 * remaining burn time. Active/semi-active missiles are view only and show
 * AUFG. while their seeker holds the target. White noise when the missile
 * is down, KEIN SIGNAL with nothing in the air.
 */
export const MissileCamDisplay = {
  persistence: 0.2,

  draw(p, d) {
    const { w, h } = p;
    const cam = d.missileCam;
    if (!cam) return;
    if (cam.static) {
      p.static(1);
      p.rect(w / 2 - 80, h / 2 - 12, 160, 24, 1, true, 'rgba(0,0,0,0.85)');
      p.text('SIGNAL VERLOREN', w / 2, h / 2, { size: 14, align: 'center', alpha: Math.floor(d.time * 6) % 2 ? 1 : 0.5 });
      return;
    }
    if (!cam.missile) {
      p.static(0.15);
      p.rect(w / 2 - 70, h / 2 - 24, 140, 44, 1, true, 'rgba(0,0,0,0.75)');
      p.text('RAKETENKAMERA', w / 2, h / 2 - 12, { size: 13, align: 'center' });
      p.text('KEIN SIGNAL', w / 2, h / 2 + 8, { size: 12, align: 'center', alpha: Math.floor(d.time * 2) % 2 ? 1 : 0.5 });
      p.text('KAM: ZURÜCK', w / 2, h - 14, { size: 9, align: 'center', alpha: 0.6 });
      return;
    }
    const m = cam.missile;
    p.image(cam.canvas, 0, 0, w, h, 1);
    p.static(0.12 + (m.lost ? 0.15 : 0) + (cam.weatherNoise ?? 0) * 0.6);

    // Crosshair
    const cx = w / 2;
    const cy = h / 2;
    p.line(cx - 22, cy, cx - 6, cy, 0.9);
    p.line(cx + 6, cy, cx + 22, cy, 0.9);
    p.line(cx, cy - 16, cx, cy - 5, 0.9);
    p.line(cx, cy + 5, cx, cy + 16, 0.9);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      p.line(cx + sx * 40, cy + sy * 30, cx + sx * 32, cy + sy * 30, 0.6);
      p.line(cx + sx * 40, cy + sy * 30, cx + sx * 40, cy + sy * 22, 0.6);
    }

    // Readouts
    p.rect(0, 0, w, 16, 0.55, true, 'rgba(0,0,0,0.55)');
    p.text(`${cam.weapon} ${GUIDANCE_LABELS[m.mode] ?? ''}`, 6, 8, { size: 10 });
    p.text(`#${m.serial % 1000}`, w - 6, 8, { size: 10, align: 'right', alpha: 0.7 });
    p.rect(0, h - 18, w, 18, 0.55, true, 'rgba(0,0,0,0.55)');
    p.text(`H ${Math.max(0, Math.round(cam.ground))} m`, 6, h - 9, { size: 11 });
    p.text(m.burnLeft > 0 ? `BRENN ${m.burnLeft.toFixed(1)} s` : 'BALLIST.', w / 2, h - 9, { size: 11, align: 'center', alpha: m.burnLeft > 0 ? 1 : 0.6 });
    p.text(`${Math.round(m.speed)} m/s`, w - 6, h - 9, { size: 11, align: 'right' });
    if (m.mode === 'optical') {
      p.text(cam.steering ? 'LENKUNG' : 'FEUER HALTEN', w - 6, 26, { size: 9, align: 'right', alpha: cam.steering ? 1 : 0.6 });
    } else if (m.mode === 'active' || m.mode === 'semiActive') {
      const ok = !m.lost && m.target;
      p.text(ok ? 'AUFG.' : 'ZIEL VERLOREN', cx, cy + 40, { size: 12, align: 'center', alpha: ok ? 1 : Math.floor(d.time * 4) % 2 ? 1 : 0.4 });
    } else if (m.mode === 'antiRadar') {
      p.text(m.target ? 'STRAHLER' : 'SUCHT', cx, cy + 40, { size: 11, align: 'center' });
    }
  },
};
