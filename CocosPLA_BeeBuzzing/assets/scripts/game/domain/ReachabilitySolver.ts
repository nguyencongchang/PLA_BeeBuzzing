import { VoxelGrid } from './VoxelGrid';
import { DIR_COUNT, DIR_X, DIR_Y, DIR_Z } from './GridDirections';

const UNREACHABLE = 255;

/**
 * Decides which cubes a bee can pull out from the current view.
 *
 * Rule: a bee leaves the target through one of its faces, travels straight through
 * empty cells and may turn 90° at most `maxTurns` times. It escapes when it leaves the
 * grid bounds while heading in a camera-facing direction (`exitMask`). Leaving the grid
 * in a non camera-facing direction is a dead end.
 *
 * Implementation: one reverse layered 0-1 BFS per solve computes, for every
 * (cell, direction) pair, h = minimum number of turns needed to escape when stepping
 * out of that cell in that direction. Cost is O(cells * 6) with zero allocations.
 *
 *   h(p, e) = 0                                   if p+e is outside and e ∈ exitMask
 *   h(p, e) = min(h(q, e), 1 + min_{d⊥e} h(q, d)) if q = p+e is inside and empty
 *
 * Removing cubes only ever opens paths, so a stale solve is always conservative.
 */
export class ReachabilitySolver {
    readonly maxTurns: number;

    private readonly grid: VoxelGrid;
    /** h(p, e) at index p * 6 + e. */
    private readonly cost: Uint8Array;
    private bufA: Int32Array;
    private bufB: Int32Array;
    private solvedVersion = -1;
    private solvedMask = -1;

    constructor(grid: VoxelGrid, maxTurns: number) {
        if (maxTurns < 0 || maxTurns > 250) throw new Error(`[ReachabilitySolver] invalid maxTurns ${maxTurns}`);
        this.grid = grid;
        this.maxTurns = maxTurns;
        const states = grid.cellCount * DIR_COUNT;
        this.cost = new Uint8Array(states);
        this.bufA = new Int32Array(states);
        this.bufB = new Int32Array(states);
    }

    /** True when the last solve used the same exit mask and grid version. */
    isUpToDate(exitMask: number): boolean {
        return this.solvedMask === exitMask && this.solvedVersion === this.grid.version;
    }

    solve(exitMask: number): void {
        const g = this.grid;
        const cost = this.cost;
        cost.fill(UNREACHABLE);

        // Layer 0 seeds: every step that leaves the grid toward the camera.
        let cur = this.bufA;
        let next = this.bufB;
        let curLen = 0;
        for (let p = 0; p < g.cellCount; p++) {
            const x = g.xs[p], y = g.ys[p], z = g.zs[p];
            for (let e = 0; e < DIR_COUNT; e++) {
                if (((exitMask >> e) & 1) === 0) continue;
                if (g.inBounds(x + DIR_X[e], y + DIR_Y[e], z + DIR_Z[e])) continue;
                const s = p * DIR_COUNT + e;
                cost[s] = 0;
                cur[curLen++] = s;
            }
        }

        for (let v = 0; v <= this.maxTurns && curLen > 0; v++) {
            let nextLen = 0;
            const canTurn = v + 1 <= this.maxTurns;
            // `cur` grows while it is processed (straight moves keep the same cost).
            for (let head = 0; head < curLen; head++) {
                const s = cur[head];
                if (cost[s] !== v) continue; // stale entry
                const p = (s / DIR_COUNT) | 0;
                if (g.isAlive(p)) continue; // a cube is a path start, never a corridor
                const e = s - p * DIR_COUNT;
                const x = g.xs[p], y = g.ys[p], z = g.zs[p];

                // Straight predecessor: stepping from p-e in direction e.
                const sx = x - DIR_X[e], sy = y - DIR_Y[e], sz = z - DIR_Z[e];
                if (g.inBounds(sx, sy, sz)) {
                    const ps = g.index(sx, sy, sz) * DIR_COUNT + e;
                    if (cost[ps] > v) {
                        cost[ps] = v;
                        cur[curLen++] = ps;
                    }
                }
                if (!canTurn) continue;

                // Turn predecessors: arrived at p heading d (⊥ e), turned to e.
                for (let d = 0; d < DIR_COUNT; d++) {
                    if ((d >> 1) === (e >> 1)) continue;
                    const tx = x - DIR_X[d], ty = y - DIR_Y[d], tz = z - DIR_Z[d];
                    if (!g.inBounds(tx, ty, tz)) continue;
                    const ts = g.index(tx, ty, tz) * DIR_COUNT + d;
                    if (cost[ts] > v + 1) {
                        cost[ts] = v + 1;
                        next[nextLen++] = ts;
                    }
                }
            }
            const tmp = cur;
            cur = next;
            next = tmp;
            curLen = nextLen;
        }

        this.solvedMask = exitMask;
        this.solvedVersion = g.version;
    }

    /** Minimum turns to escape when leaving cell i through face d (255 = never). */
    stepCost(i: number, d: number): number {
        return this.cost[i * DIR_COUNT + d];
    }

    /** Best exit face of an alive cube, or -1 if it cannot be pulled out. */
    bestFace(i: number): number {
        if (!this.grid.isAlive(i)) return -1;
        let best = -1;
        let bestCost = UNREACHABLE;
        const base = i * DIR_COUNT;
        for (let d = 0; d < DIR_COUNT; d++) {
            const c = this.cost[base + d];
            if (c < bestCost) {
                bestCost = c;
                best = d;
            }
        }
        return bestCost <= this.maxTurns ? best : -1;
    }

    isReachable(i: number): boolean {
        return this.bestFace(i) !== -1;
    }

    /**
     * Escape route of a reachable cube as flat grid coordinates
     * [x0,y0,z0, x1,y1,z1, ...]: target, every corner, then the first cell outside the grid.
     * Uses the fewest turns the cube needs, each taken as early as possible (the shortest such route
     * hugs the model instead of detouring through the grid's empty margins).
     * Returns false if the cube is not reachable.
     */
    tracePath(i: number, out: number[]): boolean {
        out.length = 0;
        let dir = this.bestFace(i);
        if (dir === -1) return false;
        const g = this.grid;
        let budget = this.cost[i * DIR_COUNT + dir];
        let x = g.xs[i], y = g.ys[i], z = g.zs[i];
        out.push(x, y, z);

        for (let guard = 0; guard <= g.cellCount; guard++) {
            x += DIR_X[dir];
            y += DIR_Y[dir];
            z += DIR_Z[dir];
            if (!g.inBounds(x, y, z)) {
                out.push(x, y, z);
                return true;
            }
            const q = g.index(x, y, z);
            // Turn at the first cell where a turn still escapes within the budget (fewest turns left
            // after it first): going on straight could run to the far edge of the grid's empty space
            // before turning, a long detour away from the model.
            let turn = -1;
            for (let d = 0; d < DIR_COUNT; d++) {
                if ((d >> 1) === (dir >> 1)) continue;
                const c = this.cost[q * DIR_COUNT + d];
                if (c + 1 <= budget && (turn === -1 || c < this.cost[q * DIR_COUNT + turn])) turn = d;
            }
            if (turn !== -1) {
                out.push(x, y, z);
                dir = turn;
                budget--;
                continue;
            }
            if (this.cost[q * DIR_COUNT + dir] > budget) throw new Error('[ReachabilitySolver] inconsistent cost field while tracing');
        }
        throw new Error('[ReachabilitySolver] path trace exceeded grid size');
    }
}
