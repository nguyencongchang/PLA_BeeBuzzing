import { instantiate, Mesh, MeshRenderer, Node, Prefab, Texture2D } from 'cc';
import { MaterialFactory } from './MaterialFactory';

/** Bee FBX: wings hinge on the body at these local coordinates (mesh units). */
const WING_HINGE_X = 0.18;
const WING_HINGE_Y = 0.45;
/** Desired world sizes (cell size is 0.2). */
const BEE_LENGTH = 0.36;
const HIVE_WIDTH = 0.92;
const BEE_MESH_LENGTH = 1.24;
const HIVE_MESH_WIDTH = 2.14;
const CUBE_MESH_SIZE = 1.05;

const WING_HEX = '#FFFFFFB0';
/** Queue hives behind the front one are drawn darker, as in the reference. */
const QUEUED_HIVE_SHADE = 0.55;
/** Thin black silhouette outline: back faces of a slightly larger hull (inverted hull). */
const HIVE_OUTLINE_SCALE = 1.05;
const OUTLINE_HEX = '#000000';
/** Soft drop shadow: translucent dark copy offset down-left, behind the hive. */
const HIVE_SHADOW_OFFSET_X = -0.09;
const HIVE_SHADOW_OFFSET_Y = -0.09;
const HIVE_SHADOW_DEPTH = 0.1;
const SHADOW_HEX = '#00000080';
/** Hive mesh spans z 0..1 (mesh units); the hull is scaled around this center. */
const HIVE_MESH_CENTER_Z = 0.5;
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
        addRenderer(mesh, this.hiveMesh).setSharedMaterial(this.materials.gameColor(color), 0);

        // Cartoon look: thin black silhouette outline + soft offset drop shadow.
        const k = s * HIVE_OUTLINE_SCALE;
        const outline = new Node('Outline');
        outline.setParent(node);
        outline.setScale(k, k, k);
        outline.setPosition(0, 0, (s - k) * HIVE_MESH_CENTER_Z); // keep the hull centered on the hive
        addRenderer(outline, this.hiveMesh).setSharedMaterial(this.materials.solid(OUTLINE_HEX, { cullFront: true }), 0);

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
        renderer.setSharedMaterial(this.materials.gameColor(color, { shade: dimmed ? QUEUED_HIVE_SHADE : 1 }), 0);
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
