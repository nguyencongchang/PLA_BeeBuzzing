import { Vec3 } from 'cc';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';

/** Height of the horizontal leg above the hive (≈ the model's base / shadow level). */
const GLIDE_HEIGHT = 0.65;
/** Per-bee height scatter of the horizontal leg so bees don't stack on one line. */
const GLIDE_JITTER = 0.22;

/** Share of bees that swing out wide (away from the model) before looping back, as in the reference. */
const WIDE_SHARE = 0.45;
/** Wide loop, drawn in the free plane beside the model: out sideways and up, then back. */
const WIDE_OUT = 2.2;
const WIDE_LIFT = 1.3;
/** Per-bee scale scatter of the wide loop. */
const WIDE_JITTER = 0.35;
/** Points sampled along the loop curve. */
const LOOP_SAMPLES = 10;

const door = new Vec3();
const c1 = new Vec3();
const c2 = new Vec3();
const doorSide = new Vec3();
const across = new Vec3();
let warnedLowModel = false;

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
 * - glides level under the model to below its target and climbs to it, or
 * - swings out wide (sideways and up) and loops back to its target.
 * Both are built from the sculpture's free zones (see SculptureClearance): the rise and the glide stay
 * under the model, the climb / loop happen beside it on the side the target faces (in front, for
 * camera-facing targets), and the last leg reaches the gate through the door on that side. The end follows the live (spinning) target, so the route is rebuilt every frame.
 */
export class BeeLaunchRoute {
    private readonly pts: Vec3[] = [];
    private readonly pool: Vec3[] = [];
    private wide = false;
    private glide = 0;
    private loopScale = 1;
    private away = 1;

    /** Picks this bee's route style from the hive top `from` towards the first target `to`. */
    build(from: Vec3, to: Vec3): void {
        this.wide = Math.random() < WIDE_SHARE;
        this.glide = GLIDE_HEIGHT + Math.random() * GLIDE_JITTER;
        this.loopScale = 1 + (Math.random() - 0.5) * 2 * WIDE_JITTER;
        this.away = -(Math.sign(to.x - from.x) || 1);
    }

    get isWide(): boolean {
        return this.wide;
    }

    /** Total length (world units) to the live gate. */
    length(from: Vec3, anchor: RouteAnchor): number {
        return walkRounded(this.points(from, anchor), Number.POSITIVE_INFINITY, null);
    }

    /** Position at distance `s` along the route to the live gate. */
    sample(from: Vec3, anchor: RouteAnchor, s: number, out: Vec3): Vec3 {
        walkRounded(this.points(from, anchor), s, out);
        return out;
    }

    private points(from: Vec3, anchor: RouteAnchor): Vec3[] {
        this.pts.length = 0;
        const c = anchor.clearance;
        // Rise and glide stay under the model (a lower glide only when the model hangs that low).
        const glide = Math.min(c.along(from) + this.glide, c.belowLevel);
        if (glide < c.along(from) && !warnedLowModel) {
            warnedLowModel = true;
            console.warn('[BeeLaunchRoute] sculpture reaches down to the hives; bees may cross its base');
        }
        gateDoor(anchor, door, doorSide);
        this.add(from);
        const rise = this.add(c.withAlong(from, glide, this.next()));
        if (this.wide) {
            // Loop in the door's side plane: across it (screen-sideways for the camera side) and up the axis.
            const start = this.add(c.withAhead(rise, doorSide, c.sideLevel, this.next()));
            const k = this.loopScale;
            Vec3.cross(across, c.axis, doorSide);
            Vec3.multiplyScalar(across, across, (Math.sign(across.x) || 1) * this.away * WIDE_OUT * k);
            Vec3.scaleAndAdd(c1, Vec3.add(c1, start, across), c.axis, WIDE_LIFT * k);
            Vec3.scaleAndAdd(c2, Vec3.scaleAndAdd(c2, door, across, 0.5), c.axis, WIDE_LIFT * 0.6 * k);
            for (let i = 1; i < LOOP_SAMPLES; i++) this.pts.push(cubic(this.next(), start, c1, c2, door, i / LOOP_SAMPLES));
        } else {
            this.add(c.withAlong(door, glide, this.next()));
        }
        this.add(door);
        this.add(anchor.gate);
        return this.pts;
    }

    /** Next pooled point (not yet part of the route). */
    private next(): Vec3 {
        while (this.pool.length <= this.pts.length) this.pool.push(new Vec3());
        return this.pool[this.pts.length];
    }

    private add(v: Vec3): Vec3 {
        const slot = this.next();
        if (slot !== v) slot.set(v);
        this.pts.push(slot);
        return slot;
    }
}
