import { primitives } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { DIR_COUNT, DIR_X, DIR_Y, DIR_Z } from '../../domain/GridDirections';
import { GridSpace } from './GridSpace';

/**
 * Per grid direction: local-space face normal n and tangents u, v with u × v = n so
 * the quad (−u−v, +u−v, +u+v, −u+v) is counter-clockwise seen from outside.
 * Grid Z is mirrored into local space (level data is left-handed), see GridSpace.
 */
const FACE_FRAMES: readonly (readonly number[])[] = [
    /* +X */ [1, 0, 0, 0, 1, 0, 0, 0, 1],
    /* -X */ [-1, 0, 0, 0, 0, 1, 0, 1, 0],
    /* +Y */ [0, 1, 0, 0, 0, 1, 1, 0, 0],
    /* -Y */ [0, -1, 0, 1, 0, 0, 0, 0, 1],
    /* +Z (grid) → -Z local */ [0, 0, -1, 0, 1, 0, 1, 0, 0],
    /* -Z (grid) → +Z local */ [0, 0, 1, 1, 0, 0, 0, 1, 0],
];
const CORNER_SIGNS = [-1, -1, 1, -1, 1, 1, -1, 1];
const CORNER_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

/**
 * Builds face-culled geometry for one chunk of the voxel grid: only faces touching an
 * empty cell (or the grid border) are emitted, colored per vertex from the palette.
 */
export class SculptureMesher {
    private readonly grid: VoxelGrid;
    private readonly space: GridSpace;
    /** sRGB 0..1 triplets indexed by game color. */
    private readonly palette: Float32Array;

    constructor(grid: VoxelGrid, space: GridSpace, palette: Float32Array) {
        this.grid = grid;
        this.space = space;
        this.palette = palette;
    }

    /** Geometry for cells in [x0,x1) × [y0,y1) × [z0,z1), or null when the chunk has no face. */
    build(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): primitives.IGeometry | null {
        const g = this.grid;
        const half = this.space.cellSize / 2;
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        const center = [0, 0, 0];

        for (let z = z0; z < z1; z++) {
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = g.index(x, y, z);
                    if (!g.isAlive(i)) continue;
                    this.space.cellToLocalArray(x, y, z, center);
                    const c = g.colorAt(i) * 3;
                    const r = this.palette[c], gr = this.palette[c + 1], b = this.palette[c + 2];

                    for (let d = 0; d < DIR_COUNT; d++) {
                        const nx = x + DIR_X[d], ny = y + DIR_Y[d], nz = z + DIR_Z[d];
                        if (g.inBounds(nx, ny, nz) && g.isAlive(g.index(nx, ny, nz))) continue;

                        const f = FACE_FRAMES[d];
                        const base = positions.length / 3;
                        for (let k = 0; k < 4; k++) {
                            const su = CORNER_SIGNS[k * 2], sv = CORNER_SIGNS[k * 2 + 1];
                            positions.push(
                                center[0] + half * (f[0] + su * f[3] + sv * f[6]),
                                center[1] + half * (f[1] + su * f[4] + sv * f[7]),
                                center[2] + half * (f[2] + su * f[5] + sv * f[8]),
                            );
                            normals.push(f[0], f[1], f[2]);
                            uvs.push(CORNER_UVS[k * 2], CORNER_UVS[k * 2 + 1]);
                            colors.push(r, gr, b, 1);
                        }
                        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
                    }
                }
            }
        }
        if (indices.length === 0) return null;
        return { positions, normals, uvs, colors, indices };
    }
}
