/**
 * Finds the muzzles of a weapon modelled on a detailed walker (data/walkerMeshes.js →
 * WALKER_MESH_MOUNTS): in the given segments, within an optional box, the front-most
 * vertices (game forward is -Z) are the barrel ends; with several barrels they are split
 * into groups along the axis they spread most. Coordinates are model space (metres, the
 * walker standing at the origin), as the segments come out of tools/import_walkers.py.
 *
 * spec.search: [{ segs: ['armR'], box: [[x0, x1], [y0, y1], [z0, z1]] | null, barrels: 1 | [nx, ny], depth: 0.35 }]
 * barrels [nx, ny]: a launcher grid (nx columns × ny rows).
 * Returns { muzzles: [[x, y, z], …], centre: [x, y, z] } or null if nothing was found.
 */
export function findMuzzles(segments, spec) {
  const muzzles = [];
  for (const s of spec.search) {
    const pts = [];
    for (const name of s.segs) {
      const g = segments[name];
      if (!g) continue;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        if (s.box && !(inside(x, s.box[0]) && inside(y, s.box[1]) && inside(z, s.box[2]))) continue;
        pts.push([x, y, z]);
      }
    }
    if (!pts.length) continue;
    const minZ = Math.min(...pts.map((v) => v[2]));
    const front = pts.filter((v) => v[2] < minZ + (s.depth ?? 0.35));
    const b = s.barrels ?? 1;
    const groups = Array.isArray(b) ? split(front, b[0], 0).flatMap((col) => split(col, b[1], 1)) : split(front, b);
    for (const group of groups) {
      const c = mean(group);
      c[2] = minZ - 0.05;
      muzzles.push(c);
    }
  }
  if (!muzzles.length) return null;
  return { muzzles, centre: mean(muzzles) };
}

function inside(v, range) {
  return !range || (v >= range[0] && v <= range[1]);
}

function mean(list) {
  const c = [0, 0, 0];
  for (const v of list) for (let k = 0; k < 3; k++) c[k] += v[k] / list.length;
  return c;
}

/** n groups by 1-D k-means along the axis (x or y) with the larger spread. */
function split(pts, n, forced = null) {
  if (n <= 1 || pts.length < n) return [pts];
  const spread = (k) => Math.max(...pts.map((v) => v[k])) - Math.min(...pts.map((v) => v[k]));
  const axis = forced ?? (spread(0) >= spread(1) ? 0 : 1);
  const vals = pts.map((v) => v[axis]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  let cent = Array.from({ length: n }, (_, i) => lo + ((i + 0.5) * (hi - lo)) / n);
  let groups = [];
  for (let it = 0; it < 12; it++) {
    groups = cent.map(() => []);
    for (const v of pts) {
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.abs(v[axis] - cent[i]) < Math.abs(v[axis] - cent[best])) best = i;
      groups[best].push(v);
    }
    cent = groups.map((g, i) => (g.length ? g.reduce((s, v) => s + v[axis], 0) / g.length : cent[i]));
  }
  return groups.filter((g) => g.length);
}
