#!/usr/bin/env python3
"""
Imports the low-res detail textures into assets/textures/ (grayscale PNG, max. 128 px).

    python3 tools/import_textures.py --sbs "<path>/Base Materials 256x256"

Each entry below is either a file from the Screaming Brain Studios "Base Materials
256x256" pack (CC0) or a procedural generator ("gen:…", made here, CC0 like the
project). Every texture is converted to grayscale, resized to SIZE, and normalised
to mean 0.5 and a common contrast, so a strength of e.g. 0.3 looks alike for all.
Generated textures tile seamlessly (periodic noise, wrap-around Voronoi).

Keep src/data/textures.js in step: the id, tile size and source live there.
"""
import argparse
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures')
SIZE = 128
TARGET_STD = 0.16  # common contrast after normalising

TEXTURES = {
    # terrain
    'ground-gravel': 'sbs:Stone/Mat_Stone_Brown_01-256x256.png',
    'ground-dirt': 'sbs:Plaster/Mat_Plaster_Brown_01-256x256.png',
    'ground-mud': 'sbs:Clay/Mat_Clay_Red_07-256x256.png',
    'ground-rock': 'sbs:Stone/Mat_Stone_Black_01-256x256.png',
    'ground-snow': 'sbs:Plaster/Mat_Plaster_White_01-256x256.png',
    'ground-ice': 'sbs:Marble/Mat_Marble_White_01-256x256.png',
    'ground-dust': 'sbs:Plaster/Mat_Plaster_Gray_03-256x256.png',
    'ground-sand': 'gen:sand',
    'ground-lava': 'gen:lava',
    'ground-crystal': 'gen:crystal',
    # objects
    'mat-concrete': 'sbs:Concrete/Mat_Concrete_Gray_03-256x256.png',
    'mat-plaster': 'sbs:Plaster/Mat_Plaster_Gray_01-256x256.png',
    'mat-wood': 'sbs:Wood/Mat_Wood_Brown_01-256x256.png',
    'mat-stone': 'sbs:Stone/Mat_Stone_Dark_01-256x256.png',
    'mat-metal': 'gen:metal',
    'mat-tank': 'gen:tank',
    'mat-crystal': 'gen:crystal',
}


def periodic_noise(rng, size, octaves=((4, 1.0), (8, 0.5), (16, 0.25), (32, 0.12))):
    """Sum of random cosine waves with integer frequencies — tiles seamlessly."""
    y, x = np.mgrid[0:size, 0:size] / size
    out = np.zeros((size, size))
    for freq, amp in octaves:
        for _ in range(6):
            fx, fy = rng.integers(-freq, freq + 1, 2)
            if fx == 0 and fy == 0:
                continue
            out += amp * np.cos(2 * np.pi * (fx * x + fy * y) + rng.uniform(0, 2 * np.pi))
    return out


def voronoi(rng, size, cells):
    """Distance to nearest / second nearest feature point, wrapping at the edges."""
    pts = rng.uniform(0, size, (cells, 2))
    y, x = np.mgrid[0:size, 0:size]
    d = np.full((cells, size, size), np.inf)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(x - px)
        dy = np.abs(y - py)
        dx = np.minimum(dx, size - dx)
        dy = np.minimum(dy, size - dy)
        d[i] = np.hypot(dx, dy)
    d.sort(axis=0)
    return d[0], d[1]


def gen(kind, size=SIZE, seed=7):
    rng = np.random.default_rng(seed + sum(map(ord, kind)))  # stable per kind
    y, x = np.mgrid[0:size, 0:size] / size
    if kind == 'metal':
        # plates with seams, light mottling and a few rivets
        img = 0.55 + 0.012 * periodic_noise(rng, size, ((4, 1), (16, 0.4)))
        img += 0.04 * rng.uniform(-1, 1, (size, size))
        # plates: one shade each, seams between them
        img += 0.05 * np.sign(np.sin(np.floor(x * 2) * 3.1 + np.floor(y * 2 + (np.floor(x * 2) % 2) * 0.5) * 1.7))
        seam = (np.mod(x * 2, 1) < 0.018) | (np.mod(y * 2 + (np.floor(x * 2) % 2) * 0.5, 1) < 0.018)
        img[seam] -= 0.3
        for cx in (0.04, 0.46, 0.54, 0.96):
            for cy in (0.04, 0.46, 0.54, 0.96):
                img[np.hypot(x - cx, y - cy) < 0.011] += 0.25
        return img
    if kind == 'tank':
        # horizontal weld bands, vertical streaks
        img = 0.55 + 0.01 * periodic_noise(rng, size, ((4, 1),)) + 0.035 * rng.uniform(-1, 1, (size, size))
        img -= 0.3 * (np.mod(y * 4, 1) < 0.02)
        # rust streaks running down from the welds
        streak = np.clip(periodic_noise(rng, size, ((16, 1),))[0:1, :] * 0.04, 0, None)
        img -= streak * (1 - np.mod(y * 4, 1))
        return img
    if kind == 'crystal':
        d1, d2 = voronoi(rng, size, 14)
        return 0.4 + 0.6 * np.clip((d2 - d1) / 18, 0, 1) + 0.05 * periodic_noise(rng, size, ((16, 1),))
    if kind == 'lava':
        d1, d2 = voronoi(rng, size, 18)
        crack = np.clip((d2 - d1) / 6, 0, 1)  # dark cracks between crust plates
        return 0.25 + 0.6 * crack + 0.08 * periodic_noise(rng, size, ((8, 1), (16, 0.5)))
    if kind == 'sand':
        warp = 0.015 * periodic_noise(rng, size, ((1, 1), (2, 0.5)))
        ripples = np.cos(2 * np.pi * (5 * y + 1 * x + warp * 5))
        return 0.5 + 0.1 * ripples + 0.12 * rng.uniform(-1, 1, (size, size))
    raise ValueError(kind)


def normalise(a):
    a = a.astype(np.float64)
    a = (a - a.mean()) / max(a.std(), 1e-6) * TARGET_STD + 0.5
    return np.clip(a, 0, 1)


def load_sbs(root, rel):
    img = Image.open(os.path.join(root, rel)).convert('L').resize((SIZE, SIZE), Image.LANCZOS)
    return np.asarray(img) / 255.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sbs', required=True, help='folder "Base Materials 256x256" of the SBS pack')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for tid, src in TEXTURES.items():
        kind, ref = src.split(':', 1)
        a = load_sbs(args.sbs, ref) if kind == 'sbs' else gen(ref)
        img = Image.fromarray((normalise(a) * 255).round().astype(np.uint8), 'L')
        path = os.path.join(OUT, f'{tid}.png')
        img.save(path, optimize=True)
        print(f'{tid:16} {src:52} {os.path.getsize(path):6} B')


if __name__ == '__main__':
    main()
