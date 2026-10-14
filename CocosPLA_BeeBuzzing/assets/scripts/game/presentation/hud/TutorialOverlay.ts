import { _decorator, Camera, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, TTFFont, tween, UIOpacity, UITransform, Vec3, Widget } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { UIScreenResolution } from 'db://assets/scripts/UIScreenResolution';
import { HiveActivatedSignal } from '../../application/GameplaySignals';
import { BOARD_LAYOUT, lineX, queuePosition } from '../hive/BoardLayout';
import { uiNode } from './HudWidgets';

const { ccclass } = _decorator;

const DIM = new Color(10, 5, 30, 150);
const HIGHLIGHT_FILL = new Color(255, 160, 220, 60);
const HIGHLIGHT_STROKE = new Color(255, 170, 225, 255);
const BUBBLE_TEXT = new Color(22, 52, 130, 255);
const TEXT = 'Tap a Bee cell to\nsend Bees';
const BUBBLE_W = 560;
const BUBBLE_H = 150;
const HAND_SIZE = 170;
/** Fingertip sits at the top-left of the hand image. */
const FINGERTIP_OFFSET = new Vec3(55, -70, 0);

/**
 * First-time tutorial from the reference: the screen dims except the front row of hives,
 * a speech bubble says what to do and a hand taps a hive. Taps go through (nothing here
 * listens for touches); the first hive tap closes it.
 */
@ccclass('TutorialOverlay')
export class TutorialOverlay extends Component {
    private onDone: () => void = () => undefined;
    private closing = false;
    private dim: Graphics = null!;
    private dimKey = '';
    private readonly holeLo = new Vec3();
    private readonly holeHi = new Vec3();
    private readonly tmp = new Vec3();

    show(camera: Camera, worldRoot: Node, lineCount: number, hand: SpriteFrame, font: TTFFont | null, onDone: () => void): void {
        this.onDone = onDone;
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.updateAlignment();
        const opacity = this.node.addComponent(UIOpacity);

        // Highlight rect around the front row of hives, in this node's UI space.
        const toUi = (x: number, y: number) => {
            Vec3.transformMat4(this.tmp, this.tmp.set(x, y, 0), worldRoot.worldMatrix);
            return camera.convertToUINode(this.tmp, this.node, new Vec3());
        };
        const pad = BOARD_LAYOUT.lineSpacing * 0.5;
        const lo = toUi(lineX(0, lineCount) - pad, BOARD_LAYOUT.lineFrontY - 0.55);
        const hi = toUi(lineX(lineCount - 1, lineCount) + pad, BOARD_LAYOUT.lineFrontY + 0.55);
        this.drawDim(lo, hi);

        const bubble = this.buildBubble(font);
        bubble.setPosition((lo.x + hi.x) / 2, hi.y + BUBBLE_H / 2 + 40);

        const handNode = uiNode('Hand', this.node, HAND_SIZE, HAND_SIZE);
        const sprite = handNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = hand;
        const middle = Math.floor(lineCount / 2);
        queuePosition(middle, lineCount, 0, this.tmp);
        handNode.setPosition(Vec3.add(new Vec3(), toUi(this.tmp.x, this.tmp.y), FINGERTIP_OFFSET));
        tween(handNode).repeatForever(
            tween().to(0.35, { scale: new Vec3(0.82, 0.82, 1) }, { easing: 'quadIn' }).to(0.35, { scale: Vec3.ONE }, { easing: 'quadOut' }).delay(0.25),
        ).start();

        opacity.opacity = 0;
        tween(opacity).to(0.3, { opacity: 255 }).start();
        SignalBus.instance.subscribe(HiveActivatedSignal, this.close);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(HiveActivatedSignal, this.close);
    }

    /** Dim layer sized to the real screen by UIScreenResolution (covers letterbox areas too). */
    private drawDim(lo: Vec3, hi: Vec3): void {
        this.holeLo.set(lo);
        this.holeHi.set(hi);
        const node = uiNode('Dim', this.node);
        node.addComponent(UIScreenResolution);
        this.dim = node.addComponent(Graphics);
        this.redrawDim();
    }

    /** UIScreenResolution may resize the dim layer after creation; redraw when it does. */
    lateUpdate(): void {
        if (this.dim) this.redrawDim();
    }

    private redrawDim(): void {
        const size = this.dim.node.getComponent(UITransform)!;
        const w = size.width, h = size.height;
        const key = `${w}x${h}`;
        if (key === this.dimKey) return;
        this.dimKey = key;
        const lo = this.holeLo, hi = this.holeHi;
        const g = this.dim;
        g.clear();
        g.fillColor = DIM;
        // Four rects around the hole keep the highlighted hives undimmed.
        g.rect(-w / 2, hi.y, w, h / 2 - hi.y);
        g.rect(-w / 2, -h / 2, w, lo.y + h / 2);
        g.rect(-w / 2, lo.y, lo.x + w / 2, hi.y - lo.y);
        g.rect(hi.x, lo.y, w / 2 - hi.x, hi.y - lo.y);
        g.fill();
        g.lineWidth = 6;
        g.fillColor = HIGHLIGHT_FILL;
        g.strokeColor = HIGHLIGHT_STROKE;
        g.roundRect(lo.x, lo.y, hi.x - lo.x, hi.y - lo.y, 28);
        g.fill();
        g.stroke();
    }

    private buildBubble(font: TTFFont | null): Node {
        const bubble = uiNode('Bubble', this.node, BUBBLE_W, BUBBLE_H);
        const g = bubble.addComponent(Graphics);
        g.fillColor = Color.WHITE;
        g.roundRect(-BUBBLE_W / 2, -BUBBLE_H / 2, BUBBLE_W, BUBBLE_H, 30);
        g.moveTo(-22, -BUBBLE_H / 2 + 2);
        g.lineTo(0, -BUBBLE_H / 2 - 26);
        g.lineTo(22, -BUBBLE_H / 2 + 2);
        g.close();
        g.fill();
        const label = uiNode('Text', bubble).addComponent(Label);
        if (font) {
            label.useSystemFont = false;
            label.font = font;
        }
        label.string = TEXT;
        label.fontSize = 44;
        label.lineHeight = 50;
        label.color = BUBBLE_TEXT;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        return bubble;
    }

    private close = (): void => {
        if (this.closing) return;
        this.closing = true;
        tween(this.node.getComponent(UIOpacity)!).to(0.2, { opacity: 0 }).call(() => {
            this.onDone();
            this.node.destroy();
        }).start();
    };
}
