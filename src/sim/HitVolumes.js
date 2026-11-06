import * as THREE from 'three';

const inv = new THREE.Matrix4();
const ray = new THREE.Ray();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const hitLocal = new THREE.Vector3();
const center = new THREE.Vector3();

/**
 * Simplified hit zones of one walker: one oriented box per model mesh,
 * tagged with the damage component (torso, armL, armR, legs, sensors).
 * The boxes are the meshes' local bounding boxes; they follow the mesh's
 * world matrix, so a box test is a ray test in mesh space — no per-triangle
 * raycasting. A bounding sphere around the walker rejects far rays first.
 */
export class HitVolumes {
  constructor(model) {
    this.model = model;
    this.volumes = [];
    const add = (obj) => obj.traverse((o) => {
      if (!o.isMesh || !o.userData.component || o.userData.noHit) return;
      o.geometry.computeBoundingBox();
      this.volumes.push({ mesh: o, box: o.geometry.boundingBox.clone(), component: o.userData.component });
    });
    add(model.root);
    add(model.legGroup);
    this.radius = model.walker.cockpit.eyeHeight * 0.85;
  }

  /** Removes the volumes of a detached part (e.g. an arm that was shot off). */
  removeComponent(component) {
    this.volumes = this.volumes.filter((v) => v.component !== component);
  }

  center(out) {
    return out.copy(this.model.root.position);
  }

  /**
   * Segment p0 → p1 against the zones. Returns the nearest hit
   * { t (0..1 along the segment), point, normal, component, mesh } or null.
   */
  intersectSegment(p0, p1, pad = 0) {
    const len = p0.distanceTo(p1);
    if (len < 1e-6) return null;
    // Broad phase: distance of the sphere centre from the segment
    this.center(center);
    const d = b.subVectors(p1, p0).divideScalar(len);
    const t0 = Math.max(0, Math.min(len, a.subVectors(center, p0).dot(d)));
    if (a.copy(p0).addScaledVector(d, t0).distanceToSquared(center) > (this.radius + pad) ** 2) return null;

    let best = null;
    for (const v of this.volumes) {
      if (!v.mesh.parent) continue;
      inv.copy(v.mesh.matrixWorld).invert();
      a.copy(p0).applyMatrix4(inv);
      b.copy(p1).applyMatrix4(inv);
      ray.origin.copy(a);
      ray.direction.subVectors(b, a).normalize();
      const box = pad ? padBox(v.box, pad) : v.box;
      if (!ray.intersectBox(box, hitLocal)) continue;
      const dist = hitLocal.distanceTo(a);
      if (dist > len) continue;
      const t = dist / len;
      if (best && t >= best.t) continue;
      best = { t, component: v.component, mesh: v.mesh, localPoint: hitLocal.clone(), normal: boxNormal(box, hitLocal) };
    }
    if (!best) return null;
    best.point = best.localPoint.clone().applyMatrix4(best.mesh.matrixWorld);
    best.localNormal = best.normal.clone();
    best.normal.transformDirection(best.mesh.matrixWorld);
    return best;
  }

  /** World-space centre of a component (mean of its volumes' centres; aiming, homing, blasts). */
  componentCenter(component, out) {
    let n = 0;
    out.set(0, 0, 0);
    for (const v of this.volumes) {
      if (v.component !== component || !v.mesh.parent) continue;
      out.add(v.box.getCenter(c2).applyMatrix4(v.mesh.matrixWorld));
      n++;
    }
    if (n) return out.divideScalar(n);
    const any = this.volumes[0];
    return any ? any.box.getCenter(out).applyMatrix4(any.mesh.matrixWorld) : this.center(out);
  }

  hasComponent(component) {
    return this.volumes.some((v) => v.component === component);
  }
}

const c2 = new THREE.Vector3();
const padded = new THREE.Box3();
function padBox(box, pad) {
  return padded.copy(box).expandByScalar(pad);
}

/** Outward normal of the box face nearest to a point on its surface. */
function boxNormal(box, p) {
  const faces = [
    [Math.abs(p.x - box.min.x), -1, 0, 0], [Math.abs(p.x - box.max.x), 1, 0, 0],
    [Math.abs(p.y - box.min.y), 0, -1, 0], [Math.abs(p.y - box.max.y), 0, 1, 0],
    [Math.abs(p.z - box.min.z), 0, 0, -1], [Math.abs(p.z - box.max.z), 0, 0, 1],
  ];
  faces.sort((x, y) => x[0] - y[0]);
  return new THREE.Vector3(faces[0][1], faces[0][2], faces[0][3]);
}

/** Steps along a ray until it goes below the terrain; returns the distance or null. */
export function raycastTerrain(sampler, origin, dir, maxDist, step = 4) {
  let prevD = 0;
  let prevAbove = origin.y - sampler.heightAt(origin.x, origin.z);
  if (prevAbove < 0) return 0;
  for (let d = step; d <= maxDist; d += step) {
    const x = origin.x + dir.x * d;
    const y = origin.y + dir.y * d;
    const z = origin.z + dir.z * d;
    const above = y - sampler.heightAt(x, z);
    if (above < 0) {
      // Linear refinement between the last two samples
      return prevD + (d - prevD) * (prevAbove / (prevAbove - above));
    }
    prevD = d;
    prevAbove = above;
  }
  return null;
}
