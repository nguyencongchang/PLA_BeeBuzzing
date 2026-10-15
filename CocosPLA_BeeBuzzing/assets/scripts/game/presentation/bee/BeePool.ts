import { Node, Quat, Vec3 } from 'cc';
import { BeeParts, ModelKit } from '../rendering/ModelKit';
import { BeeFlightPath } from './BeeFlightPath';
import { BeeLaunchRoute } from './BeeLaunchRoute';
import { CubeStreak, STREAK_LINE_COUNT } from './BeeEffects';

const FLAP_SPEED = 48;
const FLAP_ANGLE = 42;
const tmpHeading = new Vec3();

/** Bee mesh head points to -Z after this yaw (lookAt aligns -Z with the heading). */
const BEE_MODEL_YAW = 180;

/** Mutable per-flight state of one pooled bee. */
export interface Bee {
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
    /** Hive → path start route (world), see BeeLaunchRoute. */
    readonly launch: BeeLaunchRoute;
    readonly path: BeeFlightPath;
    readonly center: Vec3;   // target cube center, sculpture-local
    readonly faceDir: Vec3;  // local unit vector out of the grabbed face
    /** Home route (world), built from `homePoints` by startHomeFlight. */
    readonly home: Vec3[];
    readonly homePoints: Vec3[];
    /** Bee scale at the hive entrance, so bee and cube fit the hole (set by startHomeFlight). */
    entryScale: number;
    readonly prev: Vec3;
    /** Speed lines behind the cube while it is pulled out and carried along its path. */
    readonly streak: CubeStreak;
}

/** Recycles bee and carried-cube nodes; re-tints them when the color changes. */
export class BeePool {
    private readonly freeBees: Bee[] = [];
    private readonly freeCubes: Node[] = [];
    /** Uniform scale of a carried cube at full size (set when the first cube is built). */
    cubeScale = 1;

    constructor(private readonly kit: ModelKit, private readonly parent: Node, private readonly cellSize: number) {}

    acquireBee(color: number): Bee {
        let bee = this.freeBees.pop();
        if (bee) {
            if (bee.color !== color) this.kit.paintBee(bee.parts.body, color);
        } else {
            const parts = this.kit.createBee(color);
            const streak = new CubeStreak(this.kit.createStreak(STREAK_LINE_COUNT));
            streak.node.setParent(this.parent);
            parts.root.setParent(this.parent);
            parts.root.children[0].setRotationFromEuler(0, BEE_MODEL_YAW, 0);
            bee = {
                parts, color, phase: 0, timer: 0, s: 0, leadLength: 0, target: -1, cube: null,
                flap: Math.random() * 10, start: new Vec3(), launch: new BeeLaunchRoute(), path: new BeeFlightPath(), center: new Vec3(),
                faceDir: new Vec3(), entryScale: 1, home: [], homePoints: Array.from({ length: 7 }, () => new Vec3()), prev: new Vec3(), streak,
            };
        }
        bee.color = color;
        bee.parts.root.active = true;
        return bee;
    }

    /** A carried cube placed at its grab pose before it becomes visible (no 1-frame pop). */
    acquireCube(color: number, worldPos: Vec3, worldRot: Quat): Node {
        let cube = this.freeCubes.pop();
        if (cube) {
            this.kit.paintCube(cube, color);
            cube.setScale(this.cubeScale, this.cubeScale, this.cubeScale);
        } else {
            cube = this.kit.createCube(color, this.cellSize);
            cube.setParent(this.parent);
            this.cubeScale = cube.scale.x;
        }
        cube.setWorldPosition(worldPos);
        cube.setWorldRotation(worldRot);
        cube.active = true;
        return cube;
    }

    release(bee: Bee): void {
        bee.parts.root.active = false;
        bee.streak.stop();
        if (bee.cube) {
            bee.cube.active = false;
            this.freeCubes.push(bee.cube);
            bee.cube = null;
        }
        this.freeBees.push(bee);
    }
}

/** Places a bee at `pos` (adds a slight bob), flaps its wings and turns its head along the motion. */
export function poseBee(bee: Bee, pos: Vec3, dt: number): void {
    flapWings(bee, dt);
    pos.y += Math.sin(bee.flap * 0.21) * 0.025;

    const root = bee.parts.root;
    root.setWorldPosition(pos);
    Vec3.subtract(tmpHeading, pos, bee.prev);
    if (tmpHeading.lengthSqr() > 1e-8) root.lookAt(Vec3.add(tmpHeading, pos, tmpHeading));
    bee.prev.set(pos);
}

function flapWings(bee: Bee, dt: number): void {
    bee.flap += dt * FLAP_SPEED;
    const angle = Math.sin(bee.flap) * FLAP_ANGLE;
    bee.parts.wingL.setRotationFromEuler(0, 0, angle);
    bee.parts.wingR.setRotationFromEuler(0, 0, -angle);
}

/** How fast a landing bee turns into its clinging pose (per second). */
const CLING_TURN_RATE = 18;
const clingUp = new Vec3();
const clingView = new Vec3();
const clingRot = new Quat();
const blendRot = new Quat();

/**
 * Bee clinging to a cube face (reference): belly on the face (the model's origin is its belly),
 * back along the face normal, head pointing up the face; wings keep flapping. Blends in
 * smoothly from the flying pose.
 */
export function clingBee(bee: Bee, pos: Vec3, normal: Vec3, dt: number): void {
    flapWings(bee, dt);
    // Head direction: world up projected onto the face (fall back to "away" for top/bottom faces).
    clingUp.set(0, 1, 0);
    Vec3.scaleAndAdd(clingUp, clingUp, normal, -Vec3.dot(clingUp, normal));
    if (clingUp.lengthSqr() < 0.01) {
        clingUp.set(0, 0, -1);
        Vec3.scaleAndAdd(clingUp, clingUp, normal, -Vec3.dot(clingUp, normal));
    }
    clingUp.normalize();
    // Node -Z is the head, so the view vector (+Z) points down the face; +Y is the back.
    Vec3.negate(clingView, clingUp);
    Quat.fromViewUp(clingRot, clingView, normal);
    const root = bee.parts.root;
    Quat.slerp(blendRot, root.worldRotation, clingRot, Math.min(1, dt * CLING_TURN_RATE));
    root.setWorldRotation(blendRot);
    root.setWorldPosition(pos);
    bee.prev.set(pos);
}
