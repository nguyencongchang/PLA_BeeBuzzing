import { _decorator, Component, math, Vec3 } from 'cc';
import { GameTime } from '../../application/GameTime';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { ModelKit } from '../rendering/ModelKit';
import { SculptureView } from '../sculpture/SculptureView';
import { buildApproachPath } from './BeeFlightPath';
import { startHomeFlight, stepHomeFlight } from './BeeHomeFlight';
import { Bee, BeePool, clingBee, poseBee } from './BeePool';
import { tumble } from './BeeEffects';
import { RouteAnchor } from './FreeFlightRoute';
import { SculptureClearance } from './SculptureClearance';
import { SculptureSegmentCheck } from './SculptureSegmentCheck';

const { ccclass } = _decorator;

// Flight phases.
const APPROACH = 0, GRAB = 1, PULL = 2, CARRY = 3, LEAVE = 4;
/**
 * Bees perch on the cube before pulling it out (reference). Long enough that, at ~6 bees/s
 * on neighbouring targets, a row of 4–5 bees clings side by side while the front one pulls.
 */
const PERCH_TIME = 0.8;
const PERCH_WIGGLE = 0.02;
/** A readable pull gives the socket-to-cube light trail time to bloom. */
const PULL_TIME = 0.22;
/** Bees pop out of the hive small and reach full size after this distance (world units). */
const EMERGE_DISTANCE = 0.45;
const EMERGE_MIN_SCALE = 0.3;
/** Extra cells the approach starts beyond the grid exit, so bees swoop in. */
const EXIT_RUNWAY_CELLS = 3;
/** Bee hovers this far (cells) in front of the cube face it grabs. */
const FACE_HOVER_CELLS = 0.75;
/** Clinging bee: its belly (model origin) rests just on the cube face (cells from the cube center). */
const CLING_CELLS = 0.52;
/** Speed lines reach this far behind the carried cube, along its own path (cells). */
const TRAIL_CELLS = 3.4;
/** Lines fade out over the runway: gone this many cells before the gate. */
const TRAIL_END_CELLS = 1;
const TRAIL_FADE_CELLS = 2;
const CUBE_TRAIL_CELLS = 0.8;
/** Keeps flight readable even if a remote parameter payload contains an older speed. */
const MAX_BEE_FLIGHT_SPEED = 3;
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
    /** A bee carried its cube inside the hive. */
    onHome: () => void = () => undefined;
    /**
     * World position of the hive entrance bees carry cubes into (set by the backdrop). The hive is
     * 2D, so this is the point on the camera ray through the entrance hole at world depth `planeZ`
     * (`across`, -1..1: a point across the hole, -1/1 its rims).
     */
    hiveEntrance: (out: Vec3, planeZ?: number, across?: number) => Vec3 = (out) => Vec3.transformMat4(out, DEFAULT_HIVE, this.node.worldMatrix);
    beeSpeed = MAX_BEE_FLIGHT_SPEED;

    private sculpture: SculptureView = null!;
    private pool: BeePool = null!;
    private readonly active: Bee[] = [];
    private pending = 0;
    /** Live gate / exit the free-flight routes attach to (refreshed per bee). */
    private anchor: RouteAnchor & { gate: Vec3; exit: Vec3 } = null!;
    private readonly pos = new Vec3();
    private readonly tmp = new Vec3();

    init(kit: ModelKit, sculpture: SculptureView, grid: VoxelGrid): void {
        this.sculpture = sculpture;
        const clearance = new SculptureClearance(sculpture.node, grid, sculpture.gridSpace);
        const segments = new SculptureSegmentCheck(sculpture.node, grid, sculpture.gridSpace);
        this.anchor = { gate: new Vec3(), exit: new Vec3(), clearance, isClear: (a, b) => segments.isClear(a, b) };
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
        bee.s = bee.timer = 0;
        bee.start.set(req.from);
        bee.launch.build(req.from, this.anchorTo(bee).gate);
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
                // The route's end follows the rotating model, so its length is re-measured each frame.
                const anchor = this.anchorTo(bee);
                bee.leadLength = bee.launch.length(bee.start, anchor);
                if (bee.s < bee.leadLength) {
                    bee.launch.sample(bee.start, anchor, bee.s, this.pos);
                    // Emerging from the hive: grows from small to full size over the first stretch.
                    const k = Math.min(1, EMERGE_MIN_SCALE + (1 - EMERGE_MIN_SCALE) * bee.s / EMERGE_DISTANCE);
                    bee.parts.root.setScale(k, k, k);
                } else {
                    bee.path.sampleWorld(bee.s - bee.leadLength, world, this.pos);
                }
                if (bee.s >= bee.leadLength + bee.path.length) this.enter(bee, GRAB);
                break;
            }
            case GRAB: { // clinging on the cube face, wiggling, then pulls
                this.localToWorld(bee.center, bee.faceDir, CLING_CELLS * cell, this.pos);
                this.pos.x += Math.sin(bee.timer * 40) * PERCH_WIGGLE;
                const punch = 1 + 0.3 * Math.sin(Math.min(1, bee.timer / 0.1) * Math.PI);
                bee.parts.root.setScale(punch, punch, punch);
                if (bee.timer >= PERCH_TIME) {
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
                const pullDistance = FACE_HOVER_CELLS * cell * t;
                this.localToWorld(bee.center, bee.faceDir, pullDistance, this.tmp);
                bee.cube!.setWorldPosition(this.tmp);
                // Lines from the emptied socket outwards: only space the cube itself has just left.
                this.localToWorld(bee.center, bee.faceDir, Math.max(0, pullDistance - TRAIL_CELLS * cell), this.pos);
                bee.streak.draw(this.tmp, this.pos, cell * bee.path.unitScale, 1);
                // Still clinging: the bee rides out on the cube it pulls.
                this.localToWorld(bee.center, bee.faceDir, pullDistance + CLING_CELLS * cell, this.pos);
                if (t >= 1) {
                    bee.s = bee.path.length;
                    this.enter(bee, CARRY);
                }
                break;
            }
            case CARRY: {
                bee.s -= speed * dt;
                // Carry back out only to the first cell outside the grid: the runway is for swooping in.
                const exitS = bee.path.cumulativeWorld(1);
                bee.s = Math.max(bee.s, exitS);
                bee.path.sampleWorld(bee.s, world, this.pos);
                const cubeS = Math.min(bee.s + CUBE_TRAIL_CELLS * cell * bee.path.unitScale, bee.path.length);
                bee.path.sampleWorld(cubeS, world, this.tmp);
                bee.cube!.setWorldPosition(this.tmp);
                this.drawCarryTrail(bee, cubeS, cubeS - exitS, cell);
                tumble(bee.cube!, dt);
                if (bee.s <= exitS) {
                    bee.streak.stop();
                    startHomeFlight(bee, this.anchorTo(bee, 1), this.hiveEntrance);
                    this.enter(bee, LEAVE);
                }
                break;
            }
            case LEAVE:
                if (stepHomeFlight(bee, speed, dt, this.pool.cubeScale, this.pos)) { this.onHome(); return true; }
                break;
        }

        if (bee.phase === GRAB || bee.phase === PULL) {
            clingBee(bee, this.pos, Vec3.transformQuat(this.tmp, bee.faceDir, this.sculpture.node.worldRotation), dt);
        } else {
            poseBee(bee, this.pos, dt);
        }
        return false;
    }

    private enter(bee: Bee, phase: number): void {
        bee.phase = phase;
        bee.timer = 0;
        if (phase !== GRAB && phase !== LEAVE) bee.parts.root.setScale(1, 1, 1);
    }

    /**
     * Speed lines behind a cube carried along its path (cube at path distance `cubeS`, world, and
     * `toEnd` short of where the carry ends). The
     * tail stays on the straight leg the cube is on — never across a corner, which could clip the
     * cube on its inside — except on the last leg, which runs straight out of the emptied socket.
     */
    private drawCarryTrail(bee: Bee, cubeS: number, toEnd: number, cell: number): void {
        const path = bee.path, cellW = cell * path.unitScale;
        const wanted = cubeS + TRAIL_CELLS * cellW;
        const legEnd = path.legEnd(cubeS);
        if (legEnd < path.length || wanted <= path.length) {
            path.sampleWorld(Math.min(wanted, legEnd), this.sculpture.node.worldMatrix, this.pos);
        } else {
            const intoSocket = Math.min((wanted - path.length) / path.unitScale, FACE_HOVER_CELLS * cell);
            this.localToWorld(bee.center, bee.faceDir, FACE_HOVER_CELLS * cell - intoSocket, this.pos);
        }
        const fade = math.clamp01((toEnd / cellW - TRAIL_END_CELLS) / TRAIL_FADE_CELLS);
        bee.streak.draw(this.tmp, this.pos, cellW, fade);
    }

    /**
     * Points the shared route anchor at this bee's live exit direction and gate: path point `at`
     * (0: the runway start bees swoop in from, 1: the first cell outside the grid).
     */
    private anchorTo(bee: Bee, at = 0): RouteAnchor {
        const a = this.anchor, world = this.sculpture.node.worldMatrix;
        bee.path.pointWorld(at, world, a.gate);
        Vec3.subtract(a.exit, a.gate, bee.path.pointWorld(at + 1, world, this.tmp)).normalize();
        return a;
    }

    private localToWorld(center: Vec3, dir: Vec3, dist: number, out: Vec3): Vec3 {
        Vec3.scaleAndAdd(out, center, dir, dist);
        return Vec3.transformMat4(out, out, this.sculpture.node.worldMatrix);
    }
}
