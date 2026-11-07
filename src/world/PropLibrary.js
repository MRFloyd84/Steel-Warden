import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PROPS, PROP_PACKS, GROUP_RULES } from '../data/props.js';
import { MATERIAL_GROUPS } from '../data/textures.js';

/**
 * External environment models (data/props.js), embedded as data URLs and loaded
 * once at start. Materials and textures are dropped: each vertex keeps a
 * brightness (from its original colour) and a material group (vertex attribute
 * `mat` = group + 16, i.e. "tint with the theater palette"). The result is a
 * flat-shaded, non-indexed geometry in metres, centred on x/z, standing on y = 0.
 *
 * A missing or broken file becomes a placeholder box of the declared size
 * (striped, so it is easy to spot) and is listed in PropLibrary.missing.
 */
const FILES = import.meta.glob('../../assets/props/**/*.glb', { query: '?inline', import: 'default', eager: true });
const MAPS = import.meta.glob('../../assets/props/**/*.png', { query: '?inline', import: 'default', eager: true });
const PALETTED = 16;

const library = new Map(); // id → entry
const missing = [];
let readyPromise = null;

function fileUrl(pack, file) {
  return FILES[`../../assets/props/${pack}/${file}`] ?? null;
}

function dataUrlToBuffer(url) {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Pixel reader for a pack's colour map (decoded once). */
const colormaps = new Map();
function colormap(pack) {
  if (colormaps.has(pack)) return colormaps.get(pack);
  const name = PROP_PACKS[pack]?.colormap;
  const url = name && MAPS[`../../assets/props/${pack}/${name}`];
  const p = !url ? Promise.resolve(null) : new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      resolve({ w: img.width, h: img.height, data: g.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  colormaps.set(pack, p);
  return p;
}

function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function groupOf(r, g, b) {
  const c = hsv(r, g, b);
  return GROUP_RULES.find((rule) => rule.test(c)).group;
}

function parse(buffer) {
  return new Promise((resolve, reject) => {
    // Textures are never needed (dropped below); the colour map is read separately
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((u) => (u.startsWith('data:') ? u : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='));
    new GLTFLoader(manager).parse(buffer, '', resolve, reject);
  });
}

/** Converts a loaded glTF scene into one geometry with brightness + group per vertex. */
function convert(id, def, gltf, cmap) {
  const parts = [];
  const nodeBoxes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const n = g.attributes.position.count;
    const color = new Float32Array(n * 3);
    const mat = new Float32Array(n);
    const uv = g.attributes.uv;
    // material index per vertex (geometry groups) — usually one material
    const matIndex = new Int32Array(n);
    for (const grp of g.groups ?? []) for (let i = grp.start; i < grp.start + grp.count && i < n; i++) matIndex[i] = grp.materialIndex ?? 0;
    for (let i = 0; i < n; i++) {
      const m = mats[matIndex[i]] ?? mats[0];
      let r = m.color?.r ?? 0.8;
      let gg = m.color?.g ?? 0.8;
      let b = m.color?.b ?? 0.8;
      let [group, shade = 1] = (def.mats?.[m.name] ?? '').split(':');
      group ||= undefined;
      if (cmap && uv) {
        const x = Math.min(cmap.w - 1, Math.max(0, Math.floor((uv.getX(i) % 1 + 1) % 1 * cmap.w)));
        const y = Math.min(cmap.h - 1, Math.max(0, Math.floor((uv.getY(i) % 1 + 1) % 1 * cmap.h)));
        const k = (y * cmap.w + x) * 4;
        r = cmap.data[k] / 255;
        gg = cmap.data[k + 1] / 255;
        b = cmap.data[k + 2] / 255;
        group = undefined;
        shade = 1;
      }
      group ??= groupOf(r, gg, b);
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      // brightness only: the palette colour of the group does the rest
      const v = Math.min(1.25, Math.max(0.55, 0.65 + lum * 0.6)) * (def.tint ?? 1) * Number(shade);
      color[i * 3] = v;
      color[i * 3 + 1] = v;
      color[i * 3 + 2] = v;
      mat[i] = MATERIAL_GROUPS.indexOf(group) + PALETTED;
    }
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute('mat', new THREE.BufferAttribute(mat, 1));
    g.clearGroups();
    parts.push(g);
  });
  if (!parts.length) throw new Error('keine Meshes');
  const merged = mergeNonIndexed(parts);
  // Units → metres, own rotation, centred on x/z, standing on y = 0 (+ offset)
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(def.rot ?? [0, 0, 0]).map((a) => (a * Math.PI) / 180)));
  m.premultiply(new THREE.Matrix4().makeScale(def.scale, def.scale, def.scale));
  merged.applyMatrix4(m);
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  merged.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y + (def.y ?? 0), -(bb.min.z + bb.max.z) / 2);
  merged.computeVertexNormals(); // non-indexed: per-face normals (flat)
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  for (const p of parts) {
    p.applyMatrix4(m);
    p.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y + (def.y ?? 0), -(bb.min.z + bb.max.z) / 2);
    p.computeBoundingBox();
    nodeBoxes.push(p.boundingBox.clone());
    p.dispose();
  }
  return {
    id, geometry: merged, bounds: merged.boundingBox.clone(),
    boxes: def.hit === 'nodes' ? nodeBoxes : [merged.boundingBox.clone()],
    tris: merged.attributes.position.count / 3, missing: false,
  };
}

