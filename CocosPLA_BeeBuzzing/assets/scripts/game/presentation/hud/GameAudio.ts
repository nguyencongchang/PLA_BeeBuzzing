import { _decorator, Component } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { AudioService } from 'db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService';
import { Constant } from 'db://assets/scripts/constant/constant';
import { BeeLaunchedSignal, HiveActivatedSignal, HiveTapRejectedSignal } from '../../application/GameplaySignals';

const { ccclass } = _decorator;

/** Bees launch ~100/s; one buzz per this interval keeps the mix readable. */
const SHOOT_SFX_INTERVAL = 0.12;

/** Gameplay sound effects driven by gameplay signals (win/lose audio lives in the end cards). */
@ccclass('GameAudio')
export class GameAudio extends Component {
    private shootCooldown = 0;

    onLoad(): void {
        SignalBus.instance.subscribe(HiveActivatedSignal, this.onHiveActivated);
        SignalBus.instance.subscribe(HiveTapRejectedSignal, this.onHiveActivated);
        SignalBus.instance.subscribe(BeeLaunchedSignal, this.onBeeLaunched);
    }

    onDestroy(): void {
        SignalBus.instance.unsubscribe(HiveActivatedSignal, this.onHiveActivated);
        SignalBus.instance.unsubscribe(HiveTapRejectedSignal, this.onHiveActivated);
        SignalBus.instance.unsubscribe(BeeLaunchedSignal, this.onBeeLaunched);
    }

    update(dt: number): void {
        this.shootCooldown -= dt;
    }

    private onHiveActivated = (): void => {
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.INPUT);
    };

    private onBeeLaunched = (): void => {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = SHOOT_SFX_INTERVAL;
        AudioService.instance?.playSfx(Constant.AUDIO_NAME.SHOOT);
    };
}
