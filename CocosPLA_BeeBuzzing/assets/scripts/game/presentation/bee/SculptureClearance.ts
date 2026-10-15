import { Node, Vec3 } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { GridSpace } from '../sculpture/GridSpace';

/**
 * World-unit gap bees keep from the sculpture. Also the largest turn radius a free-flight route may
 * use: a rounded corner never strays farther than this from its corner point.
 */
export const CLEARANCE = 0.4;
/** Half the space diagonal of a unit cube: a cube's farthest point from its center, in cells. */
const CUBE_REACH = Math.sqrt(3) / 2;

const rel = new Vec3();
const arr = [0, 0, 0];

/**
 * The sculpture only spins about one axis through its origin (its local up, tilted by the fixed
 * view tilt), so every cube stays inside one cylinder around that axis whatever the spin. These
 * convex zones around the cylinder are always free:
 * - below: `along(p) <= belowLevel` and above: `along(p) >= aboveLevel` (slabs across the axis),
 * - beside it on any side `dir` (unit, perpendicular to the axis): `ahead(p, dir) >= sideLevel`.
 * A route whose straight legs each stay inside one zone, with corners rounded by at most CLEARANCE,
 * can never cut through the model. The envelope is measured once from the starting cubes (it only
 * shrinks later) in sculpture units, so it also follows any later change of the world scale.
 */
export class SculptureClearance {
    /** Spin axis (world, unit). */
    readonly axis = new Vec3();
    /** Camera side, perpendicular to the axis (world, unit). */
    readonly front = new Vec3();
    private measured = false;
    private radius = 0;
    private axisMin = 0;
    private axisMax = 0;

    constructor(private readonly node: Node, private readonly grid: VoxelGrid, private readonly space: GridSpace) {}

    get belowLevel(): number {
        this.measure();
        return this.axisMin * this.scale - CLEARANCE;
    }

    get aboveLevel(): number {
        this.measure();
        return this.axisMax * this.scale + CLEARANCE;
    }

    get sideLevel(): number {
        this.measure();
        return this.radius * this.scale + CLEARANCE;
    }

    /** Coordinate of `p` along the spin axis, from the sculpture origin. */
    along(p: Vec3): number {
        this.measure();
        return Vec3.dot(Vec3.subtract(rel, p, this.node.worldPosition), this.axis);
    }

    /** Coordinate of `p` along `dir`, from the sculpture origin. */
    ahead(p: Vec3, dir: Vec3): number {
        return Vec3.dot(Vec3.subtract(rel, p, this.node.worldPosition), dir);
    }

    /** `p` slid along the axis to axis coordinate `level`. */
    withAlong(p: Vec3, level: number, out: Vec3): Vec3 {
        return Vec3.scaleAndAdd(out, p, this.axis, level - this.along(p));
    }

    /** `p` slid along `dir` to coordinate `level` along it. */
    withAhead(p: Vec3, dir: Vec3, level: number, out: Vec3): Vec3 {
        return Vec3.scaleAndAdd(out, p, dir, level - this.ahead(p, dir));
    }

    /** The point `along` the spin axis and `radius` out from it in direction `dir` (unit, ⟂ axis). */
    orbit(dir: Vec3, along: number, radius: number, out: Vec3): Vec3 {
        this.measure();
        Vec3.scaleAndAdd(out, this.node.worldPosition, this.axis, along);
        return Vec3.scaleAndAdd(out, out, dir, radius);
    }

    /** The unit direction perpendicular to the spin axis closest to `v`. */
    perpendicular(v: Vec3, out: Vec3): Vec3 {
        this.measure();
        return Vec3.scaleAndAdd(out, v, this.axis, -Vec3.dot(v, this.axis)).normalize();
    }

    private get scale(): number {
        return this.node.worldScale.x;
    }

    /** Spin-invariant extents (distance from the axis, position along it) of every cube, in sculpture units. */
    private measure(): void {
        if (this.measured) return;
        this.measured = true;
        // Yaw is applied before the tilt, so the local up (yaw axis) maps to the world spin axis.
        Vec3.transformQuat(this.axis, Vec3.UNIT_Y, this.node.worldRotation).normalize();
        Vec3.scaleAndAdd(this.front, Vec3.UNIT_Z, this.axis, -this.axis.z).normalize();
        const g = this.grid, pivot = this.node.worldPosition, scale = this.scale;
        const reach = CUBE_REACH * this.space.cellSize;
        this.axisMin = Number.POSITIVE_INFINITY;
        this.axisMax = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < g.cellCount; i++) {
            if (!g.isAlive(i)) continue;
            this.space.cellToLocalArray(g.xs[i], g.ys[i], g.zs[i], arr);
            Vec3.transformMat4(rel, rel.set(arr[0], arr[1], arr[2]), this.node.worldMatrix);
            Vec3.subtract(rel, rel, pivot);
            const a = Vec3.dot(rel, this.axis);
            const radial = Math.sqrt(Math.max(0, Vec3.lengthSqr(rel) - a * a));
            this.radius = Math.max(this.radius, radial / scale + reach);
            this.axisMin = Math.min(this.axisMin, a / scale - reach);
            this.axisMax = Math.max(this.axisMax, a / scale + reach);
        }
        if (!(this.axisMax >= this.axisMin)) throw new Error('[SculptureClearance] sculpture has no cubes');
    }
}
