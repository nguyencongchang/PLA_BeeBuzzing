import { Camera, Layers, Node, SpriteFrame, TTFFont, UITransform } from 'cc';
import { VoxelGrid } from '../../domain/VoxelGrid';
import { HiveBoard } from '../../domain/HiveBoard';
import { MaterialFactory } from '../rendering/MaterialFactory';
import { SculptureView } from '../sculpture/SculptureView';
import { SculptureIntro } from '../sculpture/SculptureIntro';
import { TutorialHand } from './TutorialHand';
import { TutorialOverlay } from './TutorialOverlay';

export interface IntroSequenceDeps {
    readonly grid: VoxelGrid;
    readonly board: HiveBoard;
    readonly materials: MaterialFactory;
    readonly sculpture: SculptureView;
    readonly camera: Camera;
    readonly worldRoot: Node;
    readonly uiCanvas: Node;
    readonly hand: SpriteFrame | null;
    readonly font: TTFFont | null;
}

function uiChild(parent: Node, name: string, sibling: number): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform);
    node.setParent(parent);
    node.setSiblingIndex(sibling);
    return node;
}

/**
 * Reference flow after the loading screen: the sculpture assembles itself (intro), then the
 * first-time tutorial dims everything but the front hives until the first tap, after which
 * the idle tap-hint hand takes over.
 */
export class IntroSequence {
    private readonly idleHand: TutorialHand | null;

    /** Builds the (hidden) tutorial pieces right away; call `play` once loading is done. */
    constructor(private readonly d: IntroSequenceDeps) {
        d.sculpture.chunksVisible = false;
        this.idleHand = d.hand ? uiChild(d.uiCanvas, 'BeeTutorial', 3).addComponent(TutorialHand) : null;
        if (this.idleHand && d.hand) this.idleHand.init(d.camera, d.worldRoot, d.board, d.hand);
    }

    /** Resolves when the intro has finished (gameplay may start; the tutorial is up). */
    async play(): Promise<void> {
        const { grid, materials, sculpture, hand } = this.d;
        const introNode = new Node('Intro');
        introNode.layer = sculpture.node.layer;
        introNode.setParent(sculpture.node);
        await introNode.addComponent(SculptureIntro).play(grid, materials, sculpture);
        if (!hand) return;
        const overlay = uiChild(this.d.uiCanvas, 'BeeTutorialOverlay', 4).addComponent(TutorialOverlay);
        overlay.show(this.d.camera, this.d.worldRoot, this.d.board.lineCount, hand, this.d.font, () => this.idleHand?.startIdleHints());
    }
}
