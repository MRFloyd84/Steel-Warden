/**
 * Weapons page: active fire chain (keys 1–4), second chain (right mouse
 * button), capacitor, and per weapon its group,
 * load state, ammunition and barrel heat. Failed or empty weapons are
 * greyed out; weapons in the active chain are marked. Missile launchers
 * show their guidance mode; weapons on a heavily damaged arm turn red.
 */
import { GUIDANCE_LABELS } from '../../../data/weapons.js';

const RED = '#ff4a3a';

export const WeaponDisplay = {
  persistence: 0.35,

  draw(p, d) {
    const { w, h } = p;
    const r = d.weaponsReadout;
    if (!r) return;
    const state = d.weaponsReady ? 'SCHARF' : d.weaponsArmed ? 'SCHALTET' : 'GESICHERT';
    p.text(`KETTE ${r.chainIndex + 1} ${r.chainName}`, 8, 12, { size: 12 });
    p.text(r.chainMode === 'salvo' ? 'SALVE' : 'FOLGE', w - 8, 12, { size: 10, align: 'right', alpha: 0.75 });
    // Chain tabs
    r.chains.forEach((_, i) => p.rect(8 + i * 18, 22, 14, 6, i === r.chainIndex ? 1 : 0.35, i === r.chainIndex));
    // Second trigger (right mouse button)
    p.text(`RMT ${r.secondaryName}`, 14 + r.chains.length * 18, 25, { size: 9, alpha: 0.8 });
    p.text('ENERGIE', w - 104, 26, { size: 9, alpha: 0.7 });
    p.rect(w - 58, 21, 50, 8, 0.5);
    p.rect(w - 57, 22, 48 * r.capacitor, 6, 0.9, true);
    p.line(8, 36, w - 8, 36, 0.5);

    const rows = r.slots.length;
    const rowH = Math.min(30, (h - 66) / Math.max(1, rows));
    let y = 48;
    for (const s of r.slots) {
      const dim = s.disabled || s.empty ? 0.3 : d.weaponsReady ? 1 : 0.55;
      const armHurt = (s.location === 'armL' || s.location === 'armR') && (d.stages?.[s.location] ?? 0) >= 3;
      const color = armHurt || (s.disabled && (s.location === 'armL' || s.location === 'armR')) ? RED : null;
      if (s.inChain) p.poly([[6, y - 4], [12, y], [6, y + 4]], dim, true, color);
      // Bereitschaftslicht (A4): green = this weapon can hit the selected target now
      if (d.target && !s.disabled && !s.empty) p.circle(40, y - 4, 3, d.canHit?.[s.id] ? 1 : 0.35, !!d.canHit?.[s.id], 0, Math.PI * 2, d.canHit?.[s.id] ? '#6dff8e' : null);
      p.text(s.id, 16, y, { size: 11, alpha: dim, color });
      p.text(s.short, 50, y, { size: 11, alpha: dim, color });
      if (s.mode) p.text(GUIDANCE_LABELS[s.mode] ?? '', 50, y + 9, { size: 7, alpha: dim * (s.mode === 'dumb' ? 0.5 : 0.95) });
      p.text(String(s.group), 128, y, { size: 10, alpha: dim * 0.75 });
      // Load bar and heat bar
      p.rect(142, y - 6, 56, 5, 0.4 * dim);
      p.rect(143, y - 5, 54 * s.load, 3, (s.ready ? 1 : 0.6) * dim, true);
      p.rect(142, y + 2, 56, 4, 0.3 * dim);
      p.rect(143, y + 3, 54 * s.heat, 2, dim, true, s.heat > 0.75 ? '#ff6a3a' : null);
      const ammo = s.status || (s.magazine === null ? '∞' : `${s.magazine}/${s.reserve}`);
      p.text(s.beamOn ? 'STRAHL' : ammo, w - 8, y, { size: 10, align: 'right', alpha: dim });
      y += rowH;
    }
    p.line(8, h - 26, w - 8, h - 26, 0.5);
    p.text(`ZULADUNG ${d.loadoutWeight.toFixed(1)}/${d.maxLoadoutWeight} t`, 8, h - 12, { size: 10, alpha: 0.75 });
    if (r.slots.some((s) => s.mode)) p.text(`LENK ${GUIDANCE_LABELS[d.guidance] ?? ''}`, w * 0.55, h - 12, { size: 9, alpha: 0.8, align: 'center' });
    p.text(state, w - 8, h - 12, { size: 11, align: 'right', alpha: d.weaponsReady ? 1 : Math.floor(d.time * 2) % 2 ? 0.4 : 0.9 });
  },
};