function mergeNonIndexed(list) {
  const count = list.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['color', 3], ['mat', 1]]) {
    const arr = new Float32Array(count * size);
    let o = 0;
    for (const g of list) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/** Placeholder: a box of the declared size with a warning-stripe band. */
function placeholder(id, def, reason) {
  const [w, h, d] = def.size ?? [4, 4, 4];
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(0, h / 2, 0);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const color = new Float32Array(n * 3);
  const mat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const stripe = Math.floor((g.attributes.position.getY(i) + g.attributes.position.getX(i)) / 1.5) % 2;
    color.set(stripe ? [1, 0.2, 0.8] : [0.15, 0.15, 0.15], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('mat', new THREE.BufferAttribute(mat, 1));
  g.computeBoundingBox();
  missing.push(`${id} (${reason})`);
  return { id, geometry: g, bounds: g.boundingBox.clone(), boxes: [g.boundingBox.clone()], tris: n / 3, missing: true };
}

/** Loads every prop of data/props.js (once). Resolves when all are done or failed. */
export function loadProps() {
  readyPromise ??= Promise.all(Object.entries(PROPS).map(async ([id, def]) => {
    const url = fileUrl(def.pack, def.file);
    if (!url) {
      library.set(id, placeholder(id, def, `Datei fehlt: ${def.pack}/${def.file}`));
      return;
    }
    try {
      const [gltf, cmap] = await Promise.all([parse(dataUrlToBuffer(url)), colormap(def.pack)]);
      library.set(id, convert(id, def, gltf, cmap));
    } catch (e) {
      library.set(id, placeholder(id, def, `Ladefehler: ${e.message ?? e}`));
    }
  })).then(() => {
    if (missing.length) console.warn('Props mit Platzhalter:', missing.join('; '));
  });
  return readyPromise;
}

/** Converted prop (or a placeholder if it isn't loaded / doesn't exist). */
export function propEntry(id) {
  const e = library.get(id);
  if (e) return e;
  const def = PROPS[id];
  const ph = placeholder(id, def ?? {}, def ? 'noch nicht geladen' : 'unbekannte Prop-ID');
  if (def) library.set(id, ph);
  return ph;
}

export const PropLibrary = {
  get missing() {
    return missing;
  },
  get loaded() {
    return [...library.values()].filter((e) => !e.missing).length;
  },
  /** Triangles per prop type, biggest first (debug overlay). */
  triangles() {
    return [...library.values()].map((e) => [e.id, e.tris]).sort((a, b) => b[1] - a[1]);
  },
};
