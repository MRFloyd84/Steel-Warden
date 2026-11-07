/**
 * Mission start phase: the mission's startup field with defaults, the start
 * site (hangar base or drop zone) and the load-time validation.
 *
 * mission.startup = {
 *   mode: 'safe' | 'scramble' | 'hot',   default 'safe'
 *   location: 'hangar' | 'dropZone',     default 'dropZone'
 *   safeRadius: 1500,                    m around the start: no AI spawns, patrol points, drop points
 *   scrambleDelay: 30,                   scramble only: s from mission start until the enemy moves on the base
 * }
 *   safe      mission clock and enemy AI start with deploy (legs released on main power);
 *             until then every enemy group rests (no movement, perception, reinforcements)
 *   scramble  enemies active from the start, they move on the base after scrambleDelay;
 *             alarm radio, master warning blinks, startup procedure 'simple' (?startmode= overrides)
 *   hot       walker starts ready (= ?start=hot); deploy right away
 *
 * Groups: forces.groups[].activate = 'onDeploy' (default safe/hot) | 'immediate'
 * (default scramble) | 'onTrigger:<id>' with mission.triggers [{ id, type: 'area',
 * at: [x, z], radius } | { id, type: 'time', after: s since deploy }].
 * mission.spawns (target dummies without AI) are not checked.
 */
export const STARTUP_DEFAULTS = { mode: 'safe', location: 'dropZone', safeRadius: 1500, scrambleDelay: 30 };
const MODES = ['safe', 'scramble', 'hot'];
const LOCATIONS = ['hangar', 'dropZone'];

export function startupOf(mission, { hot = false } = {}) {
  const s = { ...STARTUP_DEFAULTS, ...(mission.startup ?? {}) };
  if (hot) s.mode = 'hot';
  return s;
}

/**
 * Copy of the mission with the start site added (homeBase with the hangar
 * around the player, or the drop zone marking), turned to the start heading.
 */
export function withStartSite(mission) {
  const s = startupOf(mission);
  const p = mission.playerStart;
  const site = { type: s.location === 'hangar' ? 'homeBase' : 'dropZone', at: [p.x, p.z], rotation: (p.heading * 180) / Math.PI, id: 'start' };
  return { ...mission, sites: [...(mission.sites ?? []), site] };
}

/** Problems of a mission's startup data in plain German; empty = fine. */
export function validateMission(mission) {
  const problems = [];
  const raw = mission.startup ?? {};
  const s = startupOf(mission);
  if (raw.mode !== undefined && !MODES.includes(raw.mode)) problems.push(`startup.mode „${raw.mode}“ ist unbekannt (safe, scramble, hot).`);
  if (raw.location !== undefined && !LOCATIONS.includes(raw.location)) problems.push(`startup.location „${raw.location}“ ist unbekannt (hangar, dropZone).`);
  if (!(s.safeRadius >= 0)) problems.push('startup.safeRadius muss eine Zahl ≥ 0 sein.');
  if (s.mode === 'scramble' && !(s.scrambleDelay >= 0)) problems.push('startup.scrambleDelay fehlt (Alarmstart braucht die Zeit bis zum Angriff).');
  const p = mission.playerStart;
  const check = (what, x, z) => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < s.safeRadius) problems.push(`${what} bei (${Math.round(x)}, ${Math.round(z)}) liegt ${Math.round(d)} m vom Startort — innerhalb der Schutzzone von ${s.safeRadius} m.`);
  };
  const f = mission.forces ?? {};
  const triggers = new Set((mission.triggers ?? []).map((t) => t.id));
  for (const t of mission.triggers ?? []) {
    if (t.type !== 'area' && t.type !== 'time') problems.push(`Trigger „${t.id}“: Typ „${t.type}“ ist unbekannt (area, time).`);
  }
  (f.groups ?? []).forEach((g, gi) => {
    const name = `Gruppe „${g.id ?? gi + 1}“`;
    (g.units ?? []).forEach((u) => {
      if (u.at) check(`${name}: ${u.type}`, u.at[0], u.at[1]);
    });
    (g.patrol ?? []).forEach(([x, z], i) => check(`${name}: Patrouillenpunkt ${i + 1}`, x, z));
    const act = g.activate;
    if (act && act !== 'onDeploy' && act !== 'immediate' && !act.startsWith('onTrigger:')) problems.push(`${name}: activate „${act}“ ist unbekannt.`);
    if (act?.startsWith('onTrigger:') && !triggers.has(act.slice(10))) problems.push(`${name}: Trigger „${act.slice(10)}“ ist nicht definiert.`);
  });
  for (const [x, z] of f.reinforcements?.points ?? []) check('Verstärkung: Absetzpunkt', x, z);
  (f.waves ?? []).forEach((w, i) => {
    for (const [x, z] of w.points ?? []) check(`Welle ${i + 1}: Absetzpunkt`, x, z);
  });
  return problems;
}

/** Error text for the menu, or null. */
export function missionError(mission) {
  const problems = validateMission(mission);
  if (!problems.length) return null;
  return `Mission „${mission.name}“ (${mission.id}) ist ungültig:\n${problems.map((p) => `• ${p}`).join('\n')}`;
}
