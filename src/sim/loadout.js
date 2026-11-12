import { ENEMIES } from '../data/enemies.js';
import { WEAPONS, SIZE_RANK } from '../data/weapons.js';
import { WALKERS } from '../data/walkers.js';

/**
 * Loadout rules:
 *   - the weapon exists
 *   - weapon size ≤ hardpoint size
 *   - type: same type, or the hardpoint is 'universal' (IMP-2 as a 'universal' weapon needs one)
 *   - total weight ≤ walker.maxLoadoutWeight
 *   - groups 1–4, chains only reference loaded hardpoints with weapons (no equipment)
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
  const isEquipment = (hpId) => WEAPONS[loadout[hpId]]?.kind === 'equipment';
  for (const [hpId, g] of Object.entries(groups)) {
    if (!loadout[hpId]) problems.push(`Gruppe: ${hpId} ist nicht bestückt`);
    if (isEquipment(hpId)) problems.push(`Gruppe: ${hpId} trägt Ausrüstung, keine Waffe`);
    if (!(g >= 1 && g <= 4)) problems.push(`Gruppe ${hpId}: ${g} liegt nicht in 1–4`);
  }
  chains.forEach((ch, i) => {
    for (const hpId of ch.weapons) {
      if (!loadout[hpId]) problems.push(`Kette ${i + 1} (${ch.name}): ${hpId} ist nicht bestückt`);
      else if (isEquipment(hpId)) problems.push(`Kette ${i + 1} (${ch.name}): ${hpId} trägt Ausrüstung, keine Waffe`);
    }
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
  for (const w of [...Object.values(WALKERS), ...Object.values(ENEMIES)]) {
    const { problems } = checkLoadout(w, w.defaultLoadout, w.defaultGroups, w.defaultChains);
    for (const p of problems) errors.push(`${w.name}: ${p}`);
  }
  if (errors.length) throw new Error(`Ungültige Werks-Bewaffnung:\n${errors.join('\n')}`);
}

/** Equipment that can be swapped in the mission preparation (A4). */
export const EQUIPMENT_CHOICES = ['target-pod', 'jammer'];

/**
 * Equipment swap: every hardpoint that carries equipment in the factory loadout gets
 * `equipmentId` instead — only if the result is a valid loadout (size, type, weight).
 * Returns the override map, or null (nothing to swap, unknown item or not valid).
 */
export function equipmentOverride(walker, equipmentId) {
  if (!equipmentId || !EQUIPMENT_CHOICES.includes(equipmentId)) return null;
  const base = walker.defaultLoadout ?? {};
  const slots = Object.entries(base).filter(([, id]) => WEAPONS[id]?.kind === 'equipment').map(([hp]) => hp);
  if (!slots.length) return null;
  const override = Object.fromEntries(slots.map((hp) => [hp, equipmentId]));
  return checkLoadout(walker, { ...base, ...override }, walker.defaultGroups, walker.defaultChains).problems.length ? null : override;
}

/** The equipment a walker carries ab Werk (first equipment item), or null. */
export function factoryEquipment(walker) {
  return Object.values(walker.defaultLoadout ?? {}).find((id) => WEAPONS[id]?.kind === 'equipment') ?? null;
}
