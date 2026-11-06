import * as THREE from 'three';
import { hash2 } from '../../util/noise.js';

/** Canvas helpers shared by panel, glass, lamp and monitor textures. */

export const STENCIL_FONT = '"Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", Arial, sans-serif';
export const MONO_FONT = '"Lucida Console", "DejaVu Sans Mono", Consolas, monospace';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

export function canvasTexture(canvas, { mipmaps = true, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = mipmaps;
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
  } else if (!mipmaps) {
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}

/** Deterministic random stream for procedural textures. */
export function rng(seed) {
  let i = 0;
  return () => hash2(i++, 7, seed);
}

/** Fits text into maxWidth by shrinking the font size. */
export function fitText(ctx, text, x, y, maxWidth, sizePx, weight = 'bold', font = STENCIL_FONT) {
  let size = sizePx;
  ctx.font = `${weight} ${size}px ${font}`;
  while (size > 6 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${font}`;
  }
  ctx.fillText(text, x, y);
}

const labelCache = new Map();

/**
 * Label face for lamps and button caps: white field with dark text.
 * Used as map (dim lens) and emissiveMap (lit lens) at the same time.
 */
export function labelFaceTexture(text, aspect) {
  const key = `${text}|${aspect.toFixed(2)}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const h = 48;
  const w = Math.round(h * aspect);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split(' ');
  if (lines.length > 1 && aspect < 2.6) {
    fitText(ctx, lines[0], w / 2, h * 0.3, w * 0.9, h * 0.36);
    fitText(ctx, lines.slice(1).join(' '), w / 2, h * 0.72, w * 0.9, h * 0.36);
  } else {
    fitText(ctx, text, w / 2, h / 2 + 1, w * 0.88, h * 0.55);
  }
  const tex = canvasTexture(c);
  labelCache.set(key, tex);
  return tex;
}
