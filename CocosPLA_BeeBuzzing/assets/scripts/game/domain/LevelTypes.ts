/**
 * Pure level data shared by every gameplay layer.
 * Domain files must never import 'cc' so they stay unit-testable in Node.
 */

/** One hive (shooter): a queue entry holding bullets (bees) of a single color. */
export interface HiveSpec {
    readonly id: number;
    readonly line: number;
    readonly color: number;
    readonly ammo: number;
}

export interface LevelData {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    /** World size of one cube. */
    readonly cellSize: number;
    /** Euler degrees from the level editor (Unity, left-handed). */
    readonly defaultRotation: readonly [number, number, number];
    readonly lineCount: number;
    /** value = GameColor + 1, 0 = empty; index = x + W * (y + H * z). */
    readonly cells: Uint8Array;
    readonly hives: readonly HiveSpec[];
}
