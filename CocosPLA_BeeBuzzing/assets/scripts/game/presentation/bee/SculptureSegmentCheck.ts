import { Mat4, Node, Vec3 } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { GridSpace } from '../sculpture/GridSpace';

/** Gap kept from any cube (cells): covers the bee's wings and the cube hanging under it. */
const MARGIN_CELLS = 2;
/** Sample spacing along a segment (cells). */
const STEP_CELLS = 0.5;
/** The segment must also clear the model spun this far either way (radians): it keeps spinning. */
const SPIN_SLACK = 0.55;
const SPINS = [0, SPIN_SLACK, -SPIN_SLACK];

const inv = new Mat4();
const p = new Vec3();
const local = new Vec3();

/**
 * Exact (voxel-level) test of a straight flight segment against the sculpture, used where the
 * conservative free zones of SculptureClearance would force a detour. The cubes are dilated by
 * MARGIN_CELLS once (the model only loses cubes, so the stale set stays conservative), and a segment
 * passes only if it also clears the model spun by ±SPIN_SLACK about its spin axis.
 */
export class SculptureSegmentCheck {
    private dilated: Uint8Array | null = null;
    private readonly w: number;
    private readonly h: number;
    private readonly d: number;

    constructor(private readonly node: Node, private readonly grid: VoxelGrid, private readonly space: GridSpace) {
        this.w = grid.width + 2 * MARGIN_CELLS;
        this.h = grid.height + 2 * MARGIN_CELLS;
        this.d = grid.depth + 2 * MARGIN_CELLS;
    }

    /**
     * True when the world segment a → b keeps MARGIN_CELLS away from every cube. Within that margin
     * of `a` (a grid gate, which always has cubes next to it) only the cubes themselves count.
     */
    isClear(a: Vec3, b: Vec3): boolean {
        const dilated = this.dilated ??= this.dilate();
        const cell = this.space.cellSize;
        Mat4.invert(inv, this.node.worldMatrix);
        const steps = Math.max(1, Math.ceil(Vec3.distance(a, b) / (STEP_CELLS * cell * this.node.worldScale.x)));
        const g = this.grid, cx = (g.width - 1) / 2, cy = (g.height - 1) / 2, cz = (g.depth - 1) / 2;
        const nearGate = (MARGIN_CELLS + 1) / STEP_CELLS;
        for (let i = 0; i <= steps; i++) {
            const margin = i * (Vec3.distance(a, b) / steps) < nearGate * STEP_CELLS * cell * this.node.worldScale.x ? 0 : MARGIN_CELLS;
            Vec3.transformMat4(local, Vec3.lerp(p, a, b, i / steps), inv);
            for (const spin of SPINS) {
                // Undo an extra spin of the model about its local up (the yaw axis).
                const cos = Math.cos(spin), sin = Math.sin(spin);
                const lx = local.x * cos + local.z * sin, lz = -local.x * sin + local.z * cos;
                const gx = Math.round(lx / cell + cx), gy = Math.round(local.y / cell + cy), gz = Math.round(-lz / cell + cz);
                if (margin === 0) {
                    if (gx >= 0 && gy >= 0 && gz >= 0 && gx < g.width && gy < g.height && gz < g.depth && g.isAlive(g.index(gx, gy, gz))) return false;
                    continue;
                }
                const x = gx + MARGIN_CELLS, y = gy + MARGIN_CELLS, z = gz + MARGIN_CELLS;
                if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) continue;
                if (dilated[x + this.w * (y + this.h * z)]) return false;
            }
        }
        return true;
    }

    /** Cubes grown by MARGIN_CELLS (Chebyshev) into a padded grid: separable max filter per axis. */
    private dilate(): Uint8Array {
        const { w, h, d } = this, g = this.grid, m = MARGIN_CELLS;
        let cur = new Uint8Array(w * h * d);
        for (let i = 0; i < g.cellCount; i++) {
            if (g.isAlive(i)) cur[g.xs[i] + m + w * (g.ys[i] + m + h * (g.zs[i] + m))] = 1;
        }
        const strides = [1, w, w * h], sizes = [w, h, d];
        for (let axis = 0; axis < 3; axis++) {
            const next = new Uint8Array(cur.length), stride = strides[axis], size = sizes[axis];
            for (let i = 0; i < cur.length; i++) {
                if (!cur[i]) continue;
                const pos = Math.floor(i / stride) % size;
                for (let k = Math.max(0, pos - m); k <= Math.min(size - 1, pos + m); k++) next[i + (k - pos) * stride] = 1;
            }
            cur = next;
        }
        return cur;
    }
}
