/**
 * Top-down radar, torso-up. Range rings, rotating sweep (the phosphor
 * afterglow draws its trail), torso field-of-view wedge, leg direction,
 * north marker and nav points.
 */
export const RadarDisplay = {
  persistence: 0.8,

  draw(p, d) {
    const { w, h } = p;
    if (d.sensors < 1) {
      p.text('RADAR', 8, 12, { size: 11 });
      const msg = d.sensors > 0 ? `SENSOREN INIT ${Math.round(d.sensors * 100)} %` : 'SENSOREN AUS';
      p.text(msg, w / 2, h / 2, { size: 13, align: 'center', alpha: Math.floor(d.time * 2) % 2 ? 1 : 0.5 });
      return;
    }
    const cx = w / 2;
    const cy = h * 0.56;
    const R = h * 0.42;
    const range = d.radarRange;
    const scale = R / range;
    const yaw = d.torsoYaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    // World offset -> screen (torso forward is up).
    const toScreen = (dx, dz) => {
      const rx = dx * cos - dz * sin;
      const ry = -dx * sin - dz * cos;
      return [cx + rx * scale, cy - ry * scale];
    };

    for (let i = 1; i <= 4; i++) p.circle(cx, cy, (R * i) / 4, i === 4 ? 0.7 : 0.25);
    p.line(cx - R, cy, cx + R, cy, 0.15);
    p.line(cx, cy - R, cx, cy + R, 0.15);

    // Lock cone of the torso (only targets inside can be locked)
    const fov = ((d.coneDeg ?? 36) * Math.PI) / 180;
    p.line(cx, cy, cx - Math.sin(fov) * R, cy - Math.cos(fov) * R, 0.45);
    p.line(cx, cy, cx + Math.sin(fov) * R, cy - Math.cos(fov) * R, 0.45);

    // Sweep — one turn every 2.4 s
    const a = (d.time / 2.4) * Math.PI * 2;
    p.line(cx, cy, cx + Math.sin(a) * R, cy - Math.cos(a) * R, 1);

    // North marker on the outer ring
    const [nx, ny] = toScreen(0, -range);
    p.text('N', nx, ny, { size: 12, align: 'center' });

    // Leg direction relative to the torso
    const t = d.twist;
    const lx = Math.sin(t);
    const ly = Math.cos(t);
    p.line(cx, cy, cx + lx * R * 0.22, cy - ly * R * 0.22, 0.9);
    p.poly([[cx - 5, cy + 6], [cx + 5, cy + 6], [cx, cy - 6]], 1, true);

    // Contacts: walkers in range (locked one boxed, wrecks as crosses)
    if (d.sensorsReadyFor > 0.5) for (const c of d.contacts) {
      if (c.dist > range) continue;
      const [x, y] = toScreen(c.dx, c.dz);
      if (c.wreck) {
        p.line(x - 3, y - 3, x + 3, y + 3, 0.6);
        p.line(x - 3, y + 3, x + 3, y - 3, 0.6);
      } else {
        p.rect(x - 2.5, y - 2.5, 5, 5, 1, true);
      }
      if (c.locked) p.rect(x - 6, y - 6, 12, 12, 1);
    }

    // Nav points fade in during the first sweeps after the sensors came up
    const navAlpha = Math.min(1, d.sensorsReadyFor / 2.4);
    for (const nav of navAlpha > 0 ? d.navPoints : []) {
      const dist = nav.dist;
      const k = dist > range ? range / dist : 1;
      const [x, y] = toScreen(nav.dx * k, nav.dz * k);
      const outside = dist > range;
      const s = 5;
      const a = (outside ? 0.5 : 1) * navAlpha;
      p.poly([[x, y - s], [x + s, y], [x, y + s], [x - s, y]], a, nav.active && !outside && navAlpha >= 1);
      p.text(nav.id[0], x + 8, y - 6, { size: 10, alpha: a });
    }

    // Threat: wedge on the outer ring pointing at the enemy lock / incoming missile
    if (d.threat) {
      const k = 1 / Math.max(1, d.threat.dist);
      const [tx, ty] = toScreen(d.threat.dx * k * range, d.threat.dz * k * range);
      const ang = Math.atan2(tx - cx, -(ty - cy));
      const blink = d.threat.kind === 'missile' || Math.floor(d.time * 8) % 2 === 0;
      const r0 = R * 0.78;
      const r1 = R * 1.0;
      const spread = 0.16;
      const pt = (r, a) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
      if (blink) p.poly([pt(r1, ang - spread), pt(r1, ang + spread), pt(r0, ang)], 1, true, '#ff5a3a');
      p.text(d.threat.kind === 'missile' ? 'RAKETE' : 'ERFASST', w / 2, h - 28, { size: 11, align: 'center', alpha: blink ? 1 : 0.4, color: '#ff5a3a' });
      if (d.threat.dist <= range) {
        const [mx, my] = toScreen(d.threat.dx, d.threat.dz);
        if (d.threat.kind === 'missile') p.circle(mx, my, 3, 1, true, 0, Math.PI * 2, '#ff5a3a');
      }
    }
    // Damaged sensors: snow and drifting false echoes
    if (d.sensorsHeavy) {
      p.static(0.45);
      for (let i = 0; i < 3; i++) p.rect(cx + (Math.random() - 0.5) * R * 1.6, cy + (Math.random() - 0.5) * R * 1.6, 4, 4, 0.6, true);
      p.text('SENSOR GESTÖRT', w / 2, 28, { size: 10, align: 'center', alpha: Math.floor(d.time * 2) % 2 ? 1 : 0.5 });
    }

    p.text('RADAR', 8, 12, { size: 11 });
    p.text(`${range} m`, w - 8, 12, { size: 11, align: 'right' });
    p.text(`KURS ${String(Math.round(d.headingDeg)).padStart(3, '0')}`, 8, h - 12, { size: 11 });
    const nav = d.navPoints.find((n) => n.active);
    if (nav) p.text(`NAV ${nav.id}`, w - 8, h - 12, { size: 11, align: 'right' });
  },
};
