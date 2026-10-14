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

/**
 * Launch curve as in the reference (cubic Bezier): pop straight up out of the hive, glide
 * low toward the base of the model, then climb to the start of the escape route.
 */
const LAUNCH_RISE = 0.7;
/** Glide height above the hive (≈ the model's base / shadow level). */
const GLIDE_HEIGHT = 0.9;
/** How far (0..1) the glide control point moves from the hive toward the model's center line. */
const GLIDE_TOWARD_MODEL = 0.85;
/** Per-bee scatter of the controls so the swarm fans out instead of flying single file. */
const RISE_JITTER = 0.25;
const GLIDE_JITTER_X = 0.9;
const GLIDE_JITTER_Y = 0.35;

/** Point on a cubic Bezier. */
export function cubicBezier(out: Vec3, a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
    const u = 1 - t, uu = u * u, tt = t * t;
    const k0 = uu * u, k1 = 3 * uu * t, k2 = 3 * u * tt, k3 = tt * t;
    return out.set(
        k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x,
        k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y,
        k0 * a.z + k1 * b.z + k2 * c.z + k3 * d.z,
    );
}

/** Controls of the launch curve from the hive (`from`) to the path start (`to`); returns its length estimate. */
export function launchCurve(from: Vec3, to: Vec3, modelCenter: Vec3, outC1: Vec3, outC2: Vec3): number {
    outC1.set(from.x + (Math.random() - 0.5) * RISE_JITTER, from.y + LAUNCH_RISE, from.z);
    const baseX = (modelCenter.x + to.x) / 2;
    outC2.set(
        from.x + (baseX - from.x) * GLIDE_TOWARD_MODEL + (Math.random() - 0.5) * GLIDE_JITTER_X,
        Math.min(from.y + GLIDE_HEIGHT, to.y) + Math.random() * GLIDE_JITTER_Y,
        to.z,
    );
    const poly = Vec3.distance(from, outC1) + Vec3.distance(outC1, outC2) + Vec3.distance(outC2, to);
    return (Vec3.distance(from, to) + poly) / 2;
}

/** The home arc's control point sits this far (0..1) up from the start, under the hive. */
const HOME_RISE = 0.45;

/**
 * Flight home: curves over to directly under the hive, then rises vertically through the
 * entrance (control point straight below the target → vertical final tangent, as in the
 * reference). Returns the arc length estimate.
 */
export function homeArc(from: Vec3, to: Vec3, outCtrl: Vec3): number {
    outCtrl.set(to.x, from.y + (to.y - from.y) * HOME_RISE, (from.z + to.z) / 2);
    return bezierLength(from, outCtrl, to);
}
