#!/usr/bin/env python3
"""Imports the Tripo walker models as rigid-segment, low-poly, vertex-coloured GLBs.

    pip install numpy scipy pillow fast-simplification
    python3 tools/import_walkers.py --src <folder with the tripo_convert_*.glb files>

For every model in MODELS:
  1. bind pose: skinning applied once (glb_read.py), Mixamo joints read
  2. each mesh piece of the export goes as a whole to one segment (pelvis, torso, sensors,
     armL/R, thighL/R, shinL/R, footL/R) by its skin weights — pieces that really span two
     segments are split per triangle
  3. turned to face -Z (game forward), scaled to the walker's height, feet on y = 0,
     hips on x = z = 0
  4. per segment: welded and decimated (quadric, fast-simplification) to the triangle budget
  5. colour per face from the base-colour texture, reduced to a small palette (k-means);
     bright saturated faces of Synthesis models become self-lit (segment + 'Glow')
  6. written as GLB: one mesh per segment (indexed, POSITION + COLOR_0), joints in the
     scene extras (hip, knee, ankle per side, shoulders, torso pivot)

The game (render/walker/MeshWalker.js) puts the segments on its own rig: legs by two-bone
IK, torso twist about the pivot, arms aimed about the shoulders.

Static models (PROPS: the Synthesis spike) are written as one mesh with vertex colours to
assets/props/tripo-synth/ and go through the normal prop pipeline.
"""
import argparse
import colorsys
import glob
import json
import os
import struct
import sys

import numpy as np
from scipy.cluster.vq import kmeans2
from scipy.spatial import cKDTree
import fast_simplification

sys.path.insert(0, os.path.dirname(__file__))
from glb_read import Glb  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')

# walker geometry id → (part of the Tripo file name, height in m, triangle budget, synth)
# (keep in step with src/data/walkerMeshes.js)
MODELS = {
    'kestrel': ('48bcf456', 7.8, 3200, False),
    'marder': ('c5e00fdf', 8.0, 3600, False),
    'bastion': ('0703d8eb', 11.0, 4400, False),
    'halberd': ('3b58ed91', 12.6, 4800, False),
    'goliath': ('ab02f98f', 13.2, 5200, False),
    'koloss': ('3fe731e4', 15.6, 5600, False),
    'splitter': ('3acfe2bc', 6.6, 2600, True),
    'sichel': ('ab4af61d', 9.9, 3600, True),
    'monolith': ('580c0898', 13.6, 4600, True),
}
# static props: id → (file part, height, triangle budget)
PROPS = {
    'spike-tower': ('d95a6457', 14.0, 1400),
}

# How mesh pieces are split into segments (see assign); default 'mix'
SEGMENT_MODE = {'kestrel': 'bones'}
# Arms start at the forearm (auto-rig put the upper arm bones inside the hull)
SHORT_ARMS = {'kestrel'}
# Corrections on mesh pieces (game metres, piece centre): (from segments, to segment, limits)
# limits: dict of axis → (min, max); 'ax' = |x|
FIXES = {
    'kestrel': [(('armL', 'armR'), 'torso', {'y': (5.0, 99)})],          # nose hull; gun pods stay arms
    'marder': [(('armL', 'armR'), 'torso', {'ax': (0, 2.0), 'y': (6.0, 99)})],
    'halberd': [(('armL', 'armR'), 'torso', {'y': (10.2, 99)})],          # missile boxes on the torso
    'bastion': [(('armL', 'armR'), 'torso', {'ax': (1.9, 4.0), 'y': (9.4, 99)})],  # shoulder boxes
    'monolith': [(('sensors',), 'armL', {'x': (-99, -2.5)})],             # missile rack on the left arm
}

