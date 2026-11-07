import * as THREE from 'three';
import { TEXTURES, TERRAIN_LAYERS, TERRAIN_DEFAULT, MATERIAL_GROUPS, GROUP_TEXTURES } from '../data/textures.js';
import { DEFAULT_MATERIAL_COLORS } from '../data/props.js';

/**
 * Low-res detail textures (data/textures.js): decoded once at start, packed into
 * two texture arrays — terrain (7 layers per theater) and objects (one layer per
 * material group) — and patched into the Lambert materials of terrain, buildings,
 * scatter and walkers. The texture only modulates brightness; colour stays the
 * palette's: colour × (1 + (texture − 0.5) × 2 × strength).
 *
 * Settings: filter 'nearest' (pixelated, software-renderer look) or 'linear'
 * (bilinear + trilinear between mipmaps, early 3D-card look); on/off; debug view
 * of the ground-type mask.
 */
const PNGS = import.meta.glob('../../assets/textures/*.png', { query: '?inline', import: 'default', eager: true });
const SIZE = 128;

const pixels = new Map(); // id → Uint8Array(SIZE²)
let readyPromise = null;
const terrainArrays = new Map(); // theater key → DataArrayTexture
let objectArray = null;
const allTextures = new Set();

/** Shared uniforms: changing .value reaches every patched material at once. */
export const DETAIL = {
  on: { value: 1 },
  mask: { value: 0 },
  objStrength: { value: 0.28 },
  objTiles: { value: new Array(MATERIAL_GROUPS.length).fill(4) },
  palette: { value: MATERIAL_GROUPS.map(() => new THREE.Color(1, 1, 1)) },
  objTex: { value: null },
  filter: 'linear',
  scale: 1, // option Detailtexturen: factor on the theater's terrain strength
  missing: [],
  terrain: new Set(), // own uniforms of every patched terrain material
};

/** Decodes all embedded PNGs (async, a few ms). Resolves even if some fail. */
export function loadDetailTextures() {
  readyPromise ??= Promise.all(Object.entries(PNGS).map(([path, url]) => new Promise((resolve) => {
    const id = path.split('/').pop().replace('.png', '');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = SIZE;
      c.height = SIZE;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(img, 0, 0, SIZE, SIZE);
      const rgba = g.getImageData(0, 0, SIZE, SIZE).data;
      const out = new Uint8Array(SIZE * SIZE);
      for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4];
      pixels.set(id, out);
      resolve();
    };
    img.onerror = () => {
      DETAIL.missing.push(id);
      resolve();
    };
    img.src = url;
  }))).then(() => {
    for (const id of Object.keys(TEXTURES)) if (!pixels.has(id) && !DETAIL.missing.includes(id)) DETAIL.missing.push(id);
    if (DETAIL.missing.length) console.warn('Detailtexturen fehlen:', DETAIL.missing.join(', '));
    buildObjectArray();
  });
  return readyPromise;
}

function layerData(ids) {
  const data = new Uint8Array(SIZE * SIZE * ids.length);
  ids.forEach((id, i) => {
    const px = id && pixels.get(id);
    if (px) data.set(px, i * SIZE * SIZE);
    else data.fill(128, i * SIZE * SIZE, (i + 1) * SIZE * SIZE); // neutral grey: no detail
  });
  return data;
}

function makeArray(ids) {
  const tex = new THREE.DataArrayTexture(layerData(ids), SIZE, SIZE, ids.length);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  applyFilter(tex);
  tex.needsUpdate = true;
  allTextures.add(tex);
  return tex;
}

function applyFilter(tex) {
  const nearest = DETAIL.filter === 'nearest';
  tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  tex.minFilter = nearest ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 1;
}

/** 'nearest' | 'linear' — Optionen → Grafik → Texturfilter. */
export function setDetailFilter(mode) {
  DETAIL.filter = mode === 'nearest' ? 'nearest' : 'linear';
  for (const t of allTextures) {
    applyFilter(t);
    t.needsUpdate = true;
  }
}

export function setDetailEnabled(on) {
  DETAIL.on.value = on ? 1 : 0;
}

/** Option strength factor (also for terrains already built). */
export function setDetailScale(k) {
  DETAIL.scale = k;
  DETAIL.objStrength.value = 0.28 * k;
  for (const own of DETAIL.terrain) own.uTerrStrength.value = own.base * k;
}

function buildObjectArray() {
  const ids = MATERIAL_GROUPS.map((g) => GROUP_TEXTURES[g] ?? null);
  objectArray = makeArray(ids);
  DETAIL.objTex.value = objectArray;
  DETAIL.objTiles.value = ids.map((id) => TEXTURES[id]?.tile ?? 4);
}

