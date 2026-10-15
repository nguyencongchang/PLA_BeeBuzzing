import { Vec3 } from 'cc';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';

/** Height of the horizontal leg above the hive (≈ the model's base / shadow level). */
const GLIDE_HEIGHT = 0.65;
/** Per-bee height scatter of the horizontal leg so bees don't stack on one line. */
const GLIDE_JITTER = 0.22;

/** Every LOOP_EVERY-th bee of a hive loops out to its own side; the rest sweep (reference: ~1/3). */
const LOOP_EVERY = 3;
/** Sweep: how far past the model's width the climb runs (world units), and its samples. */
const SWEEP_OUT = 0.25;
const SWEEP_SAMPLES = 12;
/** Loop, drawn in the free plane beside the model: out towards the hive's side and up, then back. */
const LOOP_OUT = 2.2;
const LOOP_LIFT = 1.3;
/** Per-bee scale scatter of the loop. */
const LOOP_JITTER = 0.35;
const LOOP_SAMPLES = 10;

const door = new Vec3();
const c1 = new Vec3();
const c2 = new Vec3();
const doorSide = new Vec3();
const across = new Vec3();
const startDir = new Vec3();
const sideways = new Vec3();
const dir = new Vec3();
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
 * Launch routes traced from the reference video. Every bee pops up out of the hive, then either
 * - sweeps: glides low along the floor under the model to past its far side, then spirals up around
 *   that side to the side its target faces (most bees), or
 * - loops: swings out and up towards the hive's own side of the screen and comes back.
 * Built from the sculpture's free zones (see SculptureClearance): the glide stays under the model,
 * the spiral keeps a radius beyond the model's widest point and the loop stays in the plane beside
 * it, so neither can cut through it; the last leg reaches the gate through its door. The end follows
 * the live (spinning) target, so the route is rebuilt every frame.
 */
export class BeeLaunchRoute {
    private readonly pts: Vec3[] = [];
    private readonly pool: Vec3[] = [];
    private loop = false;
    private glide = 0;
    private loopScale = 1;
    /** Screen side (+1 right / -1 left) the bee heads to first. */
    private side = 1;

    /**
     * Picks this bee's route from the hive top `from` towards the first target `to`; `order` is the
     * bee's launch count from that hive (sweeps and loops interleave, as in the reference).
     */
    build(from: Vec3, to: Vec3, order: number): void {
        this.loop = order % LOOP_EVERY === LOOP_EVERY - 1;
        this.glide = GLIDE_HEIGHT + Math.random() * GLIDE_JITTER;
        this.loopScale = 1 + (Math.random() - 0.5) * 2 * LOOP_JITTER;
        const towards = Math.sign(to.x - from.x) || (order % 2 ? 1 : -1);
        // Sweeps cross under the model to the target's far side; loops swing out on the hive's side.
        this.side = this.loop ? -towards : towards;
    }

    get isWide(): boolean {
        return this.loop;
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
        if (this.loop) this.addLoop(c, rise);
        else this.addSweep(c, glide);
        this.add(door);
        this.add(anchor.gate);
        return this.pts;
    }

    /**
     * Glide to past the model's far side, then spiral up around the spin axis (radius beyond the
     * model's widest point) to the door's side, reaching the door's height there.
     */
    private addSweep(c: RouteAnchor['clearance'], glide: number): void {
        c.perpendicular(Vec3.multiplyScalar(sideways, Vec3.UNIT_X, this.side), startDir);
        Vec3.cross(across, c.axis, startDir);
        const radius = c.sideLevel + SWEEP_OUT;
        const end = Math.atan2(Vec3.dot(doorSide, across), Vec3.dot(doorSide, startDir));
        const top = c.along(door);
        for (let i = 0; i <= SWEEP_SAMPLES; i++) {
            const t = i / SWEEP_SAMPLES, angle = end * t;
            Vec3.scaleAndAdd(dir, Vec3.multiplyScalar(dir, startDir, Math.cos(angle)), across, Math.sin(angle));
            // Climb mostly in the first part of the swing, like the reference arc up the far side.
            const lift = 1 - (1 - t) * (1 - t);
            this.pts.push(c.orbit(dir, glide + (top - glide) * lift, radius, this.next()));
        }
    }

    /** Loop in the door's side plane: out towards the hive's side and up, then back to the door. */
    private addLoop(c: RouteAnchor['clearance'], rise: Vec3): void {
        const start = this.add(c.withAhead(rise, doorSide, c.sideLevel, this.next()));
        const k = this.loopScale;
        Vec3.cross(across, c.axis, doorSide);
        Vec3.multiplyScalar(across, across, (Math.sign(across.x) || 1) * this.side * LOOP_OUT * k);
        Vec3.scaleAndAdd(c1, Vec3.add(c1, start, across), c.axis, LOOP_LIFT * k);
        Vec3.scaleAndAdd(c2, Vec3.scaleAndAdd(c2, door, across, 0.5), c.axis, LOOP_LIFT * 0.6 * k);
        for (let i = 1; i < LOOP_SAMPLES; i++) this.pts.push(cubic(this.next(), start, c1, c2, door, i / LOOP_SAMPLES));
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
