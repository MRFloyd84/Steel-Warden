#!/usr/bin/env python3
"""
Copies the curated environment models into assets/props/<pack>/ (all CC0).

    python3 tools/import_props.py \\
        --kenney-industrial "<…>/kenney_city-kit-industrial_2.0" \\
        --kenney-space "<…>/kenney_space-kit" \\
        --quaternius "<…>/Ultimate Modular Sci-Fi - Feb 2021"

- Kenney kits ship GLB: copied as they are. The industrial kit colours its models through
  a shared colour map; it is copied too (downscaled to 128 px, nearest — swatches stay exact).
- Quaternius ships OBJ/MTL only: converted here into a GLB with one primitive per MTL
  material (the material keeps its MTL name and Kd colour), positions + normals, no UVs.

Keep src/data/props.js in step; tools/check_credits.mjs checks both directions.
"""
import argparse
import json
import os
import shutil
import struct

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'props')

PICKS = {
    'kenney-industrial': [
        'building-a', 'building-c', 'building-f', 'building-k', 'building-p',
        'chimney-large', 'chimney-medium', 'detail-tank', 'detail-tank-large',
        'shipping-container-a', 'shipping-container-b', 'shipping-container-c',
        'water-tower', 'solar-panel-landscape-group', 'windmill',
    ],
    'kenney-space': [
        'hangar_largeA', 'hangar_roundA', 'machine_generatorLarge', 'satelliteDish_large',
        'rock_crystalsLargeA', 'rock_crystalsLargeB', 'rock_largeA', 'rock_largeB', 'rocks_smallA',
        'structure_detailed', 'supports_high', 'barrels', 'craft_cargoA',
    ],
    'quaternius-scifi': ['Props_ContainerFull', 'Props_Crate', 'Props_CrateLong', 'Props_Vessel_Tall'],
}


def kebab(name):
    out = ''
    for i, ch in enumerate(name.replace('_', '-')):
        if ch.isupper() and i and name[i - 1] not in '_-':
            out += '-'
        out += ch.lower()
    return out.replace('--', '-')


# ---------- OBJ → GLB ----------

def read_mtl(path):
    mats = {}
    cur = None
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p:
            continue
        if p[0] == 'newmtl':
            cur = p[1]
            mats[cur] = [0.8, 0.8, 0.8]
        elif p[0] == 'Kd' and cur:
            mats[cur] = [float(v) for v in p[1:4]]
    return mats


def read_obj(path):
    v, vn = [], []
    groups = {}  # material → list of (vi, ni) triples
    mat = 'default'
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p:
            continue
        if p[0] == 'v':
            v.append([float(x) for x in p[1:4]])
        elif p[0] == 'vn':
            vn.append([float(x) for x in p[1:4]])
        elif p[0] == 'usemtl':
            mat = p[1]
        elif p[0] == 'f':
            corners = []
            for c in p[1:]:
                parts = c.split('/')
                vi = int(parts[0])
                ni = int(parts[2]) if len(parts) > 2 and parts[2] else 0
                corners.append((vi - 1 if vi > 0 else len(v) + vi, ni - 1 if ni > 0 else (len(vn) + ni if ni < 0 else -1)))
            for k in range(1, len(corners) - 1):  # fan triangulation
                groups.setdefault(mat, []).extend([corners[0], corners[k], corners[k + 1]])
    return v, vn, groups


def write_glb(path, v, vn, groups, mtl):
    bin_parts = []
    views = []
    accessors = []
    prims = []
    materials = []
    offset = 0

    def add(data, target, count, comp, typ, minmax=None):
        nonlocal offset
        pad = (4 - len(data) % 4) % 4
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), 'target': target})
        bin_parts.append(data + b'\0' * pad)
        offset += len(data) + pad
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count, 'type': typ}
        if minmax:
            acc['min'], acc['max'] = minmax
        accessors.append(acc)
        return len(accessors) - 1

    for name, tris in groups.items():
        pos, nor = [], []
        for vi, ni in tris:
            pos.append(v[vi])
            nor.append(vn[ni] if 0 <= ni < len(vn) else [0, 1, 0])
        flat_p = [c for p in pos for c in p]
        flat_n = [c for n in nor for c in n]
        mins = [min(p[i] for p in pos) for i in range(3)]
        maxs = [max(p[i] for p in pos) for i in range(3)]
        pa = add(struct.pack(f'<{len(flat_p)}f', *flat_p), 34962, len(pos), 5126, 'VEC3', (mins, maxs))
        na = add(struct.pack(f'<{len(flat_n)}f', *flat_n), 34962, len(nor), 5126, 'VEC3')
        materials.append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [*mtl.get(name, [0.8, 0.8, 0.8]), 1], 'metallicFactor': 0}})
        prims.append({'attributes': {'POSITION': pa, 'NORMAL': na}, 'material': len(materials) - 1})

    blob = b''.join(bin_parts)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'steel-warden tools/import_props.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': os.path.basename(path)}],
        'meshes': [{'primitives': prims}], 'materials': materials,
        'buffers': [{'byteLength': len(blob)}], 'bufferViews': views, 'accessors': accessors,
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(blob), 0x004E4942) + blob)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kenney-industrial', required=True)
    ap.add_argument('--kenney-space', required=True)
    ap.add_argument('--quaternius', required=True)
    a = ap.parse_args()

    dst = os.path.join(OUT, 'kenney-industrial')
    os.makedirs(dst, exist_ok=True)
    src = os.path.join(a.kenney_industrial, 'Models', 'GLB format')
    for n in PICKS['kenney-industrial']:
        shutil.copy(os.path.join(src, f'{n}.glb'), os.path.join(dst, f'{n}.glb'))
    Image.open(os.path.join(src, 'Textures', 'colormap.png')).convert('RGB').resize((128, 128), Image.NEAREST).save(os.path.join(dst, 'colormap.png'))

    dst = os.path.join(OUT, 'kenney-space')
    os.makedirs(dst, exist_ok=True)
    src = os.path.join(a.kenney_space, 'Models', 'GLTF format')
    for n in PICKS['kenney-space']:
        shutil.copy(os.path.join(src, f'{n}.glb'), os.path.join(dst, f'{kebab(n)}.glb'))

    dst = os.path.join(OUT, 'quaternius-scifi')
    os.makedirs(dst, exist_ok=True)
    src = os.path.join(a.quaternius, 'OBJ')
    for n in PICKS['quaternius-scifi']:
        v, vn, groups = read_obj(os.path.join(src, f'{n}.obj'))
        write_glb(os.path.join(dst, f'{kebab(n.replace("Props_", ""))}.glb'), v, vn, groups, read_mtl(os.path.join(src, f'{n}.mtl')))

    for root, _, files in sorted(os.walk(OUT)):
        for f in sorted(files):
            p = os.path.join(root, f)
            print(f'{os.path.relpath(p, OUT):48} {os.path.getsize(p):8} B')


if __name__ == '__main__':
    main()
