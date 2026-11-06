/**
 * Weapons. Units: damage per hit (beams: per second), range m, speeds m/s,
 * fireRate shots per second (per trigger cycle), chargeTime / reloadTime s,
 * energyCost per shot (beams: per second) from the weapon capacitor,
 * heatPerShot heat units (beams: per second; 1 unit ≈ 5.5 °C core temperature
 * on a walker with heatCapacity 100), spread in degrees (cone half angle).
 *
 * type        'energy' | 'ballistic' | 'missile' | 'universal'
 * size        'S' | 'M' | 'L' — fits a hardpoint of the same or a larger size
 * damageType  'energy' | 'ballistic' | 'missile' | 'emp'
 * vsShield    multiplier against shields, vsArmor against armour
 * kind        'bolt' (projectile) | 'beam' (continuous ray) | 'missile'
 * burst       projectiles per shot (pellets / missile salvo), burstGap s between them
 * ammoPerMagazine  shots before reloading (null = energy weapon, unlimited)
 * ammoPerTon  reserve ammunition carried (one ton per weapon for now)
 * guidance    missiles: selectable modes ['dumb', 'active', 'semiActive', 'antiRadar', 'optical'];
 *             null for everything else. lockTime = lock needed for active / semiActive.
 * missile     flight model: launchSpeed m/s, thrust m/s², maxSpeed m/s, burnTime s (then
 *             ballistic), turnRate °/s, seekerCone ° (half angle), semiActiveBonus (damage
 *             factor), loft (climbs first when guided)
 * kind 'equipment'  carried, never fires (targetPod: component selection with Tab)
 * effect      optional: { kind: 'disrupt' | 'emp', time } — electronics / shields knocked out
 * visual.model  weapon model on the hardpoint (render/walker/WeaponModels.js)
 */