/** Theater colours of the material groups (external models are tinted with them). */
export function setMaterialPalette(colors = {}) {
  MATERIAL_GROUPS.forEach((g, i) => {
    DETAIL.palette.value[i].set(colors[g] ?? DEFAULT_MATERIAL_COLORS[g] ?? '#ffffff');
  });
}

/** Terrain texture array and settings for a theater (theater.detail overrides TERRAIN_DEFAULT). */
export function terrainDetail(theater) {
  const cfg = { ...TERRAIN_DEFAULT, ...(theater.detail ?? {}) };
  const key = TERRAIN_LAYERS.map((l) => cfg[l]).join('|');
  if (!terrainArrays.has(key)) terrainArrays.set(key, makeArray(TERRAIN_LAYERS.map((l) => cfg[l])));
  return {
    texture: terrainArrays.get(key),
    tiles: TERRAIN_LAYERS.map((l) => (cfg.tiles?.[l] ?? TEXTURES[cfg[l]]?.tile ?? 10)),
    strength: cfg.strength,
    ids: TERRAIN_LAYERS.map((l) => cfg[l]),
  };
}

// ---------------------------------------------------------------- shaders

const TERRAIN_VERT_HEAD = /* glsl */ `
attribute vec3 surfA;
attribute vec2 surfB;
varying vec3 vSurfA;
varying vec2 vSurfB;
varying vec3 vDetWPos;
varying vec3 vDetWNor;
`;
const TERRAIN_VERT = /* glsl */ `
vSurfA = surfA;
vSurfB = surfB;
vDetWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vDetWNor = normalize(mat3(modelMatrix) * objectNormal);
`;
const TERRAIN_FRAG_HEAD = /* glsl */ `
uniform highp sampler2DArray uTerrTex;
uniform float uTerrTile[7];
uniform float uTerrStrength;
uniform float uRockSlope;
uniform float uChunk;
uniform float uDetailOn;
uniform float uMaskView;
varying vec3 vSurfA;
varying vec2 vSurfB;
varying vec3 vDetWPos;
varying vec3 vDetWNor;
float detLayer(float i, vec2 p1, vec2 p2, float tile) {
  return texture(uTerrTex, vec3(p1 / tile, i)).r * 0.62 + texture(uTerrTex, vec3(p2 / (tile * 2.7), i)).r * 0.38;
}
`;
const TERRAIN_FRAG = /* glsl */ `
if (uDetailOn > 0.5 || uMaskView > 0.5) {
  float rock = smoothstep(uRockSlope + 0.05, uRockSlope - 0.07, vDetWNor.y);
  float keep = 1.0 - rock;
  float wSoft = vSurfA.x * keep, wShore = vSurfA.y * keep, wLava = vSurfA.z * keep, wIce = vSurfB.x * keep, wRoad = vSurfB.y * keep;
  float wHard = max(0.0, keep - wSoft - wShore - wLava - wIce - wRoad);
  if (uMaskView > 0.5) {
    diffuseColor.rgb = wHard * vec3(0.55) + wSoft * vec3(0.55, 0.36, 0.18) + rock * vec3(0.2)
      + wShore * vec3(0.2, 0.45, 0.9) + wLava * vec3(0.95, 0.2, 0.08) + wIce * vec3(0.3, 0.95, 0.95) + wRoad * vec3(0.95, 0.85, 0.2);
  } else {
    vec2 p = vDetWPos.xz;
    // first layer turned a little per terrain chunk, second layer larger and turned 37°
    vec2 ch = floor(p / uChunk);
    float a = (fract(sin(dot(ch, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.35;
    vec2 p1 = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
    vec2 p2 = mat2(0.7986, -0.6018, 0.6018, 0.7986) * p;
    float d = 0.0;
    if (wHard > 0.003) d += wHard * detLayer(0.0, p1, p2, uTerrTile[0]);
    if (wSoft > 0.003) d += wSoft * detLayer(1.0, p1, p2, uTerrTile[1]);
    if (wShore > 0.003) d += wShore * detLayer(3.0, p1, p2, uTerrTile[3]);
    if (wLava > 0.003) d += wLava * detLayer(4.0, p1, p2, uTerrTile[4]);
    if (wIce > 0.003) d += wIce * detLayer(5.0, p1, p2, uTerrTile[5]);
    if (wRoad > 0.003) d += wRoad * detLayer(6.0, p1, p2, uTerrTile[6]);
    if (rock > 0.003) {
      // cliffs: triplanar, so steep faces don't smear
      vec3 n = pow(abs(vDetWNor), vec3(4.0));
      n /= (n.x + n.y + n.z);
      float t = uTerrTile[2];
      float r = texture(uTerrTex, vec3(vDetWPos.zy / t, 2.0)).r * n.x
        + texture(uTerrTex, vec3(vDetWPos.xz / t, 2.0)).r * n.y
        + texture(uTerrTex, vec3(vDetWPos.xy / t, 2.0)).r * n.z;
      d += rock * r;
    }
    float fade = 1.0 - smoothstep(450.0, 1100.0, distance(vDetWPos, cameraPosition));
    diffuseColor.rgb *= 1.0 + (d - 0.5) * 2.0 * uTerrStrength * fade;
  }
}
`;

