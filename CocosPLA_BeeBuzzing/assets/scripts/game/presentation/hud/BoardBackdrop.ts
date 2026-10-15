import { _decorator, Camera, Color, Component, geometry, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3, Widget } from 'cc';
import { UIScreenResolution } from 'db://assets/scripts/UIScreenResolution';
import { BOARD_LAYOUT, lineX, slotPosition } from '../hive/BoardLayout';
import { uiNode } from './HudWidgets';
import { fillEllipse } from './SceneryPainter';
import { BackdropSprites } from '../../infrastructure/BeeAssetLoader';
import { pretileSpriteFrame } from '../rendering/TextureTiling';

const { ccclass } = _decorator;

const BG_COLOR = new Color(27, 31, 69, 255);
/** The tile pattern is busy at full strength; blend it over the clear color. */
const TILE_TINT = new Color(255, 255, 255, 90);
const TILE_PRE_REPEAT = 8;
const SLOT_SIZE_WORLD = 1.15;
const SLOT_BAR_COLOR = new Color(255, 190, 60, 60);
const TRAY_WIDTH_WORLD = 1.1;
const TRAY_COLOR = new Color(10, 14, 40, 150);
const SHADOW = new Color(0, 0, 0, 70);
const LEAF_ASPECT = 302 / 936;
/** Honey hive bees fly home to: in front of the leaves at the top center. */
const HIVE_W = 240;
const HIVE_H = 182;
const HIVE_TOP = -6;
/** Entrance hole center, as a fraction of the sprite height below its center. */
const HIVE_ENTRANCE_Y = 0.42;
/** Anchored at its top edge so squash/wobble pivots where it hangs from the leaves. */
const HIVE_ANCHOR_Y = 1;

function sprite(parent: Node, name: string, frame: SpriteFrame, w: number, h: number): Sprite {
    const s = uiNode(name, parent, w, h).addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    s.spriteFrame = frame;
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    return s;
}

/**
 * Background layer drawn by the BG canvas camera (behind the 3D world): navy tiled backdrop
 * (full screen via UIScreenResolution), the model's shadow, slot sockets on a honey bar,
 * hive-line trays, leaves and the hive bees fly home to.
 */
@ccclass('BoardBackdrop')
export class BoardBackdrop extends Component {
    private camera: Camera = null!;
    private worldRoot: Node = null!;
    private slotCount = 0;
    private lineCount = 0;
    private board: Graphics = null!;
    private slots: Node[] = [];
    private bgCamera: Camera | null = null;
    private hive: Node | null = null;
    private layoutKey = '';
    private readonly tmp = new Vec3();
    private readonly a = new Vec3();
    private readonly b = new Vec3();
    private readonly ray = new geometry.Ray();

    /** `bgCamera` renders this layer before the 3D camera. */
    init(camera: Camera, worldRoot: Node, bgCamera: Camera | null, sprites: BackdropSprites, slotCount: number, lineCount: number): void {
        this.camera = camera;
        this.worldRoot = worldRoot;
        this.slotCount = slotCount;
        this.lineCount = lineCount;
        this.bgCamera = bgCamera;
        if (bgCamera) {
            bgCamera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
            bgCamera.clearColor = BG_COLOR;
        }

        this.node.addComponent(UITransform);
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // Full real screen (UIScreenResolution); the tile is pre-repeated 8x so the TILED sprite
        // stays far below the UI vertex-buffer limit even on wide/tall screens.
        const tile = sprite(this.node, 'Tile', pretileSpriteFrame(sprites.tile, TILE_PRE_REPEAT), 100, 100);
        tile.type = Sprite.Type.TILED;
        tile.color = TILE_TINT;
        tile.node.addComponent(UIScreenResolution);

        this.board = uiNode('Board', this.node).addComponent(Graphics);
        for (let i = 0; i < slotCount; i++) this.slots.push(sprite(this.node, `Slot${i}`, sprites.slot, 100, 100).node);

        const width = 1240;
        const leaves = sprite(this.node, 'Leaves', sprites.leaves, width, width * LEAF_ASPECT);
        const lw = leaves.node.addComponent(Widget);
        lw.isAlignTop = true;
        lw.top = -70;

        // Drawn after the leaves so it hangs in front of them.
        this.hive = sprite(this.node, 'HangingHive', sprites.hive, HIVE_W, HIVE_H).node;
        this.hive.getComponent(UITransform)!.setAnchorPoint(0.5, HIVE_ANCHOR_Y);
        const hw = this.hive.addComponent(Widget);
        hw.isAlignTop = hw.isAlignHorizontalCenter = true;
        hw.top = HIVE_TOP;
        hw.horizontalCenter = 0;
    }

