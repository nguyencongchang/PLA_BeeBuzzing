import { _decorator, Component, Node, director } from 'cc';
import { LoadingView } from './LoadingView';
import { CTAService } from 'db://assets/scripts/services/cta/CTAService';

const { ccclass, property } = _decorator;

/**
 * Game states
 */
export enum GameState {
    LOADING = 'loading',
    FTUE = 'ftue',
    GAMEPLAY = 'gameplay',
    WIN = 'win',
    LOSE = 'lose'
}

@ccclass('GameView')
export class GameView extends Component {
    private static _instance: GameView = null;

    // ========== config Properties ==========
    @property({
        tooltip: "Enable loading screen at start"
    })
    isLoading: boolean = false;

    @property({
        tooltip: "Enable tutorial (FTUE) at start"
    })

    // ========== View References ==========
    @property(Node)
    loadingView: Node = null;

    @property(Node)
    winView: Node = null;

    @property(Node)
    loseView: Node = null;

    @property(Node)
    ctaButton: Node = null;

    // ========== Internal State ==========
    private currentState: GameState = GameState.GAMEPLAY;

    public static get instance(): GameView {
        return this._instance;
    }

    onLoad() {
        // Singleton
        if (GameView._instance && GameView._instance !== this) {
            this.node.destroy();
            return;
        }
        GameView._instance = this;

        // Initialize views
        this.hideAllViews();

        // Initialize cta
        this.initializeCTA();

        // Start game flow
        this.startGameFlow();
    }

    /**
     * Hide all views
     */
    private hideAllViews(): void {
        if (this.loadingView) this.loadingView.active = false;
        if (this.winView) this.winView.active = false;
        if (this.loseView) this.loseView.active = false;
    }

    /**
     * Initialize cta button (enable is controlled by PlayableConfig.cta)
     */
    private initializeCTA(): void {
        if (this.ctaButton) {
            this.ctaButton.on(Node.EventType.TOUCH_END, this.onCTAClicked, this);
        }
    }

    private onCTAClicked(): void {
        console.log('[GameView] cta clicked');
        CTAService.instance?.handleCTAClick();
    }

    /**
     * Start game flow based on config
     */
    private async startGameFlow(): Promise<void> {
        if (this.isLoading) {
            await this.startLoading();
        }

        this.startGameplay();
    }

    /**
     * Start loading phase
     */
    private async startLoading(): Promise<void> {
        return new Promise((resolve) => {
            this.currentState = GameState.LOADING;

            if (!this.loadingView) {
                console.warn('[GameView] LoadingView not assigned, skipping');
                resolve();
                return;
            }

            this.loadingView.active = true;
            const loadingComponent = this.loadingView.getComponent(LoadingView) as LoadingView;

            if (loadingComponent) {
                loadingComponent.startLoading(() => {
                    resolve();
                });
            } else {
                console.warn('[GameView] LoadingView component not found');
                this.loadingView.active = false;
                resolve();
            }
        });
    }

    /**
     * Start gameplay phase
     */
    private startGameplay(): void {
        this.currentState = GameState.GAMEPLAY;
    }

    /**
     * Called when tutorial completes (for manual control)
     */
    public onTutorialComplete(): void {
        console.log('[GameView] Tutorial complete callback');
        if (this.currentState === GameState.FTUE) {
            this.startGameplay();
        }
    }

    // ========== Win/Lose Management ==========

    public onWin(): void {
        console.log('[GameView] WIN!');
        this.currentState = GameState.WIN;
        if (this.winView) {
            this.winView.active = true;
        } else {
            console.error('[GameView] WinView not assigned!');
        }
    }

    public onLose(): void {
        console.log('[GameView] LOSE!');
        this.currentState = GameState.LOSE;
        if (this.loseView) {
            this.loseView.active = true;
        } else {
            console.error('[GameView] LoseView not assigned!');
        }
    }

    // ========== Getters ==========

    public getCurrentState(): GameState {
        return this.currentState;
    }

    public isInGameplay(): boolean {
        return this.currentState === GameState.GAMEPLAY;
    }

    // ========== Cleanup ==========

    onDestroy() {
        if (this.ctaButton) {
            this.ctaButton.off(Node.EventType.TOUCH_END, this.onCTAClicked, this);
        }

        if (GameView._instance === this) {
            GameView._instance = null;
        }
    }
}