/**
 * Patches a terrain material (MeshLambertMaterial with vertex colours; geometry
 * carries surfA = soft/shore/lava, surfB = ice/road weights).
 */
export function patchTerrainMaterial(material, theater, chunkSize) {
  const det = terrainDetail(theater);
  const own = {
    uTerrTex: { value: det.texture },
    uTerrTile: { value: det.tiles },
    uTerrStrength: { value: det.strength },
    uRockSlope: { value: theater.palette.rockSlope ?? 0.8 },
    uChunk: { value: chunkSize },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, own, { uDetailOn: DETAIL.on, uMaskView: DETAIL.mask });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TERRAIN_VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${TERRAIN_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TERRAIN_FRAG_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${TERRAIN_FRAG}`);
  };
  material.customProgramCacheKey = () => 'terrain-detail';
  material.userData.detail = own;
  own.base = det.strength;
  own.uTerrStrength.value = det.strength * DETAIL.scale;
  DETAIL.terrain.add(own);
  material.addEventListener('dispose', () => DETAIL.terrain.delete(own));
  return own;
}

const OBJ_VERT_HEAD = /* glsl */ `
#ifdef DETAIL_ATTR
attribute float mat;
#endif
varying float vDetMat;
varying vec3 vDetPos;
varying vec3 vDetNor;
`;
const OBJ_VERT = /* glsl */ `
#ifdef DETAIL_ATTR
vDetMat = mat;
#else
vDetMat = DETAIL_GROUP;
#endif
vDetPos = position;
vDetNor = normal;
`;
const OBJ_FRAG_HEAD = /* glsl */ `
uniform highp sampler2DArray uObjTex;
uniform float uObjTiles[${MATERIAL_GROUPS.length}];
uniform vec3 uMatPalette[${MATERIAL_GROUPS.length}];
uniform float uObjStrength;
uniform float uDetailOn;
varying float vDetMat;
varying vec3 vDetPos;
varying vec3 vDetNor;
`;
const OBJ_FRAG = /* glsl */ `
{
  int g = int(vDetMat + 0.5);
  if (g >= 16) {
    // external model: colour from the theater palette of its group
    g -= 16;
    diffuseColor.rgb *= uMatPalette[g];
  }
  if (g > 0 && uDetailOn > 0.5) {
    vec3 n = pow(abs(normalize(vDetNor)), vec3(4.0));
    n /= (n.x + n.y + n.z);
    float t = uObjTiles[g];
    float l = float(g);
    float d = texture(uObjTex, vec3(vDetPos.zy / t, l)).r * n.x
      + texture(uObjTex, vec3(vDetPos.xz / t, l)).r * n.y
      + texture(uObjTex, vec3(vDetPos.xy / t, l)).r * n.z;
    diffuseColor.rgb *= 1.0 + (d - 0.5) * 2.0 * uObjStrength;
  }
}
`;

/**
 * Patches an object material: groups come from the geometry attribute `mat`
 * (parts, props), or a fixed group for the whole material (walkers).
 */
export function patchObjectMaterial(material, { group = null } = {}) {
  const fixed = group ? MATERIAL_GROUPS.indexOf(group) : -1;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uObjTex: DETAIL.objTex, uObjTiles: DETAIL.objTiles, uMatPalette: DETAIL.palette, uObjStrength: DETAIL.objStrength, uDetailOn: DETAIL.on,
    });
    const def = fixed >= 0 ? `#define DETAIL_GROUP ${fixed.toFixed(1)}\n` : '#define DETAIL_ATTR\n';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `${def}#include <common>\n${OBJ_VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${OBJ_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${OBJ_FRAG_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${OBJ_FRAG}`);
  };
  material.customProgramCacheKey = () => `object-detail:${fixed}`;
  return material;
}

/** Debug overlay line. */
export function detailDebugLine() {
  return `Texturen ${DETAIL.on.value ? 'an' : 'aus'} · Filter ${DETAIL.filter === 'nearest' ? 'pixelig' : 'gefiltert'}${DETAIL.mask.value ? ' · BODENMASKE' : ''} · ${pixels.size}/${Object.keys(TEXTURES).length} geladen${DETAIL.missing.length ? ` · FEHLT: ${DETAIL.missing.join(', ')}` : ''}`;
}
