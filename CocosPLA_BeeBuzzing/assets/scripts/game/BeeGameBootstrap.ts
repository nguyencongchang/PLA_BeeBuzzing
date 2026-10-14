import {
    _decorator, Camera, Component, Director, director, EffectAsset, JsonAsset, Layers, math, Node, Prefab,
    Scene, TTFFont, UITransform, view,
} from 'cc';
import { EDITOR } from 'cc/env';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { GameView } from 'db://assets/scripts/UI/GameView';
import { TimerComponent } from 'db://assets/scripts/UI/GamViewComponents/TimerComponent';
import { ProgressBarComponent } from 'db://assets/scripts/UI/GamViewComponents/ProgressBarComponent';
import { decodeLevel } from './infrastructure/LevelDecoder';
import { loadFirst, loadResource, loadSpriteFrame } from './infrastructure/ResourceLoader';
import { GAME_COLOR_HEX, gameColorRgb } from './infrastructure/GamePalette';
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
import { BackdropSprites, BoardBackdrop } from './presentation/hud/BoardBackdrop';
import { TutorialHand } from './presentation/hud/TutorialHand';
import { GameAudio } from './presentation/hud/GameAudio';

const { ccclass } = _decorator;

const LEVEL_PATH = 'bee/levels/teddy.level';
const EFFECT_PATH = 'bee/effects/voxel-lit';
const FONT_PATH = 'font/LilitaOne';
/** Matches PlayableConfig.MainCamera's default position. */
const DEFAULT_CAMERA_Z = 16;
const SPRITES = 'bee/sprites';
const modelPaths = (name: string) => [`bee/models/${name}/${name}`, `bee/models/${name}`];

async function loadBackdropSprites(): Promise<BackdropSprites> {
    const [tile, leaves, hiveA, hiveB, slot] = await Promise.all(
        ['dark-bg', 'leaf-border', 'hive-hanging-a', 'hive-hanging-b', 'slot'].map((n) => loadSpriteFrame(`${SPRITES}/${n}`)),
    );
    return { tile, leaves, hiveA, hiveB, slot };
}

function buildPalette(): Float32Array {
    const palette = new Float32Array(256 * 3);
    for (const key of Object.keys(GAME_COLOR_HEX)) {
        const color = Number(key);
        const [r, g, b] = gameColorRgb(color);
        palette.set([r / 255, g / 255, b / 255], color * 3);
    }
    return palette;
}

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

    start(): void {
        this.boot().catch((e) => console.error('[BeeGame] boot failed', e));
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(GameOutcomeSignal, this.onOutcome);
    }

    update(): void {
        if (this.world) this.frameWorld();
        const c = this.controller;
        if (c && !c.running && (GameView.instance?.isInGameplay() ?? true)) c.running = true;
    }

    private async boot(): Promise<void> {
        const [levelAsset, effect, bee, hive, cube, font, backdrop, hand] = await Promise.all([
            loadResource(LEVEL_PATH, JsonAsset),
            loadResource(EFFECT_PATH, EffectAsset),
            loadFirst(modelPaths('bee'), Prefab),
            loadFirst(modelPaths('hive-hexa'), Prefab),
            loadFirst(modelPaths('bee-cube'), Prefab),
            loadResource(FONT_PATH, TTFFont).catch((e) => this.optional('font', e)),
            loadBackdropSprites().catch((e) => this.optional('backdrop sprites', e)),
            loadSpriteFrame(`${SPRITES}/hand`).catch((e) => this.optional('tutorial hand', e)),
        ]);
        const config = gameplayConfig;
        const level = decodeLevel(levelAsset.json);
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
        const materials = new MaterialFactory(effect);
        const kit = new ModelKit(materials, bee, hive, cube);

        const sculptureNode = createChild(this.world, 'Sculpture');
        sculptureNode.setPosition(0, BOARD_LAYOUT.sculptureY, 0);
        const sculpture = sculptureNode.addComponent(SculptureView);
        sculpture.init(grid, space, buildPalette(), materials.sculpture());
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
        hud.init({ camera: this.camera, worldRoot: this.world, board, font, config, totalCubes: grid.aliveCount });

        if (hand) {
            const tutorial = createChild(uiCanvas, 'BeeTutorial', Layers.Enum.UI_2D).addComponent(TutorialHand);
            tutorial.node.addComponent(UITransform);
            tutorial.node.setSiblingIndex(3);
            tutorial.init(this.camera, this.world, board, hand);
        }
        if (backdrop && bgCanvas) {
            const bgCamera = bgCanvas.getComponentInChildren(Camera);
            const templateBg = bgCanvas.getChildByName('BG');
            if (templateBg) templateBg.active = false;
            createChild(bgCanvas, 'BeeBackdrop', bgCanvas.layer).addComponent(BoardBackdrop)
                .init(this.camera, this.world, bgCamera, backdrop, board.slotCount, board.lineCount);
        }
        this.node.addComponent(GameAudio);
        this.hideTemplateHud();

        SignalBus.instance.subscribe(GameOutcomeSignal, this.onOutcome);
    }

    /** Optional cosmetic assets: warn and continue without them. */
    private optional(what: string, error: unknown): null {
        console.warn(`[BeeGame] ${what} unavailable, continuing without it`, error);
        return null;
    }

    /** The template's countdown timer / generic bar are replaced by the bee HUD. */
    private hideTemplateHud(): void {
        const gameView = GameView.instance?.node;
        if (!gameView) return;
        gameView.getComponentsInChildren(TimerComponent).forEach((c) => { c.node.active = false; });
        gameView.getComponentsInChildren(ProgressBarComponent).forEach((c) => { c.node.active = false; });
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
