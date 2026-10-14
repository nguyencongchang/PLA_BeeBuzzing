const MAX_COLORS = 256;

/**
 * Dense voxel grid of colored cubes (health 1 each).
 * Cell value = color + 1, 0 = empty. Index = x + W * (y + H * z).
 */
export class VoxelGrid {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly cellCount: number;
    /** Cached coordinates per index (avoids div/mod in hot loops). */
    readonly xs: Uint8Array;
    readonly ys: Uint8Array;
    readonly zs: Uint8Array;

    /** Increments on every removal so caches can detect staleness. */
    version = 0;

    private readonly cells: Uint8Array;
    private readonly colorCounts = new Int32Array(MAX_COLORS);
    private alive = 0;

    constructor(width: number, height: number, depth: number, cells: Uint8Array) {
        if (width > 255 || height > 255 || depth > 255) {
            throw new Error(`[VoxelGrid] grid ${width}x${height}x${depth} exceeds 255 per axis`);
        }
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.cellCount = width * height * depth;
        if (cells.length !== this.cellCount) {
            throw new Error(`[VoxelGrid] expected ${this.cellCount} cells, got ${cells.length}`);
        }
        this.cells = new Uint8Array(cells);
        this.xs = new Uint8Array(this.cellCount);
        this.ys = new Uint8Array(this.cellCount);
        this.zs = new Uint8Array(this.cellCount);

        for (let i = 0; i < this.cellCount; i++) {
            this.xs[i] = i % width;
            this.ys[i] = Math.floor(i / width) % height;
            this.zs[i] = Math.floor(i / (width * height));
            const v = this.cells[i];
            if (v !== 0) {
                this.alive++;
                this.colorCounts[v - 1]++;
            }
        }
    }

    index(x: number, y: number, z: number): number {
        return x + this.width * (y + this.height * z);
    }

    inBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth;
    }

    isAlive(i: number): boolean {
        return this.cells[i] !== 0;
    }

    /** Color of the cube at index, or -1 when empty. */
    colorAt(i: number): number {
        return this.cells[i] - 1;
    }

    get aliveCount(): number {
        return this.alive;
    }

    aliveCountOf(color: number): number {
        return this.colorCounts[color];
    }

    /** Removes the cube at index. Returns false if the cell was already empty. */
    remove(i: number): boolean {
        const v = this.cells[i];
        if (v === 0) return false;
        this.cells[i] = 0;
        this.colorCounts[v - 1]--;
        this.alive--;
        this.version++;
        return true;
    }
}
