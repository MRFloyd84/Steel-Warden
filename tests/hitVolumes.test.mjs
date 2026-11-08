import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HitVolumes } from '../src/sim/HitVolumes.js';

/** Minimal walker model: a torso box far out to the side (like the HALBERD missile boxes). */
function model() {
  const root = new THREE.Group();
  const legGroup = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  torso.userData.component = 'torso';
  torso.position.set(7, 4, 0); // corners up to ~10 m from the root
  root.add(torso);
  root.updateMatrixWorld(true);
  legGroup.updateMatrixWorld(true);
  return { root, legGroup, walker: { cockpit: { eyeHeight: 9 } } };
}

test('broad phase covers every zone after updateBounds (P4)', () => {
  const m = model();
  const hv = new HitVolumes(m);
  // shot along z through the outer edge of the box (x = 7.9, y = 4.9): ~9.2 m from the root
  const p0 = new THREE.Vector3(7.9, 4.9, -20);
  const p1 = new THREE.Vector3(7.9, 4.9, 20);
  const before = hv.intersectSegment(p0, p1);
  assert.equal(before, null, 'the fixed radius (eye × 0.85 = 7.65 m) rejected this hit');
  const r = hv.updateBounds();
  assert.ok(r >= Math.hypot(8, 5, 1), `radius ${r}`);
  const after = hv.intersectSegment(p0, p1);
  assert.ok(after, 'hit found once the radius follows the zones');
  assert.equal(after.component, 'torso');
});

test('updateBounds never shrinks below the old radius and is repeatable', () => {
  const m = model();
  m.root.children[0].position.set(0, 1, 0);
  m.root.updateMatrixWorld(true);
  const hv = new HitVolumes(m);
  const a = hv.updateBounds();
  const b = hv.updateBounds();
  assert.equal(a, b);
  assert.ok(a >= 9 * 0.85);
});
