#!/usr/bin/env node
/**
 * Compact a raw editor level JSON (BoxyBlast/Bee Cube format) into the playable's
 * compact level format. Validates the level and fails loudly on anything the
 * playable runtime does not support.
 *
 * Usage: node compact-level.mjs <raw-level.json> <out.level.json>
 *
 * Compact format:
 * {
 *   v: 1,
 *   size: [W, H, D], cell, origin: [x,y,z], rot: [x,y,z], lines,
 *   cells: base64(Uint8Array W*H*D) — value = GameColor + 1, 0 = empty,
 *          index = x + W * (y + H * z)
 *   hives: [[line, color, ammo], ...] — ordered by line, then queue index
 * }
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
    console.error('Usage: node compact-level.mjs <raw-level.json> <out.level.json>');
    process.exit(1);
}

const fail = (msg) => { console.error(`[compact-level] FAIL: ${msg}`); process.exit(1); };

/** GameColor codes with a palette entry (assets/scripts/game/infrastructure/GamePalette.ts). */
const VALID_COLORS = new Set([...Array(31).keys()].filter((c) => c !== 14 && c !== 17));

const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const { x: W, y: H, z: D } = raw.GridSize;
if (![W, H, D].every((n) => Number.isInteger(n) && n > 0 && n <= 120)) fail(`grid ${W}x${H}x${D} must be 1..120 per axis`);
if (!(raw.LineCount > 0)) fail(`LineCount must be > 0, got ${raw.LineCount}`);
const cells = new Uint8Array(W * H * D);
const cubeCountByColor = new Map();

for (const cube of raw.Cubes) {
    const { x, y, z } = cube.GridPosition;
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) fail(`cube out of bounds (${x},${y},${z})`);
    if (cube.Health !== 1) fail(`unsupported cube health ${cube.Health} at (${x},${y},${z})`);
    if (!VALID_COLORS.has(cube.Color)) fail(`cube color ${cube.Color} has no palette entry`);
    const idx = x + W * (y + H * z);
    if (cells[idx] !== 0) fail(`duplicate cube at (${x},${y},${z})`);
    cells[idx] = cube.Color + 1;
    cubeCountByColor.set(cube.Color, (cubeCountByColor.get(cube.Color) ?? 0) + 1);
}

const shooters = [...raw.ShooterSpawnData];
const ammoByColor = new Map();
for (const s of shooters) {
    if (s.IsMystery || s.FrozenAmmo || s.Tunnel?.length || (s.SecondColor ?? -1) !== -1 || s.ConnectionGroup) {
        fail(`special shooter features are not supported (line ${s.Line}, index ${s.Index})`);
    }
    if (s.Line < 0 || s.Line >= raw.LineCount) fail(`shooter line ${s.Line} outside LineCount ${raw.LineCount}`);
    if (!(s.Ammo > 0)) fail(`shooter with no ammo (line ${s.Line}, index ${s.Index})`);
    if (!VALID_COLORS.has(s.Color)) fail(`shooter color ${s.Color} has no palette entry`);
    ammoByColor.set(s.Color, (ammoByColor.get(s.Color) ?? 0) + s.Ammo);
}

// Every cube must be paid for by exactly one bullet, otherwise the level can never be won (or leaves ammo).
const colors = new Set([...cubeCountByColor.keys(), ...ammoByColor.keys()]);
for (const c of colors) {
    const cubes = cubeCountByColor.get(c) ?? 0;
    const ammo = ammoByColor.get(c) ?? 0;
    if (cubes !== ammo) fail(`color ${c}: ${cubes} cubes but ${ammo} ammo`);
}

shooters.sort((a, b) => a.Line - b.Line || a.Index - b.Index);
const round = (v) => Math.round(v * 1000) / 1000;

const compact = {
    v: 1,
    size: [W, H, D],
    cell: round(raw.CellSize),
    origin: [round(raw.GridOrigin.x), round(raw.GridOrigin.y), round(raw.GridOrigin.z)],
    rot: [raw.DefaultRotation.x, raw.DefaultRotation.y, raw.DefaultRotation.z],
    lines: raw.LineCount,
    cells: Buffer.from(cells).toString('base64'),
    hives: shooters.map((s) => [s.Line, s.Color, s.Ammo]),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const out = JSON.stringify(compact);
fs.writeFileSync(outPath, out);

const rawSize = fs.statSync(inPath).size;
console.log(`[compact-level] ${raw.Cubes.length} cubes, ${shooters.length} hives, ${colors.size} colors`);
console.log(`[compact-level] ${rawSize} B -> ${out.length} B (${(100 * out.length / rawSize).toFixed(1)}%)`);
