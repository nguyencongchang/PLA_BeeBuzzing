import { Node, Vec3 } from 'cc';
import { DIR_COUNT } from '../../domain/GridDirections';
import { GridSpace } from './GridSpace';

const tmpLocal = [0, 0, 0];
const tmpDir = new Vec3();
const toCamera = new Vec3();
const camRight = new Vec3();
const camUp = new Vec3();
const gridAxes = [new Vec3(), new Vec3(), new Vec3()];

/** Grid direction d expressed in world space under the sculpture's rotation. */
function gridDirToWorld(sculpture: Node, space: GridSpace, d: number, out: Vec3): Vec3 {
    const l = space.dirToLocal(d, tmpLocal);
    out.set(l[0], l[1], l[2]);
    return Vec3.transformQuat(out, out, sculpture.worldRotation);
}

/**
 * Bit mask of grid directions currently facing the camera (dot ≥ threshold).
 * Bees may only escape the grid along these directions.
 */
export function computeExitMask(sculpture: Node, camera: Node, space: GridSpace, threshold: number): number {
    Vec3.subtract(toCamera, camera.worldPosition, sculpture.worldPosition);
    toCamera.normalize();
    let mask = 0;
    for (let d = 0; d < DIR_COUNT; d++) {
        gridDirToWorld(sculpture, space, d, tmpDir);
        if (Vec3.dot(tmpDir, toCamera) >= threshold) mask |= 1 << d;
    }
    return mask;
}

/**
 * Row-major 3x3 matrix mapping a grid offset (in cells) to camera view space rows
 * [right, up, toward-camera]; used to rank targets top → near → right.
 */
export function computeViewMatrix(sculpture: Node, camera: Node, space: GridSpace, out: number[]): number[] {
    Vec3.transformQuat(camRight, Vec3.RIGHT, camera.worldRotation);
    Vec3.transformQuat(camUp, Vec3.UP, camera.worldRotation);
    Vec3.subtract(toCamera, camera.worldPosition, sculpture.worldPosition);
    toCamera.normalize();
    // Grid +X, +Y, +Z axes (direction indices 0, 2, 4) in world space.
    gridDirToWorld(sculpture, space, 0, gridAxes[0]);
    gridDirToWorld(sculpture, space, 2, gridAxes[1]);
    gridDirToWorld(sculpture, space, 4, gridAxes[2]);
    const rows = [camRight, camUp, toCamera];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) out[r * 3 + c] = Vec3.dot(rows[r], gridAxes[c]);
    }
    return out;
}
