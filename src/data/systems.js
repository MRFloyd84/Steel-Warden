/**
 * Walker systems for the startup procedure: every time, threshold and rate.
 * Units: volts, bar, °C, seconds; rpm and power as fractions 0..1;
 * rates are "per second". Change values here — WalkerSystems has no
 * magic numbers of its own.
 *
 * Model in short:
 *   battery ─┬─ lamps, cockpit light, system monitor (battery bus)
 *            └─ APU crank → APU running = auxiliary power (bus source HILFS)
 *   bus powered = mainBus HILFS ? APU ready : reactor power ≥ busMinPower
 *   pumps, preheater, hydraulics, monitors, gyro, sensors, weapons need bus power;
 *   shields need reactor (main) power.
 *   Reactor temperature: heat in (preheater or reactor) minus coolant cooling
 *   above the coolant setpoint minus a small passive loss.
 */
export const SYSTEMS = {
  battery: {
    nominal: 24.5, // V, battery alone
    charged: 27.8, // V, when the reactor feeds the bus
    crankSag: 3.2, // V drop while the APU is cranking
    rate: 2.0, // how fast the voltage follows (1/s)
  },

  apu: {
    crankRate: 0.2, // rpm gain while START is held
    selfSustain: 0.9, // released below this rpm → the APU spins down again
    runRate: 0.15, // rpm gain once self-sustaining
    spinDownRate: 0.12,
    readyRpm: 0.97,
    stableTime: 1.0, // s above readyRpm before HILFS BEREIT lights
    transferDelay: 1.5, // s after the bus moves to the reactor until the APU shuts down
    emergencyCrankRate: 0.3, // automatic restart after an emergency shutdown
  },

  bus: {
    busMinPower: 0.2, // reactor power needed to carry the main bus
  },

  coolant: {
    pump2Delay: 1.5, // s after the switch until pump 2 runs
    maxPressure: 6.0,
    okPressure: 4.5, // DRUCK 1/2 lamp threshold
    riseRate: 1.1,
    decayRate: 0.9,
  },

  reactor: {
    ambient: 20,
    preheatRate: 45, // °C/s from the preheater
    preheatTarget: 340, // heater switches off above this
    ignitionMinTemp: 300, // VORHEIZ OK lower bound
    preheatMaxTemp: 480, // VORHEIZ OK upper bound (too hot to ignite above)
    idlePower: 0.3, // after ignition / in VORH
    fullPower: 1.0, // in BETR
    powerRate: 0.2,
    ignitionTime: 3.0, // s to spool up to idle
    heatBase: 70, // °C/s produced by a running core
    heatPerPower: 50, // additional °C/s at full power
    coolantSetpoint: 300, // coolant only removes heat above this temperature
    coolingPerFlow: 0.33, // per °C above setpoint at full flow (both pumps)
    passiveCooling: 0.02, // per °C above ambient, always
    warnTemp: 700, // HITZE + master warning + alarm
    scramTemp: 900, // emergency shutdown
    scramPowerRate: 1.5,
    failBlinkTime: 5, // REAKTOR lamp blinks this long after a failed ignition
    flickerTime: 1.2, // cockpit lights flicker after ignition
    singleCircuitMax: 0.6, // assault class: power limit until circuit 2 runs
    circuit2Time: 2.5,
  },

  hydraulics: {
    maxPressure: 210,
    readyPressure: 180,
    auxMaxPressure: 90, // on auxiliary power the pumps can't reach operating pressure
    mainRate: 35,
    auxRate: 6,
    decayRate: 20,
    standUpHeight: 0.1, // m the cockpit rises when pressurised
    slumpPitch: 1.5, // degrees nose-down when depressurised
  },

  monitors: {
    bootOrder: ['mfdSystem', 'mfdRadar', 'mfdDamage', 'mfdTarget', 'mfdEnergy', 'mfdWeapons'],
    batteryMonitor: 'mfdSystem', // runs on battery alone, without the test
    stagger: 1.1, // s between monitors during the test
    flickerTime: 0.5,
    patternTime: 1.3,
    lineTime: 0.35, // per self-test line
    quickBootTime: 1.0, // reboot after a power loss once tested
    // Self-test lines: [label, flag]. A false flag prints FEHLER.
    selfTest: {
      mfdSystem: [['ROM', 'always'], ['RAM', 'always'], ['STROMBUS', 'busPowered'], ['REAKTOR', 'reactorRunning']],
      mfdRadar: [['ROM', 'always'], ['VIDEO', 'always'], ['SENSORBUS', 'busPowered'], ['ANTENNENANTRIEB', 'hydraulicsReady']],
      mfdDamage: [['RAM', 'always'], ['SENSORNETZ', 'busPowered'], ['REAKTOR', 'reactorRunning'], ['KÜHLUNG', 'coolantOk']],
      mfdTarget: [['RAM', 'always'], ['VIDEO', 'always'], ['ZIELRECHNER', 'onReactorBus']],
      mfdWeapons: [['RAM', 'always'], ['FEUERLEITUNG', 'onReactorBus'], ['HYDRAULIK', 'hydraulicsReady']],
      mfdEnergy: [['RAM', 'always'], ['LEISTUNGSMESSUNG', 'reactorRunning'], ['KÜHLKREIS', 'coolantOk']],
    },
  },

  gyro: { alignTime: 10, failAt: 0.45 },
  sensors: { bootTime: 3 },
  shields: { chargeTime: 6, decayTime: 1.5 },
  weapons: { armTime: 1.5 },

  alarms: {
    scramAlarmTime: 4, // s of critical alarm after an emergency shutdown
    faultAlarmTime: 3, // s after a bus fault
    blinkHz: 2,
  },

  automation: {
    actionDelay: 0.7, // s between two switch movements
    groupDelay: 0.6, // s pause before the next step
  },
};

