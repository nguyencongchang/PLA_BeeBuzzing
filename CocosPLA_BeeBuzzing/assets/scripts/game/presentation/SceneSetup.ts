import { DirectionalLight, Node, Scene } from 'cc';
import { GameView } from 'db://assets/scripts/UI/GameView';
import { TimerComponent } from 'db://assets/scripts/UI/GamViewComponents/TimerComponent';
import { ProgressBarComponent } from 'db://assets/scripts/UI/GamViewComponents/ProgressBarComponent';

/** Key light from the camera side, above-left (front faces lit, toon ramp visible on sides). */
const KEY_LIGHT_EULER = [-35, -20, 0] as const;

/** The toon hive shader (bee-master.effect) reads the scene's main directional light. */
export function ensureKeyLight(scene: Scene, parent: Node): void {
    if (scene.getComponentInChildren(DirectionalLight)) return;
    const light = new Node('KeyLight');
    light.setParent(parent);
    light.setRotationFromEuler(KEY_LIGHT_EULER[0], KEY_LIGHT_EULER[1], KEY_LIGHT_EULER[2]);
    light.addComponent(DirectionalLight);
}

/** The template's countdown timer / generic bar are replaced by the bee HUD. */
export function hideTemplateHud(): void {
    const gameView = GameView.instance?.node;
    if (!gameView) return;
    gameView.getComponentsInChildren(TimerComponent).forEach((c) => { c.node.active = false; });
    gameView.getComponentsInChildren(ProgressBarComponent).forEach((c) => { c.node.active = false; });
}
