import {_decorator, Component, Sprite, Label, tween, Vec3, UIOpacity, Color, Node} from 'cc';
import {SignalBus} from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import {AllAsyncParametersReadySignal} from 'db://assets/scripts/parameter/ParameterController';

const {ccclass, property} = _decorator;

/**
 * LoadingView - Loading UI với progress bar
 * Tự ẩn khi loading xong
 */
@ccclass('LoadingView')
export class LoadingView extends Component {
    @property(Sprite)
    FillBar: Sprite | null = null;

    @property(Label)
    progressText: Label | null = null;

    @property(Sprite)
    backgroundSprite: Sprite | null = null;

    @property(Sprite)
    iconSprite: Sprite | null = null;

    @property(Label)
    gameNameLabel: Label | null = null;

    @property({tooltip: 'Loading duration (seconds)'})
    loadingDuration: number = 2;

    @property({type: Node, tooltip: 'Black overlay to hide asset flicker until parameters are ready'})
    blackOverlay: Node | null = null;

    private _progress: number = 0;
    private _onComplete?: () => void;

    onLoad(): void {
        // Subscribe early to not miss the signal
        if (this.blackOverlay) {
            SignalBus.instance.subscribe(AllAsyncParametersReadySignal, this.onParametersReady);
        }
    }

    /**
     * Start loading
     */
    startLoading(onComplete?: () => void): void {
        this._onComplete = onComplete;
        this._progress = 0;
        this.updateProgress(0);

        // Show overlay, will hide when params ready
        if (this.blackOverlay) {
            this.blackOverlay.active = true;
        }

        // Show
        this.node.active = true;

        // Animate progress
        this.animateProgress();
    }

    /**
     * Called when all async parameters are ready - hide the black overlay
     */
    private onParametersReady = (): void => {
        this.hideBlackOverlay();
    }

    /**
     * Hide black overlay with fade animation
     */
    private hideBlackOverlay(): void {
        if (!this.blackOverlay || !this.blackOverlay.active) return;
        this.blackOverlay.active = false;
    }

    /**
     * Animate progress to 100%
     */
    private animateProgress(): void {
        if (!this.FillBar) {
            this.onLoadingComplete();
            return;
        }
        if (this.FillBar.type !== Sprite.Type.FILLED) {
            this.FillBar.type = Sprite.Type.FILLED;
        }
        this.FillBar.fillRange = 0;
        tween(this.FillBar)
            .to(this.loadingDuration, {fillRange: 1}, {
                onUpdate: () => {
                    if (this.progressText) {
                        this.progressText.string = `${Math.floor(this.FillBar.fillRange * 100)}%`;
                    }
                }
            })
            .call(() => {
                if (this.progressText) {
                    this.progressText.string = '100%';
                }
                this.onLoadingComplete();
            })
            .start();
    }

    /**
     * Update progress UI
     */
    private updateProgress(progress: number): void {
        if (this.FillBar) {
            if (this.FillBar.type !== Sprite.Type.FILLED) {
                this.FillBar.type = Sprite.Type.FILLED;
            }
            this.FillBar.fillRange = progress;
        }

        if (this.progressText) {
            this.progressText.string = `${Math.floor(progress * 100)}%`;
        }
    }

    /**
     * Loading complete
     */
    private onLoadingComplete(): void {
        // Get or add UIOpacity component for fade effect
        let uiOpacity = this.node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = this.node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 255;

        // Fade out animation
        tween(uiOpacity)
            .to(0.5, {opacity: 0}, {easing: 'sineOut'})
            .call(() => {
                this.node.active = false;
                uiOpacity.opacity = 255; // Reset opacity for next time

                // Callback
                if (this._onComplete) {
                    this._onComplete();
                }
            })
            .start();
    }

    /**
     * Set background color
     */
    setBackgroundColor(hexColor: string): void {
        if (!this.backgroundSprite) return;
        const color = new Color();
        Color.fromHEX(color, hexColor);
        this.backgroundSprite.color = color;
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(AllAsyncParametersReadySignal, this.onParametersReady);
    }
}