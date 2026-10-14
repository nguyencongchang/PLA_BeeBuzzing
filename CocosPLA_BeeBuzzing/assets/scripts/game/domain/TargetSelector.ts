import { VoxelGrid } from './VoxelGrid';
import { ReachabilitySolver } from './ReachabilitySolver';

/** Tier offset so rounded view coordinates stay positive inside the packed sort key. */
const TIER_OFFSET = 128;
const TIER_RANGE = 256;

/**
 * Picks which cube a hive shoots next.
 *
 * Among reachable, unreserved cubes of the hive's color the priority is:
 * closest to the camera → highest on screen → right-most, each measured in whole
 * cells, so bees peel the face the player is looking at, layer by layer.
 *
 * `view` is a row-major 3x3 matrix mapping a grid offset (from the grid center, in
 * cells) to view space rows: [right, up, toward-camera].
 */
export class TargetSelector {
    private readonly grid: VoxelGrid;
    private readonly solver: ReachabilitySolver;
    private readonly keys: Float64Array;
    private readonly lists = new Map<number, number[]>();
    private readonly cursors = new Map<number, number>();
    private readonly compareByKeyDesc = (a: number, b: number): number => this.keys[b] - this.keys[a];

    constructor(grid: VoxelGrid, solver: ReachabilitySolver) {
        // Rounded view coordinates must fit the packed key: |offset| ≤ half the grid diagonal.
        const maxExtent = Math.hypot(grid.width, grid.height, grid.depth) / 2;
        if (maxExtent >= TIER_OFFSET) throw new Error(`[TargetSelector] grid too large for sort key (${maxExtent.toFixed(0)} cells)`);
        this.grid = grid;
        this.solver = solver;
        this.keys = new Float64Array(grid.cellCount);
    }

    /** Rebuilds the per-color priority lists from the solver's current state. */
    rebuild(view: ArrayLike<number>): void {
        const g = this.grid;
        const cx = (g.width - 1) / 2, cy = (g.height - 1) / 2, cz = (g.depth - 1) / 2;
        this.lists.forEach((list) => { list.length = 0; });
        this.cursors.clear();

        for (let i = 0; i < g.cellCount; i++) {
            if (!this.solver.isReachable(i)) continue;
            const dx = g.xs[i] - cx, dy = g.ys[i] - cy, dz = g.zs[i] - cz;
            const right = Math.round(view[0] * dx + view[1] * dy + view[2] * dz) + TIER_OFFSET;
            const up = Math.round(view[3] * dx + view[4] * dy + view[5] * dz) + TIER_OFFSET;
            const toward = Math.round(view[6] * dx + view[7] * dy + view[8] * dz) + TIER_OFFSET;
            this.keys[i] = (toward * TIER_RANGE + up) * TIER_RANGE + right;

            const color = g.colorAt(i);
            let list = this.lists.get(color);
            if (!list) {
                list = [];
                this.lists.set(color, list);
            }
            list.push(i);
        }
        this.lists.forEach((list) => list.sort(this.compareByKeyDesc));
    }

    /** Best target of a color, or -1. Skips cubes removed or reserved since the last rebuild. */
    next(color: number, reserved: Uint8Array): number {
        const list = this.lists.get(color);
        if (!list) return -1;
        let cursor = this.cursors.get(color) ?? 0;
        while (cursor < list.length) {
            const i = list[cursor];
            if (this.grid.isAlive(i) && reserved[i] === 0) {
                this.cursors.set(color, cursor);
                return i;
            }
            cursor++;
        }
        this.cursors.set(color, cursor);
        return -1;
    }
}
