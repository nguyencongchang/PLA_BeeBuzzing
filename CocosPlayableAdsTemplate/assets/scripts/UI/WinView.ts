import { _decorator, ParticleSystem } from 'cc';
import { Constant } from 'db://assets/scripts/constant/constant';
import { EndCardView } from './EndCardView';

const { ccclass, property } = _decorator;

@ccclass('WinView')
export class WinView extends EndCardView {

    @property([ParticleSystem])
    particles: ParticleSystem[] = [];

    protected getSoundName(): string {
        return Constant.AUDIO_NAME.WIN;
    }

    onEnable() {
        super.onEnable();

        // Play all particle effects if available
        this.particles.forEach(particle => {
            if (particle) {
                particle.play();
            }
        });
    }
}