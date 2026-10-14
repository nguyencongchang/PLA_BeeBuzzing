import { _decorator, Component, Material, Mesh, MeshRenderer, Node, utils, Vec3 } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { GridSpace } from './GridSpace';
import { SculptureMesher } from './SculptureMesher';

const { ccclass } = _decorator;

const CHUNK = 8;
/** Chunk rebuild budget per frame (remaining dirty chunks roll over). */
const MAX_REBUILDS_PER_FRAME = 3;

interface Chunk {
    readonly x0: number; readonly y0: number; readonly z0: number;
    readonly node: Node;
    readonly renderer: MeshRenderer;
    mesh: Mesh | null;
}

/**
 * Renders the voxel sculpture as a few dozen chunk meshes (8³ cells each) with only
 * exposed faces. Rotating the sculpture rotates this node only — per-cube cost is zero.
 * Removing a cube marks its chunk (and a neighbour chunk if on a border) for rebuild.
 */
@ccclass('SculptureView')
export class SculptureView extends Component {
    private grid: VoxelGrid = null!;
    private space: GridSpace = null!;
    private mesher: SculptureMesher = null!;
    private material: Material = null!;
    private chunks: Chunk[] = [];
    private nx = 0; private ny = 0; private nz = 0;
    private dirty: Uint8Array = null!;
    private dirtyQueue: number[] = [];
    private readonly tmpArr = [0, 0, 0];

    init(grid: VoxelGrid, space: GridSpace, palette: Float32Array, material: Material): void {
        this.grid = grid;
        this.space = space;
        this.mesher = new SculptureMesher(grid, space, palette);
        this.material = material;
        this.nx = Math.ceil(grid.width / CHUNK);
        this.ny = Math.ceil(grid.height / CHUNK);
        this.nz = Math.ceil(grid.depth / CHUNK);
        this.dirty = new Uint8Array(this.nx * this.ny * this.nz);

        for (let cz = 0; cz < this.nz; cz++) {
            for (let cy = 0; cy < this.ny; cy++) {
                for (let cx = 0; cx < this.nx; cx++) {
                    const node = new Node(`Chunk_${cx}_${cy}_${cz}`);
                    node.layer = this.node.layer;
                    node.setParent(this.node);
                    const renderer = node.addComponent(MeshRenderer);
                    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
                    renderer.setSharedMaterial(this.material, 0);
                    const chunk: Chunk = { x0: cx * CHUNK, y0: cy * CHUNK, z0: cz * CHUNK, node, renderer, mesh: null };
                    this.chunks.push(chunk);
                    this.rebuild(chunk);
                }
            }
        }
    }

    /** Call after the grid removed cell `i`. */
    markCellRemoved(i: number): void {
        const g = this.grid;
        const x = g.xs[i], y = g.ys[i], z = g.zs[i];
        this.markChunkAt(x, y, z);
        // Faces of neighbours across a chunk border become visible too.
        if (x % CHUNK === 0) this.markChunkAt(x - 1, y, z);
        if (x % CHUNK === CHUNK - 1) this.markChunkAt(x + 1, y, z);
        if (y % CHUNK === 0) this.markChunkAt(x, y - 1, z);
        if (y % CHUNK === CHUNK - 1) this.markChunkAt(x, y + 1, z);
        if (z % CHUNK === 0) this.markChunkAt(x, y, z - 1);
        if (z % CHUNK === CHUNK - 1) this.markChunkAt(x, y, z + 1);
    }

    /** World position of a (fractional) grid coordinate under the current rotation. */
    gridToWorld(x: number, y: number, z: number, out: Vec3): Vec3 {
        const a = this.space.cellToLocalArray(x, y, z, this.tmpArr);
        out.set(a[0], a[1], a[2]);
        return Vec3.transformMat4(out, out, this.node.worldMatrix);
    }

    get gridSpace(): GridSpace {
        return this.space;
    }

    lateUpdate(): void {
        let budget = MAX_REBUILDS_PER_FRAME;
        while (budget > 0 && this.dirtyQueue.length > 0) {
            const id = this.dirtyQueue.shift()!;
            this.dirty[id] = 0;
            this.rebuild(this.chunks[id]);
            budget--;
        }
    }

    private markChunkAt(x: number, y: number, z: number): void {
        if (!this.grid.inBounds(x, y, z)) return;
        const id = Math.floor(x / CHUNK) + this.nx * (Math.floor(y / CHUNK) + this.ny * Math.floor(z / CHUNK));
        if (this.dirty[id]) return;
        this.dirty[id] = 1;
        this.dirtyQueue.push(id);
    }

    private rebuild(chunk: Chunk): void {
        const g = this.grid;
        const geometry = this.mesher.build(
            chunk.x0, chunk.y0, chunk.z0,
            Math.min(chunk.x0 + CHUNK, g.width), Math.min(chunk.y0 + CHUNK, g.height), Math.min(chunk.z0 + CHUNK, g.depth),
        );
        const old = chunk.mesh;
        chunk.mesh = geometry ? utils.MeshUtils.createMesh(geometry) : null;
        chunk.renderer.mesh = chunk.mesh;
        chunk.node.active = chunk.mesh !== null;
        old?.destroy();
    }
}
