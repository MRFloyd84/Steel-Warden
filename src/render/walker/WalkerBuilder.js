import * as THREE from 'three';
import { colored, merge, beamGeometry } from '../cockpit/geometry.js';

const DEG = Math.PI / 180;
const SOCKET = { S: 0.3, M: 0.42, L: 0.56 };

/**
 * Builds the parts of a walker from its construction plan (data/walkerModels.js).
 * Every moving part is one merged, vertex-coloured, flat-shaded geometry, tagged
 * with the damage component it belongs to (torso, armL, armR, legs, sensors) —
 * the hit zones for the weapons step.
 *
 * Returns geometries plus mount points (part + local position) for hardpoints.
 */
export function buildWalkerParts(plan, walker) {
  const P = plan.paint;
  const color = (name) => P[name] ?? name;
  const box = (size, at, col, rot) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG)));
    g.translate(at[0], at[1], at[2]);
    return colored(g, color(col));
  };

  const parts = { torso: [], sensors: [], pelvis: [], armL: [], armR: [] };
  const mounts = {};

  // Torso hull: side profile extruded across the width, narrowed toward the top
  parts.torso.push(colored(hullGeometry(plan.torso), color('base')));
  const c = plan.canopy;
  parts.torso.push(box(c.size, c.at, 'glass', [-c.tilt, 0, 0]));
  parts.torso.push(box([c.size[0] + 0.12, 0.1, c.size[2] + 0.1], [c.at[0], c.at[1] + c.size[1] / 2, c.at[2] + 0.05], 'dark', [-c.tilt, 0, 0]));

  // Shoulder missile racks
  if (plan.shoulderPods) {
    const sp = plan.shoulderPods;
    for (const side of [-1, 1]) {
      const at = [sp.at[0] * side, sp.at[1], sp.at[2]];
      parts.torso.push(box(sp.size, at, 'base'));
      parts.torso.push(box([sp.size[0] * 0.9, 0.08, sp.size[2] * 0.9], [at[0], at[1] + sp.size[1] / 2, at[2]], 'accent'));
      const [cols, rows] = sp.tubes;
      const face = at[2] - sp.size[2] / 2;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = at[0] + (i - (cols - 1) / 2) * (sp.size[0] / cols);
          const y = at[1] + (j - (rows - 1) / 2) * (sp.size[1] / rows);
          parts.torso.push(box([sp.size[0] / cols * 0.6, sp.size[1] / rows * 0.6, 0.06], [x, y, face - 0.02], 'dark'));
        }
      }
      mounts[side < 0 ? 'shoulderL' : 'shoulderR'] = { part: 'torso', local: new THREE.Vector3(at[0], at[1], face - 0.05) };
    }
  }

  for (const [name, at] of Object.entries(plan.torsoMounts ?? {})) {
    mounts[name] = { part: 'torso', local: new THREE.Vector3(...at) };
  }

  // Arms: shoulder joint, upper arm, weapon pod (built in arm-local space)
  const arm = plan.arms;
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'armL' : 'armR';
    const list = parts[key];
    const [uw, ul, ud] = arm.upper;
    const [pw, ph, pl] = arm.pod;
    list.push(colored(new THREE.CylinderGeometry(uw * 0.7, uw * 0.7, uw * 1.4, 6).rotateZ(Math.PI / 2), color('joint')));
    list.push(box([uw, ul, ud], [side * uw * 0.2, -ul / 2, 0], 'base'));
    const podAt = [side * uw * 0.2, -arm.drop, -pl * 0.25];
    list.push(box([pw, ph, pl], podAt, 'base'));
    list.push(box([pw * 1.04, ph * 0.18, pl * 0.5], [podAt[0], podAt[1] + ph * 0.4, podAt[2] + pl * 0.15], 'dark'));
    list.push(box([0.05, ph * 0.6, pl * 0.6], [podAt[0] + side * (pw / 2 + 0.02), podAt[1], podAt[2]], 'accent'));
    const front = podAt[2] - pl / 2;
    mounts[`${key}.0`] = { part: key, local: new THREE.Vector3(podAt[0], podAt[1] + ph * 0.22, front - 0.04) };
    mounts[`${key}.1`] = { part: key, local: new THREE.Vector3(podAt[0], podAt[1] - ph * 0.22, front - 0.04) };
  }

  // Pelvis with hip joints
  const pv = plan.pelvis;
  parts.pelvis.push(box(pv, [0, 0, 0], 'dark'));
  for (const side of [-1, 1]) {
    const r = plan.legs.thick[0] * 0.55;
    parts.pelvis.push(colored(new THREE.CylinderGeometry(r, r, r * 1.6, 6).rotateZ(Math.PI / 2).translate(side * plan.legs.hipWidth, 0, 0), color('joint')));
  }

  // Extras
  for (const ex of plan.extras ?? []) {
    const list = parts[ex.part === 'pelvis' ? 'pelvis' : ex.part === 'sensors' ? 'sensors' : 'torso'];
    if (ex.kind === 'box') list.push(box(ex.size, ex.at, ex.color ?? 'base'));
    if (ex.kind === 'beam') list.push(colored(beamGeometry(ex.a, ex.b, ex.w, ex.w), color('metal')));
    if (ex.kind === 'jet') {
      list.push(box(ex.size, ex.at, 'dark'));
      const r = ex.size[0] * 0.4;
      list.push(colored(new THREE.CylinderGeometry(r * 0.7, r, ex.size[1] * 0.4, 6).translate(ex.at[0], ex.at[1] - ex.size[1] * 0.6, ex.at[2]), color('metal')));
    }
  }

  // Hardpoint sockets: dark mount plate with an accent rim, on the part they belong to
  const hardpointMounts = {};
  for (const hp of walker.hardpoints) {
    const m = mounts[hp.mount];
    if (!m) throw new Error(`${walker.id}: hardpoint ${hp.id} uses unknown mount "${hp.mount}"`);
    const s = SOCKET[hp.size] ?? 0.4;
    const p = m.local;
    parts[m.part].push(box([s * 1.15, s * 1.15, 0.05], [p.x, p.y, p.z + 0.03], 'accent'));
    parts[m.part].push(box([s, s, 0.08], [p.x, p.y, p.z], 'dark'));
    hardpointMounts[hp.id] = m;
  }

  const geometries = {};
  for (const [name, list] of Object.entries(parts)) geometries[name] = list.length ? merge(list) : null;
  geometries.legs = buildLegGeometries(plan, color);
  return { geometries, hardpointMounts };
}

