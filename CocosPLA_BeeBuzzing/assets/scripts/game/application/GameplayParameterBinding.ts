import { BooleanParameter, RangeParameter, TextParameter } from 'db://assets/PlayableParamterTool/parameter/BaseParameter';
import { ParametersReadySignal } from 'db://assets/PlayableParamterTool/PlayableParameterUpdates';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { PlayableConfig } from 'db://assets/scripts/parameter/config/PlayableConfig';
import { gameplayConfig } from './GameplayConfig';

let parametersReady = false;
const readyWaiters: (() => void)[] = [];
let levelChanged: (() => void) | null = null;

function onParametersReady(): void {
    parametersReady = true;
    SignalBus.instance.unsubscribe(ParametersReadySignal, onParametersReady);
    for (const resolve of readyWaiters.splice(0)) resolve();
}

/** The dashboard may hand a parsed object instead of the text. */
function levelText(value: unknown): string {
    return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
}

/**
 * Routes dashboard parameter updates into the live gameplay config.
 * fireInterval / beeSpeed / autoRotateSpeed apply live; slotCount, maxTurns, initialTilt and the
 * speed button are read when the level boots, which waits for the parameters (see
 * `whenGameplayParametersReady`). A level change after boot is reported to `onLevelParameterChanged`.
 */
export function bindGameplayParameters(): void {
    PlayableConfig.SlotCount.onUpdate = (p: RangeParameter) => { gameplayConfig.slotCount = Math.round(p.default); };
    PlayableConfig.MaxTurns.onUpdate = (p: RangeParameter) => { gameplayConfig.maxTurns = Math.round(p.default); };
    PlayableConfig.FireInterval.onUpdate = (p: RangeParameter) => { gameplayConfig.fireInterval = p.default; };
    PlayableConfig.BeeSpeed.onUpdate = (p: RangeParameter) => { gameplayConfig.beeSpeed = p.default; };
    PlayableConfig.AutoRotateSpeed.onUpdate = (p: RangeParameter) => { gameplayConfig.autoRotateSpeed = p.default; };
    PlayableConfig.InitialTilt.onUpdate = (p: RangeParameter) => { gameplayConfig.initialTilt = p.default; };
    PlayableConfig.SpeedButton.onUpdate = (p: BooleanParameter) => { gameplayConfig.speedButtonEnabled = p.default; };
    PlayableConfig.LevelJson.onUpdate = (p: TextParameter) => {
        const json = levelText(p.default);
        const changed = json !== gameplayConfig.levelJson;
        gameplayConfig.levelJson = json;
        if (parametersReady && changed) levelChanged?.();
    };
    // Registered before the parameter manager applies the SDK values and fires the signal.
    if (!parametersReady) SignalBus.instance.subscribe(ParametersReadySignal, onParametersReady);
}

/**
 * Resolves true once the parameter manager has applied the dashboard / SDK values (they arrive
 * asynchronously, after the scene starts), or false after `timeoutMs` (no parameter manager).
 */
export function whenGameplayParametersReady(timeoutMs: number): Promise<boolean> {
    if (parametersReady) return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        readyWaiters.push(() => { clearTimeout(timer); resolve(true); });
    });
}

/** Called when the level parameter changes after the parameters were ready (live dashboard edit). */
export function onLevelParameterChanged(callback: (() => void) | null): void {
    levelChanged = callback;
}
