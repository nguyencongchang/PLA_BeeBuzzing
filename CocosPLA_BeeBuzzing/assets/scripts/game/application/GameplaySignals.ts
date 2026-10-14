import { Vec3 } from 'cc';
import { GameOutcome } from '../domain/GameRules';

/** Gameplay events on the shared SignalBus (consumed by HUD, audio, tutorial). */

export class HiveActivatedSignal {
    constructor(public readonly hiveId: number, public readonly slot: number) {}
}

export class HiveTapRejectedSignal {
    constructor(public readonly line: number, public readonly reason: 'empty-line' | 'slots-full') {}
}

export class BeeLaunchedSignal {
    constructor(public readonly color: number) {}
}

export class CubePulledSignal {
    constructor(public readonly color: number, public readonly worldPos: Vec3) {}
}

export class LevelProgressSignal {
    constructor(public readonly removed: number, public readonly total: number) {}
}

/** Active hives can't shoot from this angle but could after rotating. */
export class RotateHintSignal {
    constructor(public readonly visible: boolean) {}
}

export class GameOutcomeSignal {
    constructor(public readonly outcome: GameOutcome) {}
}

export class SculptureDraggedSignal {}
