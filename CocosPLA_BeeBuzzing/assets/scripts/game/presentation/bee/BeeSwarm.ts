import { _decorator, Component, math, Vec3 } from 'cc';
import { GameTime } from '../../application/GameTime';
import { ModelKit } from '../rendering/ModelKit';
import { SculptureView } from '../sculpture/SculptureView';
import { bezier, buildApproachPath, homeArc, launchArc } from './BeeFlightPath';
import { Bee, BeePool } from './BeePool';

const { ccclass } = _decorator;

// Flight phases.
const APPROACH = 0, GRAB = 1, PULL = 2, CARRY = 3, LEAVE = 4;
const GRAB_TIME = 0.07;
const PULL_TIME = 0.12;
/** Extra cells the approach starts beyond the grid exit, so bees swoop in. */
const EXIT_RUNWAY_CELLS = 3;
/** Bee hovers this far (cells) in front of the cube face it grabs. */
const FACE_HOVER_CELLS = 0.75;
const CUBE_TRAIL_CELLS = 0.8;
const FLAP_SPEED = 48;
const FLAP_ANGLE = 42;
/** Keeps flight readable even if a remote parameter payload contains an older speed. */
const MAX_BEE_FLIGHT_SPEED = 4;
/** Fraction of the home flight spent shrinking into the hive entrance. */
const ENTER_FRACTION = 0.22;
const ENTER_SCALE = 0.25;
/** Fallback hive entrance (swarm-local) when no backdrop provides one. */
const DEFAULT_HIVE = new Vec3(0, 6.2, 0);

export interface LaunchRequest {
    readonly color: number;
    readonly from: Vec3;
    readonly target: number;
    /** Solver escape route, flat grid coords: target, corners..., first cell outside. */
    readonly gridPath: readonly number[];
}

/**
 * All bees and the cubes they carry, driven by one update loop (no per-bee components).
 * Calls `onGrab(target)` the moment a bee latches on — that is when the cube leaves the grid.
 */
@ccclass('BeeSwarm')
export class BeeSwarm extends Component {
    onGrab: (target: number) => void = () => undefined;
    /** World position of the hive entrance bees carry cubes into (set by the backdrop). */
    hiveEntrance: (out: Vec3) => Vec3 = (out) => Vec3.transformMat4(out, DEFAULT_HIVE, this.node.worldMatrix);
    beeSpeed = MAX_BEE_FLIGHT_SPEED;

    private sculpture: SculptureView = null!;
    private pool: BeePool = null!;
    private readonly active: Bee[] = [];
    private pending = 0;
    private readonly pos = new Vec3();
    private readonly tmp = new Vec3();

    init(kit: ModelKit, sculpture: SculptureView): void {
        this.sculpture = sculpture;
        // Carried cubes match the on-screen cube size (sculpture may be scaled).
        this.pool = new BeePool(kit, this.node, sculpture.gridSpace.cellSize * sculpture.node.scale.x);
    }

    /** Bees in flight (including those flying away). */
    get count(): number {
        return this.active.length;
    }

    /** Bees that have not grabbed their cube yet. */
    get pendingGrabs(): number {
        return this.pending;
    }

    launch(req: LaunchRequest): void {
        const bee = this.pool.acquireBee(req.color);
        buildApproachPath(bee.path, req.gridPath, this.sculpture.gridSpace, EXIT_RUNWAY_CELLS, FACE_HOVER_CELLS, bee.center, bee.faceDir);
        bee.path.unitScale = this.sculpture.node.worldScale.x;
        bee.target = req.target;
        bee.phase = APPROACH;
        bee.s = 0;
        bee.timer = 0;
        bee.start.set(req.from);
        const pathStart = bee.path.pointWorld(0, this.sculpture.node.worldMatrix, this.tmp);
        bee.leadLength = launchArc(req.from, pathStart, this.sculpture.node.worldPosition, bee.arcCtrl);
        bee.prev.set(req.from);
        bee.parts.root.setWorldPosition(req.from);
        bee.parts.root.setScale(1, 1, 1);
        this.pending++;
        this.active.push(bee);
    }

    update(dt: number): void {
        const sdt = GameTime.scaled(dt);
        for (let i = this.active.length - 1; i >= 0; i--) {
            const bee = this.active[i];
            if (this.step(bee, sdt)) {
                this.pool.release(bee);
                this.active[i] = this.active[this.active.length - 1];
                this.active.pop();
            }
        }
    }