function hullGeometry(t) {
  const shape = new THREE.Shape(t.profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t.width, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // shape x (= our z) stays z, extrusion runs along -x
  g.translate(t.width / 2, 0, 0);
  // Narrow the top: scale x with height
  const ys = t.profile.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - minY) / (maxY - minY);
    pos.setX(i, pos.getX(i) * (1 + (t.taperTop - 1) * k));
  }
  g.computeVertexNormals();
  return g;
}

/** Thigh/shin hang along -Y from their joint; the foot's origin is the ankle. */
function buildLegGeometries(plan, color) {
  const L = plan.legs;
  const [tw, sw] = L.thick;
  const style = L.style;
  const box = (size, at, col) => colored(new THREE.BoxGeometry(...size).translate(...at), color(col));

  const thigh = [box([tw, L.thigh, tw * 1.1], [0, -L.thigh / 2, 0], 'base')];
  const knee = colored(new THREE.CylinderGeometry(tw * 0.55, tw * 0.55, tw * 1.2, 6).rotateZ(Math.PI / 2).translate(0, -L.thigh, 0), color('joint'));
  thigh.push(knee);
  if (style !== 'digitigrade') thigh.push(box([tw * 1.05, L.thigh * 0.45, 0.12], [0, -L.thigh * 0.45, -tw * 0.6], 'dark'));

  const shin = [box([sw, L.shin, sw * 1.2], [0, -L.shin / 2, 0], 'base')];
  if (style === 'heavy') {
    shin.push(box([sw * 1.25, L.shin * 0.6, 0.25], [0, -L.shin * 0.42, -sw * 0.7], 'base'));
    shin.push(box([sw * 1.3, 0.18, 0.3], [0, -L.shin * 0.15, -sw * 0.75], 'accent'));
  } else {
    shin.push(box([sw * 0.9, 0.16, sw * 1.25], [0, -L.shin * 0.25, 0], 'accent'));
  }
  // Hydraulic piston along the shin
  shin.push(box([0.12, L.shin * 0.7, 0.12], [0, -L.shin * 0.5, sw * 0.75], 'metal'));

  const [fw, fh, fl] = L.foot;
  const foot = [];
  if (style === 'digitigrade') {
    foot.push(box([fw * 0.5, fh, fl * 0.35], [0, -fh / 2, 0], 'dark'));
    for (const a of [-22, 0, 22]) {
      const g = new THREE.BoxGeometry(fw * 0.22, fh * 0.8, fl * 0.75).translate(0, -fh * 0.55, -fl * 0.4);
      g.rotateY(a * DEG);
      foot.push(colored(g, color('base')));
    }
    foot.push(box([fw * 0.2, fh * 0.7, fl * 0.35], [0, -fh * 0.6, fl * 0.3], 'base'));
  } else {
    foot.push(box([fw, fh, fl], [0, -fh / 2, -fl * 0.15], 'dark'));
    foot.push(box([fw * 0.9, fh * 0.5, fl * 0.35], [0, -fh * 0.25 + fh * 0.35, -fl * 0.5], 'base'));
    if (style === 'heavy') foot.push(box([fw * 0.7, fh * 1.2, fl * 0.4], [0, fh * 0.3, fl * 0.05], 'base'));
  }
  return { thigh: merge(thigh), shin: merge(shin), foot: merge(foot) };
}