export const WEAPONS = {
  'lux-12': {
    id: 'lux-12', name: 'LUX-12 Impulslaser', short: 'LUX-12', type: 'energy', size: 'S', weight: 1.0,
    kind: 'bolt', damage: 8, damageType: 'energy', vsShield: 1.5, vsArmor: 0.8,
    range: 350, projectileSpeed: 900, fireRate: 4, chargeTime: 0, energyCost: 4, heatPerShot: 1.2,
    ammoPerMagazine: null, reloadTime: 0, ammoPerTon: null, spread: 0.3, burst: 1, lockTime: 0, guidance: null,
    visual: { model: 'laser', muzzleFx: 'flashRed', projectileFx: 'boltRed', impactFx: 'sparks', color: '#ff4030', length: 3 },
    sound: 'weapon.laser',
  },
  'lux-40': {
    id: 'lux-40', name: 'LUX-40 Strahllaser', short: 'LUX-40', type: 'energy', size: 'M', weight: 3.0,
    kind: 'beam', damage: 40, damageType: 'energy', vsShield: 1.5, vsArmor: 0.8,
    range: 500, projectileSpeed: 0, fireRate: 0, chargeTime: 0, energyCost: 18, heatPerShot: 9,
    beamTime: 1.6, cooldown: 2.2,
    ammoPerMagazine: null, reloadTime: 0, ammoPerTon: null, spread: 0, burst: 1, lockTime: 0, guidance: null,
    visual: { model: 'beam', muzzleFx: 'flashRed', projectileFx: 'beamRed', impactFx: 'burn', color: '#ff3a24' },
    sound: 'weapon.beam',
  },
  'pz-9': {
    id: 'pz-9', name: 'PZ-9 Partikelwerfer', short: 'PZ-9', type: 'energy', size: 'L', weight: 6.0,
    kind: 'bolt', damage: 70, damageType: 'energy', vsShield: 1.4, vsArmor: 1.0,
    range: 700, projectileSpeed: 1400, fireRate: 0.3, chargeTime: 0, energyCost: 45, heatPerShot: 22,
    ammoPerMagazine: null, reloadTime: 0, ammoPerTon: null, spread: 0.1, burst: 1, lockTime: 0, guidance: null,
    effect: { kind: 'disrupt', time: 1.5 },
    visual: { model: 'particle', muzzleFx: 'flashBlue', projectileFx: 'orbBlue', impactFx: 'plasma', color: '#7ab8ff', length: 6 },
    sound: 'weapon.particle',
  },
  'ak-20': {
    id: 'ak-20', name: 'AK-20 Autokanone', short: 'AK-20', type: 'ballistic', size: 'M', weight: 4.0,
    kind: 'bolt', damage: 6, damageType: 'ballistic', vsShield: 0.5, vsArmor: 1.4,
    range: 600, projectileSpeed: 900, fireRate: 10, chargeTime: 0, energyCost: 0.5, heatPerShot: 0.6,
    ammoPerMagazine: 30, reloadTime: 2.5, ammoPerTon: 300, spread: 0.3, burst: 1, lockTime: 0, guidance: null,
    visual: { model: 'autocannon', muzzleFx: 'flashYellow', projectileFx: 'tracer', impactFx: 'sparks', color: '#ffd27a', length: 4 },
    sound: 'weapon.autocannon',
  },
  'sr-3': {
    id: 'sr-3', name: 'SR-3 Schienenkanone', short: 'SR-3', type: 'ballistic', size: 'L', weight: 7.0,
    kind: 'bolt', damage: 85, damageType: 'ballistic', vsShield: 0.6, vsArmor: 1.5,
    range: 1400, projectileSpeed: 3500, fireRate: 0.25, chargeTime: 1.2, energyCost: 35, heatPerShot: 18,
    ammoPerMagazine: 4, reloadTime: 4, ammoPerTon: 20, spread: 0.05, burst: 1, lockTime: 0, guidance: null,
    visual: { model: 'railgun', muzzleFx: 'flashBlue', projectileFx: 'slug', impactFx: 'heavy', color: '#d8f0ff', length: 14 },
    sound: 'weapon.railgun',
  },
  'sk-6': {
    id: 'sk-6', name: 'SK-6 Schrotgeschütz', short: 'SK-6', type: 'ballistic', size: 'S', weight: 1.5,
    kind: 'bolt', damage: 4, damageType: 'ballistic', vsShield: 0.5, vsArmor: 1.3,
    range: 180, projectileSpeed: 700, fireRate: 1, chargeTime: 0, energyCost: 1, heatPerShot: 3,
    ammoPerMagazine: 6, reloadTime: 2.2, ammoPerTon: 60, spread: 4, burst: 10, burstGap: 0, lockTime: 0, guidance: null,
    visual: { model: 'shotgun', muzzleFx: 'flashYellow', projectileFx: 'pellet', impactFx: 'sparks', color: '#ffcf80', length: 1.5 },
    sound: 'weapon.shotgun',
  },
  'falke-4': {
    id: 'falke-4', name: 'FALKE-4 Kurzstreckenraketen', short: 'FALKE-4', type: 'missile', size: 'S', weight: 1.5,
    kind: 'missile', damage: 12, damageType: 'missile', vsShield: 0.6, vsArmor: 1.2,
    range: 400, projectileSpeed: 220, fireRate: 0.4, chargeTime: 0, energyCost: 2, heatPerShot: 3,
    ammoPerMagazine: 4, reloadTime: 4, ammoPerTon: 40, spread: 1.5, burst: 4, burstGap: 0.08, lockTime: 0,
    guidance: ['dumb', 'antiRadar'],
    missile: { launchSpeed: 70, thrust: 160, maxSpeed: 240, burnTime: 2.2, turnRate: 45, seekerCone: 35 },
    visual: { model: 'rocketPod', muzzleFx: 'flashYellow', projectileFx: 'rocket', impactFx: 'blast', color: '#ffb050', length: 1.2 },
    sound: 'weapon.rocket',
  },
  'habicht-8': {
    id: 'habicht-8', name: 'HABICHT-8 Lenkraketen', short: 'HABICHT-8', type: 'missile', size: 'M', weight: 3.5,
    kind: 'missile', damage: 9, damageType: 'missile', vsShield: 0.6, vsArmor: 1.2,
    range: 800, projectileSpeed: 180, fireRate: 0.17, chargeTime: 0, energyCost: 3, heatPerShot: 2,
    ammoPerMagazine: 8, reloadTime: 6, ammoPerTon: 64, spread: 3, burst: 8, burstGap: 0.1, lockTime: 2,
    guidance: ['dumb', 'active', 'semiActive', 'antiRadar'],
    missile: { launchSpeed: 55, thrust: 120, maxSpeed: 200, burnTime: 4.5, turnRate: 75, seekerCone: 50, semiActiveBonus: 1.3 },
    visual: { model: 'missileBox', muzzleFx: 'flashYellow', projectileFx: 'rocket', impactFx: 'blast', color: '#ffb050', length: 1.4 },
    sound: 'weapon.rocket',
  },
  speer: {
    id: 'speer', name: 'SPEER Langstreckenrakete', short: 'SPEER', type: 'missile', size: 'L', weight: 6.0,
    kind: 'missile', damage: 90, damageType: 'missile', vsShield: 0.6, vsArmor: 1.3,
    range: 1500, projectileSpeed: 160, fireRate: 0.12, chargeTime: 0, energyCost: 6, heatPerShot: 8,
    ammoPerMagazine: 1, reloadTime: 8, ammoPerTon: 8, spread: 0.5, burst: 1, lockTime: 2.5,
    guidance: ['dumb', 'active', 'semiActive', 'optical'],
    missile: { launchSpeed: 40, thrust: 70, maxSpeed: 150, burnTime: 11, turnRate: 40, seekerCone: 40, semiActiveBonus: 1.25, loft: true },
    blastRadius: 14,
    visual: { model: 'speer', muzzleFx: 'flashYellow', projectileFx: 'bigRocket', impactFx: 'bigBlast', color: '#ffb050', length: 3 },
    sound: 'weapon.speer',
  },
  'target-pod': {
    id: 'target-pod', name: 'ZK-1 Zielkapsel', short: 'ZIELKAPSEL', type: 'universal', size: 'S', weight: 1.0,
    kind: 'equipment', damage: 0, range: 0, energyCost: 0, heatPerShot: 0, fireRate: 0, burst: 0,
    ammoPerMagazine: null, guidance: null,
    visual: { model: 'pod', color: '#9fd8ff' },
  },
  'imp-2': {
    id: 'imp-2', name: 'IMP-2 EMP-Werfer', short: 'IMP-2', type: 'universal', size: 'M', weight: 3.0,
    kind: 'bolt', damage: 0, damageType: 'emp', vsShield: 0, vsArmor: 0,
    range: 400, projectileSpeed: 500, fireRate: 0.2, chargeTime: 0.6, energyCost: 50, heatPerShot: 10,
    ammoPerMagazine: null, reloadTime: 0, ammoPerTon: null, spread: 0.2, burst: 1, lockTime: 0, guidance: null,
    effect: { kind: 'emp', time: 4 },
    visual: { model: 'emp', muzzleFx: 'flashBlue', projectileFx: 'orbBlue', impactFx: 'emp', color: '#9fd8ff', length: 4 },
    sound: 'weapon.emp',
  },
};

/** Selectable guidance modes in rotary order (LENKUNG knob). */
export const GUIDANCE_MODES = ['dumb', 'active', 'semiActive', 'antiRadar', 'optical'];
export const GUIDANCE_LABELS = { dumb: 'UNGEL', active: 'AKTIV', semiActive: 'HALBAKT', antiRadar: 'ANTIRAD', optical: 'OPTISCH' };

export const SIZE_RANK = { S: 1, M: 2, L: 3 };

export function getWeapon(id) {
  const w = WEAPONS[id];
  if (!w) throw new Error(`Unknown weapon "${id}"`);
  return w;
}
