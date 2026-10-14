import {_decorator, Component, Camera, Label, Sprite, Node} from 'cc';
import {PlayableConfig} from "db://assets/scripts/parameter/config/PlayableConfig";
import {AudioContainer} from "db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioContainer";
import {getAudioClipFromBase64} from "db://assets/PlayableParamterTool/utils/getAudioClipFromBase64";
import {AudioService} from "db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService";
import {SignalBus} from "db://assets/PLAGameFoundation/signalBus";
import {ParametersReadySignal} from "db://assets/PlayableParamterTool/PlayableParameterUpdates";
import {applySpriteParams, applyLabelParams, applyCameraParams, applyButtonParams} from "./ParameterUtils";
import {WinView} from "db://assets/scripts/UI/WinView";
import {LoseView} from "db://assets/scripts/UI/LoseView";
import {
    replaceParameterAudioFromResources
} from "db://assets/PlayableParamterTool/assetParameterUtils/ParameterReplacedAssetsHandler";
import {LoadingView} from "db://assets/scripts/UI/LoadingView";

const {ccclass, property} = _decorator;

/**
 * Signal emitted when all async parameters (audio, sprite from base64) have been loaded
 */
export class AllAsyncParametersReadySignal {
    constructor() {}
}

/**
 * ParameterController - Main controller for playable parameters
 * Extends BaseParameterManager to handle SDK integration and parameter registration
 */
@ccclass('ParameterController')
export class ParameterController extends Component {
    private static _instance: ParameterController = null;

    public static get instance(): ParameterController {
        return this._instance;
    }

    @property(Camera)
    public mainCamera: Camera = null;

    @property(Node)
    public ctaButton: Node = null;

    @property(Label)
    public tutLabel: Label = null;

    @property(Sprite)
    public handTutSprite: Sprite = null;

    @property(Sprite)
    public logoSprite: Sprite = null;

    @property(LoadingView)
    public loadingView: LoadingView = null;

    @property(WinView)
    public winView: WinView = null;

    @property(LoseView)
    public loseView: LoseView = null;

    // Track pending async promises
    private _audioUpdatePromises: Promise<void>[] = [];
    private _spriteUpdatePromises: Promise<void>[] = [];

    onLoad() {
        ParameterController._instance = this;

        // Subscribe to ParametersReadySignal, then wait for async updates
        SignalBus.instance.subscribe(ParametersReadySignal, this.onParametersReady);
    }

    onDestroy() {
        SignalBus.instance.unsubscribe(ParametersReadySignal, this.onParametersReady);
    }

    /**
     * Called when sync parameters are ready
     * Waits for async parameters then fires AllAsyncParametersReadySignal
     */
    private onParametersReady = async (): Promise<void> => {
        await this.waitForAsyncUpdates();
    }

    /**
     * Setup parameter update callbacks
     * Called by ParameterRegister.registerParameters()
     */
    public SetUpOnUpdate(): void {
        PlayableConfig.MainCamera.onUpdate = (data: typeof PlayableConfig.MainCamera) => {
            applyCameraParams(this.mainCamera, data.parameters);
        }

        PlayableConfig.RedirectAfterClicks.onUpdate = (data: typeof PlayableConfig.RedirectAfterClicks) => {
        }

        PlayableConfig.MusicVolume.onUpdate = (data: typeof PlayableConfig.MusicVolume) => {
            AudioService.instance.setMusicVolume(data.default);
        }

        PlayableConfig.SxfVolume.onUpdate = (data: typeof PlayableConfig.SxfVolume) => {
            AudioService.instance.setSfxVolume(data.default);
        }

        // Audio parameters - Update AudioContainer when audio params change
        this.setupAudioParamUpdates();

        // UI Node parameters
        this.setupUINodeParamUpdates();
    }

