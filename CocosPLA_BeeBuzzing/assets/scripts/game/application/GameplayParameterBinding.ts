import { BooleanParameter, RangeParameter } from 'db://assets/PlayableParamterTool/parameter/BaseParameter';
import { PlayableConfig } from 'db://assets/scripts/parameter/config/PlayableConfig';
import { gameplayConfig } from './GameplayConfig';

/**
 * Routes dashboard parameter updates into the live gameplay config.
 * fireInterval / beeSpeed / autoRotateSpeed apply live; slotCount, maxTurns,
 * initialTilt and the speed button are read once when the level boots.
 */
export function bindGameplayParameters(): void {
    PlayableConfig.SlotCount.onUpdate = (p: RangeParameter) => { gameplayConfig.slotCount = Math.round(p.default); };
    PlayableConfig.MaxTurns.onUpdate = (p: RangeParameter) => { gameplayConfig.maxTurns = Math.round(p.default); };
    PlayableConfig.FireInterval.onUpdate = (p: RangeParameter) => { gameplayConfig.fireInterval = p.default; };
    PlayableConfig.BeeSpeed.onUpdate = (p: RangeParameter) => { gameplayConfig.beeSpeed = p.default; };
    PlayableConfig.AutoRotateSpeed.onUpdate = (p: RangeParameter) => { gameplayConfig.autoRotateSpeed = p.default; };
    PlayableConfig.InitialTilt.onUpdate = (p: RangeParameter) => { gameplayConfig.initialTilt = p.default; };
    PlayableConfig.SpeedButton.onUpdate = (p: BooleanParameter) => { gameplayConfig.speedButtonEnabled = p.default; };
}
