import { _decorator, Component, math, Vec3 } from 'cc';
import { GameTime } from '../../application/GameTime';
import { ModelKit } from '../rendering/ModelKit';
import { SculptureView } from '../sculpture/SculptureView';
import { buildApproachPath } from './BeeFlightPath';
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
    beeSpeed = 16;

    private sculpture: SculptureView = null!;
    private pool: BeePool = null!;
    private readonly active: Bee[] = [];
    private pending = 0;
    private readonly pos = new Vec3();
    private readonly tmp = new Vec3();

    init(kit: ModelKit, sculpture: SculptureView): void {
        this.sculpture = sculpture;
        this.pool = new BeePool(kit, this.node, sculpture.gridSpace.cellSize);
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
        bee.target = req.target;
        bee.phase = APPROACH;
        bee.s = 0;
        bee.timer = 0;
        bee.start.set(req.from);
        bee.leadLength = Vec3.distance(req.from, bee.path.pointWorld(0, this.sculpture.node.worldMatrix, this.tmp));
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
        const speed = this.beeSpeed;
        bee.timer += dt;

        switch (bee.phase) {
            case APPROACH: {
                bee.s += speed * dt;
                if (bee.s < bee.leadLength) {
                    bee.path.pointWorld(0, world, this.tmp);
                    Vec3.lerp(this.pos, bee.start, this.tmp, bee.s / bee.leadLength);
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
                bee.path.sampleWorld(bee.s + CUBE_TRAIL_CELLS * cell, world, this.tmp);
                bee.cube!.setWorldPosition(this.tmp);
                if (bee.s <= 0) {
                    bee.leaveFrom.set(this.pos);
                    const side = this.pos.x >= 0 ? 1 : -1;
                    bee.leaveTo.set(side * (5 + Math.random() * 2.5), 7.5 + Math.random() * 2, 1 + Math.random());
                    bee.s = Vec3.distance(bee.leaveFrom, bee.leaveTo);
                    this.enter(bee, LEAVE);
                }
                break;
            }
            case LEAVE: {
                const t = math.clamp01((bee.timer * speed * 1.15) / bee.s);
                Vec3.lerp(this.pos, bee.leaveFrom, bee.leaveTo, t * t);
                Vec3.scaleAndAdd(this.tmp, this.pos, Vec3.UNIT_Y, -0.12);
                bee.cube!.setWorldPosition(this.tmp);
                if (t >= 1) return true;
                break;
            }
        }

        this.animate(bee, dt);
        return false;
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
        if (phase !== GRAB) bee.parts.root.setScale(1, 1, 1);
    }

    private localToWorld(center: Vec3, dir: Vec3, dist: number, out: Vec3): Vec3 {
        Vec3.scaleAndAdd(out, center, dir, dist);
        return Vec3.transformMat4(out, out, this.sculpture.node.worldMatrix);
    }
}
