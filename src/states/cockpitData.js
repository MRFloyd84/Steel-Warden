import { DEG } from '../util/math.js';
import { COMBAT } from '../data/combat.js';
import { CLASS_LABELS } from '../data/walkers.js';

/**
 * The instrument snapshot handed to all cockpit displays each frame.
 * Built from walker motion, control state and WalkerSystems.
 */
export const compassDeg = (yaw) => ((((-yaw / DEG) % 360) + 360) % 360);

export function createCockpitData(walker, mission, systems) {
  return {
    walkerName: walker.name,
    reactorOutput: walker.reactorOutput,
    maxSpeed: walker.maxSpeed,
    maxReverseSpeed: walker.maxReverseSpeed,
    twistLimit: walker.torsoTwistLimit,
    armor: walker.armor,
    health: { torso: 1, armL: 1, armR: 1, legs: 1, sensors: 1, reactor: 1 },
    stages: { torso: 0, armL: 0, armR: 0, legs: 0, sensors: 0, reactor: 0 },
    armorNow: { ...walker.armor },
    frontShare: 0.5,
    contacts: [],
    target: null,
    weaponsReadout: null,
    coneDeg: COMBAT.targeting.coneDeg,
    shields: { front: 0, rear: 0, left: 0, right: 0 },
    hardpoints: walker.hardpoints.map((hp) => ({ ...hp, weapon: null })),
    loadoutWeight: 0,
    maxLoadoutWeight: walker.maxLoadoutWeight,
    navPoints: (mission.navPoints ?? []).map((n, i) => ({ ...n, active: i === 0, dx: 0, dz: 0, dist: 0, bearingDeg: 0 })),
    monitorStatus: (id) => systems.monitorStatus(id),
    sensors: 0,
    sensorsReadyFor: 0,
    time: 0,
    sys: {},
  };
}

export function updateCockpitData(d, dt, { motion: m, controls: c, systems, stick, combat }) {
  d.monitorFaults = systems.monitorFaults;
  const s = systems.s;
  const f = systems.flags;
  const k = systems.cfg;
  d.time += dt;
  d.throttle = m.throttle.value;
  d.speed = m.speed;
  d.torsoYaw = m.torsoYaw;
  // An unaligned gyro makes the compass wander.
  const drift = (1 - s.gyro.align) * (25 * Math.sin(d.time * 0.37) + 8 * Math.sin(d.time * 1.9));
  d.gyroAligned = f.gyroAligned;
  d.headingDeg = (compassDeg(m.torsoYaw) + drift + 360) % 360;
  d.legHeadingDeg = (compassDeg(m.legYaw) + drift + 360) % 360;
  d.twist = m.twist;
  d.twistDeg = m.twist / DEG;
  d.pitchDeg = m.pitch / DEG;
  d.grade = m.grade;
  d.stickX = stick.x;
  d.stickY = stick.y;
  d.stickTwist = stick.twist;

  d.radarRange = c.has('radarRange') ? Number(c.positionLabel('radarRange')) : 1000;
  d.weaponsArmed = c.has('weaponsArm') && c.value('weaponsArm') === 1;
  d.weaponsReady = f.weaponsReady;
  d.energyPreset = c.has('energyPreset') ? c.positionLabel('energyPreset') : '';
  d.radioChannel = c.has('radioChannel') ? c.positionLabel('radioChannel') : '';
  d.sensors = s.sensors.level;
  d.extraCircuit = systems.extraCircuit;
  d.circuit2 = f.reactor2Running;
  d.sensorsReadyFor = f.sensorsReady ? d.sensorsReadyFor + dt : 0;
  if (combat) updateCombatData(d, m, combat);
  else for (const side of ['front', 'rear', 'left', 'right']) d.shields[side] = s.shields.level;
  for (const nav of d.navPoints) {
    nav.dx = nav.x - m.x;
    nav.dz = nav.z - m.z;
    nav.dist = Math.hypot(nav.dx, nav.dz);
    nav.bearingDeg = ((Math.atan2(nav.dx, -nav.dz) / DEG) + 360) % 360;
  }

  const y = d.sys;
  y.time = d.time;
  y.startComplete = f.legsReleased && !f.restartNeeded;
  y.source = s.power.fault ? 'none' : s.power.source;
  y.volts = s.battery.volts;
  y.apuRpm = s.apu.rpm;
  y.apuReadyRpm = k.apu.readyRpm;
  y.p1 = s.coolant.p1;
  y.p2 = s.coolant.p2;
  y.coolantMax = k.coolant.maxPressure;
  y.coolantOk = k.coolant.okPressure;
  y.temp = s.reactor.temp;
  y.ignitionMin = k.reactor.ignitionMinTemp;
  y.preheatMax = k.reactor.preheatMaxTemp;
  y.warnTemp = k.reactor.warnTemp;
  y.scramTemp = k.reactor.scramTemp;
  y.power = s.reactor.power;
  y.idlePower = k.reactor.idlePower;
  y.hydraulics = s.hydraulics.pressure;
  y.hydMax = k.hydraulics.maxPressure;
  y.hydReady = k.hydraulics.readyPressure;
  [y.phase, y.alert] = phase(systems);
}

