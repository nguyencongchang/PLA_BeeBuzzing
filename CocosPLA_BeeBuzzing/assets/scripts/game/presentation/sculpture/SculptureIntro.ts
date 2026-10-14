import { _decorator, Component, Mesh, MeshRenderer, Node, primitives, utils, Vec3 } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { DIR_COUNT, DIR_X, DIR_Y, DIR_Z } from '../../domain/GridDirections';
import { MaterialFactory } from '../rendering/MaterialFactory';
import { SculptureView } from './SculptureView';

const { ccclass } = _decorator;

/** Bottom → top stagger of the drop (seconds across the whole height). */
const LAYER_SPREAD = 0.9;
const RANDOM_DELAY = 0.25;
const FALL_TIME = 0.5;
/** Cubes start this many model-heights above their spot (off the top of the screen). */
const DROP_HEIGHTS = 1.4;

interface FallingCube {
    readonly node: Node;
    readonly to: Vec3;
    readonly fromY: number;
    readonly delay: number;
}

/** easeOutBack: overshoots slightly so each cube "lands" with a small bounce. */
function easeOutBack(t: number): number {
    const c1 = 1.70158, c3 = c1 + 1, u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
}

/**
 * Intro from the reference: the sculpture assembles itself from cubes dropping in from
 * above, bottom layers first. Only surface cubes are animated (interior ones are never
 * visible); the chunk meshes take over once every cube has landed.
 */
@ccclass('SculptureIntro')
export class SculptureIntro extends Component {
    private cubes: FallingCube[] = [];
    private time = 0;
    private endTime = 0;
    private sculpture: SculptureView = null!;
    private mesh: Mesh | null = null;
    private resolve: (() => void) | null = null;

    play(grid: VoxelGrid, materials: MaterialFactory, sculpture: SculptureView): Promise<void> {
        this.sculpture = sculpture;
        sculpture.chunksVisible = false;
        const space = sculpture.gridSpace;
        const cell = space.cellSize;
        this.mesh = utils.MeshUtils.createMesh(primitives.box({ width: cell, height: cell, length: cell }));
        const dropY = grid.height * cell * DROP_HEIGHTS;
        const local = [0, 0, 0];

        for (let i = 0; i < grid.cellCount; i++) {
            if (!grid.isAlive(i) || !this.isSurface(grid, i)) continue;
            const x = grid.xs[i], y = grid.ys[i], z = grid.zs[i];
            space.cellToLocalArray(x, y, z, local);
            const node = new Node('IntroCube');
            node.layer = this.node.layer;
            node.setParent(this.node);
            const renderer = node.addComponent(MeshRenderer);
            renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
            renderer.mesh = this.mesh;
            renderer.setSharedMaterial(materials.gameColor(grid.colorAt(i), { edge: true }), 0);
            const delay = LAYER_SPREAD * (y / Math.max(1, grid.height - 1)) + Math.random() * RANDOM_DELAY;
            const to = new Vec3(local[0], local[1], local[2]);
            const fromY = to.y + dropY + Math.random() * cell * 6;
            node.setPosition(to.x, fromY, to.z);
            this.cubes.push({ node, to, fromY, delay });
            this.endTime = Math.max(this.endTime, delay + FALL_TIME);
        }
        return new Promise((resolve) => { this.resolve = resolve; });
    }

    update(dt: number): void {
        if (!this.resolve) return;
        this.time += dt;
        for (const c of this.cubes) {
            const t = Math.min(1, Math.max(0, (this.time - c.delay) / FALL_TIME));
            const k = easeOutBack(t);
            c.node.setPosition(c.to.x, c.fromY + (c.to.y - c.fromY) * k, c.to.z);
        }
        if (this.time >= this.endTime) this.finish();
    }

    private finish(): void {
        this.sculpture.chunksVisible = true;
        this.node.destroy();
        this.mesh?.destroy();
        const resolve = this.resolve!;
        this.resolve = null;
        resolve();
    }

    private isSurface(grid: VoxelGrid, i: number): boolean {
        const x = grid.xs[i], y = grid.ys[i], z = grid.zs[i];
        for (let d = 0; d < DIR_COUNT; d++) {
            const nx = x + DIR_X[d], ny = y + DIR_Y[d], nz = z + DIR_Z[d];
            if (!grid.inBounds(nx, ny, nz) || !grid.isAlive(grid.index(nx, ny, nz))) return true;
        }
        return false;
    }
}
