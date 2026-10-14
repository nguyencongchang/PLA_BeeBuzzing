/**
 * The six axis directions of the voxel grid.
 * Index layout: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z  → opposite(d) = d ^ 1, axis(d) = d >> 1.
 */
export const DIR_COUNT = 6;
export const DIR_X: readonly number[] = [1, -1, 0, 0, 0, 0];
export const DIR_Y: readonly number[] = [0, 0, 1, -1, 0, 0];
export const DIR_Z: readonly number[] = [0, 0, 0, 0, 1, -1];

/** Bit mask with every direction set. */
export const ALL_DIRS_MASK = (1 << DIR_COUNT) - 1;

export function oppositeDir(d: number): number {
    return d ^ 1;
}

export function isPerpendicular(a: number, b: number): boolean {
    return (a >> 1) !== (b >> 1);
}
