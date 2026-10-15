import { Node, Quat, Vec3 } from 'cc';

/** Speed-line width and the gap from the cube center to where the lines start (cells). */
const LINE_WIDTH = 0.06;
const LINE_GAP = 0.5;
/**
 * Reference layout: a long center line and two shorter ones beside it, all within the cube's
 * width. `offset` across the motion (cells), `length` as a share of the trail.
 */
const LINES = [
    { offset: 0, length: 1 },
    { offset: -0.3, length: 0.62 },
    { offset: 0.3, length: 0.8 },
];
export const STREAK_LINE_COUNT = LINES.length;
/** Carried cubes tumble slowly, as in the reference. */
const TUMBLE_DEG_PER_SEC = 150;
const TUMBLE_AXIS = new Vec3(0.8, 0.5, 0.3).normalize();

const dir = new Vec3();
const side = new Vec3();
const a = new Vec3();
const b = new Vec3();
const mid = new Vec3();
const spin = new Quat();

/**
 * Speed lines behind a carried cube (reference): a few thin parallel white lines from the cube's back
 * face to `tail`, side by side on screen. The caller picks `tail` on the cube's own flight path, so
 * the lines only ever cover space the cube has just flown through (empty cells) and can never cut
 * through the sculpture or poke out of it.
 */
export class CubeStreak {
    constructor(readonly node: Node) {
        node.active = false;
    }

    /**
     * Lines from `head` (cube center) back to `tail`, for a cube `cell` world units wide; `fade` (0..1)
     * thins them out.
     */
    draw(head: Vec3, tail: Vec3, cell: number, fade: number): void {
        Vec3.subtract(dir, head, tail);
        const length = dir.length() - LINE_GAP * cell;
        const width = LINE_WIDTH * cell * fade;
        if (length <= 0.05 * cell || width <= 0.004 * cell) {
            this.stop();
            return;
        }
        dir.normalize();
        // Camera looks down -Z: offset the lines across the motion as seen on screen.
        Vec3.cross(side, dir, Vec3.UNIT_Z);
        if (side.lengthSqr() < 1e-4) Vec3.cross(side, dir, Vec3.UNIT_Y);
        side.normalize();
        this.node.active = true;
        const lines = this.node.children;
        for (let i = 0; i < lines.length; i++) {
            const { offset, length: share } = LINES[i];
            Vec3.scaleAndAdd(a, head, dir, -LINE_GAP * cell);
            Vec3.scaleAndAdd(a, a, side, offset * cell);
            Vec3.scaleAndAdd(b, a, dir, -length * share);
            Vec3.lerp(mid, a, b, 0.5);
            const line = lines[i];
            line.setWorldPosition(mid);
            line.lookAt(a);
            line.setWorldScale(width, width, length * share);
        }
    }

    stop(): void {
        this.node.active = false;
    }
}

/** Slow tumble of a carried cube. */
export function tumble(cube: Node, dt: number): void {
    Quat.fromAxisAngle(spin, TUMBLE_AXIS, (TUMBLE_DEG_PER_SEC * Math.PI / 180) * dt);
    cube.rotate(spin);
}