/**
 * Reactor power split per ENERGIE knob position (shields / weapons / drive).
 * Shown on the energy monitor now; the weapons step makes it effective.
 */
export const ENERGY_PRESETS = {
  SCHILD: { shields: 0.5, weapons: 0.25, drive: 0.25 },
  AUSGL: { shields: 0.34, weapons: 0.33, drive: 0.33 },
  WAFFE: { shields: 0.25, weapons: 0.5, drive: 0.25 },
};

/** Radio lines (sender, text) for system events. */
export const RADIO = {
  coldStart: { from: 'TECHNIK', text: 'Walker ist kalt. Checkliste mit K, Schalter im freien Blick (V). Tasten: H.' },
  coldStartSimple: { from: 'TECHNIK', text: 'Vereinfachter Start: Batterie ein, den Rest fahren wir mit. Checkliste mit K.' },
  coldStartAuto: { from: 'TECHNIK', text: 'Walker ist kalt. Shift+S startet die automatische Startprozedur.' },
  autoStart: { from: 'TECHNIK', text: 'Automatische Startprozedur läuft.' },
  ready: { from: 'TECHNIK', text: 'Alle Systeme grün. Beinsperre gelöst — bereit zum Ausrücken.' },
  scram: { from: 'TECHNIK', text: 'Notabschaltung Reaktor! Kühlung prüfen, dann Neustart.' },
  busFault: { from: 'TECHNIK', text: 'Hauptbus ohne Reaktor — Stromausfall. Zurück auf HILFS.' },
  ignitionFailed: { from: 'TECHNIK', text: 'Zündung fehlgeschlagen. Kerntemperatur zu niedrig — vorheizen.' },
};

/**
 * Checklists. Each step names a flag from WalkerSystems.flags; a step is
 * ticked the first time its flag becomes true. `restart` replaces the
 * display after an emergency shutdown. `requires` limits a step to walkers
 * with that feature (e.g. the assault class's second reactor circuit).
 */
export const CHECKLISTS = {
  full: [
    { text: 'BATTERIE — EIN', flag: 'batteryOn' },
    { text: 'HILFSAGG. START — HALTEN BIS BEREIT', flag: 'apuReady' },
    { text: 'KÜHLPUMPEN — EIN, DRUCK 1 + 2 PRÜFEN', flag: 'coolantOk' },
    { text: 'BETRIEBSART — VORH, VORHEIZ OK', flag: 'preheatOk' },
    { text: 'ZÜNDUNG — KAPPE AUF, ZÜNDEN', flag: 'reactorRunning' },
    { text: 'HAUPTBUS — REAKT', flag: 'onReactorBus' },
    { text: 'HYDRAULIK — EIN', flag: 'hydraulicsReady' },
    { text: 'MONITORE — TEST', flag: 'monitorsTested' },
    { text: 'GYRO — AUSRICHTEN (10 s)', flag: 'gyroAligned' },
    { text: 'SENSOREN — EIN', flag: 'sensorsReady' },
    { text: 'SCHILDE — EIN', flag: 'shieldsReady' },
    { text: 'WAFFEN — KAPPE AUF, SCHARF', flag: 'weaponsReady' },
    { text: 'BEINSPERRE — LÖSEN', flag: 'legsReleased' },
    { text: 'ZÜNDUNG KREIS 2 — KAPPE AUF, ZÜNDEN', flag: 'reactor2Running', requires: 'extraCircuit' },
    { text: 'BETRIEBSART — BETR (VOLLE LEISTUNG)', flag: 'reactorFull' },
  ],
  simple: [
    { text: 'BATTERIE — EIN', flag: 'batteryOn' },
    { text: 'ZÜNDUNG — NACH VORHEIZ OK ZÜNDEN', flag: 'reactorRunning' },
    { text: 'MONITORE — TEST', flag: 'monitorsTested' },
    { text: 'WAFFEN — KAPPE AUF, SCHARF', flag: 'weaponsReady' },
    { text: 'BEINSPERRE — LÖSEN', flag: 'legsReleased' },
  ],
  restart: [
    { text: 'KÜHLPUMPEN — DRUCK PRÜFEN', flag: 'coolantOk' },
    { text: 'BETRIEBSART — VORH, VORHEIZ OK', flag: 'preheatOk' },
    { text: 'ZÜNDKAPPE — SCHLIESSEN, ÖFFNEN', flag: 'ignitionReset' },
    { text: 'ZÜNDUNG — NEU ZÜNDEN', flag: 'reactorRunning' },
    { text: 'HAUPTBUS — REAKT', flag: 'onReactorBus' },
    { text: 'ZÜNDUNG KREIS 2 — NEU ZÜNDEN', flag: 'reactor2Running', requires: 'extraCircuit' },
    { text: 'BETRIEBSART — BETR', flag: 'reactorFull' },
  ],
};

