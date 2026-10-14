import { _decorator } from 'cc';
import {BaseTimerComponent} from "db://assets/PLAGameFoundation/ui/components/BaseTimerComponent";
const { ccclass } = _decorator;


/**
 * TimerComponent - Countdown timer with singleton access
 *
 * Usage:
 * - Drag prefab into scene, auto works
 * - Access via: TimerComponent.instance.startTimer()
 * - Listen: SignalBus.instance.subscribe(TimerEndSignal, (signal) => {})
 */
@ccclass('TimerComponent')
export class TimerComponent extends BaseTimerComponent {

    private static _instance: TimerComponent = null;
    public static get instance(): TimerComponent { return this._instance; }

    onLoad() {
        TimerComponent._instance = this;
        super.onLoad();
    }

    onDestroy() {
        if (TimerComponent._instance === this) {
            TimerComponent._instance = null;
        }
    }
}