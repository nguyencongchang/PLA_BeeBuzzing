import { GameOutcome } from '../domain/GameRules';

/** Gameplay events on the shared SignalBus (consumed by HUD, audio, tutorial). */

export class HiveActivatedSignal {
    constructor(public readonly hiveId: number, public readonly slot: number) {}
}

export class HiveTapRejectedSignal {
    constructor(public readonly line: number, public readonly reason: 'empty-line' | 'slots-full') {}
}

/** A bee pulled a cube out of the sculpture. */
export class CubePluckedSignal {}

export class BeeLaunchedSignal {
    constructor(public readonly color: number) {}
}

/** Active hives can't shoot from this angle but could after rotating. */
export class RotateHintSignal {
    constructor(public readonly visible: boolean) {}
}

export class GameOutcomeSignal {
    constructor(public readonly outcome: GameOutcome) {}
}

export class SculptureDraggedSignal {}
