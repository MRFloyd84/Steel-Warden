/**
 * Detailed walker models (assets/walkers/<geometry id>.glb), made from the Tripo exports by
 * tools/import_walkers.py. A walker or Synthesis machine whose geometry id has a file here
 * uses it (render/walker/WalkerMeshes.js); the others keep their procedural plan.
 * tools/check_credits.mjs checks every file against this list and CREDITS.md.
 */
export const WALKER_MESH_SOURCE = {
  name: 'STEEL WARDEN Tripo-Modelle (Walker und Synthese)', author: 'Rene, erzeugt mit Tripo AI',
  license: 'Tripo-Nutzungsbedingungen (siehe CREDITS.md)', url: 'https://www.tripo3d.ai',
};

/** geometry id → Tripo export (part of its file name) */
export const WALKER_MESHES = {
  kestrel: '48bcf456', marder: 'c5e00fdf', bastion: '0703d8eb', halberd: '3b58ed91', goliath: 'ab02f98f', koloss: '3fe731e4',
  splitter: '3acfe2bc', sichel: 'ab4af61d', monolith: '580c0898',
};
