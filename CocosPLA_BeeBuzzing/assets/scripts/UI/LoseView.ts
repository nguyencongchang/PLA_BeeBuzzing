import { _decorator } from 'cc';
import { Constant } from 'db://assets/scripts/constant/constant';
import { EndCardView } from './EndCardView';

const { ccclass } = _decorator;

@ccclass('LoseView')
export class LoseView extends EndCardView {

    protected getSoundName(): string {
        return Constant.AUDIO_NAME.LOSE;
    }
}