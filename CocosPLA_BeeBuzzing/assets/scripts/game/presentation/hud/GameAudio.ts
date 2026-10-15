import { _decorator, AudioClip, Component } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { AudioService } from 'db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService';
import { AudioContainer } from 'db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioContainer';
import { Constant } from 'db://assets/scripts/constant/constant';
import {
    BeeLaunchedSignal, CubePluckedSignal, HiveActivatedSignal, HiveTapRejectedSignal,
} from '../../application/GameplaySignals';
import { loadResource } from '../../infrastructure/ResourceLoader';

const { ccclass } = _decorator;

/** Bees launch ~6/s per hive; one buzz per this interval keeps the mix readable. */
const SHOOT_SFX_INTERVAL = 0.12;
/** Cubes are plucked as fast as bees arrive; one pluck per this interval. */
const PLUCK_SFX_INTERVAL = 0.09;
/** Gameplay clips not listed in the scene's AudioContainer, loaded from resources/audio. */
const RUNTIME_CLIPS = [Constant.AUDIO_NAME.REJECT, Constant.AUDIO_NAME.PLUCK];

/** Gameplay sound effects driven by gameplay signals (win/lose audio lives in the end cards). */
@ccclass('GameAudio')
export class GameAudio extends Component {
    private shootCooldown = 0;
    private pluckCooldown = 0;

    onLoad(): void {
        SignalBus.instance.subscribe(HiveActivatedSignal, this.onHiveActivated);
        SignalBus.instance.subscribe(HiveTapRejectedSignal, this.onHiveRejected);
        SignalBus.instance.subscribe(BeeLaunchedSignal, this.onBeeLaunched);
        SignalBus.instance.subscribe(CubePluckedSignal, this.onCubePlucked);
        for (const name of RUNTIME_CLIPS) this.registerClip(name);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(HiveActivatedSignal, this.onHiveActivated);
        SignalBus.instance.unsubscribe(HiveTapRejectedSignal, this.onHiveRejected);
        SignalBus.instance.unsubscribe(BeeLaunchedSignal, this.onBeeLaunched);
        SignalBus.instance.unsubscribe(CubePluckedSignal, this.onCubePlucked);
    }

    update(dt: number): void {
        this.shootCooldown -= dt;
        this.pluckCooldown -= dt;
    }

    /** Cosmetic: a missing clip is logged and that sound is skipped. */
    private registerClip(name: string): void {
        loadResource(`audio/${name}`, AudioClip)
            .then((clip) => AudioContainer.instance?.registerAudioClip(name, clip))
            .catch((e) => console.warn(`[GameAudio] '${name}' sound unavailable`, e));
    }

    private onHiveActivated = (): void => {
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.INPUT);
    };

    private onHiveRejected = (): void => {
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.REJECT);
    };

    private onBeeLaunched = (): void => {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = SHOOT_SFX_INTERVAL;
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.SHOOT);
    };

    private onCubePlucked = (): void => {
        if (this.pluckCooldown > 0) return;
        this.pluckCooldown = PLUCK_SFX_INTERVAL;
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.PLUCK);
    };
}
