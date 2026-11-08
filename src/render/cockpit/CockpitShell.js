import * as THREE from 'three';
import { QuadWriter, blockGeometry, beamGeometry, colored, merge } from './geometry.js';
import { createGlassMaterial } from './CanopyGlass.js';

const DEG = Math.PI / 180;

/**
 * Static cockpit body built from the variant data: wall/window ring with
 * struts, roof and floor, blocks (seat, pedestals, glareshield, racks),
 * harness straps and cable bundles. Opaque parts are merged into one mesh.
 */
export function buildShell(variant, theater) {
  const canopy = variant.canopy;
  const colors = variant.colors;
  const col = (name) => colors[name] ?? name;

  const radiusAt = (y) => {
    if (y <= canopy.yLow) return canopy.radiusLow;
    if (y >= canopy.yHigh) return canopy.radiusHigh;
    const t = (y - canopy.yLow) / (canopy.yHigh - canopy.yLow);
    return canopy.radiusLow + (canopy.radiusHigh - canopy.radiusLow) * t;
  };
  const point = (deg, y) => {
    const r = radiusAt(y);
    return [r * Math.sin(deg * DEG), y, -r * Math.cos(deg * DEG)];
  };

  const walls = new QuadWriter();
  const glass = new QuadWriter();
  const opaque = [];
  const ringAngles = [];
  let paneIndex = 0;

  // Modelled cockpit: no wall ring; window panes are given as polygons (fan from the first point)
  for (const poly of variant.glass ?? []) {
    const span = paneSpan(poly);
    const u0 = paneIndex * 0.37;
    const uv = paneUv(poly);
    for (let i = 1; i < poly.length - 1; i++) {
      glass.triUv(poly[0], poly[i], poly[i + 1], '#ffffff', [uv[0], uv[i], uv[i + 1]].map(([u, v]) => [u0 + u * span, v]));
    }
    paneIndex++;
  }

  for (const seg of canopy.segments ?? []) {
    const win = seg.window;
    const steps = win ? 1 : Math.max(1, Math.ceil((seg.to - seg.from) / canopy.wallStepDeg));
    const heights = win
      ? [canopy.floor, canopy.yLow, win.sill, win.top, canopy.yHigh, canopy.roof]
      : [canopy.floor, canopy.yLow, canopy.yHigh, canopy.roof];
    const bands = [...new Set(heights)].filter((h) => h >= canopy.floor && h <= canopy.roof).sort((a, b) => a - b);

    for (let s = 0; s < steps; s++) {
      const a = seg.from + ((seg.to - seg.from) * s) / steps;
      const b = seg.from + ((seg.to - seg.from) * (s + 1)) / steps;
      ringAngles.push(a);
      for (let i = 0; i < bands.length - 1; i++) {
        const h0 = bands[i];
        const h1 = bands[i + 1];
        const quad = [point(a, h0), point(b, h0), point(b, h1), point(a, h1)];
        if (win && h0 >= win.sill - 1e-6 && h1 <= win.top + 1e-6) {
          const u0 = paneIndex * 0.37;
          const span = (b - a) / 45;
          glass.quad(...quad, '#ffffff', [u0, 0, u0 + span, 1]);
        } else {
          walls.quad(...quad, i === 0 ? col('wallDark') : col('wall'));
        }
      }
    }

    if (win) {
      paneIndex++;
      const t = canopy.strut;
      opaque.push(colored(beamGeometry(point(seg.from, win.sill), point(seg.from, win.top), t, t), col('frame')));
      opaque.push(colored(beamGeometry(point(seg.to, win.sill), point(seg.to, win.top), t, t), col('frame')));
      opaque.push(colored(beamGeometry(point(seg.from, win.sill), point(seg.to, win.sill), t, t), col('frame')));
      opaque.push(colored(beamGeometry(point(seg.from, win.top), point(seg.to, win.top), t, t), col('frame')));
    }
  }

  // Roof and floor fans
  for (let i = 0; i < ringAngles.length && canopy.segments; i++) {
    const a = ringAngles[i];
    const b = ringAngles[(i + 1) % ringAngles.length] + (i + 1 === ringAngles.length ? 360 : 0);
    walls.tri([0, canopy.roof, 0], point(a, canopy.roof), point(b, canopy.roof), col('wallDark'));
    walls.tri([0, canopy.floor, 0], point(b, canopy.floor), point(a, canopy.floor), col('floor'));
  }
  if (walls.pos.length) opaque.push(walls.finish());

  for (const blk of variant.blocks) opaque.push(colored(blockGeometry(blk.min, blk.max, blk.rot), col(blk.color)));
  for (const bm of variant.beams) opaque.push(colored(beamGeometry(bm.a, bm.b, bm.w, bm.h, bm.up), col(bm.color)));
  for (const cable of variant.cables) {
    const curve = new THREE.CatmullRomCurve3(cable.points.map((p) => new THREE.Vector3(...p)));
    opaque.push(colored(new THREE.TubeGeometry(curve, 14, cable.r, 5, false), cable.color));
  }

  const shellMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(merge(opaque), shellMaterial);
  shell.name = 'cockpitShell';

  const glassMaterial = createGlassMaterial(canopy, theater.canopyGrime);
  glassMaterial.map.wrapS = THREE.RepeatWrapping;
  const glassMesh = new THREE.Mesh(glass.finish({ withUv: true }), glassMaterial);
  glassMesh.name = 'canopyGlass';
  glassMesh.renderOrder = 10;
  glassMesh.userData.noPick = true;

  const group = new THREE.Group();
  group.add(shell, glassMesh);
  return { group, glassMaterial, materials: [shellMaterial, glassMaterial] };
}

/** Width of a pane in "45° units" (as the ring panes): its horizontal extent at ~1 m. */
function paneSpan(poly) {
  const xs = poly.map((p) => Math.atan2(p[0], -p[2]));
  return Math.max(0.3, (Math.max(...xs) - Math.min(...xs)) / (Math.PI / 4));
}

/** Pane-local [u, v] in 0..1 (u along the pane's horizontal, v up) for each polygon point. */
function paneUv(poly) {
  const a = new THREE.Vector3(...poly[0]);
  const e1 = new THREE.Vector3(...poly[1]).sub(a);
  const e2 = new THREE.Vector3(...poly[2]).sub(a);
  const n = new THREE.Vector3().crossVectors(e1, e2).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const side = new THREE.Vector3().crossVectors(up, n).normalize();
  const local = poly.map((p) => {
    const d = new THREE.Vector3(...p).sub(a);
    return [d.dot(side), d.dot(up)];
  });
  const us = local.map((l) => l[0]);
  const vs = local.map((l) => l[1]);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  return local.map(([u, v]) => [(u - u0) / (u1 - u0 || 1), (v - v0) / (v1 - v0 || 1)]);
}
