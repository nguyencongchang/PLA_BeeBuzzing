import { _decorator, Color, Component, Graphics, Label, Node, TTFFont, tween, Tween, UIOpacity, Vec3, Widget } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { GameplayConfig } from '../../application/GameplayConfig';
import { GameTime } from '../../application/GameTime';
import { GameOutcomeSignal, RotateHintSignal } from '../../application/GameplaySignals';
import { drawRoundRect, uiLabel, uiNode } from './HudWidgets';

const { ccclass } = _decorator;

/** Top HUD row (as in the reference): "Level N" pill left, "▶▶ 2x" pill right. */
const ROW_TOP = 205;
const SIDE_MARGIN = 32;
const PILL_H = 64;
const LEVEL_W = 200;
const SPEED_W = 170;
const LEVEL_BG = new Color(40, 70, 110, 150);
const SPEED_OFF = new Color(46, 196, 64, 255);
const SPEED_ON = new Color(255, 140, 30, 255);

export interface HudDeps {
    readonly font: TTFFont | null;
    readonly config: GameplayConfig;
    readonly levelNumber: number;
}

function pinTopCorner(node: Node, left: boolean): void {
    const w = node.addComponent(Widget);
    w.isAlignTop = true;
    w.top = ROW_TOP;
    if (left) {
        w.isAlignLeft = true;
        w.left = SIDE_MARGIN;
    } else {
        w.isAlignRight = true;
        w.right = SIDE_MARGIN;
    }
}

/** Level pill, X2 SPEED toggle and the "drag to rotate" hint. */
@ccclass('GameHud')
export class GameHud extends Component {
    private hint: Node = null!;
    private speedBg: Graphics = null!;
    private speedLabel: Label = null!;

    init(d: HudDeps): void {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        const level = uiNode('LevelPill', this.node, LEVEL_W, PILL_H);
        pinTopCorner(level, true);
        drawRoundRect(level.addComponent(Graphics), LEVEL_W, PILL_H, PILL_H / 2, LEVEL_BG);
        uiLabel(level, `Level ${d.levelNumber}`, 34, d.font);

        if (d.config.speedButtonEnabled) this.buildSpeedButton(d.font);
        this.buildHint(d.font);

        SignalBus.instance.subscribe(RotateHintSignal, this.onHint);
        SignalBus.instance.subscribe(GameOutcomeSignal, this.onOutcome);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(RotateHintSignal, this.onHint);
        SignalBus.instance.unsubscribe(GameOutcomeSignal, this.onOutcome);
    }

    private buildSpeedButton(font: TTFFont | null): void {
        const btn = uiNode('SpeedButton', this.node, SPEED_W, PILL_H);
        pinTopCorner(btn, false);
        this.speedBg = btn.addComponent(Graphics);
        this.speedLabel = uiLabel(btn, '', 34, font);
        this.speedLabel.node.setPosition(22, 0);
        this.refreshSpeedButton();
        btn.on(Node.EventType.TOUCH_END, () => {
            GameTime.scale = GameTime.scale > 1 ? 1 : 2;
            this.refreshSpeedButton();
            tween(btn).to(0.06, { scale: new Vec3(0.9, 0.9, 1) }).to(0.1, { scale: Vec3.ONE }).start();
        });
    }

    /** Pill + two "fast-forward" triangles drawn as vectors (the font has no ▶ glyph). */
    private refreshSpeedButton(): void {
        const fast = GameTime.scale > 1;
        const g = this.speedBg;
        drawRoundRect(g, SPEED_W, PILL_H, PILL_H / 2, fast ? SPEED_ON : SPEED_OFF, Color.WHITE, 4);
        g.fillColor = Color.WHITE;
        for (const x of [-58, -36]) {
            g.moveTo(x, 13);
            g.lineTo(x + 20, 0);
            g.lineTo(x, -13);
            g.close();
        }
        g.fill();
        this.speedLabel.string = fast ? '1x' : '2x';
    }

    private buildHint(font: TTFFont | null): void {
        this.hint = uiNode('RotateHint', this.node, 700, 90);
        this.hint.setPosition(0, 120);
        this.hint.addComponent(UIOpacity).opacity = 0;
        uiLabel(this.hint, 'Drag to rotate!', 56, font);
        this.hint.active = false;
    }

    private onHint = (s: RotateHintSignal): void => {
        const opacity = this.hint.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(opacity);
        Tween.stopAllByTarget(this.hint);
        if (s.visible) {
            this.hint.active = true;
            this.hint.setScale(Vec3.ONE);
            tween(opacity).to(0.25, { opacity: 255 }).start();
            tween(this.hint).repeatForever(tween().to(0.5, { scale: new Vec3(1.08, 1.08, 1) }).to(0.5, { scale: Vec3.ONE })).start();
        } else {
            tween(opacity).to(0.2, { opacity: 0 }).call(() => { this.hint.active = false; }).start();
        }
    };

    private onOutcome = (): void => {
        this.node.active = false;
    };
}
