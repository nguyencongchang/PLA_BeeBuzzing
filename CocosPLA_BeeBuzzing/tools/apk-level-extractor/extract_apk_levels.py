#!/usr/bin/env python3
"""
Extract the Bee Buzzing sculpture levels (Unity `LevelData` ScriptableObjects) from the game's
APK and write each one in the raw editor level JSON format (GridSize, Cubes, ShooterSpawnData…),
the same format as `Marketing_teddy_burgundy.json`. Feed any output file to
`tools/level-compactor/compact-level.mjs` to get a playable `.level.json`.

Usage:
    python3 extract_apk_levels.py <Bee-Buzzing.apks | base.apk | data.unity3d> <out-dir>

Requires UnityPy (`pip install UnityPy`). The build is IL2CPP with stripped type trees, so the
MonoBehaviour bytes are decoded by hand (layout reverse-engineered from game version 0.2.6):

    LevelData : name, GridSize int3, CellSize f32, GridOrigin f3, DefaultRotation f3, f32 (unknown, 1.0),
                Cubes[]: {x, y, z, Color, Health, 3 × int feature flags},
                6 × int (obstacle groups), LineCount, ShooterSpawnData[]
    Shooter   : Color, Ammo, Line, Index, ConnectionGroup, int, flag (mystery-like), int, int,
                Tunnel[]: {Color, Ammo, int},
                TunnelSlotCount, SecondColor, SecondAmmo, 6 × int, int (1), int, int (1)

Only levels the playable can run are exported: obstacles, multi-hit or special cubes and
frozen/tunnel/two-color hives are skipped (listed in index.json with the reason). Hive connection
groups and the mystery-like flag are dropped (the hives become plain ones; `droppedHiveFeatures`
counts them), which never makes a level unwinnable since ammo still matches cubes per color. Every exported level is checked so that the ammo of
each color equals its cube count.
"""
import io
import json
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path

import UnityPy

LEVEL_CLASS = 'LevelData'
CUBE_INTS = 8
SHOOTER_HEAD_INTS = 10  # color, ammo, line, index, 5 flags, tunnel count
SHOOTER_TAIL = (1, -1, 0, 0, 0, 0, 0, 0, 1, 0, 1)  # slot count 1, no second color, flags off
VALID_COLORS = set(range(31)) - {14, 17}


def load_unity_data(path: Path) -> bytes:
    """Returns `assets/bin/Data/data.unity3d` from an .apks, an .apk or the file itself."""
    if path.suffix == '.apks':
        with zipfile.ZipFile(path) as apks:
            return load_unity_data_from_apk(apks.read('base.apk'))
    if path.suffix == '.apk':
        return load_unity_data_from_apk(path.read_bytes())
    return path.read_bytes()


def load_unity_data_from_apk(apk: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(apk)) as z:
        return z.read('assets/bin/Data/data.unity3d')


class Reader:
    def __init__(self, raw: bytes, pos: int = 0):
        self.raw, self.pos = raw, pos

    def ints(self, n: int) -> tuple:
        values = struct.unpack_from(f'<{n}i', self.raw, self.pos)
        self.pos += 4 * n
        return values

    def int(self) -> int:
        return self.ints(1)[0]

    def floats(self, n: int) -> tuple:
        values = struct.unpack_from(f'<{n}f', self.raw, self.pos)
        self.pos += 4 * n
        return values

    def string(self) -> str:
        n = self.int()
        text = self.raw[self.pos:self.pos + n].decode('utf-8')
        self.pos += (n + 3) & ~3
        return text


