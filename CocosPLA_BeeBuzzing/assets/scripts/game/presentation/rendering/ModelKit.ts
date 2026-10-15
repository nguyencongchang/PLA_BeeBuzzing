import { instantiate, Mesh, MeshRenderer, Node, Prefab, primitives, Texture2D, utils } from 'cc';
import { MaterialFactory } from './MaterialFactory';

/** Bee FBX: wings hinge on the body at these local coordinates (mesh units). */
const WING_HINGE_X = 0.18;
const WING_HINGE_Y = 0.45;
/** Desired world sizes (cell size is 0.2). */
const BEE_LENGTH = 0.36;
const HIVE_WIDTH = 0.88;
const BEE_MESH_LENGTH = 1.24;
const HIVE_MESH_WIDTH = 2.14;
const CUBE_MESH_SIZE = 1.05;

const WING_HEX = '#FFFFFFB0';
/** Speed lines behind a carried cube: thin, slightly see-through white, as in the reference. */
const STREAK_LINE_HEX = '#FFFFFFD0';
/** Parallel speed lines per cube (CubeStreak lays them out). */
const STREAK_LINE_COUNT = 2;
/** Queue hives behind the front one are drawn darker, as in the reference. */
const QUEUED_HIVE_SHADE = 0.55;
/** Soft shadow: translucent dark copy offset up-left behind the hive (as in the reference). */
const HIVE_SHADOW_OFFSET_X = -0.1;
const HIVE_SHADOW_OFFSET_Y = 0.1;
const HIVE_SHADOW_DEPTH = 0.1;
const SHADOW_HEX = '#00000080';
const STRIPE_HEX = '#1A1A1A';

export interface BeeParts {
    readonly root: Node;
    readonly wingL: Node;
    readonly wingR: Node;
    readonly body: MeshRenderer;
}

function findMesh(root: Node, name: string): MeshRenderer {
    const node = root.getChildByPath(name) ?? root.getComponentsInChildren(MeshRenderer).find((r) => r.node.name === name)?.node;
    const renderer = node?.getComponent(MeshRenderer);
    if (!renderer?.mesh) throw new Error(`[ModelKit] mesh '${name}' not found in model '${root.name}'`);
    return renderer;
}

function addRenderer(node: Node, mesh: Mesh): MeshRenderer {
    const r = node.addComponent(MeshRenderer);
    r.mesh = mesh;
    r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    return r;
}

/**
 * Lightweight runtime copies of the imported models: plain nodes + shared instanced
 * materials instead of full prefab instances (no per-bee material clones, no animation
 * components), so ~150 bees stay cheap.
 */
export class ModelKit {
    private readonly materials: MaterialFactory;
    private readonly beeBody: Mesh;
    private readonly beeWingL: Mesh;
    private readonly beeWingR: Mesh;
    private readonly smileTexture: Texture2D | null;
    private readonly hiveMesh: Mesh;
    private readonly cubeMesh: Mesh;
    private streakMesh: Mesh | null = null;

    constructor(materials: MaterialFactory, bee: Prefab, hive: Prefab, cube: Prefab) {
        this.materials = materials;
        const beeTmp = instantiate(bee);
        const body = findMesh(beeTmp, 'Bee_2/Body');
        this.beeBody = body.mesh!;
        this.beeWingL = findMesh(beeTmp, 'Bee_2/Wing_L').mesh!;
        this.beeWingR = findMesh(beeTmp, 'Bee_2/Wing_R').mesh!;
        const smileMat = body.sharedMaterials[2];
        this.smileTexture = (smileMat?.getProperty('mainTexture') as Texture2D) ?? null;
        beeTmp.destroy();

        const hiveTmp = instantiate(hive);
        this.hiveMesh = findMesh(hiveTmp, 'Hexa').mesh!;
        hiveTmp.destroy();

        const cubeTmp = instantiate(cube);
        this.cubeMesh = findMesh(cubeTmp, 'Cube').mesh!;
        cubeTmp.destroy();
    }