    /**
     * Setup UI Node parameter update callbacks
     */
    private setupUINodeParamUpdates(): void {
        // Logo - SpriteParameter
        PlayableConfig.Logo.onUpdate = (data: typeof PlayableConfig.Logo) => {
            const promise = applySpriteParams(this.logoSprite, data.parameters);
            if (promise) {
                this._spriteUpdatePromises.push(promise);
            }
        };

        // cta - ButtonParameter
        PlayableConfig.CTA.onUpdate = (data: typeof PlayableConfig.CTA) => {
            applyButtonParams(this.ctaButton, data.parameters);
        };

        // Tut - LabelParameter
        PlayableConfig.Tut.onUpdate = (data: typeof PlayableConfig.Tut) => {
            applyLabelParams(this.tutLabel, data.parameters);
        };

        // HandTut - SpriteParameter
        PlayableConfig.HandTut.onUpdate = (data: typeof PlayableConfig.HandTut) => {
            const promise = applySpriteParams(this.handTutSprite, data.parameters);
            if (promise) {
                this._spriteUpdatePromises.push(promise);
            }
        };

        // Loading background color
        PlayableConfig.LoadingBackgroundColor.onUpdate = (data) => {
            this.loadingView?.setBackgroundColor(data.default);
        };

        // Loading game name (LabelParameter)
        PlayableConfig.LoadingGameName.onUpdate = (data: typeof PlayableConfig.LoadingGameName) => {
            if (this.loadingView?.gameNameLabel) {
                applyLabelParams(this.loadingView.gameNameLabel, data.parameters);
            }
        };

        // Loading icon (SpriteParameter)
        PlayableConfig.LoadingIcon.onUpdate = (data: typeof PlayableConfig.LoadingIcon) => {
            if (this.loadingView?.iconSprite) {
                const promise = applySpriteParams(this.loadingView.iconSprite, data.parameters);
                if (promise) {
                    this._spriteUpdatePromises.push(promise);
                }
            }
        };

        // EndCard Win CTA - ButtonParameter
        PlayableConfig.EndCardWinCTA.onUpdate = (data: typeof PlayableConfig.EndCardWinCTA) => {
            applyButtonParams(this.winView?.actionButton, data.parameters);
        };

        // EndCard Lose CTA - ButtonParameter
        PlayableConfig.EndCardLoseCTA.onUpdate = (data: typeof PlayableConfig.EndCardLoseCTA) => {
            applyButtonParams(this.loseView?.actionButton, data.parameters);
        };
    }

    /**
     * Setup audio parameter update callbacks
     * Automatically updates AudioContainer when audio params change
     * Auto-detects all audio params from PlayableConfig with category "Audio"
     */
    private setupAudioParamUpdates(): void {
        let audioParamCount = 0;

        // Auto-detect all audio params from PlayableConfig
        Object.entries(PlayableConfig).forEach(([key, param]) => {
            // Check if this is an audio parameter (category === "Audio")
            if (param.category === 'Audio') {
                // Extract audio name from key
                const audioName = key;
                // Setup onUpdate callback
                param.onUpdate = (updatedParam) => {
                    // Use replaceParameterAudioFromResources to handle removal marking and decoding
                    const promise = replaceParameterAudioFromResources(audioName, updatedParam)
                        .then(audioClip => {
                            if (audioClip && AudioContainer.instance) {
                                AudioContainer.instance.registerAudioClip(audioName, audioClip);
                            }
                        })
                        .catch(error => {
                            console.error(`[ParameterController] Failed to load ${audioName}:`, error);
                        });

                    this._audioUpdatePromises.push(promise);
                };

                audioParamCount++;
            }
        });
    }

    /**
     * Wait for all async parameter updates to complete and fire signals
     */
    private async waitForAsyncUpdates(): Promise<void> {
        const audioPromises = [...this._audioUpdatePromises];
        const spritePromises = [...this._spriteUpdatePromises];

        // Clear the arrays for future updates
        this._audioUpdatePromises = [];
        this._spriteUpdatePromises = [];

        // Wait for audio and sprite updates in parallel
        const [audioResults, spriteResults] = await Promise.all([
            Promise.all(audioPromises),
            Promise.all(spritePromises)
        ]);

        // Fire signal after all async params loaded
        SignalBus.instance.fire(new AllAsyncParametersReadySignal());
    }
}