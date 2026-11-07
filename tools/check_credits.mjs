#!/usr/bin/env node
/**
 * Checks that every external asset is accounted for:
 *   - every file in assets/props/<pack>/ and assets/textures/ is referenced by data/props.js
 *     (or is the pack's colour map) / data/textures.js, and every referenced file exists
 *   - every pack (PROP_PACKS) and texture source (TEXTURE_SOURCES) has an entry in CREDITS.md
 *     with its name, author, licence and link
 * Usage: node tools/check_credits.mjs   (exit code 1 on problems)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPS, PROP_PACKS } from '../src/data/props.js';
import { TEXTURES, TEXTURE_SOURCES } from '../src/data/textures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credits = readFileSync(join(root, 'CREDITS.md'), 'utf8');
const problems = [];

// Props
const propDir = join(root, 'assets/props');
const used = new Set();
for (const [id, def] of Object.entries(PROPS)) {
  if (!PROP_PACKS[def.pack]) problems.push(`Prop ${id}: unbekanntes Paket ${def.pack}`);
  const rel = `${def.pack}/${def.file}`;
  used.add(rel);
  if (!existsSync(join(propDir, rel))) problems.push(`Prop ${id}: Datei fehlt (${rel})`);
}
for (const [pack, p] of Object.entries(PROP_PACKS)) if (p.colormap) used.add(`${pack}/${p.colormap}`);
for (const pack of existsSync(propDir) ? readdirSync(propDir) : []) {
  if (!PROP_PACKS[pack]) problems.push(`assets/props/${pack}/: Paket fehlt in PROP_PACKS`);
  for (const f of readdirSync(join(propDir, pack))) if (!used.has(`${pack}/${f}`)) problems.push(`assets/props/${pack}/${f}: in props.js nicht verwendet`);
}

// Textures
const texDir = join(root, 'assets/textures');
for (const [id, t] of Object.entries(TEXTURES)) {
  if (!TEXTURE_SOURCES[t.source]) problems.push(`Textur ${id}: unbekannte Quelle ${t.source}`);
  if (!existsSync(join(texDir, `${id}.png`))) problems.push(`Textur ${id}: Datei fehlt (${id}.png)`);
}
for (const f of existsSync(texDir) ? readdirSync(texDir) : []) if (!TEXTURES[f.replace(/\.png$/, '')]) problems.push(`assets/textures/${f}: in textures.js nicht eingetragen`);

// Credits entries
const need = (what, entry) => {
  for (const key of ['name', 'author', 'license', 'url']) {
    if (entry[key] && !credits.includes(entry[key])) problems.push(`CREDITS.md: ${what} — „${entry[key]}“ (${key}) fehlt`);
  }
};
for (const [k, p] of Object.entries(PROP_PACKS)) need(`Paket ${k}`, p);
for (const [k, s] of Object.entries(TEXTURE_SOURCES)) need(`Texturquelle ${k}`, s);

const nFiles = used.size + Object.keys(TEXTURES).length;
if (problems.length) {
  console.log(`✗ ${problems.length} Problem(e):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${nFiles} Dateien, ${Object.keys(PROP_PACKS).length} Modellpakete, ${Object.keys(TEXTURE_SOURCES).length} Texturquellen — alle mit Credits-Eintrag.`);
