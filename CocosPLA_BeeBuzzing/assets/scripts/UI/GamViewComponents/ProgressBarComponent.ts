import { _decorator } from 'cc';
import {BaseProgressBarComponent} from "db://assets/PLAGameFoundation/ui/components/BaseProgressBarComponent";

const { ccclass } = _decorator;


/**
 * ProgressBarComponent - Progress bar with singleton access
 *
 * Usage:
 * - Drag prefab into scene
 * - Access via: ProgressBarComponent.instance.setProgress(0.5)
 * - Listen: SignalBus.instance.subscribe(ProgressEmptySignal, () => {})
 */
@ccclass('ProgressBarComponent')
export class ProgressBarComponent extends BaseProgressBarComponent {

    private static _instance: ProgressBarComponent = null;
    public static get instance(): ProgressBarComponent { return this._instance; }

    onLoad() {
        ProgressBarComponent._instance = this;
        super.onLoad();
    }

    onDestroy() {
        super.onDestroy();
        if (ProgressBarComponent._instance === this) {
            ProgressBarComponent._instance = null;
        }
    }
}