function phase(systems) {
  const { s, flags: f } = systems;
  const r = s.reactor;
  if (s.power.fault) return ['BUSFEHLER — HAUPTBUS AUF HILFS', true];
  if (f.scrammed) return [r.lockout ? 'NOTABSCHALTUNG — ZÜNDKAPPE ZURÜCKSETZEN' : 'NOTABSCHALTUNG', true];
  if (f.heatWarning) return ['ÜBERHITZUNG KERN', true];
  if (!f.batteryOn) return ['KALT', false];
  if (s.apu.mode === 'crank') return ['HILFSAGGREGAT LÄUFT AN', false];
  if (r.mode === 'igniting') return ['ZÜNDUNG', false];
  if (!f.busPowered) return ['BATTERIEBETRIEB', false];
  if (f.preheatOk) return ['ZÜNDBEREIT', false];
  if (r.heater) return ['VORHEIZEN', false];
  if (r.mode === 'running') {
    if (!f.onReactorBus) return ['REAKTOR LÄUFT — HAUPTBUS UMSCHALTEN', false];
    return [r.power < 0.95 ? 'REAKTOR LEERLAUF' : 'REAKTOR VOLLAST', false];
  }
  return ['HILFSSTROM', false];
}

function updateCombatData(d, m, combat) {
  const r = combat.readout();
  Object.assign(d.shields, r.shields);
  d.frontShare = r.frontShare;
  for (const [k, part] of Object.entries(r.parts)) {
    d.health[k] = (part.armor + part.internal) / (part.maxArmor + part.maxInternal);
    d.stages[k] = part.stage;
    d.armorNow[k] = part.armor;
  }
  // Torso internal structure is the reactor
  const t = r.parts.torso;
  d.health.reactor = t.internal / t.maxInternal;
  d.stages.reactor = t.internal <= 0 ? 4 : t.internal / t.maxInternal > 0.8 ? 0 : t.internal / t.maxInternal > 0.55 ? 1 : t.internal / t.maxInternal > 0.3 ? 2 : 3;
  d.armorNow.reactor = t.internal;
  d.radarRange *= r.sensorsRange;
  d.weaponsReadout = r.weapons;
  d.lockState = r.lockState;
  d.sensorsHeavy = r.parts.sensors.stage >= 3;
  const th = combat.threat;
  d.threat = th ? { ...th, dist: Math.hypot(th.dx, th.dz) } : null;
  d.guidance = r.guidance;
  d.hasPod = r.hasPod;
  d.tracking = r.tracking;
  d.loadoutWeight = r.weapons.slots.reduce((sum, sl) => sum + combat.weapons.byId[sl.id].def.weight, 0);

  d.area = d.worldLink?.areaRelative(m.x, m.z) ?? null;
  // Radar contacts (all other walkers; data link and passive radar come with A4)
  d.contacts.length = 0;
  for (const u of combat.units.enemies) {
    const p = u.motion.pose;
    const dx = p.x - m.x;
    const dz = p.z - m.z;
    d.contacts.push({ dx, dz, dist: Math.hypot(dx, dz), locked: u === r.target?.unit, wreck: !!u.wreck });
  }

  const tg = r.target;
  if (tg) {
    const u = tg.unit;
    d.target = {
      name: tg.name, cls: CLASS_LABELS[tg.cls] ?? tg.cls, tonnage: tg.tonnage, distance: tg.distance, lockTime: tg.lockTime,
      wreck: tg.wreck, unit: u,
      stages: Object.fromEntries(Object.entries(u.damage.parts).map(([k, p]) => [k, p.stage])),
      shields: { front: u.damage.shieldFraction('front'), rear: u.damage.shieldFraction('rear'), left: u.damage.shieldFraction('left'), right: u.damage.shieldFraction('right') },
      needLock: needLock(combat.weapons.slots),
      component: tg.component,
      converging: tg.converging,
    };
  } else d.target = null;
}

/** Shortest lock time of the launchers that currently need a lock (0 = none). */
function needLock(slots) {
  const times = slots.filter((s) => !s.disabled && (s.mode === 'active' || s.mode === 'semiActive')).map((s) => s.def.lockTime);
  return times.length ? Math.min(...times) : 0;
}
