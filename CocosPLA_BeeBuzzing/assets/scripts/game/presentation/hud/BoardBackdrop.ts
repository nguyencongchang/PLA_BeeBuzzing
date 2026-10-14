import { _decorator, Camera, Color, Component, geometry, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3, Widget } from 'cc';
import { BOARD_LAYOUT, slotPosition } from '../hive/BoardLayout';
import { uiNode } from './HudWidgets';
import { fillEllipse, fillVerticalGradient, hexagonPath } from './SceneryPainter';
import { BackdropSprites } from '../../infrastructure/BeeAssetLoader';

const { ccclass } = _decorator;

// Palette sampled from the reference video.
const SKY_TOP = new Color(46, 150, 240, 255);
const SKY_HORIZON = new Color(200, 233, 255, 255);
const HILL_FAR = new Color(150, 205, 130, 255);
const HILL_NEAR = new Color(104, 178, 88, 255);
const FLOOR_TOP = new Color(244, 205, 232, 255);
const FLOOR_BOTTOM = new Color(226, 160, 210, 255);
const PLATFORM = new Color(250, 222, 240, 255);
const SHADOW = new Color(80, 40, 90, 80);
const SLOT_FILL = new Color(214, 104, 160, 150);
const SLOT_STROKE = new Color(255, 255, 255, 110);
const SEPARATOR = new Color(255, 255, 255, 120);
const PANEL_TOP = new Color(150, 96, 170, 255);
const PANEL_BOTTOM = new Color(78, 44, 104, 255);
/** Horizon height as a fraction of the screen from the top. */
const HORIZON = 0.4;
const SLOT_RADIUS_WORLD = 0.52;
const LEAF_ASPECT = 302 / 936;
/** Honey hive bees fly home to: in front of the leaves at the top center. */
const HIVE_W = 240;
const HIVE_H = 182;
const HIVE_TOP = -6;
/** Entrance hole center, as a fraction of the sprite height below its center. */
const HIVE_ENTRANCE_Y = 0.42;

function sprite(parent: Node, name: string, frame: SpriteFrame, w: number, h: number): Sprite {
    const s = uiNode(name, parent, w, h).addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    s.spriteFrame = frame;
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    return s;
}

/**
 * Background layer drawn by the BG canvas camera (behind the 3D world), matching the
 * reference: sky + hills, pink floor with the model's shadow, slot hexes, separator and
 * queue panel, leaves and the hive bees fly home to. All vector except leaves / hive.
 */
@ccclass('BoardBackdrop')
export class BoardBackdrop extends Component {
    private camera: Camera = null!;
    private worldRoot: Node = null!;
    private slotCount = 0;
    private scenery: Graphics = null!;
    private bgCamera: Camera | null = null;
    private hive: Node | null = null;
    private layoutKey = '';
    private readonly tmp = new Vec3();
    private readonly a = new Vec3();
    private readonly b = new Vec3();
    private readonly ray = new geometry.Ray();

    /** `bgCamera` renders this layer before the 3D camera. */
    init(camera: Camera, worldRoot: Node, bgCamera: Camera | null, sprites: BackdropSprites, slotCount: number): void {
        this.camera = camera;
        this.worldRoot = worldRoot;
        this.slotCount = slotCount;
        this.bgCamera = bgCamera;
        if (bgCamera) {
            bgCamera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
            bgCamera.clearColor = SKY_TOP;
        }

        this.node.addComponent(UITransform);
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        this.scenery = uiNode('Scenery', this.node).addComponent(Graphics);

        const width = 1240;
        const leaves = sprite(this.node, 'Leaves', sprites.leaves, width, width * LEAF_ASPECT);
        const lw = leaves.node.addComponent(Widget);
        lw.isAlignTop = true;
        lw.top = -70;

        // Drawn after the leaves so it hangs in front of them, as in the reference.
        this.hive = sprite(this.node, 'HangingHive', sprites.hive, HIVE_W, HIVE_H).node;
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
        this.paint();
    }

    /**
     * World position (board plane) of the hive entrance hole, or null without a BG camera.
     * The hive is UI on the BG canvas, so the hole is projected to screen and back into 3D.
     */
    hiveEntrance(out: Vec3): Vec3 | null {
        if (!this.hive || !this.bgCamera) return null;
        this.tmp.set(0, -HIVE_H * HIVE_ENTRANCE_Y, 0);
        Vec3.transformMat4(this.tmp, this.tmp, this.hive.worldMatrix);
        this.bgCamera.worldToScreen(this.tmp, this.a);
        this.camera.screenPointToRay(this.a.x, this.a.y, this.ray);
        const planeZ = this.worldRoot.worldPosition.z;
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

    private boardY(worldY: number): number {
        return this.toUi(this.a.set(0, worldY, 0), this.b).y;
    }

    private paint(): void {
        const g = this.scenery;
        const size = this.node.getComponent(UITransform)!;
        const w = size.width, h = size.height;
        const left = -w / 2, top = h / 2, bottom = -h / 2;
        const ppu = this.pixelsPerUnit();
        const horizon = top - h * HORIZON;
        const separator = this.boardY(BOARD_LAYOUT.separatorY);
        g.clear();

        fillVerticalGradient(g, left, top, w, top - horizon, SKY_TOP, SKY_HORIZON);
        fillEllipse(g, -w * 0.3, horizon, w * 0.45, h * 0.06, HILL_FAR);
        fillEllipse(g, w * 0.35, horizon, w * 0.4, h * 0.05, HILL_FAR);
        fillEllipse(g, -w * 0.45, horizon - h * 0.01, w * 0.3, h * 0.04, HILL_NEAR);
        fillEllipse(g, w * 0.5, horizon - h * 0.01, w * 0.28, h * 0.035, HILL_NEAR);
        fillVerticalGradient(g, left, horizon, w, horizon - separator, FLOOR_TOP, FLOOR_BOTTOM);

        // Raised platform + soft shadow under the model.
        const shadowY = this.boardY(BOARD_LAYOUT.shadowY);
        fillEllipse(g, 0, shadowY + ppu * 0.15, w * 0.62, ppu * 1.1, PLATFORM);
        fillEllipse(g, 0, shadowY, BOARD_LAYOUT.shadowHalfWidth * ppu, ppu * 0.22, SHADOW);

        // Slot sockets.
        g.lineWidth = 5;
        g.strokeColor = SLOT_STROKE;
        g.fillColor = SLOT_FILL;
        for (let i = 0; i < this.slotCount; i++) {
            this.toUi(slotPosition(i, this.slotCount, this.a), this.b);
            hexagonPath(g, this.b.x, this.b.y, SLOT_RADIUS_WORLD * ppu);
            g.fill();
            g.stroke();
        }

        // Queue panel under the separator line.
        fillVerticalGradient(g, left, separator, w, separator - bottom, PANEL_TOP, PANEL_BOTTOM);
        g.lineWidth = 6;
        g.strokeColor = SEPARATOR;
        g.moveTo(left, separator);
        g.lineTo(-left, separator);
        g.stroke();
    }
}