    /** Advances one bee; returns true when it left the screen. */
    private step(bee: Bee, dt: number): boolean {
        const world = this.sculpture.node.worldMatrix;
        const cell = this.sculpture.gridSpace.cellSize;
        const speed = Math.min(this.beeSpeed, MAX_BEE_FLIGHT_SPEED);
        bee.timer += dt;

        switch (bee.phase) {
            case APPROACH: {
                bee.s += speed * dt;
                if (bee.s < bee.leadLength) {
                    bee.path.pointWorld(0, world, this.tmp);
                    bezier(this.pos, bee.start, bee.arcCtrl, this.tmp, bee.s / bee.leadLength);
                } else {
                    bee.path.sampleWorld(bee.s - bee.leadLength, world, this.pos);
                }
                if (bee.s >= bee.leadLength + bee.path.length) this.enter(bee, GRAB);
                break;
            }
            case GRAB: {
                bee.path.pointWorld(bee.path.pointCount - 1, world, this.pos);
                const punch = 1 + 0.35 * Math.sin(Math.min(1, bee.timer / GRAB_TIME) * Math.PI);
                bee.parts.root.setScale(punch, punch, punch);
                if (bee.timer >= GRAB_TIME) {
                    this.pending--;
                    this.localToWorld(bee.center, bee.faceDir, 0, this.tmp);
                    bee.cube = this.pool.acquireCube(bee.color, this.tmp, this.sculpture.node.worldRotation);
                    this.onGrab(bee.target);
                    this.enter(bee, PULL);
                }
                break;
            }
            case PULL: {
                const t = math.clamp01(bee.timer / PULL_TIME);
                this.localToWorld(bee.center, bee.faceDir, FACE_HOVER_CELLS * cell * t, this.tmp);
                bee.cube!.setWorldPosition(this.tmp);
                this.localToWorld(bee.center, bee.faceDir, (FACE_HOVER_CELLS + 0.3 * t) * cell, this.pos);
                if (t >= 1) {
                    bee.s = bee.path.length;
                    this.enter(bee, CARRY);
                }
                break;
            }
            case CARRY: {
                bee.s -= speed * dt;
                bee.path.sampleWorld(bee.s, world, this.pos);
                bee.path.sampleWorld(bee.s + CUBE_TRAIL_CELLS * cell * bee.path.unitScale, world, this.tmp);
                bee.cube!.setWorldPosition(this.tmp);
                if (bee.s <= 0) this.startHomeFlight(bee);
                break;
            }
            case LEAVE: {
                // Fly home to the hive carrying the cube, shrinking into the entrance at the end.
                const t = math.clamp01((bee.timer * speed) / bee.s);
                bezier(this.pos, bee.leaveFrom, bee.leaveCtrl, bee.leaveTo, t * (2 - t));
                const k = t < 1 - ENTER_FRACTION ? 1 : math.lerp(1, ENTER_SCALE, (t - 1 + ENTER_FRACTION) / ENTER_FRACTION);
                bee.parts.root.setScale(k, k, k);
                Vec3.scaleAndAdd(this.tmp, this.pos, Vec3.UNIT_Y, -0.14 * k);
                bee.cube!.setWorldPosition(this.tmp);
                bee.cube!.setScale(this.pool.cubeScale * k, this.pool.cubeScale * k, this.pool.cubeScale * k);
                if (t >= 1) return true;
                break;
            }
        }

        this.animate(bee, dt);
        return false;
    }

    private startHomeFlight(bee: Bee): void {
        bee.leaveFrom.set(this.pos);
        bee.s = homeArc(bee.leaveFrom, this.hiveEntrance(bee.leaveTo), bee.leaveCtrl);
        this.enter(bee, LEAVE);
    }

    private animate(bee: Bee, dt: number): void {
        bee.flap += dt * FLAP_SPEED;
        const angle = Math.sin(bee.flap) * FLAP_ANGLE;
        bee.parts.wingL.setRotationFromEuler(0, 0, angle);
        bee.parts.wingR.setRotationFromEuler(0, 0, -angle);
        this.pos.y += Math.sin(bee.flap * 0.21) * 0.025;

        const root = bee.parts.root;
        root.setWorldPosition(this.pos);
        Vec3.subtract(this.tmp, this.pos, bee.prev);
        if (this.tmp.lengthSqr() > 1e-8) {
            Vec3.add(this.tmp, this.pos, this.tmp);
            root.lookAt(this.tmp);
        }
        bee.prev.set(this.pos);
    }

    private enter(bee: Bee, phase: number): void {
        bee.phase = phase;
        bee.timer = 0;
        if (phase !== GRAB && phase !== LEAVE) bee.parts.root.setScale(1, 1, 1);
    }

    private localToWorld(center: Vec3, dir: Vec3, dist: number, out: Vec3): Vec3 {
        Vec3.scaleAndAdd(out, center, dir, dist);
        return Vec3.transformMat4(out, out, this.sculpture.node.worldMatrix);
    }
}
