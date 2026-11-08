import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Cockpit model (assets/cockpit/cockpit.glb, made by tools/import_cockpit.py from the Tripo
 * export): one textured shell plus the two control grips as their own nodes (pivot at the grip
 * base). Embedded in the bundle, decoded once at start (meshopt), shared by every cockpit.
 *
 * Without the file (or if decoding fails) cockpits fall back to the procedural variants.
 */
const FILES = import.meta.glob('../../../assets/cockpit/*.glb', { query: '?inline', import: 'default', eager: true });

/** Option "Cockpit": modelled (default) or the procedural cockpits of the walker classes. */
export const COCKPIT_MODEL_USE = { enabled: true };

let cached = null; // { scene, triangles }
let failed = null;
let readyPromise = null;

function dataUrlToBuffer(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function loadCockpitModel() {
  readyPromise ??= (async () => {
    const url = Object.entries(FILES).find(([path]) => path.endsWith('/cockpit.glb'))?.[1];
    if (!url) {
      failed = 'Datei fehlt';
      return;
    }
    try {
      await MeshoptDecoder.ready;
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await new Promise((res, rej) => loader.parse(dataUrlToBuffer(url), '', res, rej));
      let triangles = 0;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.shared = true; // geometry and material belong to the cache, not to a cockpit
        o.material.userData.shared = true;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      });
      cached = { scene: gltf.scene, triangles };
    } catch (e) {
      failed = e.message ?? String(e);
      console.warn('Cockpit-Modell nicht geladen:', failed);
    }
  })();
  return readyPromise;
}

export const CockpitModelInfo = {
  get ready() { return !!cached; },
  get failed() { return failed; },
  get triangles() { return cached?.triangles ?? 0; },
};

/**
 * A placed instance (shares geometry and material with the cache): group in cockpit space
 * (eye at the origin) and the grip nodes by name.
 * @param placement { eye: model-space eye point, scale: metres per model unit }
 */
export function instantiateCockpitModel(placement) {
  if (!cached) return null;
  const model = cached.scene.clone(true);
  const s = placement.scale;
  model.scale.setScalar(s);
  model.position.set(-placement.eye[0] * s, -placement.eye[1] * s, -placement.eye[2] * s);
  model.name = 'cockpitModel';
  const grips = {};
  model.traverse((o) => {
    if (o.name?.startsWith('grip')) grips[o.name] = o;
  });
  return { object: model, grips, material: findMaterial(model) };
}

function findMaterial(root) {
  let mat = null;
  root.traverse((o) => {
    if (o.isMesh && !mat) mat = o.material;
  });
  return mat;
}
