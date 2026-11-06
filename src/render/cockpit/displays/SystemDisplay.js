const COMPASS_LABELS = { 0: 'N', 90: 'O', 180: 'S', 270: 'W' };

/**
 * Drive & orientation page: compass tape with leg-heading caret, throttle
 * bar with set/actual speed, torso-twist dial, pitch, slope and nav info.
 * Reactor/heat/coolant bars join once the startup systems exist.
 */
export const SystemDisplay = {
  persistence: 0.45,

  draw(p, d) {
    const { w, h } = p;
    drawCompass(p, d, w);
    drawThrottle(p, d, 18, 58, 34, h - 92);
    drawTwist(p, d, w * 0.67, h * 0.52, 54);

    const kmh = Math.round(Math.abs(d.speed) * 3.6);
    const pct = Math.round(d.throttle * 100);
    p.text('SCHUB', 64, 64, { size: 10, alpha: 0.7 });
    p.text(`${pct > 0 ? '+' : ''}${pct} %`, 64, 80, { size: 16 });
    p.text('GESCHW', 64, 104, { size: 10, alpha: 0.7 });
    p.text(`${d.speed < -0.1 ? '-' : ''}${kmh}`, 64, 120, { size: 16 });
    p.text('km/h', 64, 136, { size: 10, alpha: 0.7 });
    p.text('NEIG', 64, 160, { size: 10, alpha: 0.7 });
    const pitch = Math.round(d.pitchDeg);
    p.text(`${pitch >= 0 ? '+' : ''}${pitch}°`, 64, 176, { size: 14 });

    const grade = Math.round(d.grade * 100);
    p.text(`STEIGUNG ${grade >= 0 ? '+' : ''}${grade} %`, w - 8, h - 30, { size: 10, align: 'right', alpha: Math.abs(grade) > 40 ? 1 : 0.7 });
    const nav = d.navPoints.find((n) => n.active);
    if (nav) {
      const km = (nav.dist / 1000).toFixed(2);
      p.text(`NAV ${nav.id}  ${String(Math.round(nav.bearingDeg)).padStart(3, '0')}°  ${km} km`, w - 8, h - 12, { size: 11, align: 'right' });
    }
  },
};

function drawCompass(p, d, w) {
  const top = 6;
  const hh = 34;
  const pxPerDeg = 2.4;
  const cx = w / 2;
  p.rect(4, top, w - 8, hh, 0.35);
  const heading = d.headingDeg;
  const first = Math.floor((heading - cx / pxPerDeg) / 10) * 10;
  for (let deg = first; deg <= heading + cx / pxPerDeg; deg += 10) {
    const x = cx + (deg - heading) * pxPerDeg;
    if (x < 8 || x > w - 8) continue;
    const norm = ((deg % 360) + 360) % 360;
    const major = norm % 30 === 0;
    p.line(x, top + hh, x, top + hh - (major ? 10 : 5), major ? 0.9 : 0.5);
    if (major) {
      const label = COMPASS_LABELS[norm] ?? String(norm / 10).padStart(2, '0');
      p.text(label, x, top + 11, { size: 11, align: 'center' });
    }
  }
  p.poly([[cx - 6, top + hh + 8], [cx + 6, top + hh + 8], [cx, top + hh + 1]], 1, true);
  // Leg heading caret
  let rel = d.legHeadingDeg - heading;
  rel = ((rel + 540) % 360) - 180;
  const lx = Math.max(8, Math.min(w - 8, cx + rel * pxPerDeg));
  p.rect(lx - 3, top + hh - 4, 6, 4, 1, true);
}

function drawThrottle(p, d, x, y, bw, bh) {
  const zeroY = y + bh * 0.72; // reverse uses the lower part
  const fwd = zeroY - y;
  const rev = y + bh - zeroY;
  p.rect(x, y, bw, bh, 0.6);
  p.line(x - 4, zeroY, x + bw + 4, zeroY, 1);
  for (const f of [0.25, 0.5, 0.75]) p.line(x, zeroY - fwd * f, x + 6, zeroY - fwd * f, 0.5);
  const t = d.throttle;
  if (t >= 0) p.rect(x + 3, zeroY - fwd * t, bw - 6, fwd * t, 0.8, true);
  else p.rect(x + 3, zeroY, bw - 6, rev * -t, 0.8, true);
  // Actual speed marker
  const s = d.speed >= 0 ? d.speed / d.maxSpeed : d.speed / d.maxReverseSpeed;
  const sy = s >= 0 ? zeroY - fwd * s : zeroY + rev * -s;
  p.poly([[x + bw + 2, sy], [x + bw + 10, sy - 5], [x + bw + 10, sy + 5]], 1, true);
}

function drawTwist(p, d, cx, cy, r) {
  const limit = (d.twistLimit * Math.PI) / 180;
  p.circle(cx, cy, r, 0.3);
  // Allowed arc (up = leg direction)
  p.circle(cx, cy, r, 0.9, false, -Math.PI / 2 - limit, -Math.PI / 2 + limit);
  p.line(cx, cy, cx, cy - r - 6, 0.5);
  p.text('BEINE', cx, cy + r + 14, { size: 10, align: 'center', alpha: 0.7 });
  // Torso needle: positive twist is to the left
  const a = -d.twist;
  p.line(cx, cy, cx + Math.sin(a) * r, cy - Math.cos(a) * r, 1);
  p.circle(cx, cy, 4, 1, true);
  const deg = Math.round(Math.abs(d.twistDeg));
  const side = d.twistDeg > 0.5 ? 'L' : d.twistDeg < -0.5 ? 'R' : ' ';
  p.text(`TORSO ${side} ${deg}°`, cx, cy - r - 16, { size: 11, align: 'center' });
}
