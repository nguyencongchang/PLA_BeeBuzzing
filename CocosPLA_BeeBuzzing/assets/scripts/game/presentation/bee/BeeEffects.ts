import { Node, Quat, Vec3 } from 'cc';

/**
 * The reference keeps the light attached while the cube clears its cell, then lets its tail
 * melt away instead of disappearing on the next frame.  The actual pink bloom is created by
 * ModelKit; this width controls its bright white core.
 */
const STREAK_LIFE = 0.16;
const STREAK_WIDTH = 0.035;
/** How fast the streak's tail catches up with the cube once it is out (per second). */
const STREAK_CATCH_UP = 32;
/** Never allow the afterglow to turn into a long spear behind a fast-moving cube. */
const MAX_STREAK_LENGTH = 0.085;
/** Carried cubes tumble slowly, as in the reference. */
const TUMBLE_DEG_PER_SEC = 150;
const TUMBLE_AXIS = new Vec3(0.8, 0.5, 0.3).normalize();

const mid = new Vec3();
const tailDirection = new Vec3();
const spin = new Quat();

/**
 * Light streak left behind a cube pulled out of the sculpture: it grows from the socket to
 * the cube during the pull, then its tail chases the cube while its pink bloom fades. `node`
 * contains the glow and the white centre line, and is stretched along its Z axis.
 */
export class CubeStreak {
    private readonly tail = new Vec3();
    private age = -1;
    private released = false;

    constructor(readonly node: Node) {
        node.active = false;
    }

    /** True only after the cube has cleared the face and the visible trail has started. */
    get active(): boolean {
        return this.age >= 0;
    }

    /** The cube starts leaving its socket at world position `socket`. */
    start(socket: Vec3): void {
        this.tail.set(socket);
        this.age = 0;
        this.released = false;
        this.node.setWorldPosition(socket);
        this.node.setScale(0, 0, 0); // sized on the first update, never a one-frame unit box
        this.node.active = true;
    }

    /** The cube is fully out: from now on the tail chases it and the streak fades. */
    release(): void {
        this.released = true;
    }

    update(head: Vec3, dt: number): void {
        if (this.age < 0) return;
        if (this.released) {
            this.age += dt;
            Vec3.lerp(this.tail, this.tail, head, Math.min(1, dt * STREAK_CATCH_UP));
        }
        // Ease the fade so the glow holds briefly after the cube breaks free, then contracts.
        const fade = Math.max(0, 1 - this.age / STREAK_LIFE);
        const width = STREAK_WIDTH * fade * fade;
        let length = Vec3.distance(this.tail, head);
        // The original effect only leaves a small bloom immediately behind the cube.  Clamp
        // the tail to that tiny distance so a frame hitch or a fast path can never draw a
        // long line back into / through the sculpture.
        if (length > MAX_STREAK_LENGTH) {
            Vec3.subtract(tailDirection, this.tail, head).normalize();
            Vec3.scaleAndAdd(this.tail, head, tailDirection, MAX_STREAK_LENGTH);
            length = MAX_STREAK_LENGTH;
        }
        if (width <= 0.002 || (this.released && length < 0.01)) {
            this.stop();
            return;
        }
        Vec3.lerp(mid, this.tail, head, 0.5);
        this.node.setWorldPosition(mid);
        if (length > 1e-4) this.node.lookAt(head);
        this.node.setScale(width, width, Math.max(length, 1e-3));
    }

    stop(): void {
        this.age = -1;
        this.node.active = false;
    }
}

/** Slow tumble of a carried cube. */
export function tumble(cube: Node, dt: number): void {
    Quat.fromAxisAngle(spin, TUMBLE_AXIS, (TUMBLE_DEG_PER_SEC * Math.PI / 180) * dt);
    cube.rotate(spin);
}