    /** Re-layout only when the board's projection changed (resize, framing, camera param). */
    lateUpdate(): void {
        this.toUi(this.a.set(0, 0, 0), this.b);
        const key = `${this.pixelsPerUnit().toFixed(2)}:${this.b.x.toFixed(1)}:${this.b.y.toFixed(1)}:${this.node.getComponent(UITransform)!.height}`;
        if (key === this.layoutKey) return;
        this.layoutKey = key;
        this.layout();
    }

    /** The back hive layer (the front layer and the squash animation mirror it). */
    get hiveNode(): Node | null {
        return this.hive;
    }

    /**
     * World position of the hive entrance hole at world depth `planeZ` (default: the board plane),
     * or null without a BG camera. The hive is UI on the BG canvas, so the hole is projected to
     * screen and back into 3D: every depth gives a point that shows exactly on the hole.
     */
    hiveEntrance(out: Vec3, planeZ = this.worldRoot.worldPosition.z): Vec3 | null {
        if (!this.hive || !this.bgCamera) return null;
        this.tmp.set(0, -HIVE_H * (HIVE_ANCHOR_Y - 0.5 + HIVE_ENTRANCE_Y), 0);
        Vec3.transformMat4(this.tmp, this.tmp, this.hive.worldMatrix);
        this.bgCamera.worldToScreen(this.tmp, this.a);
        this.camera.screenPointToRay(this.a.x, this.a.y, this.ray);
        if (Math.abs(this.ray.d.z) < 1e-6) return null;
        return Vec3.scaleAndAdd(out, this.ray.o, this.ray.d, (planeZ - this.ray.o.z) / this.ray.d.z);
    }

    /** Pixels per world unit at the board plane (world root is uniformly scaled). */
    private pixelsPerUnit(): number {
        this.toUi(this.a.set(0, 0, 0), this.a);
        this.toUi(this.b.set(1, 0, 0), this.b);
        return Math.abs(this.b.x - this.a.x);
    }

    private toUi(local: Vec3, out: Vec3): Vec3 {
        Vec3.transformMat4(this.tmp, local, this.worldRoot.worldMatrix);
        return this.camera.convertToUINode(this.tmp, this.node, out);
    }

    private layout(): void {
        const ppu = this.pixelsPerUnit();
        const g = this.board;
        g.clear();

        this.toUi(this.a.set(0, BOARD_LAYOUT.shadowY, 0), this.b);
        fillEllipse(g, this.b.x, this.b.y, BOARD_LAYOUT.shadowHalfWidth * ppu, ppu * 0.22, SHADOW);

        // Slot sockets on a honey bar.
        const slotPx = SLOT_SIZE_WORLD * ppu;
        for (let i = 0; i < this.slots.length; i++) {
            this.toUi(slotPosition(i, this.slotCount, this.a), this.b);
            this.slots[i].setPosition(this.b);
            this.slots[i].getComponent(UITransform)!.setContentSize(slotPx, slotPx);
        }
        this.toUi(slotPosition(0, this.slotCount, this.a), this.b);
        const left = this.b.x - slotPx * 0.6;
        const barY = this.b.y;
        this.toUi(slotPosition(this.slotCount - 1, this.slotCount, this.a), this.b);
        g.fillColor = SLOT_BAR_COLOR;
        g.roundRect(left, barY - slotPx * 0.55, this.b.x + slotPx * 0.6 - left, slotPx * 1.1, slotPx * 0.3);
        g.fill();

        // One tray per hive line, from the front hive down past the screen edge.
        const trayW = TRAY_WIDTH_WORLD * ppu;
        const bottom = this.toUi(this.a.set(0, -20, 0), this.b).y;
        g.fillColor = TRAY_COLOR;
        for (let line = 0; line < this.lineCount; line++) {
            this.toUi(this.a.set(lineX(line, this.lineCount), BOARD_LAYOUT.lineFrontY + 0.65, 0), this.b);
            g.roundRect(this.b.x - trayW / 2, bottom, trayW, this.b.y - bottom, trayW * 0.3);
        }
        g.fill();
    }
}
