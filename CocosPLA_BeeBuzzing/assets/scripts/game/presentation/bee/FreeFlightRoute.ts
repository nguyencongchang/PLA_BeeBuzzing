import { Vec3 } from 'cc';
import { CLEARANCE, SculptureClearance } from './SculptureClearance';

/** Live world-space geometry the free-flight routes (hive → model, model → hive) attach to. */
export interface RouteAnchor {
    /** Start of the bee's grid path: a few cells outside the grid, beyond the exit face. */
    readonly gate: Vec3;
    /** Unit direction in which the escape route leaves the grid (camera-facing by construction). */
    readonly exit: Vec3;
    readonly clearance: SculptureClearance;
}

const way = new Vec3();
/** Below this share of the exit across the axis, the exit counts as going up / down the axis. */
const MIN_SIDEWAYS = 0.2;

/**
 * Where a bee crosses into the free zone beside the sculpture on its way to (or from) the gate, and
 * the side (`outSide`, unit, perpendicular to the axis) that zone lies on: the side the exit faces,
 * or the camera side when the exit runs along the axis. The door is on the ray from the gate along
 * exit + side, which keeps moving away from the exit face, so the leg to the gate never touches the
 * model — wherever the spin has turned the target.
 */
export function gateDoor(a: RouteAnchor, out: Vec3, outSide: Vec3): Vec3 {
    const c = a.clearance;
    Vec3.scaleAndAdd(outSide, a.exit, c.axis, -Vec3.dot(a.exit, c.axis));
    if (outSide.length() < MIN_SIDEWAYS) outSide.set(c.front);
    outSide.normalize();
    const gap = c.sideLevel - c.ahead(a.gate, outSide);
    if (gap <= 0) return out.set(a.gate);
    Vec3.add(way, a.exit, outSide).normalize();
    return Vec3.scaleAndAdd(out, a.gate, way, gap / Vec3.dot(way, outSide));
}

const entry = new Vec3();
const exitPt = new Vec3();
const cursor = new Vec3();
const p = new Vec3();
const q = new Vec3();

/**
 * Walks a polyline whose inner corners are rounded (quadratic fillet of radius ≤ CLEARANCE, at most
 * half of each adjacent leg, so a rounded corner stays within CLEARANCE of its corner point).
 * Writes the point at distance `s` into `out` (clamped to the end) when given; returns the total
 * length, or `s` when stopped early.
 */
export function walkRounded(pts: readonly Vec3[], s: number, out: Vec3 | null): number {
    cursor.set(pts[0]);
    let travelled = 0;
    for (let i = 1; i < pts.length; i++) {
        const corner = pts[i];
        const last = i === pts.length - 1;
        const inLen = Vec3.distance(pts[i - 1], corner);
        const outLen = last ? 0 : Vec3.distance(corner, pts[i + 1]);
        const r = last ? 0 : Math.min(CLEARANCE, inLen / 2, outLen / 2);
        Vec3.lerp(entry, corner, pts[i - 1], inLen > 0 ? r / inLen : 0);

        const straight = Vec3.distance(cursor, entry);
        if (out && s <= travelled + straight) {
            Vec3.lerp(out, cursor, entry, straight > 0 ? (s - travelled) / straight : 1);
            return s;
        }
        travelled += straight;
        if (last) break;

        Vec3.lerp(exitPt, corner, pts[i + 1], outLen > 0 ? r / outLen : 0);
        const arc = (Vec3.distance(entry, corner) + Vec3.distance(corner, exitPt) + Vec3.distance(entry, exitPt)) / 2;
        if (out && s <= travelled + arc) {
            const t = arc > 0 ? (s - travelled) / arc : 1;
            Vec3.lerp(p, entry, corner, t);
            Vec3.lerp(q, corner, exitPt, t);
            Vec3.lerp(out, p, q, t);
            return s;
        }
        travelled += arc;
        cursor.set(exitPt);
    }
    if (out) out.set(pts[pts.length - 1]);
    return travelled;
}
