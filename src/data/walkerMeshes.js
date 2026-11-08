/**
 * Detailed walker models (assets/walkers/<geometry id>.glb), made from the Tripo exports by
 * tools/import_walkers.py. A walker or Synthesis machine whose geometry id has a file here
 * uses it (render/walker/WalkerMeshes.js); the others keep their procedural plan.
 * tools/check_credits.mjs checks every file against this list and CREDITS.md.
 */
export const WALKER_MESH_SOURCE = {
  name: 'STEEL WARDEN Tripo-Modelle (Walker und Synthese)', author: 'Rene, erzeugt mit Tripo AI',
  license: 'Eigene Rechte (bezahlter Tripo-Tarif)', url: 'https://www.tripo3d.ai',
};

/** geometry id → Tripo export (part of its file name) */
export const WALKER_MESHES = {
  kestrel: '48bcf456', marder: 'c5e00fdf', bastion: '0703d8eb', halberd: '3b58ed91', goliath: 'ab02f98f', koloss: '3fe731e4',
  splitter: '3acfe2bc', sichel: 'ab4af61d', monolith: '580c0898',
};

/**
 * Where the weapons sit on the detailed models: hardpoint id → attach part (the walker part
 * the muzzles ride on) and the search for the modelled barrels (render/walker/muzzleFinder.js).
 * Model space in metres, game forward -Z, x < 0 is the walker's left. A hardpoint not listed
 * here keeps the position carried over from the procedural plan.
 */
const T = (box, barrels = 1, segs = ['torso', 'sensors']) => ({ segs, box, barrels });
const A = (seg, barrels = 1, box = null) => ({ segs: [seg], box, barrels });
export const WALKER_MESH_MOUNTS = {
  kestrel: {
    LA: { attach: 'armL', search: [A('armL', 2)] },                                   // twin chin gun left
    RA: { attach: 'armR', search: [A('armR', 2)] },                                   // twin chin gun right
    CT: { attach: 'torso', search: [T([[-0.4, 0.4], [4.8, 5.6], null])] },            // slot under the canopy
    TS: { attach: 'torso', search: [T([[-2, -1.0], [6.6, 8], [0.3, 3]]), T([[1.0, 2], [6.6, 8], [0.3, 3]])] }, // grille pods
  },
  marder: {
    LA: { attach: 'armL', search: [A('armL', 2)] },
    RA: { attach: 'armR', search: [A('armR', 1)] },
    LT: { attach: 'torso', search: [T([[-1.6, -0.2], [7.0, 8.1], null])] },
    RT: { attach: 'torso', search: [T([[0.2, 1.6], [7.0, 8.1], null])] },
  },
  bastion: {
    RA: { attach: 'armR', search: [A('armR', 2)] },                                   // twin cannon
    LA: { attach: 'armL', search: [A('armL', [2, 2])] },                              // 2×2 rack
    LS: { attach: 'torso', search: [T([[-4, -1.9], [9.4, 11], null])] },              // shoulder box (X hatch)
    RS: { attach: 'torso', search: [T([[1.9, 4], [9.4, 11], null])] },                // shoulder box (vents)
    CT: { attach: 'torso', search: [T([[-0.6, 0.6], [8.0, 9.4], null])] },            // under the canopy
  },
  halberd: {
    LS: { attach: 'torso', search: [T([[-6, -2], [10.2, 13], null], [3, 3])] },
    RS: { attach: 'torso', search: [T([[2, 6], [10.2, 13], null], [3, 3])] },
    LA: { attach: 'armL', search: [A('armL', 1, [null, [4.5, 7.5], null])] },          // fist
    RA: { attach: 'armR', search: [A('armR', 1, [null, [4.5, 7.5], null])] },
  },
  goliath: {
    RA: { attach: 'armR', search: [A('armR', 2)] },
    LA: { attach: 'armL', search: [A('armL', [2, 2])] },
    LT: { attach: 'torso', search: [T([[-1.6, -0.4], [11.2, 13], null])] },
    RT: { attach: 'torso', search: [T([[0.4, 1.6], [11.2, 13], null])] },
  },
  koloss: {
    LA: { attach: 'armL', search: [A('armL', 3)] },
    RA: { attach: 'armR', search: [A('armR', 3)] },
    LS: { attach: 'torso', search: [T([[-2.4, -0.6], [11, 12.6], null], [2, 2])] },
    RS: { attach: 'torso', search: [T([[0.6, 2.4], [11, 12.6], null], [2, 2])] },
    LT: { attach: 'torso', search: [T([[-2.4, -0.6], [9.2, 11], null], [2, 2])] },
    RT: { attach: 'torso', search: [T([[0.6, 2.4], [9.2, 11], null], [2, 2])] },
  },
  splitter: {
    LT: { attach: 'torso', search: [T([[-1.8, -0.6], [3.9, 5.6], null])] },          // emitter on its boom
    CT: { attach: 'torso', search: [T([[-0.8, 0.8], [3.6, 5.0], null])] },            // red eye
  },
  sichel: {
    LA: { attach: 'armL', search: [A('armL', 1, [null, [3.8, 6.4], null])] },         // crystal claw
    RA: { attach: 'armR', search: [A('armR', 1, [null, [3.8, 6.4], null])] },
    CT: { attach: 'torso', search: [T([[-0.8, 0.8], [6.5, 8.6], null])] },            // chest crystal
  },
  monolith: {
    RA: { attach: 'armR', search: [A('armR', 1)] },                                   // hex cannon
    LA: { attach: 'armL', search: [A('armL', [2, 3], [[-5.5, -2.5], [9, 12.5], null])] }, // 6-tube rack
    CT: { attach: 'torso', search: [T([[-1.5, 1.5], [9, 12.5], null])] },             // chest crystal
  },
};
