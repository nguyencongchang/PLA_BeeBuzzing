import { Vec3 } from 'cc';

/** Height of the horizontal leg above the hive (≈ the model's base / shadow level). */
const GLIDE_HEIGHT = 0.65;
/** Per-bee height scatter of the horizontal leg so bees don't stack on one line. */
const GLIDE_JITTER = 0.22;
/** Radius of the rounded turns at both corners (world units). */
const TURN_RADIUS = 0.35;

const entry = new Vec3();
const exit = new Vec3();
const p = new Vec3();
const q = new Vec3();
const cursor = new Vec3();
const pts: Vec3[] = [];

/**
 * Launch route from the reference: the bee pops straight up out of the hive, turns and
 * flies level across the floor to below its target, then climbs straight up to the start
 * of its escape route. Both corners are rounded (quadratic fillets). The first waypoints are
 * fixed at launch; the end follows the live (rotating) target every frame.
 */
export class BeeLaunchRoute {
    /** Top of the vertical rise, start of the level leg. */
    readonly rise = new Vec3();
    /** End of the level leg, below the target. */
    readonly under = new Vec3();

    /** Fixes the route from the hive top `from` toward the current path start `to`. */
    build(from: Vec3, to: Vec3): void {
        const glideY = Math.min(from.y + GLIDE_HEIGHT + Math.random() * GLIDE_JITTER, to.y);
        this.rise.set(from.x, glideY, from.z);
        this.under.set(to.x, glideY, to.z);
    }

    /** Total length (world units) to the live end `to`. */
    length(from: Vec3, to: Vec3): number {
        return this.walk(from, to, Number.POSITIVE_INFINITY, null);
    }

    /** Position at distance `s` along the route to the live end `to`. */
    sample(from: Vec3, to: Vec3, s: number, out: Vec3): Vec3 {
        this.walk(from, to, s, out);
        return out;
    }

    /** Walks straight pieces and corner fillets (from → rise → under → to). Returns the length walked. */
    private walk(from: Vec3, to: Vec3, s: number, out: Vec3 | null): number {
        pts.length = 0;
        pts.push(from, this.rise, this.under, to);
        cursor.set(from);
        let travelled = 0;
        for (let i = 1; i < pts.length; i++) {
            const corner = pts[i];
            const last = i === pts.length - 1;
            const inLen = Vec3.distance(pts[i - 1], corner);
            const outLen = last ? 0 : Vec3.distance(corner, pts[i + 1]);
            const r = last ? 0 : Math.min(TURN_RADIUS, inLen / 2, outLen / 2);
            Vec3.lerp(entry, corner, pts[i - 1], inLen > 0 ? r / inLen : 0);

            const straight = Vec3.distance(cursor, entry);
            if (out && s <= travelled + straight) {
                Vec3.lerp(out, cursor, entry, straight > 0 ? (s - travelled) / straight : 1);
                return s;
            }
            travelled += straight;
            if (last) break;

            Vec3.lerp(exit, corner, pts[i + 1], outLen > 0 ? r / outLen : 0);
            const arc = (Vec3.distance(entry, corner) + Vec3.distance(corner, exit) + Vec3.distance(entry, exit)) / 2;
            if (out && s <= travelled + arc) {
                const t = arc > 0 ? (s - travelled) / arc : 1;
                Vec3.lerp(p, entry, corner, t);
                Vec3.lerp(q, corner, exit, t);
                Vec3.lerp(out, p, q, t);
                return s;
            }
            travelled += arc;
            cursor.set(exit);
        }
        if (out) out.set(to);
        return travelled;
    }
}
