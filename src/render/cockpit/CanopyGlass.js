import * as THREE from 'three';
import { makeCanvas, canvasTexture, rng } from './canvasKit.js';

/**
 * Procedural armoured-glass texture: light tint, scratches, theater grime
 * collecting at the lower edge, specks and smudges.
 */
export function createGlassMaterial(canopy, grime, seed = 9) {
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  const tint = new THREE.Color(canopy.tint);
  const g = new THREE.Color(grime?.color ?? '#7a776c');
  const amount = grime?.amount ?? 0.4;
  const rgba = (col, a) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;

  ctx.fillStyle = rgba(tint, canopy.glassOpacity);
  ctx.fillRect(0, 0, size, size);

  // Grime builds up from the bottom edge and in the corners.
  const bottom = ctx.createLinearGradient(0, size, 0, size * 0.55);
  bottom.addColorStop(0, rgba(g, 0.55 * amount));
  bottom.addColorStop(1, rgba(g, 0));
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, size, size);
  for (const [cx, cy] of [[0, 0], [size, 0], [0, size], [size, size]]) {
    const r = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.35);
    r.addColorStop(0, rgba(g, 0.35 * amount));
    r.addColorStop(1, rgba(g, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
  }

  // Smudges
  for (let i = 0; i < 14; i++) {
    const x = rand() * size;
    const y = size * (0.35 + rand() * 0.65);
    const r = 20 + rand() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rgba(g, 0.12 * amount));
    grad.addColorStop(1, rgba(g, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Specks
  for (let i = 0; i < 500 * amount + 80; i++) {
    const x = rand() * size;
    const y = size * Math.sqrt(rand());
    ctx.fillStyle = rgba(g, 0.2 + rand() * 0.4);
    ctx.fillRect(x, y, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }

  // Scratches: thin bright arcs
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 6 + rand() * 70;
    const ang = rand() * Math.PI;
    const bend = (rand() - 0.5) * 0.6;
    ctx.strokeStyle = `rgba(235,240,235,${0.03 + rand() * 0.08})`;
    ctx.lineWidth = rand() < 0.85 ? 0.7 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5,
      x + Math.cos(ang) * len, y + Math.sin(ang) * len,
    );
    ctx.stroke();
  }

  const texture = canvasTexture(c);
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
