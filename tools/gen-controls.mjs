#!/usr/bin/env node
/**
 * Writes the controls tables into README.md from src/input/actions.js
 * (between <!-- controls:start --> and <!-- controls:end -->), so the
 * README always matches the defaults. Usage: node tools/gen-controls.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ACTIONS, CATEGORIES, CONTEXTS } from '../src/input/actions.js';
import { tokenLabel, padLabel } from '../src/input/keyLabels.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = join(root, 'README.md');
const CTX = { combat: 'Kampf', freeLook: 'freier Blick', missileCam: 'Raketenkamera', external: 'Außenkamera', menu: 'Menü', freeCam: 'Freiflug', debug: 'Debug', global: 'überall' };

const lines = ['_Erzeugt aus `src/input/actions.js` mit `node tools/gen-controls.mjs` — nicht von Hand ändern. Tasten nach deutscher QWERTZ-Beschriftung._', ''];
for (const [cat, name] of Object.entries(CATEGORIES)) {
  const list = ACTIONS.filter((a) => a.category === cat);
  if (!list.length) continue;
  lines.push(`**${name}**`, '', '| Aktion | Tastatur / Maus | Gamepad | Kontext |', '|---|---|---|---|');
  const choices = list.filter((a) => a.id.startsWith('menuChoice'));
  for (const a of list) {
    if (a.id.startsWith('menuChoice') && a !== choices[0]) continue;
    const label = a.id.startsWith('menuChoice') ? `Menü: Eintrag 1–${choices.length}` : a.label;
    const keys = a.id.startsWith('menuChoice') ? `\`1\`–\`${choices.length}\`` : (a.keys ?? []).map((t) => `\`${tokenLabel(t)}\``).join(' / ') || '–';
    const pad = (a.pad ?? []).map(padLabel).join(' / ') || '–';
    lines.push(`| ${label} | ${keys} | ${pad} | ${a.contexts.map((c) => CTX[c] ?? c).join(', ')} |`);
  }
  lines.push('');
}
lines.push('Kontexte: ' + Object.entries(CONTEXTS).map(([k, v]) => `**${CTX[k]}** = ${v}`).join(' · ') + '.');

const text = readFileSync(readme, 'utf8');
const start = '<!-- controls:start -->';
const end = '<!-- controls:end -->';
const a = text.indexOf(start);
const b = text.indexOf(end);
if (a < 0 || b < 0) throw new Error('README: Marker <!-- controls:start --> / <!-- controls:end --> fehlen');
writeFileSync(readme, text.slice(0, a + start.length) + '\n' + lines.join('\n') + '\n' + text.slice(b));
console.log(`README.md: ${ACTIONS.length} Aktionen eingetragen`);