PART_OF = {
    'Hips': 'pelvis',
    'LeftUpLeg': 'thighL', 'LeftLeg': 'shinL', 'LeftFoot': 'footL', 'LeftToeBase': 'footL', 'LeftToe_End': 'footL',
    'RightUpLeg': 'thighR', 'RightLeg': 'shinR', 'RightFoot': 'footR', 'RightToeBase': 'footR', 'RightToe_End': 'footR',
    'Spine': 'torso', 'Spine1': 'torso', 'Spine2': 'torso', 'Neck': 'torso',
    'LeftShoulder': 'torso', 'RightShoulder': 'torso',
    'Head': 'sensors', 'HeadTop_End': 'sensors',
}
SEGMENTS = ['pelvis', 'torso', 'sensors', 'armL', 'armR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']


def part_of(joint):
    n = joint.split(':')[-1]
    if n in PART_OF:
        return PART_OF[n]
    if n.startswith('Left') and ('Arm' in n or 'Hand' in n):
        return 'armL'
    if n.startswith('Right') and ('Arm' in n or 'Hand' in n):
        return 'armR'
    return 'torso'


def find(src, key):
    hits = [f for f in glob.glob(os.path.join(src, '*.glb')) if key in os.path.basename(f)]
    if not hits:
        raise SystemExit(f'Datei mit "{key}" nicht gefunden in {src}')
    return hits[0]


def sample(img, uv):
    h, w, _ = img.shape
    x = np.clip((uv[..., 0] % 1) * w, 0, w - 1).astype(int)
    y = np.clip((uv[..., 1] % 1) * h, 0, h - 1).astype(int)
    return img[y, x]


def face_colours(img, U):
    if img is None:
        return np.full((len(U), 3), 0.6, np.float32)
    corners = sample(img, U)  # (n,3,3)
    centre = sample(img, U.mean(1))
    return (corners.sum(1) + centre * 2) / 5


# Bone lines per segment (Mixamo joint names) for the geometric vote
BONES = {
    'pelvis': [('Hips', 'Spine')],
    'torso': [('Spine', 'Spine1'), ('Spine1', 'Spine2'), ('Spine2', 'Neck'), ('Spine2', 'LeftShoulder'), ('Spine2', 'RightShoulder')],
    'sensors': [('Neck', 'Head'), ('Head', 'HeadTop_End')],
    'armL': [('LeftShoulder', 'LeftArm'), ('LeftArm', 'LeftForeArm'), ('LeftForeArm', 'LeftHand'), ('LeftHand', 'LeftHandMiddle4')],
    'armR': [('RightShoulder', 'RightArm'), ('RightArm', 'RightForeArm'), ('RightForeArm', 'RightHand'), ('RightHand', 'RightHandMiddle4')],
    'thighL': [('LeftUpLeg', 'LeftLeg')], 'shinL': [('LeftLeg', 'LeftFoot')], 'footL': [('LeftFoot', 'LeftToeBase'), ('LeftToeBase', 'LeftToe_End')],
    'thighR': [('RightUpLeg', 'RightLeg')], 'shinR': [('RightLeg', 'RightFoot')], 'footR': [('RightFoot', 'RightToeBase'), ('RightToeBase', 'RightToe_End')],
}


