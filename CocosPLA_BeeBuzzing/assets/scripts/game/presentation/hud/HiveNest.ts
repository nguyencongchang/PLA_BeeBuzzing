import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Widget } from 'cc';
import { uiNode } from './HudWidgets';

const { ccclass } = _decorator;

// Jelly spring driven by bee arrivals (stiffness / damping per second², per second).
const SQUASH_STIFFNESS = 260;
const SQUASH_DAMPING = 11;
/** Velocity kick per arriving bee, and the cap so a swarm keeps it lively but bounded. */
const ARRIVAL_KICK = 0.55;
const MAX_SQUASH_VELOCITY = 1.0;
/** Scale change per unit of spring displacement: one arrival ≈ 3%, a swarm caps near 8%. */
const SQUASH_SCALE = 0.8;
/** Vertical squash relative to the horizontal bulge (volume-ish preserving). */
const SQUASH_Y_RATIO = 0.8;
/** Side-to-side wobble: smooth sway whose amplitude follows the squash energy. */
const WOBBLE_DEG = 40;
const MAX_WOBBLE_DEG = 4;
const WOBBLE_FREQ = 9;

/**
 * The hanging hive as two layers, as in the reference: the back layer (full hive with the
 * dark entrance) lives on the BG canvas behind the 3D bees, this front layer (entrance cut
 * out) on the UI canvas in front of them — bees seen through the hole vanish inside.
 * Every arriving bee kicks a damped spring: the hive bulges, squashes and wobbles.
 */
@ccclass('HiveNest')
export class HiveNest extends Component {
    private back: Node = null!;
    private front: Node = null!;
    private squash = 0;
    private velocity = 0;
    private time = 0;

    /** `back` is the BG-canvas hive sprite; the front copy mirrors its size, anchor and widget. */
    init(back: Node, frontFrame: SpriteFrame): void {
        this.back = back;
        this.node.addComponent(UITransform);
        const stretch = this.node.addComponent(Widget);
        stretch.isAlignTop = stretch.isAlignBottom = stretch.isAlignLeft = stretch.isAlignRight = true;
        stretch.top = stretch.bottom = stretch.left = stretch.right = 0;

        const backSize = back.getComponent(UITransform)!;
        this.front = uiNode('HiveFront', this.node, backSize.width, backSize.height);
        this.front.getComponent(UITransform)!.setAnchorPoint(backSize.anchorPoint);
        const sprite = this.front.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frontFrame;
        const backWidget = back.getComponent(Widget)!;
        const w = this.front.addComponent(Widget);
        w.isAlignTop = w.isAlignHorizontalCenter = true;
        w.top = backWidget.top;
        w.horizontalCenter = backWidget.horizontalCenter;
    }

    /** A bee carried its cube into the hive. */
    onBeeArrived(): void {
        this.velocity = Math.min(MAX_SQUASH_VELOCITY, this.velocity + ARRIVAL_KICK);
    }

    update(dt: number): void {
        if (!this.back) return;
        this.time += dt;
        const step = Math.min(dt, 1 / 30); // keep the spring stable on frame hitches
        const accel = -SQUASH_STIFFNESS * this.squash - SQUASH_DAMPING * this.velocity;
        this.velocity += accel * step;
        this.squash += this.velocity * step;
        if (Math.abs(this.squash) < 1e-4 && Math.abs(this.velocity) < 1e-3) {
            this.squash = this.velocity = 0;
        }
        const sx = 1 + this.squash * SQUASH_SCALE;
        const sy = 1 - this.squash * SQUASH_SCALE * SQUASH_Y_RATIO;
        const sway = Math.min(MAX_WOBBLE_DEG, Math.abs(this.squash) * WOBBLE_DEG);
        const angle = Math.sin(this.time * WOBBLE_FREQ) * sway;
        for (const node of [this.back, this.front]) {
            node.setScale(sx, sy, 1);
            node.setRotationFromEuler(0, 0, angle);
        }
    }
}
