"""Cockpit model import: Tripo GLB → assets/cockpit/cockpit.glb (game-ready).

    python3 tools/import_cockpit.py <tripo.glb> [--ratio 0.08]
    needs: numpy, pillow; gltfpack (npm: `npx gltfpack`, 1.3+) for simplification and compression

Steps
  1. read the single textured Tripo mesh (model units: floor y = 0, front = -z, width ~0.98)
  2. cut the two control grips out of the shell into their own nodes with the pivot at the
     grip base (left grip = throttle, right grip = side stick; the game swings them)
  3. re-encode the textures (colour 2048 JPEG q86, normal map 1024 JPEG q90)
  4. gltfpack: quadric simplification to --ratio of the triangles (attribute seams kept),
     quantisation and meshopt compression (three.js: MeshoptDecoder)

Grip boxes and pivots are in model units, measured on the source (docs/COCKPIT-MODEL-PLAN.md).
The game places the model with src/data/cockpits.js → COCKPITS.model.model (eye, scale).
"""
import argparse
import io
import json
import os
import struct
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from glb_read import Glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'cockpit', 'cockpit.glb')

# Grip boxes (min, max) and pivots (collar top, where the grip leaves the console), model units.
GRIPS = {
    'gripL': {'min': [-0.30, 0.079, 0.035], 'max': [-0.175, 0.20, 0.135], 'pivot': [-0.2477, 0.079, 0.1056]},
}
GRIPS['gripR'] = {
    'min': [-GRIPS['gripL']['max'][0], *GRIPS['gripL']['min'][1:]],
    'max': [-GRIPS['gripL']['min'][0], *GRIPS['gripL']['max'][1:]],
    'pivot': [-GRIPS['gripL']['pivot'][0], *GRIPS['gripL']['pivot'][1:]],
}


def image_bytes(g, index):
    im = g.j['images'][g.j['textures'][index]['source']]
    bv = g.j['bufferViews'][im['bufferView']]
    off = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(g.bin[off:off + bv['byteLength']])).convert('RGB')


def jpeg(img, size, quality):
    if img.size[0] > size:
        img = img.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def split_grips(P, I):
    """Faces whose three vertices lie inside a grip box go to that grip."""
    rest = np.ones(len(I), dtype=bool)
    parts = {}
    for name, box in GRIPS.items():
        lo, hi = np.array(box['min']), np.array(box['max'])
        inside_v = np.all((P >= lo) & (P <= hi), axis=1)
        faces = np.all(inside_v[I], axis=1) & rest
        rest &= ~faces
        parts[name] = I[faces]
        print(f'{name}: {faces.sum()} Dreiecke')
    parts['shell'] = I[rest]
    return parts


def compact(P, N, UV, faces):
    used, inv = np.unique(faces.ravel(), return_inverse=True)
    return P[used], N[used], UV[used], inv.reshape(-1, 3).astype(np.uint32)


def write_glb(path, meshes, textures):
    """meshes: list of (name, translation, P, N, UV, faces); one shared material."""
    bin_ = bytearray()
    views, accessors = [], []

    def add(arr, target=None):
        while len(bin_) % 4:
            bin_.append(0)
        off = len(bin_)
        bin_.extend(arr.tobytes())
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    def acc(arr, typ, comp, target, minmax=False):
        a = {'bufferView': add(arr, target), 'componentType': comp, 'count': len(arr), 'type': typ}
        if minmax:
            a['min'] = arr.min(axis=0).tolist()
            a['max'] = arr.max(axis=0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    gl_meshes, nodes = [], []
    for name, t, P, N, UV, F in meshes:
        attrs = {
            'POSITION': acc(P.astype(np.float32), 'VEC3', 5126, 34962, True),
            'NORMAL': acc(N.astype(np.float32), 'VEC3', 5126, 34962),
            'TEXCOORD_0': acc(UV.astype(np.float32), 'VEC2', 5126, 34962),
        }
        idx = acc(F.astype(np.uint32).ravel(), 'SCALAR', 5125, 34963)
        gl_meshes.append({'name': name, 'primitives': [{'attributes': attrs, 'indices': idx, 'material': 0}]})
        nodes.append({'name': name, 'mesh': len(gl_meshes) - 1, 'translation': list(map(float, t))})
    images = []
    for data in textures:
        images.append({'bufferView': add(np.frombuffer(data, dtype=np.uint8)), 'mimeType': 'image/jpeg'})
    j = {
        'asset': {'version': '2.0', 'generator': 'steel-warden import_cockpit.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gl_meshes,
        'materials': [{'name': 'cockpit', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.9},
                       'normalTexture': {'index': 1}, 'doubleSided': True}],
        'textures': [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': images, 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}],
    }
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    while len(bin_) % 4:
        bin_.append(0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--ratio', type=float, default=0.08)
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()

    g = Glb(a.src)
    prim = g.j['meshes'][0]['primitives'][0]
    P = g.accessor(prim['attributes']['POSITION']).astype(np.float64)
    N = g.accessor(prim['attributes']['NORMAL'])
    UV = g.accessor(prim['attributes']['TEXCOORD_0'])
    I = g.accessor(prim['indices']).reshape(-1, 3)
    P += np.array(g.j['nodes'][0].get('translation', [0, 0, 0]))
    print(f'Quelle: {len(I)} Dreiecke, {len(P)} Punkte')

    mat = g.j['materials'][0]
    colour = image_bytes(g, mat['pbrMetallicRoughness']['baseColorTexture']['index'])
    normal = image_bytes(g, mat['normalTexture']['index'])
    textures = [jpeg(colour, 2048, 86), jpeg(normal, 1024, 90)]

    meshes = []
    for name, faces in split_grips(P, I).items():
        p, n, uv, f = compact(P, N, UV, faces)
        t = np.array(GRIPS[name]['pivot']) if name in GRIPS else np.zeros(3)
        meshes.append((name, t, p - t, n, uv, f))

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'raw.glb')
        write_glb(raw, meshes, textures)
        cmd = ['npx', '--yes', 'gltfpack', '-i', raw, '-o', a.out, '-si', str(a.ratio), '-kn', '-km', '-c']
        print(' '.join(cmd))
        subprocess.run(cmd, check=True, cwd=os.environ.get('GLTFPACK_DIR', ROOT))
    print(f'{a.out}: {os.path.getsize(a.out) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
