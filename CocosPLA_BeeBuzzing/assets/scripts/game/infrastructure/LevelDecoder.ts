import { HiveSpec, LevelData } from '../domain/LevelTypes';

/** Shape produced by tools/level-compactor/compact-level.mjs. */
interface CompactLevelJson {
    v: number;
    size: [number, number, number];
    cell: number;
    rot: [number, number, number];
    lines: number;
    cells: string;
    hives: [number, number, number][];
}

function decodeBase64(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Every cube is paid for by exactly one bee, otherwise the level can never be won. */
function assertAmmoMatchesCubes(cells: Uint8Array, hives: readonly HiveSpec[]): void {
    const balance = new Map<number, number>();
    for (const v of cells) if (v) balance.set(v - 1, (balance.get(v - 1) ?? 0) + 1);
    for (const h of hives) balance.set(h.color, (balance.get(h.color) ?? 0) - h.ammo);
    for (const [color, diff] of balance) {
        if (diff !== 0) throw new Error(`[LevelDecoder] color ${color}: cubes and bees differ by ${diff}`);
    }
}

/** Decodes a compact level (pure, no engine dependency). Throws on malformed input. */
export function decodeLevel(json: unknown): LevelData {
    const raw = json as CompactLevelJson;
    if (!raw || raw.v !== 1) throw new Error(`[LevelDecoder] unsupported level version ${raw?.v}`);
    const [width, height, depth] = raw.size;
    const cells = decodeBase64(raw.cells);
    if (cells.length !== width * height * depth) {
        throw new Error(`[LevelDecoder] cell data length ${cells.length} != ${width}x${height}x${depth}`);
    }
    const hives: HiveSpec[] = raw.hives.map(([line, color, ammo], id) => {
        if (!(line >= 0 && line < raw.lines) || !(ammo > 0)) {
            throw new Error(`[LevelDecoder] invalid hive #${id}: line ${line}, ammo ${ammo}`);
        }
        return { id, line, color, ammo };
    });
    assertAmmoMatchesCubes(cells, hives);
    return {
        width,
        height,
        depth,
        cellSize: raw.cell,
        defaultRotation: raw.rot,
        lineCount: raw.lines,
        cells,
        hives,
    };
}
