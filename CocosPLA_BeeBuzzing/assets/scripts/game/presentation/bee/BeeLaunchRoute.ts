import { Vec3 } from 'cc';

/** Height of the horizontal leg above the hive (≈ the model's base / shadow level). */
const GLIDE_HEIGHT = 0.65;
/** Per-bee height scatter of the horizontal leg so bees don't stack on one line. */
const GLIDE_JITTER = 0.22;
/** Radius of the rounded turns at both corners (world units). */
const TURN_RADIUS = 0.35;

/** Share of bees that swing out wide (away from the model) before looping back, as in the reference. */
const WIDE_SHARE = 0.45;
/** Wide loop: initial rise, then out (away from the model), up and away from the camera. */
const WIDE_RISE = 0.45;
const WIDE_OUT = 2.2;
const WIDE_LIFT = 1.3;
const WIDE_DEPTH = 2.0;
/** Per-bee scale scatter of the wide loop. */
const WIDE_JITTER = 0.35;
/** Chord samples used to measure the loop's length. */
const LOOP_SAMPLES = 10;

const entry = new Vec3();
const exit = new Vec3();
const p = new Vec3();
const q = new Vec3();
const cursor = new Vec3();
const c2 = new Vec3();
const prev = new Vec3();
const pts: Vec3[] = [];

/** Point on a cubic Bezier. */
function cubic(out: Vec3, a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
    const u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
    return out.set(
        k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x,
        k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y,
        k0 * a.z + k1 * b.z + k2 * c.z + k3 * d.z,
    );
}

/**
 * Launch routes from the reference. Every bee pops straight up out of the hive, then either
 * - glides level across the floor to below its target and climbs to it (rounded corners), or
 * - swings out wide: away from the model, up and into the distance, looping back to its target.
 * The fixed waypoints are set at launch; the end follows the live (rotating) target every frame.
 */
export class BeeLaunchRoute {
    /** Top of the vertical rise. */
    readonly rise = new Vec3();
    /** Level route: end of the level leg, below the target. Wide route: first loop control. */
    readonly under = new Vec3();
    /** Wide route: second loop control, as an offset from the live target. */
    readonly loopOffset = new Vec3();
    private wide = false;

    /** Fixes the route from the hive top `from` toward the current path start `to`. */
    build(from: Vec3, to: Vec3): void {
        this.wide = Math.random() < WIDE_SHARE;
        if (!this.wide) {
            const glideY = Math.min(from.y + GLIDE_HEIGHT + Math.random() * GLIDE_JITTER, to.y);
            this.rise.set(from.x, glideY, from.z);
            this.under.set(to.x, glideY, to.z);
            return;
        }
        const away = -(Math.sign(to.x - from.x) || 1);
        const k = 1 + (Math.random() - 0.5) * 2 * WIDE_JITTER;
        this.rise.set(from.x, from.y + WIDE_RISE, from.z);
        this.under.set(from.x + away * WIDE_OUT * k, this.rise.y + WIDE_LIFT * k, from.z - WIDE_DEPTH * k);
        this.loopOffset.set(away * WIDE_OUT * 0.5 * k, WIDE_LIFT * 0.6 * k, -WIDE_DEPTH * 0.4 * k);
    }

    /** Total length (world units) to the live end `to`. */
    length(from: Vec3, to: Vec3): number {
        return this.wide ? this.walkLoop(from, to, Number.POSITIVE_INFINITY, null) : this.walk(from, to, Number.POSITIVE_INFINITY, null);
    }

    /** Position at distance `s` along the route to the live end `to`. */
    sample(from: Vec3, to: Vec3, s: number, out: Vec3): Vec3 {
        if (this.wide) this.walkLoop(from, to, s, out);
        else this.walk(from, to, s, out);
        return out;
    }

    /** Wide route: straight rise, then a cubic loop rise → (out, up, away) → back to `to`. */
    private walkLoop(from: Vec3, to: Vec3, s: number, out: Vec3 | null): number {
        const riseLen = Vec3.distance(from, this.rise);
        if (out && s <= riseLen) {
            Vec3.lerp(out, from, this.rise, riseLen > 0 ? s / riseLen : 1);
            return s;
        }
        Vec3.add(c2, to, this.loopOffset);
        let travelled = riseLen;
        prev.set(this.rise);
        for (let i = 1; i <= LOOP_SAMPLES; i++) {
            cubic(p, this.rise, this.under, c2, to, i / LOOP_SAMPLES);
            const seg = Vec3.distance(prev, p);
            if (out && s <= travelled + seg) {
                Vec3.lerp(out, prev, p, seg > 0 ? (s - travelled) / seg : 1);
                return s;
            }
            travelled += seg;
            prev.set(p);
        }
        if (out) out.set(to);
        return travelled;
    }

    /** Level route: straight pieces and corner fillets (from → rise → under → to). */
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
