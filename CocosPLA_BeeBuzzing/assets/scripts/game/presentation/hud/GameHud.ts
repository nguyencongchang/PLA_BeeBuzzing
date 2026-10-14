import { _decorator, Camera, Color, Component, Graphics, Label, Node, TTFFont, tween, Tween, UIOpacity, Vec3, Widget } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { HiveBoard } from '../../domain/HiveBoard';
import { GameplayConfig } from '../../application/GameplayConfig';
import { GameTime } from '../../application/GameTime';
import { GameOutcomeSignal, LevelProgressSignal, RotateHintSignal } from '../../application/GameplaySignals';
import { drawRoundRect, uiLabel, uiNode } from './HudWidgets';

const { ccclass } = _decorator;

const BAR_W = 560;
const BAR_H = 38;
const HONEY = new Color(255, 196, 40, 255);
const BAR_BG = new Color(40, 28, 20, 200);

export interface HudDeps {
    readonly camera: Camera;
    readonly worldRoot: Node;
    readonly board: HiveBoard;
    readonly font: TTFFont | null;
    readonly config: GameplayConfig;
    readonly totalCubes: number;
}

/** Top progress bar, X2 SPEED toggle and the "drag to rotate" hint. */
@ccclass('GameHud')
export class GameHud extends Component {
    private fill: Graphics = null!;
    private percent: Label = null!;
    private hint: Node = null!;
    private speedLabel: Label = null!;
    private speedBg: Graphics = null!;
    private shownProgress = 0;
    private targetProgress = 0;

    init(d: HudDeps): void {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this.buildProgressBar(d.font);
        if (d.config.speedButtonEnabled) this.buildSpeedButton(d.font);
        this.buildHint(d.font);

        SignalBus.instance.subscribe(LevelProgressSignal, this.onProgress);
        SignalBus.instance.subscribe(RotateHintSignal, this.onHint);
        SignalBus.instance.subscribe(GameOutcomeSignal, this.onOutcome);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(LevelProgressSignal, this.onProgress);
        SignalBus.instance.unsubscribe(RotateHintSignal, this.onHint);
        SignalBus.instance.unsubscribe(GameOutcomeSignal, this.onOutcome);
    }

    update(dt: number): void {
        if (Math.abs(this.shownProgress - this.targetProgress) < 1e-4) return;
        this.shownProgress += (this.targetProgress - this.shownProgress) * Math.min(1, dt * 10);
        this.redrawFill();
    }

    private buildProgressBar(font: TTFFont | null): void {
        const bar = uiNode('Progress', this.node, BAR_W, BAR_H);
        const w = bar.addComponent(Widget);
        w.isAlignTop = true;
        w.top = 70;
        drawRoundRect(bar.addComponent(Graphics), BAR_W + 10, BAR_H + 10, (BAR_H + 10) / 2, BAR_BG);
        this.fill = uiNode('Fill', bar, BAR_W, BAR_H).addComponent(Graphics);
        this.percent = uiLabel(bar, '0%', 30, font);
        this.redrawFill();
    }

    private redrawFill(): void {
        const g = this.fill;
        g.clear();
        const w = Math.max(BAR_H, BAR_W * this.shownProgress);
        g.roundRect(-BAR_W / 2, -BAR_H / 2, w, BAR_H, BAR_H / 2);
        g.fillColor = HONEY;
        g.fill();
        this.percent.string = `${Math.floor(this.shownProgress * 100)}%`;
    }

    private buildSpeedButton(font: TTFFont | null): void {
        const btn = uiNode('SpeedButton', this.node, 190, 84);
        const w = btn.addComponent(Widget);
        w.isAlignTop = w.isAlignRight = true;
        w.top = 140;
        w.right = 40;
        this.speedBg = btn.addComponent(Graphics);
        this.speedLabel = uiLabel(btn, '', 34, font);
        this.refreshSpeedButton();
        btn.on(Node.EventType.TOUCH_END, () => {
            GameTime.scale = GameTime.scale > 1 ? 1 : 2;
            this.refreshSpeedButton();
            tween(btn).to(0.06, { scale: new Vec3(0.9, 0.9, 1) }).to(0.1, { scale: Vec3.ONE }).start();
        });
    }

    private refreshSpeedButton(): void {
        const fast = GameTime.scale > 1;
        drawRoundRect(this.speedBg, 190, 84, 26, fast ? new Color(255, 120, 30, 255) : new Color(70, 160, 60, 255), Color.WHITE, 5);
        this.speedLabel.string = fast ? 'X2 ON' : 'X2 SPEED';
    }

    private buildHint(font: TTFFont | null): void {
        this.hint = uiNode('RotateHint', this.node, 700, 90);
        this.hint.setPosition(0, 120);
        this.hint.addComponent(UIOpacity).opacity = 0;
        uiLabel(this.hint, 'Drag to rotate!', 56, font);
        this.hint.active = false;
    }

    private onProgress = (s: LevelProgressSignal): void => {
        this.targetProgress = s.total > 0 ? s.removed / s.total : 0;
    };

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
