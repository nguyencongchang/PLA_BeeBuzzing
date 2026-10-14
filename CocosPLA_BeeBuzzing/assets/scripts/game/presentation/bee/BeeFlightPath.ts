import { Mat4, Vec3 } from 'cc';

const tmpA = new Vec3();
const tmpB = new Vec3();

/**
 * A polyline in sculpture-local space evaluated through the sculpture's *current*
 * world matrix, so bees keep tracking their cube while the model rotates.
 * Lengths / sample distances are in world units via `unitScale` (the sculpture's
 * uniform world scale), so they stay valid under rotation.
 */
export class BeeFlightPath {
    /** Flat local xyz. */
    readonly points: number[] = [];
    readonly cumulative: number[] = [];
    /** World units per local unit. */
    unitScale = 1;

    /** Total length in world units. */
    get length(): number {
        return this.cumulative.length ? this.cumulative[this.cumulative.length - 1] * this.unitScale : 0;
    }

    get pointCount(): number {
        return this.points.length / 3;
    }

    reset(): void {
        this.points.length = 0;
        this.cumulative.length = 0;
    }

    push(x: number, y: number, z: number): void {
        const n = this.points.length;
        let acc = 0;
        if (n > 0) {
            const dx = x - this.points[n - 3], dy = y - this.points[n - 2], dz = z - this.points[n - 1];
            acc = this.cumulative[this.cumulative.length - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        this.points.push(x, y, z);
        this.cumulative.push(acc);
    }

    /** World position at world distance s (clamped) along the path. */
    sampleWorld(worldS: number, world: Mat4, out: Vec3): Vec3 {
        const s = worldS / this.unitScale;
        const n = this.pointCount;
        if (n === 0) return out.set(0, 0, 0);
        const c = this.cumulative;
        if (s <= 0 || n === 1) return this.pointWorld(0, world, out);
        if (s >= c[n - 1]) return this.pointWorld(n - 1, world, out);
        let i = 1;
        while (i < n - 1 && c[i] < s) i++;
        const seg = c[i] - c[i - 1];
        const t = seg > 0 ? (s - c[i - 1]) / seg : 0;
        this.pointLocal(i - 1, tmpA);
        this.pointLocal(i, tmpB);
        Vec3.lerp(out, tmpA, tmpB, t);
        return Vec3.transformMat4(out, out, world);
    }

    pointWorld(i: number, world: Mat4, out: Vec3): Vec3 {
        this.pointLocal(i, out);
        return Vec3.transformMat4(out, out, world);
    }

    private pointLocal(i: number, out: Vec3): Vec3 {
        return out.set(this.points[i * 3], this.points[i * 3 + 1], this.points[i * 3 + 2]);
    }
}

/** Anything that maps (fractional) grid coordinates into sculpture-local space. */
interface GridToLocal {
    cellToLocalArray(x: number, y: number, z: number, out: number[]): number[];
}

const tmpArr = [0, 0, 0];

/**
 * Builds a bee's approach path from the solver's escape route (flat grid coords:
 * target, corners..., first cell outside): a runway beyond the exit, the corners in
 * reverse, then a hover point in front of the grabbed face. Also returns the target
 * center and the face normal in local space.
 */
export function buildApproachPath(
    path: BeeFlightPath, route: readonly number[], space: GridToLocal,
    runwayCells: number, hoverCells: number, outCenter: Vec3, outFaceDir: Vec3,
): void {
    const last = route.length - 3;
    // Face direction = first segment; exit direction = last segment.
    const fx = Math.sign(route[3] - route[0]), fy = Math.sign(route[4] - route[1]), fz = Math.sign(route[5] - route[2]);
    const ex = Math.sign(route[last] - route[last - 3]);
    const ey = Math.sign(route[last + 1] - route[last - 2]);
    const ez = Math.sign(route[last + 2] - route[last - 1]);
    const push = (x: number, y: number, z: number) => {
        const l = space.cellToLocalArray(x, y, z, tmpArr);
        path.push(l[0], l[1], l[2]);
    };

    path.reset();
    push(route[last] + ex * runwayCells, route[last + 1] + ey * runwayCells, route[last + 2] + ez * runwayCells);
    for (let i = last; i >= 3; i -= 3) push(route[i], route[i + 1], route[i + 2]);
    push(route[0] + fx * hoverCells, route[1] + fy * hoverCells, route[2] + fz * hoverCells);

    const c = space.cellToLocalArray(route[0], route[1], route[2], tmpArr);
    outCenter.set(c[0], c[1], c[2]);
    outFaceDir.set(fx, fy, -fz); // grid Z is mirrored in local space
}

/** Point on a quadratic Bezier. */
export function bezier(out: Vec3, a: Vec3, c: Vec3, b: Vec3, t: number): Vec3 {
    const u = 1 - t;
    return out.set(
        u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        u * u * a.y + 2 * u * t * c.y + t * t * b.y,
        u * u * a.z + 2 * u * t * c.z + t * t * b.z,
    );
}

/** Cheap quadratic Bezier length estimate (mean of chord and control polygon). */
export function bezierLength(a: Vec3, c: Vec3, b: Vec3): number {
    return (Vec3.distance(a, b) + Vec3.distance(a, c) + Vec3.distance(c, b)) / 2;
}

/** Sideways bulge / lift (world units) of the slot → sculpture arc, so streams fan out like a fountain. */
const ARC_BULGE = 1.7;
const ARC_LIFT = 0.8;
/** The home arc's control point sits this far (0..1) up from the start, under the hive. */
const HOME_RISE = 0.45;

/**
 * Control point of the slot → path-start arc: out sideways (away from the sculpture's
 * center line) and up, then curving in. Returns the arc length estimate.
 */
export function launchArc(from: Vec3, to: Vec3, center: Vec3, outCtrl: Vec3): number {
    const side = Math.abs(from.x - center.x) > 0.3 ? Math.sign(from.x - center.x) : Math.sign(to.x - center.x) || 1;
    Vec3.lerp(outCtrl, from, to, 0.35);
    outCtrl.x += side * ARC_BULGE;
    outCtrl.y += ARC_LIFT;
    return bezierLength(from, outCtrl, to);
}

/**
 * Flight home: curves over to directly under the hive, then rises vertically through the
 * entrance (control point straight below the target → vertical final tangent, as in the
 * reference). Returns the arc length estimate.
 */
export function homeArc(from: Vec3, to: Vec3, outCtrl: Vec3): number {
    outCtrl.set(to.x, from.y + (to.y - from.y) * HOME_RISE, (from.z + to.z) / 2);
    return bezierLength(from, outCtrl, to);
}
