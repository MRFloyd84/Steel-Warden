import * as THREE from 'three';
import { makeCanvas, canvasTexture, fitText, rng, STENCIL_FONT } from './canvasKit.js';

/** Riveted metal type plate with walker designation, manufacturer and serial. */
export function buildNameplate(walker, width) {
  const W = 320;
  const H = 120;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = rng(walker.tonnage * 17);

  ctx.fillStyle = '#a7a593';
  ctx.fillRect(0, 0, W, H);
  // Brushed grain
  for (let y = 0; y < H; y++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.05})`;
    ctx.fillRect(0, y, W, 1);
  }
  ctx.strokeStyle = '#3f3e35';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  for (const [x, y] of [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]]) {
    ctx.fillStyle = '#5f5d50';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#1f1e19';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, walker.name, W / 2, 38, W - 60, 34, 'bold', STENCIL_FONT);
  fitText(ctx, walker.manufacturer.toUpperCase(), W / 2, 70, W - 60, 16, 'bold', STENCIL_FONT);
  fitText(ctx, `S/N ${walker.cockpit.serial}  ·  ${walker.tonnage} t`, W / 2, 94, W - 60, 15, 'normal', STENCIL_FONT);

  const texture = canvasTexture(c);
  const material = new THREE.MeshLambertMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (H / W)), material);
  mesh.position.z = 0.001;
  mesh.userData.dispose = () => {
    texture.dispose();
    material.dispose();
    mesh.geometry.dispose();
  };
  return mesh;
}