    createBee(color: number): BeeParts {
        const root = new Node('Bee');
        const model = new Node('Model');
        model.setParent(root);
        model.setScale(BEE_LENGTH / BEE_MESH_LENGTH, BEE_LENGTH / BEE_MESH_LENGTH, BEE_LENGTH / BEE_MESH_LENGTH);

        const bodyNode = new Node('Body');
        bodyNode.setParent(model);
        const body = addRenderer(bodyNode, this.beeBody);
        this.paintBee(body, color);

        const wingMat = this.materials.solid(WING_HEX, { transparent: true });
        const wingL = this.createWing(model, this.beeWingL, -1, wingMat);
        const wingR = this.createWing(model, this.beeWingR, 1, wingMat);
        return { root, wingL, wingR, body };
    }

    /** Re-tints a pooled bee for a new color. */
    paintBee(body: MeshRenderer, color: number): void {
        body.setSharedMaterial(this.materials.gameColor(color), 0);
        body.setSharedMaterial(this.materials.solid(STRIPE_HEX), 1);
        body.setSharedMaterial(this.materials.solid('#FFFFFF', { transparent: true, texture: this.smileTexture }), 2);
    }

    createHive(color: number): Node {
        const node = new Node('Hive');
        const mesh = new Node('Hexa');
        mesh.setParent(node);
        const s = HIVE_WIDTH / HIVE_MESH_WIDTH;
        mesh.setScale(s, s, s);
        // Toon shading + pixel outline from bee-master.effect; soft offset drop shadow below.
        addRenderer(mesh, this.hiveMesh).setSharedMaterial(this.materials.toonGameColor(color), 0);

        const shadow = new Node('Shadow');
        shadow.setParent(node);
        shadow.setScale(s, s, s);
        shadow.setPosition(HIVE_SHADOW_OFFSET_X, HIVE_SHADOW_OFFSET_Y, -HIVE_SHADOW_DEPTH);
        addRenderer(shadow, this.hiveMesh).setSharedMaterial(this.materials.solid(SHADOW_HEX, { transparent: true }), 0);
        return node;
    }

    /** Front hives (tappable) at full color, hives waiting behind them dimmed. */
    paintHive(hive: Node, color: number, dimmed: boolean): void {
        const renderer = hive.getChildByName('Hexa')!.getComponent(MeshRenderer)!;
        renderer.setSharedMaterial(this.materials.toonGameColor(color, dimmed ? QUEUED_HIVE_SHADE : 1), 0);
    }

    /** Speed-line set behind a carried cube: unit boxes along Z, each placed by CubeStreak. */
    createStreak(): Node {
        this.streakMesh ??= utils.MeshUtils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
        const node = new Node('CubeStreak');
        const material = this.materials.solid(STREAK_LINE_HEX, { transparent: true, unlit: true });
        for (let i = 0; i < STREAK_LINE_COUNT; i++) {
            const line = new Node(`Line${i}`);
            line.setParent(node);
            addRenderer(line, this.streakMesh).setSharedMaterial(material, 0);
        }
        return node;
    }

    createCube(color: number, cellSize: number): Node {
        const node = new Node('FlyingCube');
        const s = cellSize / CUBE_MESH_SIZE;
        node.setScale(s, s, s);
        addRenderer(node, this.cubeMesh).setSharedMaterial(this.materials.gameColor(color), 0);
        return node;
    }

    paintCube(node: Node, color: number): void {
        node.getComponent(MeshRenderer)!.setSharedMaterial(this.materials.gameColor(color), 0);
    }

    private createWing(model: Node, mesh: Mesh, side: number, material: ReturnType<MaterialFactory['solid']>): Node {
        // Pivot at the hinge so flapping rotates around the body, not the mesh origin.
        const pivot = new Node(side < 0 ? 'WingPivotL' : 'WingPivotR');
        pivot.setParent(model);
        pivot.setPosition(side * WING_HINGE_X, WING_HINGE_Y, 0);
        const wing = new Node('Wing');
        wing.setParent(pivot);
        wing.setPosition(-side * WING_HINGE_X, -WING_HINGE_Y, 0);
        addRenderer(wing, mesh).setSharedMaterial(material, 0);
        return pivot;
    }
}
