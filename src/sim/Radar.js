import * as THREE from 'three';
import { COMBAT } from '../data/combat.js';

const p = new THREE.Vector3();

/**
 * The player's radar (A4, docs/A4-PLAN.md). Pure functions — MissionCombat and cockpitData
 * feed them, tests call them directly.
 *
 *   active   everything inside the range dial with a free line (terrain and buildings cover)
 *   passive  only emitting units up to COMBAT.radar.passiveRange, no line needed (their
 *            emission gives them away); plus the danger circle
 *   link     in both modes: what a wingman saw in the last COMBAT.radar.linkMemory s
 */

/** Does the player emit? Sensors on and powered with the radar active, or the jammer on. */
export function playerEmits({ sensorsOn, powered, radarActive, jamming }) {
  return (sensorsOn && powered && radarActive) || !!jamming;
}

/**
 * Radar contacts of the player.
 * @param o {
 *   mode      'active' | 'passive'
 *   range     m (dial × sensor damage)
 *   eye       THREE.Vector3 of the player
 *   enemies   units of the other side
 *   los(eye, point) → bool   free line (Perception.lineOfSight)
 *   link      Map unit → seconds since a wingman saw it (data link), may be empty
 * }
 * @returns [{ unit, how: 'radar' | 'passive' | 'link' }]
 */
export function radarContacts({ mode, range, eye, enemies, los, link = new Map() }) {
  const out = [];
  for (const u of enemies) {
    if (u.wreck?.kind === 'reactor') continue;
    const c = u.volumes.componentCenter('torso', p);
    const dist = Math.hypot(c.x - eye.x, c.z - eye.z);
    let how = null;
    if (mode === 'active' && dist <= range && los(eye, c)) how = 'radar';
    else if (mode === 'passive' && u.emitting && dist <= Math.max(range, COMBAT.radar.passiveRange)) how = 'passive';
    if (!how && (link.get(u) ?? Infinity) <= COMBAT.radar.linkMemory) how = 'link';
    if (how) out.push({ unit: u, how });
  }
  return out;
}

/**
 * Data link: for every enemy the latest time any wingman saw it (seconds ago).
 * flight: ai/Flight.js (members with contacts { visible, seenAt }), may be null.
 */
export function linkContacts(flight) {
  const out = new Map();
  if (!flight) return out;
  for (const c of flight.members) {
    if (c.dead) continue;
    for (const [t, k] of c.contacts) {
      const ago = k.visible ? 0 : c.time - (k.seenAt ?? -Infinity);
      if (ago < (out.get(t) ?? Infinity)) out.set(t, ago);
    }
  }
  return out;
}

/**
 * Danger circle on the passive radar: the distance at which the enemies in the mission can
 * notice the player — signature location, their sight × light × weather × signature, the
 * radar of emitting enemies, and everyone while the player emits.
 * @param o { signature {sight, detect}, enemies, rangeFactor(unit), emitting }
 */
export function dangerRadius({ signature, enemies, rangeFactor, emitting = false }) {
  let r = signature?.detect ?? 0;
  for (const u of enemies) {
    if (u.wreck) continue;
    const ai = u.walker.ai ?? {};
    r = Math.max(r, (ai.sight?.range ?? 900) * rangeFactor(u) * (signature?.sight ?? 1));
    if (u.emitting) r = Math.max(r, ai.radar ?? COMBAT.radar.aiDefault);
    if (emitting) r = Math.max(r, ai.detectEmitting ?? 1500);
  }
  return r;
}

/**
 * Jammer: does an enemy active/semi-active missile lose its jamming target? Fixed per
 * missile (serial) so runs repeat: about COMBAT.jammer.breakChance of them do, beyond
 * COMBAT.jammer.missileRange.
 */
export function jamBreaks(serial, dist) {
  const k = COMBAT.jammer;
  if (dist <= k.missileRange) return false;
  // integer mixer (murmur3 finaliser) → evenly spread 0..1
  let h = Math.imul(serial ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296 < k.breakChance;
}
