"""Minimal glTF 2.0 / GLB reader (numpy): nodes, skinned meshes in bind pose, base-colour texture.

Used by tools/import_walkers.py. Only what the Tripo exports need: triangles, POSITION,
TEXCOORD_0, JOINTS_0/WEIGHTS_0, one skin, embedded images.
"""
import io
import json
import struct

import numpy as np
from PIL import Image

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, path):
        data = open(path, 'rb').read()
        if data[:4] != b'glTF':
            raise ValueError(f'{path}: kein GLB')
        off = 12
        self.json, self.bin = None, b''
        while off < len(data):
            n, kind = struct.unpack('<II', data[off:off + 8])
            chunk = data[off + 8:off + 8 + n]
            if kind == 0x4E4F534A:
                self.json = json.loads(chunk)
            elif kind == 0x004E4942:
                self.bin = chunk
            off += 8 + n
        self.j = self.json
        self._world = None

    def accessor(self, i):
        a = self.j['accessors'][i]
        bv = self.j['bufferViews'][a['bufferView']]
        dt = np.dtype(COMP[a['componentType']])
        nc = NCOMP[a['type']]
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0) or dt.itemsize * nc
        count = a['count']
        raw = np.frombuffer(self.bin, dtype=np.uint8, count=stride * (count - 1) + dt.itemsize * nc, offset=start)
        if stride == dt.itemsize * nc:
            arr = raw.view(dt).reshape(count, nc).copy()
        else:
            arr = np.lib.stride_tricks.as_strided(raw, shape=(count, dt.itemsize * nc), strides=(stride, 1)).copy().view(dt).reshape(count, nc)
        if a.get('normalized'):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr

    # ---- scene graph ----
    @staticmethod
    def local_matrix(node):
        if 'matrix' in node:
            return np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
        t = np.array(node.get('translation', [0, 0, 0]), dtype=np.float64)
        x, y, z, w = node.get('rotation', [0, 0, 0, 1])
        s = np.array(node.get('scale', [1, 1, 1]), dtype=np.float64)
        r = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ])
        m = np.eye(4)
        m[:3, :3] = r * s
        m[:3, 3] = t
        return m

    def world(self):
        if self._world is not None:
            return self._world
        nodes = self.j['nodes']
        parent = {}
        for i, n in enumerate(nodes):
            for c in n.get('children', []):
                parent[c] = i
        out = [None] * len(nodes)

        def w(i):
            if out[i] is None:
                m = self.local_matrix(nodes[i])
                out[i] = w(parent[i]) @ m if i in parent else m
            return out[i]

        for i in range(len(nodes)):
            w(i)
        self._world = out
        return out

    def joint_positions(self):
        """name → world position (bind pose) of every skin joint."""
        if not self.j.get('skins'):
            return {}
        W = self.world()
        return {self.j['nodes'][i].get('name', str(i)): W[i][:3, 3].copy() for i in self.j['skins'][0]['joints']}

    def base_color_image(self):
        for m in self.j.get('materials', []):
            t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if t is None:
                continue
            img = self.j['images'][self.j['textures'][t['index']]['source']]
            bv = self.j['bufferViews'][img['bufferView']]
            raw = self.bin[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
            return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.float32) / 255
        return None

    def triangles(self):
        """All triangles in bind pose: positions (n,3,3), uv (n,3,2), joint name weights per vertex.

        Returns (pos, uv, joints, weights, joint_names, node); joints index into joint_names, -1 = none;
        node = index of the mesh node each triangle came from.
        """
        W = self.world()
        skin = (self.j.get('skins') or [None])[0]
        names = [self.j['nodes'][i].get('name', str(i)) for i in skin['joints']] if skin else []
        skin_mats = None
        if skin:
            ibm = self.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1).astype(np.float64)
            skin_mats = np.stack([W[jn] @ ibm[k] for k, jn in enumerate(skin['joints'])])
        P, U, J, Wt, N = [], [], [], [], []
        for ni, node in enumerate(self.j['nodes']):
            if 'mesh' not in node:
                continue
            for prim in self.j['meshes'][node['mesh']]['primitives']:
                if prim.get('mode', 4) != 4:
                    continue
                at = prim['attributes']
                pos = self.accessor(at['POSITION']).astype(np.float64)
                uv = self.accessor(at['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in at else np.zeros((len(pos), 2), np.float32)
                idx = self.accessor(prim['indices']).reshape(-1) if 'indices' in prim else np.arange(len(pos))
                h = np.c_[pos, np.ones(len(pos))]
                if skin_mats is not None and 'skin' in node and 'JOINTS_0' in at:
                    jj = self.accessor(at['JOINTS_0']).astype(np.int64)
                    ww = self.accessor(at['WEIGHTS_0']).astype(np.float64)
                    tot = ww.sum(1, keepdims=True)
                    ww = ww / np.maximum(tot, 1e-9)
                    M = np.einsum('vk,vkij->vij', ww, skin_mats[jj])
                    world = np.einsum('vij,vj->vi', M, h)[:, :3]
                    unweighted = tot[:, 0] < 1e-6  # no weights: rigid with the mesh node
                    world[unweighted] = (h[unweighted] @ W[ni].T)[:, :3]
                else:
                    world = (h @ W[ni].T)[:, :3]
                    jj = np.full((len(pos), 4), -1, np.int64)
                    ww = np.zeros((len(pos), 4))
                tri = idx.reshape(-1, 3)
                P.append(world[tri])
                U.append(uv[tri])
                J.append(jj[tri])
                Wt.append(ww[tri])
                N.append(np.full(len(tri), ni))
        return np.concatenate(P), np.concatenate(U), np.concatenate(J), np.concatenate(Wt), names, np.concatenate(N)
