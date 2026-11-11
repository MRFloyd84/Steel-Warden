/**
 * Who can hit whom (docs/WINGMEN-PLAN.md). One rule for projectiles, beams and splash:
 *   - never the shooter itself
 *   - other side: always
 *   - same side: only the player's shots hit (its wingmen); enemies among themselves and
 *     wingmen among themselves or against the player do not (wingmen also hold fire when a
 *     friend is in the line of fire, WingmanController)
 * owner may be null (no shooter known): hits everyone.
 */
export function canHit(owner, unit) {
  if (!owner) return true;
  if (unit === owner) return false;
  if (!owner.side || unit.side !== owner.side) return true;
  return !!owner.isPlayer;
}

/**
 * Whose kill an enemy wreck is: 'player' (its shots, or nobody known — ground, chain blast,
 * as before wingmen existed), 'team' (a wingman) or null (not an enemy: a lost wingman).
 */
export function killCredit(unit) {
  if (unit.side !== 'enemy') return null;
  const by = unit.killedBy;
  if (by && !by.isPlayer && by.side === 'player') return 'team';
  return 'player';
}
