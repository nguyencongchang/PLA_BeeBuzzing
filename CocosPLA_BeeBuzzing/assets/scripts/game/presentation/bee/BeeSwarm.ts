import { _decorator, Component, math, Node, Vec3 } from 'cc';
import { GameTime } from '../../application/GameTime';
import { BeeParts, ModelKit } from '../rendering/ModelKit';
import { SculptureView } from '../sculpture/SculptureView';
import { BeeFlightPath } from './BeeFlightPath';

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
/** Bee mesh head points to -Z after this yaw (lookAt aligns -Z with the heading). */
const BEE_MODEL_YAW = 180;

export interface LaunchRequest {
    readonly color: number;
    readonly from: Vec3;
    readonly target: number;
    /** Solver escape route, flat grid coords: target, corners..., first cell outside. */
    readonly gridPath: readonly number[];
}

interface Bee {
    readonly parts: BeeParts;
    color: number;
    phase: number;
    timer: number;
    s: number;
    leadLength: number;
    target: number;
    cube: Node | null;
    flap: number;
    readonly start: Vec3;
    readonly path: BeeFlightPath;
    readonly center: Vec3;   // target cube center, local
    readonly faceDir: Vec3;  // local unit vector out of the grabbed face
    readonly leaveFrom: Vec3;
    readonly leaveTo: Vec3;
    readonly prev: Vec3;
}

/**
 * All bees and the cubes they carry, driven by one update loop (no per-bee components).
 * Calls `onGrab(target)` the moment a bee latches on — that is when the cube leaves the grid.
 */
@ccclass('BeeSwarm')
export class BeeSwarm extends Component {
    onGrab: (target: number, color: number) => void = () => undefined;
    beeSpeed = 16;

    private kit: ModelKit = null!;
    private sculpture: SculptureView = null!;
    private readonly active: Bee[] = [];
    private readonly freeBees: Bee[] = [];
    private readonly freeCubes: Node[] = [];
    private pending = 0;
    private readonly pos = new Vec3();
    private readonly tmp = new Vec3();
    private readonly tmpArr = [0, 0, 0];

    init(kit: ModelKit, sculpture: SculptureView): void {
        this.kit = kit;
        this.sculpture = sculpture;
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
        const bee = this.acquireBee(req.color);
        const space = this.sculpture.gridSpace;
        const gp = req.gridPath;
        const last = gp.length - 3;
        const cell = space.cellSize;

        // Face direction = first path segment; exit direction = last segment.
        const fx = Math.sign(gp[3] - gp[0]), fy = Math.sign(gp[4] - gp[1]), fz = Math.sign(gp[5] - gp[2]);
        const ex = Math.sign(gp[last] - gp[last - 3]), ey = Math.sign(gp[last + 1] - gp[last - 2]), ez = Math.sign(gp[last + 2] - gp[last - 1]);

        bee.path.reset();
        this.pushGrid(bee.path, gp[last] + ex * EXIT_RUNWAY_CELLS, gp[last + 1] + ey * EXIT_RUNWAY_CELLS, gp[last + 2] + ez * EXIT_RUNWAY_CELLS);
        for (let i = last; i >= 3; i -= 3) this.pushGrid(bee.path, gp[i], gp[i + 1], gp[i + 2]);
        this.pushGrid(bee.path, gp[0] + fx * FACE_HOVER_CELLS, gp[1] + fy * FACE_HOVER_CELLS, gp[2] + fz * FACE_HOVER_CELLS);

        const c = space.cellToLocalArray(gp[0], gp[1], gp[2], this.tmpArr);
        bee.center.set(c[0], c[1], c[2]);
        bee.faceDir.set(fx, fy, -fz); // grid Z is mirrored in local space

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
                this.release(bee);
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
                const total = bee.leadLength + bee.path.length;
                if (bee.s < bee.leadLength) {
                    bee.path.pointWorld(0, world, this.tmp);
                    Vec3.lerp(this.pos, bee.start, this.tmp, bee.s / bee.leadLength);
                } else {
                    bee.path.sampleWorld(bee.s - bee.leadLength, world, this.pos);
                }
                if (bee.s >= total) this.enter(bee, GRAB);
                break;
            }
            case GRAB: {
                bee.path.pointWorld(bee.path.pointCount - 1, world, this.pos);
                const punch = 1 + 0.35 * Math.sin(Math.min(1, bee.timer / GRAB_TIME) * Math.PI);
                bee.parts.root.setScale(punch, punch, punch);
                if (bee.timer >= GRAB_TIME) {
                    this.pending--;
                    bee.cube = this.acquireCube(bee.color);
                    this.onGrab(bee.target, bee.color);
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
        Vec3.subtract(this.tmp, this.pos, bee.prev);
        if (this.tmp.lengthSqr() > 1e-8) {
            Vec3.add(this.tmp, this.pos, this.tmp);
            root.setWorldPosition(this.pos);
            root.lookAt(this.tmp);
        } else {
            root.setWorldPosition(this.pos);
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

    private pushGrid(path: BeeFlightPath, x: number, y: number, z: number): void {
        const l = this.sculpture.gridSpace.cellToLocalArray(x, y, z, this.tmpArr);
        path.push(l[0], l[1], l[2]);
    }

    private acquireBee(color: number): Bee {
        let bee = this.freeBees.pop();
        if (bee) {
            if (bee.color !== color) this.kit.paintBee(bee.parts.body, color);
        } else {
            const parts = this.kit.createBee(color);
            parts.root.setParent(this.node);
            parts.root.children[0].setRotationFromEuler(0, BEE_MODEL_YAW, 0);
            bee = {
                parts, color, phase: APPROACH, timer: 0, s: 0, leadLength: 0, target: -1, cube: null,
                flap: Math.random() * 10, start: new Vec3(), path: new BeeFlightPath(), center: new Vec3(),
                faceDir: new Vec3(), leaveFrom: new Vec3(), leaveTo: new Vec3(), prev: new Vec3(),
            };
        }
        bee.color = color;
        bee.parts.root.active = true;
        return bee;
    }

    private acquireCube(color: number): Node {
        let cube = this.freeCubes.pop();
        if (cube) {
            this.kit.paintCube(cube, color);
        } else {
            cube = this.kit.createCube(color, this.sculpture.gridSpace.cellSize);
            cube.setParent(this.node);
        }
        // Inherit the sculpture's orientation so the cube leaves without popping.
        cube.setWorldRotation(this.sculpture.node.worldRotation);
        cube.active = true;
        return cube;
    }

    private release(bee: Bee): void {
        bee.parts.root.active = false;
        if (bee.cube) {
            bee.cube.active = false;
            this.freeCubes.push(bee.cube);
            bee.cube = null;
        }
        this.freeBees.push(bee);
    }
}