def seg_distance(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def geometric_votes(P, jp, short_arms=False):
    """Votes per triangle from the distance of its centre to each segment's bone lines."""
    c = P.mean(1)
    d = np.full((len(P), len(SEGMENTS)), np.inf)
    for si, name in enumerate(SEGMENTS):
        for a, b in BONES[name]:
            if short_arms and name.startswith('arm') and not a.endswith(('ForeArm', 'Hand')):
                continue
            if a in jp and b in jp:
                d[:, si] = np.minimum(d[:, si], seg_distance(c, jp[a], jp[b]))
    best = d.min(1, keepdims=True)
    return np.exp(-((d - best) / np.maximum(best * 0.25 + 0.01, 1e-4)) ** 2)


def assign(P, J, W, names, node, jp, mode, short_arms=False):
    """Segment per triangle: whole mesh pieces where they are clearly one segment.

    mode 'skin': vote by skin weights; 'bones': by distance to the bone lines; 'mix': both.
    """
    seg_names = SEGMENTS
    jmap = np.array([seg_names.index(part_of(n)) for n in names] + [seg_names.index('torso')])
    jj = np.where(J < 0, len(names), J)
    tri_votes = np.zeros((len(J), len(seg_names)))
    np.add.at(tri_votes, (np.repeat(np.arange(len(J)), 12), jmap[jj.reshape(-1, 12)].reshape(-1)), W.reshape(-1, 12).reshape(-1))
    tri_votes /= np.maximum(tri_votes.sum(1, keepdims=True), 1e-9)
    if short_arms:  # upper-arm skin weights belong to the hull
        for k, n in enumerate(names):
            if n.split(':')[-1] in ('LeftArm', 'RightArm'):
                jmap[k] = seg_names.index('torso')
        tri_votes[:] = 0
        np.add.at(tri_votes, (np.repeat(np.arange(len(J)), 12), jmap[jj.reshape(-1, 12)].reshape(-1)), W.reshape(-1, 12).reshape(-1))
        tri_votes /= np.maximum(tri_votes.sum(1, keepdims=True), 1e-9)
    if mode != 'skin':
        geo = geometric_votes(P, jp, short_arms)
        geo /= geo.sum(1, keepdims=True)
        tri_votes = geo if mode == 'bones' else 0.5 * tri_votes + 0.5 * geo
    tri_seg = tri_votes.argmax(1)
    out = tri_seg.copy()
    for n in np.unique(node):
        m = node == n
        votes = tri_votes[m].sum(0)
        order = np.argsort(-votes)
        best, second = order[0], order[1]
        share = votes / max(votes.sum(), 1e-9)
        # a leg piece that clearly reaches over the knee or ankle is cut per triangle
        leg = SEGMENTS[best][:-1] in ('thigh', 'shin', 'foot') and SEGMENTS[second][:-1] in ('thigh', 'shin', 'foot')
        if share[best] >= 0.72 and not (leg and share[second] > 0.12):
            out[m] = best
    return out


def apply_fixes(seg, T, node, fixes):
    for frm, to, lim in fixes:
        fi = [SEGMENTS.index(f) for f in frm]
        for n in np.unique(node):
            m = (node == n) & np.isin(seg, fi)
            if not m.any():
                continue
            c = T[m].reshape(-1, 3).mean(0)
            val = {'x': c[0], 'y': c[1], 'z': c[2], 'ax': abs(c[0])}
            if all(lo <= val[k] <= hi for k, (lo, hi) in lim.items()):
                seg[m] = SEGMENTS.index(to)
    return seg


def to_game(P, height):
    """Mixamo faces +Z: turn 180° to face -Z, scale to height, feet on 0."""
    v = P.reshape(-1, 3) * np.array([-1, 1, -1])
    lo, hi = v.min(0), v.max(0)
    s = height / (hi[1] - lo[1])
    return s, lo


def weld(tris):
    v = tris.reshape(-1, 3)
    q = np.round(v / 1e-4).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    return v[first], inv.reshape(-1, 3)


def decimate(tris, budget):
    pts, faces = weld(tris)
    if len(faces) > budget:
        pts2, faces2 = fast_simplification.simplify(pts.astype(np.float32), faces.astype(np.int32), target_reduction=1 - budget / len(faces))
        if len(faces2):
            pts, faces = pts2, faces2
    # drop degenerate faces
    t = pts[faces]
    area = np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1)
    return pts, faces[area > 1e-7]


def brighten(colours, value=0.30, sat=1.2):
    """Tripo base colours are dark (lit by PBR); scale to a median value, lift saturation."""
    hsv = np.array([colorsys.rgb_to_hsv(*c) for c in colours])
    k = value / max(np.median(hsv[:, 2]), 1e-3)
    hsv[:, 2] = np.clip(hsv[:, 2] * k, 0, 1)
    hsv[:, 1] = np.clip(hsv[:, 1] * sat, 0, 1)
    return np.array([colorsys.hsv_to_rgb(*c) for c in hsv])


