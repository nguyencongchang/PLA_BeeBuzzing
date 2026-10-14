import { DIR_X, DIR_Y, DIR_Z } from '../../domain/GridDirections';

/**
 * Maps grid coordinates (level data, left-handed, +Z away from the camera) into the
 * sculpture node's local space (Cocos, right-handed, +Z toward the camera).
 * The grid is centered on the node pivot so rotation spins around the model's middle.
 */
export class GridSpace {
    readonly cellSize: number;
    private readonly cx: number;
    private readonly cy: number;
    private readonly cz: number;

    constructor(width: number, height: number, depth: number, cellSize: number) {
        this.cellSize = cellSize;
        this.cx = (width - 1) / 2;
        this.cy = (height - 1) / 2;
        this.cz = (depth - 1) / 2;
    }

    /** Local position of a (possibly fractional / out-of-grid) grid coordinate. */
    cellToLocalArray(x: number, y: number, z: number, out: number[]): number[] {
        out[0] = (x - this.cx) * this.cellSize;
        out[1] = (y - this.cy) * this.cellSize;
        out[2] = -(z - this.cz) * this.cellSize;
        return out;
    }

    /** Local-space unit vector of a grid direction. */
    dirToLocal(d: number, out: number[]): number[] {
        out[0] = DIR_X[d];
        out[1] = DIR_Y[d];
        out[2] = -DIR_Z[d];
        return out;
    }
}