def decode_level(raw: bytes) -> dict:
    """Decodes one LevelData MonoBehaviour; raises ValueError for unsupported mechanics."""
    r = Reader(raw, 28)  # skip m_GameObject, m_Enabled, m_Script
    name = r.string()
    gx, gy, gz = r.ints(3)
    cell, = r.floats(1)
    origin, rotation = r.floats(3), r.floats(3)
    r.floats(1)
    cubes = [r.ints(CUBE_INTS) for _ in range(r.int())]
    obstacles = r.ints(6)
    line_count = r.int()
    shooters = []
    for _ in range(r.int()):
        head = r.ints(SHOOTER_HEAD_INTS)
        tunnel = r.ints(3 * head[9])
        tail = r.ints(len(SHOOTER_TAIL))
        shooters.append((head, tunnel, tail))

    if any(obstacles):
        raise ValueError('obstacle groups')
    if len({c[:3] for c in cubes}) != len(cubes):
        raise ValueError('duplicate cubes')
    for x, y, z, color, health, *flags in cubes:
        if not (0 <= x < gx and 0 <= y < gy and 0 <= z < gz):
            raise ValueError('cubes outside GridSize')
        if color not in VALID_COLORS:
            raise ValueError(f'special cube color {color}')
        if health != 1 or any(flags):
            raise ValueError('multi-hit or special cubes')
    dropped = 0
    for head, tunnel, tail in shooters:
        if head[5] or head[7] or head[8] or tunnel or tail != SHOOTER_TAIL:
            raise ValueError('special hives')
        dropped += bool(head[4] or head[6])
        if head[0] not in VALID_COLORS or not 0 <= head[2] < line_count:
            raise ValueError(f'invalid hive {head[:4]}')

    cube_count = Counter(c[3] for c in cubes)
    ammo = Counter()
    for head, _, _ in shooters:
        ammo[head[0]] += head[1]
    if cube_count != ammo:
        raise ValueError(f'ammo does not match cubes ({dict(cube_count)} vs {dict(ammo)})')

    return {
        'Name': name,
        'GridSize': {'x': gx, 'y': gy, 'z': gz},
        'CellSize': cell,
        'GridOrigin': dict(zip('xyz', origin)),
        'DefaultRotation': dict(zip('xyz', rotation)),
        'Cubes': [{'GridPosition': {'x': x, 'y': y, 'z': z}, 'Color': color, 'Health': 1}
                  for x, y, z, color, *_ in cubes],
        'LineCount': line_count,
        'DroppedHiveFeatures': dropped,
        'ShooterSpawnData': [{
            'Color': h[0], 'Ammo': h[1], 'Line': h[2], 'Index': h[3], 'ConnectionGroup': 0,
            'IsMystery': False, 'FrozenAmmo': 0, 'Tunnel': [], 'TunnelSlotCount': 1,
            'SecondColor': -1, 'SecondAmmo': 0,
        } for h, _, _ in shooters],
    }


def level_behaviours(env):
    """Yields the raw bytes of every MonoBehaviour whose script class is LevelData."""
    level_scripts = {(o.assets_file, o.path_id) for o in env.objects
                     if o.type.name == 'MonoScript' and o.read().m_ClassName == LEVEL_CLASS}
    for o in env.objects:
        if o.type.name != 'MonoBehaviour':
            continue
        raw = o.get_raw_data()
        file_id, path_id = struct.unpack_from('<iq', raw, 16)
        if any(pid == path_id for _, pid in level_scripts):
            yield raw


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    env = UnityPy.load(load_unity_data(src))
    index = []
    for raw in level_behaviours(env):
        try:
            level = decode_level(raw)
        except (ValueError, struct.error) as err:
            name = Reader(raw, 28).string()
            index.append({'name': name, 'exported': False, 'reason': str(err)})
            continue
        (out / f"{level['Name']}.json").write_text(json.dumps(level, indent=1))
        g = level['GridSize']
        index.append({
            'name': level['Name'], 'exported': True, 'size': [g['x'], g['y'], g['z']],
            'cubes': len(level['Cubes']), 'hives': len(level['ShooterSpawnData']),
            'lines': level['LineCount'], 'colors': len({c['Color'] for c in level['Cubes']}),
            'droppedHiveFeatures': level['DroppedHiveFeatures'],
        })
    index.sort(key=lambda e: (int(e['name'].split('_')[0]) if e['name'].split('_')[0].isdigit() else 1 << 30, e['name']))
    (out / 'index.json').write_text(json.dumps(index, indent=1))
    exported = sum(e['exported'] for e in index)
    print(f'[extract-apk-levels] {exported}/{len(index)} levels exported to {out}')
    for reason, n in Counter(e['reason'].split(' (')[0] for e in index if not e['exported']).most_common():
        print(f'  skipped {n}: {reason}')


if __name__ == '__main__':
    main()
