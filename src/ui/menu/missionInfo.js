import { getTheater } from '../../data/theaters.js';
import { WEATHER } from '../../data/weather.js';
import { ENEMIES, GUNS } from '../../data/enemies.js';
import { WALKERS } from '../../data/walkers.js';
import { STRUCTURES, SITES } from '../../data/structures.js';
import { startupOf, withStartSite } from '../../states/missionStartup.js';
import { createSampler } from '../../render/World.js';
import { CONFIG } from '../../data/config.js';

/** Mission facts for the menus, all derived from the mission data. */
export const CATEGORY_LABELS = { theater: 'Schauplätze', combat: 'Gefechte', system: 'Systemtests', debug: 'Erprobung' };
export const TIME_LABELS = { day: 'Tag', dusk: 'Dämmerung', dawn: 'Morgengrauen', night: 'Nacht' };
export const START_LABELS = { safe: 'sicher', scramble: 'Alarmstart', hot: 'heiß' };
export const LOCATION_LABELS = { hangar: 'Hangar', dropZone: 'Absetzpunkt' };

export function theaterName(m) {
  return getTheater(m.theater).name;
}

export function weatherName(m, override = null) {
  const id = override ?? m.weather ?? getTheater(m.theater).weather ?? 'clear';
  const name = WEATHER[id]?.name ?? id;
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export function startLabel(m) {
  const s = startupOf(m);
  const extra = s.mode === 'scramble' ? ` nach ${s.scrambleDelay} s` : '';
  return `${START_LABELS[s.mode]}${extra} · ${LOCATION_LABELS[s.location]}`;
}

/** Expected opposition as short lines: units by type, guns, reinforcements, waves, target dummies. */
export function enemyLines(m) {
  const f = m.forces ?? {};
  const count = new Map();
  const add = (type, n = 1) => count.set(type, (count.get(type) ?? 0) + n);
  for (const g of f.groups ?? []) for (const u of g.units ?? []) add(u.type);
  const name = (t) => {
    const e = ENEMIES[t] ?? WALKERS[t];
    return e ? `${e.name}${e.role ? ` (${e.role})` : ''}` : t;
  };
  const lines = [...count].map(([t, n]) => `${n}× ${name(t)}`);
  if (f.guns?.length) {
    const types = new Set(f.guns);
    const sites = (m.sites ?? []).flatMap((s) => SITES[s.type]?.items.map((it) => it.s) ?? []);
    const all = [...(m.structures ?? []).map((s) => s.type), ...sites].filter((t) => GUNS[t] && types.has(t));
    const byType = new Map();
    for (const t of all) byType.set(t, (byType.get(t) ?? 0) + 1);
    for (const [t, n] of byType) lines.push(`${n}× ${STRUCTURES[t]?.name ?? t}`);
  }
  if (f.reinforcements) lines.push(`Verstärkung ${f.reinforcements.via === 'lander' ? 'per Landefähre' : 'vom Rand'}`);
  if (f.waves?.length) lines.push(`${f.waves.length} Wellen per Landefähre`);
  if (m.spawns?.length) lines.push(`${m.spawns.length} Zielattrappen (ohne Gegenwehr)`);
  return lines.length ? lines : ['keine'];
}

// ---- overview map (top view from the height field) ----

const mapCache = new Map();

/**
 * Small map canvas: height field shaded in green, the mission area, start,
 * nav points and enemy positions. Cached per mission.
 */
export function missionMap(m, size = 220) {
  const key = `${m.id}:${size}`;
  if (mapCache.has(key)) return mapCache.get(key);
  const mission = withStartSite(m);
  const pts = [[m.playerStart.x, m.playerStart.z], ...(m.navPoints ?? []).map((n) => [n.x, n.z]), ...(m.area ?? [])];
  for (const g of m.forces?.groups ?? []) for (const u of g.units ?? []) if (u.at) pts.push(u.at);
  for (const w of m.forces?.waves ?? []) pts.push(...(w.points ?? []));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const span = Math.max(600, maxX - minX, maxZ - minZ) * 1.25;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const sampler = createSampler(mission, CONFIG.terrain);
  const n = 72;
  const h = new Float32Array(n * n);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = sampler.heightAt(cx - span / 2 + ((i + 0.5) / n) * span, cz - span / 2 + ((j + 0.5) / n) * span);
      h[j * n + i] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cell = size / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = (h[j * n + i] - lo) / Math.max(1, hi - lo);
      // Simple hill shading from the left neighbour
      const shade = i > 0 ? Math.max(-0.25, Math.min(0.25, (h[j * n + i] - h[j * n + i - 1]) * 0.03)) : 0;
      const k = 0.18 + v * 0.45 + shade;
      g.fillStyle = `rgb(${Math.round(20 + 40 * k)}, ${Math.round(40 + 150 * k)}, ${Math.round(28 + 50 * k)})`;
      g.fillRect(i * cell, j * cell, cell + 1, cell + 1);
    }
  }
  const tx = (x) => ((x - (cx - span / 2)) / span) * size;
  const tz = (z) => ((z - (cz - span / 2)) / span) * size;
  // Grid every 500 m
  g.strokeStyle = 'rgba(120, 255, 150, 0.12)';
  g.lineWidth = 1;
  for (let x = Math.ceil((cx - span / 2) / 500) * 500; x < cx + span / 2; x += 500) {
    g.beginPath();
    g.moveTo(tx(x), 0);
    g.lineTo(tx(x), size);
    g.stroke();
  }
  for (let z = Math.ceil((cz - span / 2) / 500) * 500; z < cz + span / 2; z += 500) {
    g.beginPath();
    g.moveTo(0, tz(z));
    g.lineTo(size, tz(z));
    g.stroke();
  }
  if (m.area?.length) {
    g.strokeStyle = '#5fe0c8';
    g.setLineDash([4, 3]);
    g.beginPath();
    m.area.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z))));
    g.closePath();
    g.stroke();
    g.setLineDash([]);
  }
  const s = startupOf(m);
  if (s.safeRadius > 0) {
    g.strokeStyle = 'rgba(255, 210, 58, 0.35)';
    g.beginPath();
    g.arc(tx(m.playerStart.x), tz(m.playerStart.z), (s.safeRadius / span) * size, 0, Math.PI * 2);
    g.stroke();
  }
  g.font = `${Math.round(size / 20)}px monospace`;
  g.textBaseline = 'middle';
  for (const nav of m.navPoints ?? []) {
    g.strokeStyle = '#9affb8';
    g.beginPath();
    g.arc(tx(nav.x), tz(nav.z), 4, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#9affb8';
    g.fillText(nav.id, tx(nav.x) + 6, tz(nav.z));
  }
  g.fillStyle = '#ff5a4a';
  for (const grp of m.forces?.groups ?? []) {
    for (const u of grp.units ?? []) {
      if (!u.at) continue;
      const x = tx(u.at[0]);
      const z = tz(u.at[1]);
      g.beginPath();
      g.moveTo(x, z - 4);
      g.lineTo(x + 4, z + 3);
      g.lineTo(x - 4, z + 3);
      g.fill();
    }
  }
  for (const w of m.forces?.waves ?? []) {
    for (const [x, z] of w.points ?? []) {
      g.strokeStyle = '#ff5a4a';
      g.strokeRect(tx(x) - 3, tz(z) - 3, 6, 6);
    }
  }
  // Start
  g.fillStyle = '#ffd23a';
  const sx = tx(m.playerStart.x);
  const sz = tz(m.playerStart.z);
  g.beginPath();
  g.moveTo(sx, sz - 6);
  g.lineTo(sx + 6, sz);
  g.lineTo(sx, sz + 6);
  g.lineTo(sx - 6, sz);
  g.fill();
  g.fillStyle = 'rgba(160, 255, 180, 0.7)';
  g.fillText(`${Math.round(span / 100) / 10} km`, 4, size - 8);
  const url = c.toDataURL();
  mapCache.set(key, url);
  return url;
}
