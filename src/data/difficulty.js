/**
 * Difficulty levels (Optionen → Schwierigkeit, stored in localStorage).
 *
 *   reaction      s — how often the AI re-aims (aim error re-rolled, target position sampled)
 *   spread        ° — aim error at that interval (on top of the weapon spread)
 *   lead          0..1 — share of the correct lead for moving targets
 *   flank / cover / focus  tactics allowed: flanking, taking cover, focus fire
 *   reinforcement factor on the mission's reinforcement delay
 *   count         factor on the number of units per group (min. 1)
 *   sight         factor on sight ranges
 *   lockTime      factor on missile lock-on time
 */
export const DIFFICULTY = {
  beginner: { name: 'Anfänger', reaction: 1.4, spread: 4.5, lead: 0.2, flank: false, cover: false, focus: false, reinforcement: 1.8, count: 0.6, sight: 0.7, lockTime: 1.6 },
  green: { name: 'Grün', reaction: 1.0, spread: 3.2, lead: 0.45, flank: true, cover: false, focus: false, reinforcement: 1.4, count: 0.8, sight: 0.85, lockTime: 1.3 },
  normal: { name: 'Normal', reaction: 0.7, spread: 2.2, lead: 0.7, flank: true, cover: true, focus: false, reinforcement: 1.0, count: 1.0, sight: 1.0, lockTime: 1.0 },
  veteran: { name: 'Veteran', reaction: 0.45, spread: 1.4, lead: 0.85, flank: true, cover: true, focus: true, reinforcement: 0.8, count: 1.2, sight: 1.1, lockTime: 0.85 },
  elite: { name: 'Elite', reaction: 0.3, spread: 0.8, lead: 1.0, flank: true, cover: true, focus: true, reinforcement: 0.6, count: 1.4, sight: 1.2, lockTime: 0.7 },
};

export const DIFFICULTY_ORDER = ['beginner', 'green', 'normal', 'veteran', 'elite'];

export function getDifficulty(id) {
  return DIFFICULTY[id] ?? DIFFICULTY.normal;
}
