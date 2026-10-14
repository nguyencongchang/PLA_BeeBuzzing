import { _decorator, Camera, Component, Director, director, Layers, math, Node, Scene, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { GameView } from 'db://assets/scripts/UI/GameView';
import { BeeAssets, loadBeeAssets } from './infrastructure/BeeAssetLoader';
import { buildPaletteFloat32 } from './infrastructure/GamePalette';
import { VoxelGrid } from './domain/VoxelGrid';
import { HiveBoard } from './domain/HiveBoard';
import { gameplayConfig } from './application/GameplayConfig';
import { GameplayController } from './application/GameplayController';
import { GameOutcomeSignal } from './application/GameplaySignals';
import { MaterialFactory } from './presentation/rendering/MaterialFactory';
import { ModelKit } from './presentation/rendering/ModelKit';
import { GridSpace } from './presentation/sculpture/GridSpace';
import { SculptureView } from './presentation/sculpture/SculptureView';
import { SculptureRotator } from './presentation/sculpture/SculptureRotator';
import { HiveBoardView } from './presentation/hive/HiveBoardView';
import { BOARD_LAYOUT } from './presentation/hive/BoardLayout';
import { BeeSwarm } from './presentation/bee/BeeSwarm';
import { GameInputRouter } from './presentation/input/GameInputRouter';
import { GameHud } from './presentation/hud/GameHud';
import { BoardBackdrop } from './presentation/hud/BoardBackdrop';
import { IntroSequence } from './presentation/hud/IntroSequence';
import { HiveNest } from './presentation/hud/HiveNest';
import { ensureKeyLight, hideTemplateHud } from './presentation/SceneSetup';
import { GameAudio } from './presentation/hud/GameAudio';

const { ccclass } = _decorator;

/** Matches PlayableConfig.MainCamera's default position. */
const DEFAULT_CAMERA_Z = 16;

function createChild(parent: Node, name: string, layer = Layers.Enum.DEFAULT): Node {
    const node = new Node(name);
    node.layer = layer;
    node.setParent(parent);
    return node;
}

/**
 * Entry point of the Bee Cube level. Loads assets from `resources/bee`, builds the 3D
 * world, HUD and gameplay at runtime, and forwards the outcome to the template's GameView.
 * Auto-attached to the launched scene (see bottom of file) unless the scene already has one.
 */
@ccclass('BeeGameBootstrap')
export class BeeGameBootstrap extends Component {
    private camera: Camera = null!;
    private world: Node = null!;
    private controller: GameplayController | null = null;
    /** Gameplay waits for the intro (sculpture assembly) to finish. */
    private introDone = false;
    /** Starts the intro; deferred until the loading screen has handed over. */
    private pendingIntro: (() => void) | null = null;

    start(): void {
        this.boot().catch((e) => this.onBootFailed(e));
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(GameOutcomeSignal, this.onOutcome);
    }

    update(): void {
        if (this.world) this.frameWorld();
        const c = this.controller;
        const gameplayReady = GameView.instance?.isInGameplay() ?? true;
        if (this.pendingIntro && gameplayReady) {
            const startIntro = this.pendingIntro;
            this.pendingIntro = null;
            startIntro();
        }
        if (c && this.introDone && !c.running && gameplayReady) c.running = true;
    }

    private async boot(): Promise<void> {
        const assets = await loadBeeAssets();
        if (!this.isValid) return; // scene changed while loading
        this.build(assets);
        SignalBus.instance.subscribe(GameOutcomeSignal, this.onOutcome);
    }

    private build({ level, effect, toonEffect, bee, hive, cube, font, backdrop, hand }: BeeAssets): void {
        const config = gameplayConfig;
        const scene = director.getScene()!;
        const cameraNode = scene.getChildByName('Camera3D');
        const uiCanvas = scene.getChildByName('UICanvas');
        const bgCanvas = scene.getChildByName('BGCanvas');
        if (!cameraNode?.getComponent(Camera) || !uiCanvas) throw new Error('[BeeGame] scene needs Camera3D and UICanvas');
        this.camera = cameraNode.getComponent(Camera)!;
        // Parameters may not have applied the camera pose yet; start from the default one.
        if (cameraNode.worldPosition.z < 1) cameraNode.setWorldPosition(0, 0, DEFAULT_CAMERA_Z);

        this.world = createChild(this.node, 'BeeWorld');
        this.frameWorld();

        const grid = new VoxelGrid(level.width, level.height, level.depth, level.cells);
        const space = new GridSpace(level.width, level.height, level.depth, level.cellSize);
        const materials = new MaterialFactory(effect, toonEffect);
        ensureKeyLight(scene, this.node);
        const kit = new ModelKit(materials, bee, hive, cube);

        const sculptureNode = createChild(this.world, 'Sculpture');
        sculptureNode.setPosition(0, BOARD_LAYOUT.sculptureY, 0);
        sculptureNode.setScale(BOARD_LAYOUT.sculptureScale, BOARD_LAYOUT.sculptureScale, BOARD_LAYOUT.sculptureScale);
        const sculpture = sculptureNode.addComponent(SculptureView);
        sculpture.init(grid, space, buildPaletteFloat32(), materials.sculpture());
        const rotator = sculptureNode.addComponent(SculptureRotator);
        rotator.tilt = config.initialTilt;
        rotator.autoRotateSpeed = config.autoRotateSpeed;
        rotator.applyRotation();

        // Labels sit under every other UI element (CTA, end cards stay on top).
        const labelRoot = createChild(uiCanvas, 'HiveLabels', Layers.Enum.UI_2D);
        labelRoot.addComponent(UITransform);
        labelRoot.setSiblingIndex(1);

        const board = new HiveBoard(level.hives, level.lineCount, config.slotCount);
        const hives = createChild(this.world, 'Hives').addComponent(HiveBoardView);
        hives.init(board, kit, this.camera, labelRoot, font);

        const swarm = createChild(this.world, 'Bees').addComponent(BeeSwarm);
        swarm.init(kit, sculpture);
        swarm.beeSpeed = config.beeSpeed;

        const controller = this.node.addComponent(GameplayController);
        controller.init({ config, grid, board, camera: cameraNode, sculpture, rotator, hives, swarm });
        this.controller = controller;

        const router = this.node.addComponent(GameInputRouter);
        router.init(this.camera, this.world, rotator, level.lineCount);
        router.onLineTapped = (line) => controller.tapLine(line);

        const hud = createChild(uiCanvas, 'BeeHud', Layers.Enum.UI_2D).addComponent(GameHud);
        hud.node.setSiblingIndex(2);
        hud.init({ font, config });

        // After the loading screen: intro (sculpture assembles) → first-time tutorial → idle hints.
        const intro = new IntroSequence({ grid, board, materials, sculpture, camera: this.camera, worldRoot: this.world, uiCanvas, hand, font });
        this.pendingIntro = () => intro.play().then(() => { this.introDone = true; });
        if (backdrop && bgCanvas) {
            const bgCamera = bgCanvas.getComponentInChildren(Camera);
            const templateBg = bgCanvas.getChildByName('BG');
            if (templateBg) templateBg.active = false;
            const view = createChild(bgCanvas, 'BeeBackdrop', bgCanvas.layer).addComponent(BoardBackdrop);
            view.init(this.camera, this.world, bgCamera, backdrop, board.slotCount, board.lineCount);
            const fallback = swarm.hiveEntrance;
            swarm.hiveEntrance = (out) => view.hiveEntrance(out) ?? fallback(out);
            if (view.hiveNode) {
                const nest = createChild(uiCanvas, 'BeeHiveFront', Layers.Enum.UI_2D).addComponent(HiveNest);
                nest.node.setSiblingIndex(1);
                nest.init(view.hiveNode, backdrop.hiveFront);
                swarm.onHome = () => nest.onBeeArrived();
            }
        }
        this.node.addComponent(GameAudio);
        hideTemplateHud();
    }


    /** Never leave a dead ad: surface the error and fall back to the end card (CTA still works). */
    private onBootFailed(error: unknown): void {
        console.error('[BeeGame] boot failed, showing the end card instead', error);
        GameView.instance?.onLose();
    }


    /** Uniformly scales the world so the play field always fits the camera frustum. */
    private frameWorld(): void {
        const cam = this.camera;
        const dist = Math.max(1, cam.node.worldPosition.z);
        const halfH = dist * Math.tan(math.toRadian(cam.fov) / 2);
        const size = view.getVisibleSize();
        const halfW = halfH * (size.width / size.height);
        const s = Math.min(halfH / BOARD_LAYOUT.minHalfHeight, halfW / BOARD_LAYOUT.minHalfWidth);
        if (Math.abs(this.world.scale.x - s) > 1e-4) this.world.setScale(s, s, s);
    }

    private onOutcome = (signal: GameOutcomeSignal): void => {
        const gameView = GameView.instance;
        if (!gameView) {
            console.warn(`[BeeGame] outcome '${signal.outcome}' but no GameView in scene`);
            return;
        }
        if (signal.outcome === 'win') gameView.onWin();
        else if (signal.outcome === 'lose') gameView.onLose();
    };
}

// Auto-attach: the gameplay boots without hand-wiring the scene in the editor.
if (!EDITOR) {
    director.on(Director.EVENT_AFTER_SCENE_LAUNCH, (scene: Scene) => {
        if (scene.getComponentInChildren(BeeGameBootstrap)) return;
        createChild(scene, 'BeeGame').addComponent(BeeGameBootstrap);
    });
}
