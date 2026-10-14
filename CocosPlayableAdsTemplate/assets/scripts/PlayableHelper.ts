import {_decorator, Component} from 'cc';
import {SignalBus} from '../PLAGameFoundation/signalBus/SignalBus';
import {FirstInteractionSignal, TapSignal, SwipeSignal, DragSignal} from '../PLAGameFoundation/inputService/InputSignals';
import {AudioService} from '../PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService';
import {Constant} from "db://assets/scripts/constant/constant";
import {CTAService} from "db://assets/scripts/services/cta/CTAService";
import {PlayableConfig} from "db://assets/scripts/parameter/config/PlayableConfig";
import {ParametersReadySignal} from "db://assets/PlayableParamterTool/PlayableParameterUpdates";

const {ccclass, property} = _decorator;

/**
 * PlayableHelper Template cho Playable Ads
 * - Xử lý FirstTouch để play music
 * - Subscribe các input signals
 * - Xử lý RedirectAfterClicks
 */
@ccclass('PlayableHelper')
export class PlayableHelper extends Component {

    @property
    autoPlayMusicOnFirstTouch: boolean = true;

    private signalBus: SignalBus = SignalBus.instance;
    private clickCount: number = 0;
    private hasRedirected: boolean = false;

    onLoad() {
        this.signalBus.subscribe(FirstInteractionSignal, () => this.onFirstTouch());
        this.signalBus.subscribe(ParametersReadySignal, () => this.initRedirectAfterClicks());
    }

    private initRedirectAfterClicks(): void {
        const redirectConfig = PlayableConfig.RedirectAfterClicks.parameters;
        if (redirectConfig.active.default) {
            this.signalBus.subscribe(TapSignal, this.onTap.bind(this));
        }
    }

    private onTap(signal: TapSignal): void {
        if (this.hasRedirected) return;

        this.clickCount++;
        const redirectConfig = PlayableConfig.RedirectAfterClicks.parameters;

        if (this.clickCount >= redirectConfig.count.default) {
            this.hasRedirected = true;
            CTAService.instance.handleCTAClick();
        }
    }

    protected onFirstTouch() {
        if (this.autoPlayMusicOnFirstTouch) {
            AudioService.instance.playMusic(Constant.AUDIO_NAME.BGM);
        }
    }
}