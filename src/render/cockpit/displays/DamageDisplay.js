// Silhouette boxes in normalised screen space [x, y, w, h] (front view).
const PARTS = {
  sensors: [[0.41, 0.12, 0.14, 0.09]],
  torso: [[0.33, 0.23, 0.3, 0.29]],
  armL: [[0.16, 0.25, 0.14, 0.33]],
  armR: [[0.66, 0.25, 0.14, 0.33]],
  legs: [[0.34, 0.55, 0.11, 0.35], [0.51, 0.55, 0.11, 0.35]],
};
const STAGE_SHORT = ['OK', 'LEICHT', 'MITTEL', 'SCHWER', 'ZERST'];
const LABELS = { torso: 'TORSO', armL: 'ARM L', armR: 'ARM R', legs: 'BEINE', sensors: 'SENSOR', reactor: 'REAKTOR' };

export function healthColor(f) {
  if (f > 0.66) return '#5dff7a';
  if (f > 0.33) return '#ffcf3a';
  if (f > 0) return '#ff4a2a';
  return '#5a5a5a';
}

/**
 * Damage page: walker silhouette with colour-coded components, reactor
 * core, four shield arcs and the armour table (from walker data).
 */
export const DamageDisplay = {
  persistence: 0.4,

  draw(p, d) {
    const { w, h } = p;
    const sx = w * 0.62;
    const health = d.health;
    const box = ([x, y, bw, bh]) => [x * sx, y * h, bw * sx, bh * h];

    // Shields: arcs around the silhouette (front up, rear down, left, right)
    const cx = sx * 0.48;
    const cy = h * 0.5;
    const r = h * 0.47;
    const arcs = { front: -Math.PI / 2, right: 0, rear: Math.PI / 2, left: Math.PI };
    for (const [side, mid] of Object.entries(arcs)) {
      const f = d.shields[side];
      p.circle(cx, cy, r, 0.25, false, mid - 0.62, mid + 0.62);
      if (f > 0) p.circle(cx, cy, r, 0.4 + 0.6 * f, false, mid - 0.62 * f, mid + 0.62 * f, healthColor(f));
    }

    for (const [part, rects] of Object.entries(PARTS)) {
      const color = healthColor(health[part]);
      for (const rect of rects) {
        const [x, y, bw, bh] = box(rect);
        p.rect(x, y, bw, bh, 0.35, true, hexAlpha(color, 0.35));
        p.rect(x, y, bw, bh, 1, false, color);
      }
    }
    p.circle(sx * 0.48, h * 0.37, 7, 1, true, 0, Math.PI * 2, healthColor(health.reactor));

    // Armour table: remaining armour and damage stage
    const tx = sx + 6;
    p.text(d.walkerName, tx, 14, { size: 11 });
    p.line(tx, 24, w - 6, 24, 0.5);
    let y = 38;
    for (const key of ['torso', 'armL', 'armR', 'legs', 'sensors', 'reactor']) {
      const f = health[key];
      const st = d.stages?.[key] ?? 0;
      p.text(LABELS[key], tx, y, { size: 10, alpha: 0.75 });
      p.text(STAGE_SHORT[st], w - 40, y, { size: 9, align: 'right', color: healthColor(f) });
      p.text(String(Math.round(d.armorNow?.[key] ?? d.armor[key] * f)), w - 6, y, { size: 10, align: 'right', color: healthColor(f) });
      y += 17;
    }
    p.line(tx, y - 6, w - 6, y - 6, 0.5);
    const front = Math.round((d.frontShare ?? 0.5) * 100);
    p.text(`SCHILD V${front}/H${100 - front}`, tx, y + 6, { size: 10, alpha: 0.75 });
    const avg = (d.shields.front + d.shields.rear + d.shields.left + d.shields.right) / 4;
    p.text(`${Math.round(avg * 100)} %`, w - 6, y + 22, { size: 11, align: 'right', color: healthColor(avg) });
  },
};

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