/**
 * Script for the simple and automatic start. Each step runs its actions
 * one after another, then waits for its flag. `player` lists the start
 * modes in which the pilot does this step himself (automation waits).
 * Actions: ['guard', id, open] ['set', id, value] ['press', id] ['release', id] ['wait', s]
 * `retry` runs if the flag is not reached within `timeout` seconds;
 * `skipIf` flags mark a step as already behind us (e.g. APU after the bus transfer).
 */
export const STARTUP_SCRIPT = [
  { id: 'battery', player: ['simple'], actions: [['guard', 'batteryMaster', true], ['set', 'batteryMaster', 1]], flag: 'batteryOn' },
  { id: 'apu', skipIf: ['onReactorBus', 'reactorRunning'], actions: [['press', 'apuStart']], flag: 'apuReady', after: [['release', 'apuStart']], timeout: 12, retry: [['release', 'apuStart'], ['wait', 1], ['press', 'apuStart']] },
  { id: 'coolant', actions: [['set', 'coolantPumps', 1]], flag: 'coolantOk', timeout: 9, retry: [['set', 'coolantPumps', 0], ['wait', 0.5], ['set', 'coolantPumps', 1]] },
  { id: 'preheat', skipIf: ['reactorRunning'], actions: [['set', 'reactorMode', 1]], flag: 'preheatOk', timeout: 20 },
  { id: 'ignition', player: ['simple'], actions: [['guard', 'reactorIgnition', true], ['set', 'reactorIgnition', 1]], flag: 'reactorRunning', timeout: 8, retry: [['set', 'reactorIgnition', 0], ['set', 'reactorIgnition', 1]] },
  { id: 'bus', actions: [['set', 'mainBus', 1]], flag: 'onReactorBus' },
  { id: 'hydraulics', actions: [['set', 'hydraulics', 1]], flag: 'hydraulicsReady', timeout: 12 },
  { id: 'monitors', player: ['simple'], actions: [['press', 'systemTest'], ['wait', 0.3], ['release', 'systemTest']], flag: 'monitorsTested', timeout: 15 },
  { id: 'gyro', actions: [['press', 'gyroAlign'], ['wait', 0.3], ['release', 'gyroAlign']], flag: 'gyroAligned', timeout: 13, retry: [['press', 'gyroAlign'], ['wait', 0.3], ['release', 'gyroAlign']] },
  { id: 'sensors', actions: [['set', 'sensors', 1]], flag: 'sensorsReady' },
  { id: 'shields', actions: [['set', 'shields', 1]], flag: 'shieldsReady' },
  { id: 'weapons', player: ['simple'], actions: [['guard', 'weaponsArm', true], ['set', 'weaponsArm', 1]], flag: 'weaponsReady' },
  { id: 'legs', player: ['simple'], actions: [['guard', 'legLock', true], ['set', 'legLock', 1]], flag: 'legsReleased' },
  { id: 'circuit2', requires: 'extraCircuit', actions: [['guard', 'reactor2Ignition', true], ['set', 'reactor2Ignition', 1]], flag: 'reactor2Running', timeout: 8 },
  { id: 'fullPower', actions: [['set', 'reactorMode', 2]], flag: 'reactorFull' },
];
