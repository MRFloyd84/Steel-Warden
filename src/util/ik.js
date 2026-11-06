import * as THREE from 'three';

const tmpDir = new THREE.Vector3();
const tmpBend = new THREE.Vector3();

/**
 * Analytic two-bone IK (hip → knee → ankle).
 * @param pole  direction the knee should point to (e.g. walker forward)
 * Writes the knee and the reachable ankle position; returns the ankle.
 */
export function solveTwoBone(hip, target, l1, l2, pole, outKnee, outAnkle) {
  tmpDir.subVectors(target, hip);
  let dist = tmpDir.length();
  if (dist < 1e-6) tmpDir.set(0, -1, 0);
  else tmpDir.divideScalar(dist);
  dist = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);

  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  tmpBend.copy(pole).addScaledVector(tmpDir, -pole.dot(tmpDir));
  if (tmpBend.lengthSq() < 1e-8) tmpBend.set(0, 0, -1);
  tmpBend.normalize();

  outKnee.copy(hip).addScaledVector(tmpDir, a).addScaledVector(tmpBend, h);
  outAnkle.copy(hip).addScaledVector(tmpDir, dist);
  return outAnkle;
}

const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const basis = new THREE.Matrix4();

/**
 * Orients a segment mesh whose geometry hangs along -Y from its origin so it
 * spans from `from` to `to`; `side` keeps its width axis stable (no spinning).
 */
export function orientSegment(obj, from, to, side) {
  by.subVectors(from, to).normalize();
  bx.copy(side).addScaledVector(by, -side.dot(by));
  if (bx.lengthSq() < 1e-8) bx.set(1, 0, 0);
  bx.normalize();
  bz.crossVectors(bx, by);
  basis.makeBasis(bx, by, bz);
  obj.quaternion.setFromRotationMatrix(basis);
  obj.position.copy(from);
}
