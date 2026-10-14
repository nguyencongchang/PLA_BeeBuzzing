import { _decorator, Component, math, Quat, Vec3 } from 'cc';
import { GameTime } from '../../application/GameTime';

const { ccclass } = _decorator;

const DEG_PER_PIXEL = 0.35;
const MIN_TILT = -60;
const MAX_TILT = 75;
const INERTIA_DAMPING = 5;
const IDLE_RESUME_DELAY = 2;
const AUTO_SPIN_RAMP = 1.5;
/** Rotation change (deg) that counts as "the view changed" for reachability refresh. */
const VIEW_CHANGE_EPS = 1.5;

/**
 * Yaw (around world Y) + tilt (around world X) of the sculpture.
 * Idle → slow auto spin; drag → direct control with inertia on release.
 * `viewVersion` increments whenever the orientation changed meaningfully.
 */
@ccclass('SculptureRotator')
export class SculptureRotator extends Component {
    autoRotateSpeed = 8;

    yaw = 0;
    tilt = 25;
    viewVersion = 0;

    private dragging = false;
    private yawVelocity = 0;
    private tiltVelocity = 0;
    private idleTime = IDLE_RESUME_DELAY;
    private lastYaw = Number.NaN;
    private lastTilt = Number.NaN;
    private readonly qYaw = new Quat();
    private readonly qTilt = new Quat();
    private readonly q = new Quat();

    get isDragging(): boolean {
        return this.dragging;
    }

    beginDrag(): void {
        this.dragging = true;
        this.yawVelocity = 0;
        this.tiltVelocity = 0;
    }

    /** Pixel delta since the previous move event. */
    drag(dxPixels: number, dyPixels: number, dt: number): void {
        const dYaw = dxPixels * DEG_PER_PIXEL;
        const dTilt = -dyPixels * DEG_PER_PIXEL;
        this.yaw += dYaw;
        this.tilt = math.clamp(this.tilt + dTilt, MIN_TILT, MAX_TILT);
        if (dt > 0) {
            this.yawVelocity = math.lerp(this.yawVelocity, dYaw / dt, 0.5);
            this.tiltVelocity = math.lerp(this.tiltVelocity, dTilt / dt, 0.5);
        }
        this.idleTime = 0;
    }

    endDrag(): void {
        this.dragging = false;
        this.idleTime = 0;
    }

    update(dt: number): void {
        if (!this.dragging) {
            this.idleTime += dt;
            const decay = Math.exp(-INERTIA_DAMPING * dt);
            this.yawVelocity *= decay;
            this.tiltVelocity *= decay;
            this.yaw += this.yawVelocity * dt;
            this.tilt = math.clamp(this.tilt + this.tiltVelocity * dt, MIN_TILT, MAX_TILT);
            if (this.idleTime > IDLE_RESUME_DELAY) {
                const ramp = Math.min(1, (this.idleTime - IDLE_RESUME_DELAY) / AUTO_SPIN_RAMP);
                this.yaw += this.autoRotateSpeed * ramp * GameTime.scaled(dt);
            }
        }
        this.applyRotation();
    }

    applyRotation(): void {
        Quat.fromAxisAngle(this.qYaw, Vec3.UNIT_Y, math.toRadian(this.yaw));
        Quat.fromAxisAngle(this.qTilt, Vec3.UNIT_X, math.toRadian(this.tilt));
        Quat.multiply(this.q, this.qTilt, this.qYaw);
        this.node.setRotation(this.q);

        if (Number.isNaN(this.lastYaw)
            || Math.abs(this.yaw - this.lastYaw) > VIEW_CHANGE_EPS
            || Math.abs(this.tilt - this.lastTilt) > VIEW_CHANGE_EPS) {
            this.lastYaw = this.yaw;
            this.lastTilt = this.tilt;
            this.viewVersion++;
        }
    }
}
