import { VoxelGrid } from '../../../assets/scripts/game/domain/VoxelGrid';

/** Builds a grid; `filled` = [x, y, z, color] tuples. */
export function makeGrid(w: number, h: number, d: number, filled: number[][]): VoxelGrid {
    const cells = new Uint8Array(w * h * d);
    for (const [x, y, z, color] of filled) cells[x + w * (y + h * z)] = color + 1;
    return new VoxelGrid(w, h, d, cells);
}

/** Solid box of one color. */
export function solidBox(n: number, color = 0): number[][] {
    const out: number[][] = [];
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push([x, y, z, color]);
    return out;
}

/** Deterministic PRNG for fuzz tests. */
export function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
