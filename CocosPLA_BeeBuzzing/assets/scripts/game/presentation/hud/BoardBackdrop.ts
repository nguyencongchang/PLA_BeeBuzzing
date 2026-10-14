import { _decorator, Camera, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3, Widget } from 'cc';
import { BOARD_LAYOUT, lineX, slotPosition } from '../hive/BoardLayout';
import { uiNode } from './HudWidgets';

const { ccclass } = _decorator;

const SLOT_SIZE_WORLD = 1.25;
const TRAY_WIDTH_WORLD = 1.2;
const TRAY_COLOR = new Color(10, 14, 40, 150);
const SLOT_BAR_COLOR = new Color(255, 190, 60, 60);
const LEAF_ASPECT = 302 / 936;
const BG_COLOR = new Color(27, 31, 69, 255);
/** The tile pattern is busy at full strength; blend it over the clear color. */
const TILE_TINT = new Color(255, 255, 255, 90);

export interface BackdropSprites {
    readonly tile: SpriteFrame;
    readonly leaves: SpriteFrame;
    readonly hiveA: SpriteFrame;
    readonly hiveB: SpriteFrame;
    readonly slot: SpriteFrame;
}

function sprite(parent: Node, name: string, frame: SpriteFrame, w: number, h: number): Sprite {
    const s = uiNode(name, parent, w, h).addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    s.spriteFrame = frame;
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    return s;
}

/**
 * Background layer drawn by the BG canvas camera (behind the 3D world): tiled backdrop,
 * hanging-hive + leaf decor, line trays and slot sockets aligned to the 3D board.
 */
@ccclass('BoardBackdrop')
export class BoardBackdrop extends Component {
    private camera: Camera = null!;
    private worldRoot: Node = null!;
    private slotCount = 0;
    private lineCount = 0;
    private slots: Node[] = [];
    private trays: Graphics = null!;
    private slotBar: Graphics = null!;
    private readonly tmp = new Vec3();
    private readonly a = new Vec3();
    private readonly b = new Vec3();

    /** `bgCamera` renders this layer before the 3D camera. */
    init(camera: Camera, worldRoot: Node, bgCamera: Camera | null, sprites: BackdropSprites, slotCount: number, lineCount: number): void {
        this.camera = camera;
        this.worldRoot = worldRoot;
        this.slotCount = slotCount;
        this.lineCount = lineCount;

        if (bgCamera) {
            bgCamera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
            bgCamera.clearColor = BG_COLOR;
        }
        this.node.addComponent(UITransform);
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        const tile = sprite(this.node, 'Tile', sprites.tile, 100, 100);
        tile.type = Sprite.Type.TILED;
        tile.color = TILE_TINT;
        const tw = tile.node.addComponent(Widget);
        tw.isAlignTop = tw.isAlignBottom = tw.isAlignLeft = tw.isAlignRight = true;
        tw.top = tw.bottom = tw.left = tw.right = 0;

        this.trays = uiNode('LineTrays', this.node).addComponent(Graphics);
        this.slotBar = uiNode('SlotBar', this.node).addComponent(Graphics);
        for (let i = 0; i < slotCount; i++) this.slots.push(sprite(this.node, `Slot${i}`, sprites.slot, 100, 100).node);

        this.decorTop(sprites);
        this.layout();
    }

    lateUpdate(): void {
        this.layout();
    }

    private decorTop(sprites: BackdropSprites): void {
        const hiveL = sprite(this.node, 'HangingHiveL', sprites.hiveA, 262, 199);
        this.alignCorner(hiveL.node, true, -30, 120);
        const hiveR = sprite(this.node, 'HangingHiveR', sprites.hiveB, 262, 199);
        hiveR.node.setScale(-1, 1, 1);
        this.alignCorner(hiveR.node, false, -30, 120);

        const width = 1240;
        const leaves = sprite(this.node, 'Leaves', sprites.leaves, width, width * LEAF_ASPECT);
        const w = leaves.node.addComponent(Widget);
        w.isAlignTop = true;
        w.top = -40;
    }

    private alignCorner(node: Node, left: boolean, top: number, side: number): void {
        const w = node.getComponent(Widget) ?? node.addComponent(Widget);
        w.isAlignTop = true;
        w.top = top;
        if (left) {
            w.isAlignLeft = true;
            w.left = side - 131;
        } else {
            w.isAlignRight = true;
            w.right = side - 131;
        }
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
        const slotPx = SLOT_SIZE_WORLD * ppu;
        for (let i = 0; i < this.slots.length; i++) {
            const node = this.slots[i];
            this.toUi(slotPosition(i, this.slotCount, this.a), this.b);
            node.setPosition(this.b);
            node.getComponent(UITransform)!.setContentSize(slotPx, slotPx);
        }

        // Honey bar behind the slot row.
        this.toUi(slotPosition(0, this.slotCount, this.a), this.b);
        const left = this.b.x - slotPx * 0.6;
        const barY = this.b.y;
        this.toUi(slotPosition(this.slotCount - 1, this.slotCount, this.a), this.b);
        const g = this.slotBar;
        g.clear();
        g.fillColor = SLOT_BAR_COLOR;
        g.roundRect(left, barY - slotPx * 0.55, this.b.x + slotPx * 0.6 - left, slotPx * 1.1, slotPx * 0.3);
        g.fill();

        // One tray per hive line, from the front hive down past the screen edge.
        const t = this.trays;
        t.clear();
        t.fillColor = TRAY_COLOR;
        const trayW = TRAY_WIDTH_WORLD * ppu;
        const bottom = -this.node.getComponent(UITransform)!.height / 2 - 20;
        for (let line = 0; line < this.lineCount; line++) {
            this.toUi(this.a.set(lineX(line, this.lineCount), BOARD_LAYOUT.lineFrontY + 0.75, 0), this.b);
            t.roundRect(this.b.x - trayW / 2, bottom, trayW, this.b.y - bottom, trayW * 0.3);
        }
        t.fill();
    }
}
