import { _decorator, Camera, Component, EventTouch, geometry, input, Input, Node, Vec2, Vec3 } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { SculptureDraggedSignal } from '../../application/GameplaySignals';
import { SculptureRotator } from '../sculpture/SculptureRotator';
import { BOARD_LAYOUT, lineAtX } from '../hive/BoardLayout';

const { ccclass } = _decorator;

/** Pixels a touch may travel and still count as a tap. */
const TAP_SLOP = 14;

/**
 * Splits raw touches into "drag → rotate sculpture" and "tap → hive line".
 * Taps are resolved by intersecting the camera ray with the board plane (z = 0 in the
 * world root's local space) — no physics module needed.
 */
@ccclass('GameInputRouter')
export class GameInputRouter extends Component {
    onLineTapped: (line: number) => void = () => undefined;

    private camera: Camera = null!;
    private worldRoot: Node = null!;
    private rotator: SculptureRotator = null!;
    private lineCount = 0;
    private readonly startPos = new Vec2();
    private dragging = false;
    private tracking = false;
    private lastMoveTime = 0;
    private draggedOnce = false;
    private readonly ray = new geometry.Ray();
    private readonly hit = new Vec3();

    init(camera: Camera, worldRoot: Node, rotator: SculptureRotator, lineCount: number): void {
        this.camera = camera;
        this.worldRoot = worldRoot;
        this.rotator = rotator;
        this.lineCount = lineCount;
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(e: EventTouch): void {
        if (e.getID() !== 0 && this.tracking) return; // single-finger control
        e.getLocation(this.startPos);
        this.tracking = true;
        this.dragging = false;
        this.lastMoveTime = performance.now();
    }

    private onTouchMove(e: EventTouch): void {
        if (!this.tracking) return;
        const loc = e.getLocation();
        if (!this.dragging && Vec2.distance(loc, this.startPos) > TAP_SLOP) {
            this.dragging = true;
            this.rotator.beginDrag();
            if (!this.draggedOnce) {
                this.draggedOnce = true;
                SignalBus.instance.fire(new SculptureDraggedSignal());
            }
        }
        if (!this.dragging) return;
        const now = performance.now();
        const delta = e.getDelta();
        this.rotator.drag(delta.x, delta.y, (now - this.lastMoveTime) / 1000);
        this.lastMoveTime = now;
    }

    private onTouchEnd(e: EventTouch): void {
        if (!this.tracking) return;
        this.tracking = false;
        if (this.dragging) {
            this.rotator.endDrag();
            return;
        }
        const loc = e.getLocation();
        if (!this.pickBoardPoint(loc.x, loc.y, this.hit)) return;
        if (this.hit.y > BOARD_LAYOUT.lineTapMaxY) return;
        const line = lineAtX(this.hit.x, this.lineCount);
        if (line !== -1) this.onLineTapped(line);
    }

    /** Screen point → point on the board plane in world-root local space. */
    private pickBoardPoint(x: number, y: number, out: Vec3): boolean {
        this.camera.screenPointToRay(x, y, this.ray);
        const root = this.worldRoot;
        // Plane z = 0 of the world root (unrotated, uniformly scaled, so its world z is constant).
        const planeZ = root.worldPosition.z;
        if (Math.abs(this.ray.d.z) < 1e-6) return false;
        const t = (planeZ - this.ray.o.z) / this.ray.d.z;
        if (t < 0) return false;
        Vec3.scaleAndAdd(out, this.ray.o, this.ray.d, t);
        Vec3.subtract(out, out, root.worldPosition);
        Vec3.multiplyScalar(out, out, 1 / root.worldScale.x);
        return true;
    }
}
