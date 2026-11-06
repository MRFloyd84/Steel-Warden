import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small geometry helpers for the cockpit. Static parts are built as
 * non-indexed, vertex-coloured geometries and merged into a few meshes,
 * so the whole shell costs only a handful of draw calls.
 */

const tmpColor = new THREE.Color();
const DEG = Math.PI / 180;

/** Non-indexed copy with a solid vertex colour and no UVs (ready for merging). */
export function colored(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  tmpColor.set(color);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function merge(geometries) {
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  return merged;
}

/** Axis-aligned box between min and max, optionally rotated around its centre (degrees). */
export function blockGeometry(min, max, rot) {
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG)));
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return g;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

/** Box of width w and height h running from a to b; `up` orients the height axis. */
export function beamGeometry(a, b, w, h = w, up = null) {
  tmpA.fromArray(a);
  tmpB.fromArray(b);
  const len = tmpA.distanceTo(tmpB);
  const g = new THREE.BoxGeometry(w, h, len);
  const dir = tmpB.clone().sub(tmpA).normalize();
  if (up) tmpUp.fromArray(up);
  else tmpUp.set(0, 1, 0);
  if (Math.abs(dir.dot(tmpUp.clone().normalize())) > 0.98) tmpUp.set(1, 0, 0);
  const m = new THREE.Matrix4().lookAt(tmpA, tmpB, tmpUp);
  m.setPosition(tmpA.clone().add(tmpB).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

/** Writes quads into plain arrays; finish() returns a non-indexed geometry. */
export class QuadWriter {
  constructor() {
    this.pos = [];
    this.col = [];
    this.uv = [];
  }

  quad(p0, p1, p2, p3, color, uvRect = null) {
    tmpColor.set(color);
    const verts = [p0, p1, p2, p0, p2, p3];
    const r = uvRect ?? [0, 0, 1, 1];
    const uvs = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[1]], [r[2], r[3]], [r[0], r[3]]];
    for (let i = 0; i < 6; i++) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
  }

  tri(p0, p1, p2, color) {
    tmpColor.set(color);
    for (const p of [p0, p1, p2]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
      this.uv.push(0, 0);
    }
  }

  finish({ withUv = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

/**
 * Panel frame from data: normal points at the pilot, up is the text-up
 * direction. Local X = right, Y = up, Z = out of the panel.
 */
export function panelMatrix(def) {
  const z = new THREE.Vector3().fromArray(def.normal).normalize();
  const upHint = new THREE.Vector3().fromArray(def.up);
  const x = new THREE.Vector3().crossVectors(upHint, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(def.center[0], def.center[1], def.center[2]);
  return m;
}

/** Panel-local position (metres) for a normalised [u, v] (v = 0 at the top). */
export function panelLocal(def, at) {
  return [(at[0] - 0.5) * def.size[0], (0.5 - at[1]) * def.size[1]];
}
