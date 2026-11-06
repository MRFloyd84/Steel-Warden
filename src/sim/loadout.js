import { WEAPONS, SIZE_RANK } from '../data/weapons.js';
import { WALKERS } from '../data/walkers.js';

/**
 * Loadout rules:
 *   - the weapon exists
 *   - weapon size ≤ hardpoint size
 *   - type: same type, or the hardpoint is 'universal' (IMP-2 as a 'universal' weapon needs one)
 *   - total weight ≤ walker.maxLoadoutWeight
 *   - groups 1–4, chains only reference loaded hardpoints
 * Returns a list of problems; empty = valid.
 */
export function checkLoadout(walker, loadout, groups = {}, chains = []) {
  const problems = [];
  const hpById = Object.fromEntries(walker.hardpoints.map((hp) => [hp.id, hp]));
  let weight = 0;
  for (const [hpId, weaponId] of Object.entries(loadout ?? {})) {
    const hp = hpById[hpId];
    const w = WEAPONS[weaponId];
    if (!hp) { problems.push(`Hardpoint ${hpId} existiert nicht`); continue; }
    if (!w) { problems.push(`${hpId}: unbekannte Waffe "${weaponId}"`); continue; }
    if (SIZE_RANK[w.size] > SIZE_RANK[hp.size]) problems.push(`${hpId}: ${w.short} (${w.size}) zu groß für Hardpoint ${hp.size}`);
    if (hp.type !== 'universal' && hp.type !== w.type) problems.push(`${hpId}: ${w.short} (${w.type}) passt nicht auf Hardpoint ${hp.type}`);
    weight += w.weight;
  }
  if (weight > walker.maxLoadoutWeight + 1e-6) problems.push(`Übergewicht ${weight.toFixed(1)} t > ${walker.maxLoadoutWeight} t`);
  for (const [hpId, g] of Object.entries(groups)) {
    if (!loadout[hpId]) problems.push(`Gruppe: ${hpId} ist nicht bestückt`);
    if (!(g >= 1 && g <= 4)) problems.push(`Gruppe ${hpId}: ${g} liegt nicht in 1–4`);
  }
  chains.forEach((ch, i) => {
    for (const hpId of ch.weapons) if (!loadout[hpId]) problems.push(`Kette ${i + 1} (${ch.name}): ${hpId} ist nicht bestückt`);
    if (ch.mode !== 'salvo' && ch.mode !== 'sequence') problems.push(`Kette ${i + 1}: Modus "${ch.mode}" unbekannt`);
  });
  return { problems, weight };
}

export function loadoutWeight(loadout) {
  return Object.values(loadout ?? {}).reduce((sum, id) => sum + (WEAPONS[id]?.weight ?? 0), 0);
}

/** Checks every walker's factory loadout once at start-up; throws with all problems listed. */
export function validateFactoryLoadouts() {
  const errors = [];
  for (const w of Object.values(WALKERS)) {
    const { problems } = checkLoadout(w, w.defaultLoadout, w.defaultGroups, w.defaultChains);
    for (const p of problems) errors.push(`${w.name}: ${p}`);
  }
  if (errors.length) throw new Error(`Ungültige Werks-Bewaffnung:\n${errors.join('\n')}`);
}