def palette(colours, k):
    if len(colours) <= k:
        return colours
    lab = colours.astype(np.float64)
    cent, lbl = kmeans2(lab, k, minit='++', seed=7)
    return cent[lbl]


def glowing(c):
    out = np.zeros(len(c), bool)
    for i, (r, g, b) in enumerate(c):
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        out[i] = s > 0.45 and v > 0.4 and not (0.12 < h < 0.45)  # purple, red, cyan — not olive/khaki
    return out


def write_glb(path, meshes, extras):
    """meshes: list of (name, positions (n,3) float32, colours (n,3) 0..1, indices (m,3))."""
    bin_parts, views, accessors, gl_meshes, nodes = [], [], [], [], []
    off = 0

    def add(data, target):
        nonlocal off
        b = data.tobytes()
        pad = (-len(b)) % 4
        bin_parts.append(b + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), 'target': target})
        off += len(b) + pad
        return len(views) - 1

    for name, pos, col, idx in meshes:
        pos = pos.astype(np.float32)
        c8 = np.c_[np.clip(np.round(col * 255), 0, 255), np.full(len(col), 255)].astype(np.uint8)
        ind = idx.astype(np.uint16 if len(pos) < 65536 else np.uint32).reshape(-1)
        a0 = len(accessors)
        accessors.append({'bufferView': add(pos, 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                          'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        accessors.append({'bufferView': add(c8, 34962), 'componentType': 5121, 'normalized': True, 'count': len(pos), 'type': 'VEC4'})
        accessors.append({'bufferView': add(ind, 34963), 'componentType': 5123 if ind.dtype == np.uint16 else 5125, 'count': len(ind), 'type': 'SCALAR'})
        gl_meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': a0, 'COLOR_0': a0 + 1}, 'indices': a0 + 2, 'material': 0}]})
        nodes.append({'name': name, 'mesh': len(gl_meshes) - 1})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'STEEL WARDEN tools/import_walkers.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes))), 'extras': extras}],
        'nodes': nodes, 'meshes': gl_meshes,
        'materials': [{'name': 'vertex', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0}}],
        'buffers': [{'byteLength': off}], 'bufferViews': views, 'accessors': accessors,
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    bn = b''.join(bin_parts)
    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bn), 0x004E4942) + bn)


def build_mesh(tris, cols, budget, colours=10):
    """Decimates, colours faces by nearest source face, splits vertices per colour."""
    pts, faces = decimate(tris, budget)
    if not len(faces):
        return None
    tree = cKDTree(tris.mean(1))
    _, near = tree.query(pts[faces].mean(1))
    fc = cols[near]
    return pts, faces, fc


def unshare(pts, faces, fc):
    """Indexed mesh whose vertices carry one colour each (vertex duplicated per colour)."""
    key = np.c_[faces.reshape(-1), np.repeat(np.round(fc * 255).astype(np.int64), 3, axis=0)]
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    return pts[uniq[:, 0]], uniq[:, 1:] / 255.0, inv.reshape(-1, 3)


