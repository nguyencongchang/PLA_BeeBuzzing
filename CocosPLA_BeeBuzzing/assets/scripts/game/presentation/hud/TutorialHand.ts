import { _decorator, Camera, Component, Node, Sprite, SpriteFrame, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { HiveBoard } from '../../domain/HiveBoard';
import { GameOutcomeSignal, HiveActivatedSignal } from '../../application/GameplaySignals';
import { BOARD_LAYOUT, queuePosition } from '../hive/BoardLayout';
import { uiNode } from './HudWidgets';

const { ccclass } = _decorator;

const HAND_SIZE = 170;
/** Re-show the tap hint after this long without a hive tap. */
const IDLE_HINT_DELAY = 4;
/** Fingertip sits at the top-left of the hand image. */
const FINGERTIP_OFFSET = new Vec3(55, -70, 0);

/** Pulsing hand pointing at a tappable hive: on start and whenever the player idles. */
@ccclass('TutorialHand')
export class TutorialHand extends Component {
    private camera: Camera = null!;
    private worldRoot: Node = null!;
    private board: HiveBoard = null!;
    private hand: Node = null!;
    private idle = 0;
    private finished = false;
    private readonly tmp = new Vec3();
    private readonly ui = new Vec3();

    init(camera: Camera, worldRoot: Node, board: HiveBoard, frame: SpriteFrame): void {
        this.camera = camera;
        this.worldRoot = worldRoot;
        this.board = board;
        this.hand = uiNode('Hand', this.node, HAND_SIZE, HAND_SIZE);
        const sprite = this.hand.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        this.hand.addComponent(UIOpacity);
        this.idle = IDLE_HINT_DELAY; // show right away
        SignalBus.instance.subscribe(HiveActivatedSignal, this.onTap);
        SignalBus.instance.subscribe(GameOutcomeSignal, this.onFinish);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(HiveActivatedSignal, this.onTap);
        SignalBus.instance.unsubscribe(GameOutcomeSignal, this.onFinish);
    }

    update(dt: number): void {
        if (this.finished) return;
        this.idle += dt;
        const line = this.pickLine();
        const shouldShow = this.idle >= IDLE_HINT_DELAY && line !== -1;
        if (shouldShow !== this.hand.active) this.setVisible(shouldShow);
        if (!shouldShow) return;

        queuePosition(line, this.board.lineCount, 0, this.tmp);
        this.tmp.y += BOARD_LAYOUT.lineStep * 0.1;
        Vec3.transformMat4(this.tmp, this.tmp, this.worldRoot.worldMatrix);
        this.camera.convertToUINode(this.tmp, this.node, this.ui);
        Vec3.add(this.ui, this.ui, FINGERTIP_OFFSET);
        this.hand.setPosition(this.ui);
    }

    /** Front-most line with a hive while a slot is free; -1 when tapping makes no sense. */
    private pickLine(): number {
        if (this.board.freeSlotCount === 0) return -1;
        const middle = Math.floor(this.board.lineCount / 2);
        for (let k = 0; k < this.board.lineCount; k++) {
            const line = (middle + k) % this.board.lineCount;
            if (this.board.line(line).length > 0) return line;
        }
        return -1;
    }

    private setVisible(visible: boolean): void {
        Tween.stopAllByTarget(this.hand);
        this.hand.active = visible;
        if (!visible) return;
        this.hand.setScale(1, 1, 1);
        tween(this.hand).repeatForever(
            tween().to(0.35, { scale: new Vec3(0.82, 0.82, 1) }, { easing: 'quadIn' }).to(0.35, { scale: Vec3.ONE }, { easing: 'quadOut' }).delay(0.25),
        ).start();
    }

    private onTap = (): void => {
        this.idle = 0;
        if (this.hand.active) this.setVisible(false);
    };

    private onFinish = (): void => {
        this.finished = true;
        this.setVisible(false);
    };
}
