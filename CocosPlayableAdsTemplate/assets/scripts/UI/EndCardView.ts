import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { AudioService } from "db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService";
import { CTAService } from "db://assets/scripts/services/cta/CTAService";

const { ccclass, property } = _decorator;

/**
 * EndCardView - Base class for Win/Lose end card screens
 * Provides common animation and cta functionality
 */
@ccclass('EndCardView')
export abstract class EndCardView extends Component {

    @property(Node)
    panel: Node = null;

    @property(Node)
    coin: Node = null;

    @property(Node)
    actionButton: Node = null;

    @property({
        tooltip: "Animation duration in seconds"
    })
    animDuration: number = 0.5;

    @property({
        tooltip: "Delay between each element animation"
    })
    animDelay: number = 0.15;

    @property({
        tooltip: "Button pulsing scale multiplier"
    })
    pulseScale: number = 1.1;

    @property({
        tooltip: "Button pulse duration in seconds"
    })
    pulseDuration: number = 0.8;

    // ==================== cta config ====================
    @property({
        tooltip: "Enable full screen cta - tap anywhere on end card to trigger cta"
    })
    fullScreenCTA: boolean = false;

    /**
     * Get the sound name to play when this end card appears
     * Override in subclass to provide specific sound
     */
    protected abstract getSoundName(): string;

    /**
     * Get additional elements to animate (besides panel, coin, actionButton)
     * Override in subclass if needed
     */
    protected getAdditionalElements(): Node[] {
        return [];
    }

    /**
     * Called after entrance animation completes
     * Override in subclass for additional behavior
     */
    protected onEntranceComplete(): void {
        // Default: do nothing, subclass can override
    }

    onEnable() {
        // Play sound when end card appears
        const soundName = this.getSoundName();
        if (soundName) {
            AudioService.instance.playSfx(soundName);
        }

        // Play entrance animation
        this.playEntranceAnimation();

        // Setup cta
        this.setupCTA();
    }

    private setupCTA(): void {
        // Setup action button click
        if (this.actionButton) {
            this.actionButton.on(Node.EventType.TOUCH_END, this.onActionButtonClicked, this);
        }

        // Setup full screen cta if enabled
        if (this.fullScreenCTA) {
            this.node.on(Node.EventType.TOUCH_END, this.onFullScreenClicked, this);
        }
    }

    private onFullScreenClicked(): void {
        console.log(`[${this.constructor.name}] Full screen CTA clicked`);
        CTAService.instance.handleCTAClick();
    }

    protected playEntranceAnimation(): void {
        const baseElements = [this.panel, this.coin, this.actionButton];
        const additionalElements = this.getAdditionalElements();
        const elements = [...baseElements, ...additionalElements];

        elements.forEach((element, index) => {
            if (!element) return;

            // Store original scale
            const originalScale = element.scale.clone();

            // Set initial scale to 0
            element.setScale(Vec3.ZERO);

            // Animate with delay based on index
            tween(element)
                .delay(index * this.animDelay)
                .to(this.animDuration, { scale: originalScale }, {
                    easing: 'backOut'
                })
                .call(() => {
                    // Start pulsing animation for button after entrance animation completes
                    if (element === this.actionButton) {
                        this.startButtonPulse();
                        this.onEntranceComplete();
                    }
                })
                .start();
        });
    }

    protected startButtonPulse(): void {
        if (!this.actionButton) return;

        const originalScale = this.actionButton.scale.clone();
        const pulseScaleVec = originalScale.clone().multiplyScalar(this.pulseScale);

        // Pulsing loop: scale up -> scale down -> repeat
        tween(this.actionButton)
            .to(this.pulseDuration / 2, { scale: pulseScaleVec }, { easing: 'sineInOut' })
            .to(this.pulseDuration / 2, { scale: originalScale }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    protected onActionButtonClicked(): void {
        console.log(`[${this.constructor.name}] Action button clicked`);
        CTAService.instance.handleCTAClick();
    }

    onDestroy() {
        if (this.actionButton && this.actionButton.isValid) {
            this.actionButton.off(Node.EventType.TOUCH_END, this.onActionButtonClicked, this);
            tween(this.actionButton).stop();
        }
        if (this.panel && this.panel.isValid) {
            tween(this.panel).stop();
        }
        // Clean up full screen cta listener
        if (this.fullScreenCTA) {
            this.node.off(Node.EventType.TOUCH_END, this.onFullScreenClicked, this);
        }
    }
}