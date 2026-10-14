import { Node, Quat, Vec3 } from 'cc';
import { BeeParts, ModelKit } from '../rendering/ModelKit';
import { BeeFlightPath } from './BeeFlightPath';

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
    readonly path: BeeFlightPath;
    readonly center: Vec3;   // target cube center, sculpture-local
    readonly faceDir: Vec3;  // local unit vector out of the grabbed face
    readonly leaveFrom: Vec3;
    readonly leaveTo: Vec3;
    readonly prev: Vec3;
}

/** Recycles bee and carried-cube nodes; re-tints them when the color changes. */
export class BeePool {
    private readonly freeBees: Bee[] = [];
    private readonly freeCubes: Node[] = [];

    constructor(private readonly kit: ModelKit, private readonly parent: Node, private readonly cellSize: number) {}

    acquireBee(color: number): Bee {
        let bee = this.freeBees.pop();
        if (bee) {
            if (bee.color !== color) this.kit.paintBee(bee.parts.body, color);
        } else {
            const parts = this.kit.createBee(color);
            parts.root.setParent(this.parent);
            parts.root.children[0].setRotationFromEuler(0, BEE_MODEL_YAW, 0);
            bee = {
                parts, color, phase: 0, timer: 0, s: 0, leadLength: 0, target: -1, cube: null,
                flap: Math.random() * 10, start: new Vec3(), path: new BeeFlightPath(), center: new Vec3(),
                faceDir: new Vec3(), leaveFrom: new Vec3(), leaveTo: new Vec3(), prev: new Vec3(),
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
        } else {
            cube = this.kit.createCube(color, this.cellSize);
            cube.setParent(this.parent);
        }
        cube.setWorldPosition(worldPos);
        cube.setWorldRotation(worldRot);
        cube.active = true;
        return cube;
    }

    release(bee: Bee): void {
        bee.parts.root.active = false;
        if (bee.cube) {
            bee.cube.active = false;
            this.freeCubes.push(bee.cube);
            bee.cube = null;
        }
        this.freeBees.push(bee);
    }
}