def import_walker(gid, src, key, height, budget, synth, out_dir):
    g = Glb(find(src, key))
    P, U, J, W, names, node = g.triangles()
    img = g.base_color_image()
    cols = face_colours(img, U)
    jp = {k.split(':')[-1]: v for k, v in g.joint_positions().items()}
    seg = assign(P, J, W, names, node, jp, SEGMENT_MODE.get(gid, 'mix'), gid in SHORT_ARMS)
    s, lo = to_game(P, height)
    hips = jp['Hips'] * np.array([-1, 1, -1])
    shift = np.array([hips[0], lo[1], hips[2]])
    tp = lambda v: ((np.asarray(v) * np.array([-1, 1, -1])) - shift) * s  # noqa: E731
    T = tp(P.reshape(-1, 3)).reshape(-1, 3, 3)
    seg = apply_fixes(seg, T, node, FIXES.get(gid, []))
    # Palette over the whole model so every segment shares the same colours
    allc = palette(brighten(cols), 9)
    total = len(T)
    meshes, stats = [], {}
    for si, name in enumerate(SEGMENTS):
        m = seg == si
        if not m.any():
            continue
        share = max(80, int(budget * m.sum() / total))
        r = build_mesh(T[m], allc[m], share)
        if os.environ.get('SW_DEBUG'):
            print(f'   {name}: {m.sum()} → {0 if r is None else len(r[1])} (Ziel {share})')
        if r is None:
            continue
        pts, faces, fc = r
        glow = glowing(fc) if synth else np.zeros(len(fc), bool)
        for suffix, sel in (('', ~glow), ('Glow', glow)):
            if not sel.any():
                continue
            v, c, f = unshare(pts, faces[sel], fc[sel])
            meshes.append((name + suffix, v, c, f))
            stats[name + suffix] = len(f)
    j = lambda n: tp(jp[n]).round(4).tolist()  # noqa: E731
    # Game left (side -1, x < 0) is the model's Left after the 180° turn
    extras = {
        'model': gid, 'height': height,
        'joints': {
            'hipL': j('LeftUpLeg'), 'kneeL': j('LeftLeg'), 'ankleL': j('LeftFoot'),
            'hipR': j('RightUpLeg'), 'kneeR': j('RightLeg'), 'ankleR': j('RightFoot'),
            'shoulderL': j('LeftArm'), 'shoulderR': j('RightArm'),
            'pivot': j('Spine'), 'head': j('Head'),
        },
    }
    path = os.path.join(out_dir, f'{gid}.glb')
    write_glb(path, meshes, extras)
    print(f'{gid:9s} {os.path.getsize(path) / 1024:6.0f} KB  {sum(stats.values()):5d} Dreiecke  ' + ' '.join(f'{k}:{v}' for k, v in stats.items()))


def import_prop(pid, src, key, height, budget, out_dir):
    g = Glb(find(src, key))
    P, U, J, W, names, node = g.triangles()
    cols = palette(brighten(face_colours(g.base_color_image(), U)), 6)
    v = P.reshape(-1, 3) * np.array([-1, 1, -1])
    lo, hi = v.min(0), v.max(0)
    s = height / (hi[1] - lo[1])
    c = (lo + hi) / 2
    T = ((v - np.array([c[0], lo[1], c[2]])) * s).reshape(-1, 3, 3)
    pts, faces, fc = build_mesh(T, cols, budget)
    vv, cc, ff = unshare(pts, faces, fc)
    path = os.path.join(out_dir, f'{pid}.glb')
    write_glb(path, [(pid, vv, cc, ff)], {'model': pid, 'height': height})
    print(f'{pid:9s} {os.path.getsize(path) / 1024:6.0f} KB  {len(ff):5d} Dreiecke (Prop)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--src', required=True, help='Ordner mit den tripo_convert_*.glb')
    ap.add_argument('--only', nargs='*', help='nur diese IDs')
    ap.add_argument('--mode', choices=['skin', 'bones', 'mix'], help='Segmentierung für alle erzwingen (Test)')
    a = ap.parse_args()
    wdir = os.path.join(ROOT, 'assets', 'walkers')
    pdir = os.path.join(ROOT, 'assets', 'props', 'tripo-synth')
    os.makedirs(wdir, exist_ok=True)
    os.makedirs(pdir, exist_ok=True)
    if a.mode:
        for gid in MODELS:
            SEGMENT_MODE[gid] = a.mode
    for gid, (key, h, budget, synth) in MODELS.items():
        if not a.only or gid in a.only:
            import_walker(gid, a.src, key, h, budget, synth, wdir)
    for pid, (key, h, budget) in PROPS.items():
        if not a.only or pid in a.only:
            import_prop(pid, a.src, key, h, budget, pdir)


if __name__ == '__main__':
    main()
