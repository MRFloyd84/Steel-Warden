#!/usr/bin/env python3
"""
Builds the game's sample pack from the raw recordings in assets/sounds-raw/.

For every recipe: decode to mono 44.1 kHz, trim, optionally flatten the
level envelope, turn loops into seamless loops (equal-power crossfade of the
tail into the head), normalise, fade, and encode to MP3 (96 kbps) in
src/audio/samples/<name>.mp3. Those files are embedded into the bundle.

Requires: Python 3, numpy, ffmpeg on PATH.
Usage:   python3 tools/prepare_sounds.py
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'sounds-raw')
OUT = os.path.join(ROOT, 'src', 'audio', 'samples')
SR = 44100

# name, source file prefix, start s, end s (None = to the end), options
# kind: 'oneshot' | 'loop'   norm: ('peak', dBFS) | ('rms', dBFS)
RECIPES = [
    # Movement
    ('mech_step', 'freesound_community-mech_step_001', 0.03, 1.45, dict(norm=('peak', -1), fade_out=0.15)),
    ('motor_loop', 'Mechanical_machine_m_2', 0, None, dict(kind='loop', xfade=0.3, norm=('rms', -20))),
    ('servo_loop', 'Continuous_hydraulic_1', 0, None, dict(kind='loop', xfade=0.4, norm=('rms', -20))),
    ('servo_heavy_loop', 'Continuous_hydraulic_2', 0, None, dict(kind='loop', xfade=0.4, norm=('rms', -20))),
    ('creak_1', 'Old_rusty_heavy_stee_1', 0.05, None, dict(norm=('peak', -3), fade_out=0.1)),
    ('creak_2', 'Old_rusty_heavy_stee_2', 0.05, None, dict(norm=('peak', -3), fade_out=0.1)),
    ('creak_3', 'Old_rusty_heavy_stee_3', 0.05, None, dict(norm=('peak', -3), fade_out=0.1)),
    ('creak_4', 'Old_rusty_heavy_stee_4', 0.05, None, dict(norm=('peak', -3), fade_out=0.1)),
    ('piston_end', 'Heavy_hydraulic_pist_1', 0, None, dict(norm=('peak', -1), fade_out=0.08)),
    ('piston_short', 'Heavy_hydraulic_pist_2', 0.05, 0.98, dict(norm=('peak', -1), fade_out=0.08)),
    ('piston_rattle', 'Heavy_hydraulic_pist_4', 0.08, None, dict(norm=('peak', -1), fade_out=0.1)),
    ('hydraulic_stop', 'Heavy_industrial_hyd_1-1792874511136', 0, None, dict(norm=('peak', -3), fade_out=0.1)),

    # Cockpit and systems
    ('airflow_loop', 'old_pc_airflow_quiet_2', 0, None, dict(kind='loop', xfade=0.5, norm=('rms', -22))),
    ('reactor_loop', 'Seamless_loop_of_a_h_2', 0, None, dict(kind='loop', xfade=0.08, norm=('rms', -20))),
    ('coolant_loop', 'industrial_coolant_p_1', 0, None, dict(kind='loop', xfade=0.25, norm=('rms', -20))),
    ('hydraulic_loop', 'Heavy_industrial_hyd_1-1792874468606', 0, None, dict(kind='loop', xfade=0.15, norm=('rms', -20))),
    ('hydraulic_loop_b', 'Heavy_industrial_hyd_3', 0, None, dict(kind='loop', xfade=0.15, norm=('rms', -20))),
    ('apu_spool', 'Large_quadcopter_dro_4', 0.3, None, dict(norm=('peak', -2), fade_out=0.05)),
    ('apu_loop', 'Large_quadcopter_dro_2-1792947480431', 0.2, 1.6, dict(kind='loop', xfade=0.3, flatten=True, norm=('rms', -20))),
    ('gyro_spin', 'Large_quadcopter_dro_3', 0.15, None, dict(norm=('peak', -2), fade_out=0.4)),
    ('crt_boot', 'old_pc_and_displays__2', 0, None, dict(norm=('peak', -3), fade_out=0.3)),
    ('relay_on', 'electrical_contactor_3', 0.05, 0.5, dict(norm=('peak', -2), fade_out=0.05)),
    ('relay_off', 'electrical_contactor_3', 0.68, 1.1, dict(norm=('peak', -2), fade_out=0.05)),
    ('contactor_heavy', 'electrical_contactor_2', 0.65, 1.7, dict(norm=('peak', -1), fade_out=0.15)),
    ('valve_1', 'Heavy_steel_valve_sn_1', 0, 0.7, dict(norm=('peak', -1), fade_out=0.1)),
    ('valve_2', 'Heavy_steel_valve_sn_2', 0, 0.7, dict(norm=('peak', -1), fade_out=0.1)),
    ('valve_3', 'Heavy_steel_valve_sn_3', 0, 0.7, dict(norm=('peak', -1), fade_out=0.1)),
    ('hiss_1', 'Short_sharp_pneumati_1', 0, 0.6, dict(norm=('peak', -1), fade_out=0.1)),
    ('hiss_2', 'Short_sharp_pneumati_2', 0, 0.6, dict(norm=('peak', -1), fade_out=0.1)),
    ('hiss_3', 'Short_sharp_pneumati_3', 0, 0.6, dict(norm=('peak', -1), fade_out=0.1)),
    ('lock_clank', 'Heavy_metal_locking__1', 0, 1.2, dict(norm=('peak', -1), fade_out=0.3)),
    ('alarm_warble', 'industrial_control_p_3', 0, 2.93, dict(kind='loop', xfade=0.08, norm=('rms', -18))),
    ('alarm_critical', 'industrial_control_p_4', 0, 3.765, dict(kind='loop', xfade=0.08, norm=('rms', -18))),

    # Weapons, hangar, enemies (used from later steps on)
    ('autocannon_shot', 'machine_gun_mech_2', 0.03, 0.105, dict(norm=('peak', -1), fade_out=0.02)),
    ('autocannon_burst', 'machine_gun_mech_2', 0, None, dict(kind='loop', xfade=0.05, norm=('peak', -1))),
    ('cannon_shot', 'cannon_shoot_mech_3', 2.05, None, dict(norm=('peak', -1), fade_out=0.3)),
    ('hangar_door', 'freesound_community-big-garage-door-opening', 0, None, dict(norm=('peak', -2), fade_out=0.5)),
    ('drone_pass', 'Large_quadcopter_dro_2-1792945734918', 0.1, 2.4, dict(norm=('peak', -2), fade_out=0.3)),
]


def find_raw(prefix):
    for f in sorted(os.listdir(RAW)):
        if f.startswith(prefix):
            return os.path.join(RAW, f)
    sys.exit(f'Raw file not found for "{prefix}"')


def decode(path):
    pcm = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64)


def flatten_envelope(x, window=0.2):
    n = int(window * SR)
    rms = np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same') + 1e-12)
    gain = np.clip(np.median(rms) / rms, 0.25, 4.0)
    return x * gain


def make_loop(x, xfade):
    m = int(xfade * SR)
    t = np.linspace(0, np.pi / 2, m)
    head = x[:m] * np.sin(t)
    tail = x[-m:] * np.cos(t)
    out = x[:-m].copy()
    out[:m] = head + tail
    return out


def normalise(x, mode, db):
    target = 10 ** (db / 20)
    if mode == 'peak':
        x = x * (target / (np.max(np.abs(x)) + 1e-12))
    else:
        x = x * (target / (np.sqrt(np.mean(x * x)) + 1e-12))
    peak = np.max(np.abs(x))
    limit = 10 ** (-1 / 20)
    return x * (limit / peak) if peak > limit else x


def fade(x, fade_in, fade_out):
    if fade_in:
        n = int(fade_in * SR)
        x[:n] *= np.linspace(0, 1, n)
    if fade_out:
        n = int(fade_out * SR)
        x[-n:] *= np.linspace(1, 0, n)
    return x


def encode(x, path):
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
         '-c:a', 'libmp3lame', '-b:a', '96k', path],
        input=pcm, check=True,
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, prefix, start, end, opt in RECIPES:
        x = decode(find_raw(prefix))
        a = int(start * SR)
        b = len(x) if end is None else min(len(x), int(end * SR))
        x = x[a:b].copy()
        if opt.get('flatten'):
            x = flatten_envelope(x)
        loop = opt.get('kind') == 'loop'
        if loop:
            x = make_loop(x, opt.get('xfade', 0.1))
        x = normalise(x, *opt.get('norm', ('peak', -1)))
        if not loop:
            x = fade(x, opt.get('fade_in', 0.003), opt.get('fade_out', 0))
        path = os.path.join(OUT, f'{name}.mp3')
        encode(x, path)
        size = os.path.getsize(path)
        total += size
        print(f'{name:18} {len(x) / SR:6.2f} s  {"loop" if loop else "    "}  {size / 1024:6.1f} KB')
    print(f'{len(RECIPES)} samples, {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
