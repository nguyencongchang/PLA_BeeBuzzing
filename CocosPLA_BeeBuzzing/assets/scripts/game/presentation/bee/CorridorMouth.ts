import { Vec3 } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/**
 * Where a bee waits for a cube buried down a tight corridor: the first cell (counting outward from
 * the target along the solver route) past the last route cell with cubes on two opposite sides —
 * narrower than a bee — so the bee never squeezes into the model; the cube slides out to it instead.
 * Returns that distance in cells (0 when the route has no such cell: the bee clings on the cube
 * face) and writes the outward direction of the route there, sculpture-local, into `outDir`.
 */
export function corridorMouth(route: readonly number[], grid: VoxelGrid, outDir: Vec3): number {
    const target = grid.index(route[0], route[1], route[2]);
    let walked = 0, mouth = 0;
    for (let k = 3; k < route.length; k += 3) {
        const dx = Math.sign(route[k] - route[k - 3]), dy = Math.sign(route[k + 1] - route[k - 2]), dz = Math.sign(route[k + 2] - route[k - 1]);
        const steps = Math.abs(route[k] - route[k - 3]) + Math.abs(route[k + 1] - route[k - 2]) + Math.abs(route[k + 2] - route[k - 1]);
        for (let t = 1; t <= steps; t++) {
            const x = route[k - 3] + dx * t, y = route[k - 2] + dy * t, z = route[k - 1] + dz * t;
            walked++;
            // The step into the mouth cell: the bee there looks back down the corridor.
            if (walked === mouth) outDir.set(dx, dy, -dz); // grid Z is mirrored in local space
            if (!grid.inBounds(x, y, z)) return mouth;
            if (squeezed(grid, x, y, z, target)) mouth = walked + 1;
        }
    }
    return mouth;
}

/** True when cubes (other than the target) sit on both sides of the cell along some axis. */
function squeezed(grid: VoxelGrid, x: number, y: number, z: number, target: number): boolean {
    for (const [ox, oy, oz] of AXES) {
        if (isWall(grid, x + ox, y + oy, z + oz, target) && isWall(grid, x - ox, y - oy, z - oz, target)) return true;
    }
    return false;
}

function isWall(grid: VoxelGrid, x: number, y: number, z: number, target: number): boolean {
    if (!grid.inBounds(x, y, z)) return false;
    const i = grid.index(x, y, z);
    return i !== target && grid.isAlive(i);
}
