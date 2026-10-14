import { Node, Quat, Vec3 } from 'cc';

/** Streak lifetime after the cube leaves its socket, and its starting thickness (world units). */
const STREAK_LIFE = 0.3;
const STREAK_WIDTH = 0.04;
/** How fast the streak's tail catches up with the cube once it is out (per second). */
const STREAK_CATCH_UP = 9;
/** Carried cubes tumble slowly, as in the reference. */
const TUMBLE_DEG_PER_SEC = 150;
const TUMBLE_AXIS = new Vec3(0.8, 0.5, 0.3).normalize();

const mid = new Vec3();
const spin = new Quat();

/**
 * White light streak left behind a cube pulled out of the sculpture (reference): it grows
 * from the socket to the cube during the pull, then its tail chases the cube while it thins
 * out. `node` is a unit box (ModelKit.createStreak) stretched along its Z axis.
 */
export class CubeStreak {
    private readonly tail = new Vec3();
    private age = -1;
    private released = false;

    constructor(readonly node: Node) {
        node.active = false;
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
        const width = STREAK_WIDTH * Math.max(0, 1 - this.age / STREAK_LIFE);
        const length = Vec3.distance(this.tail, head);
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
