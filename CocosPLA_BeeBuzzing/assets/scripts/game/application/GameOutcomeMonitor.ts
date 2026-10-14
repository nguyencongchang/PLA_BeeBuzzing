import { VoxelGrid } from '../domain/VoxelGrid';
import { HiveBoard } from '../domain/HiveBoard';
import { ReachabilitySolver } from '../domain/ReachabilitySolver';
import { TargetSelector } from '../domain/TargetSelector';
import { ALL_DIRS_MASK } from '../domain/GridDirections';
import { evaluateOutcome, GameOutcome } from '../domain/GameRules';

export interface OutcomeReport {
    readonly outcome: GameOutcome;
    /** Active hives are idle from this angle but rotating would give them a target. */
    readonly rotateHint: boolean;
}

/**
 * Lose / hint evaluation. Uses a second "omni" solve (every direction is an exit) to
 * answer "could rotating the sculpture help?" — the game is only lost when it could not.
 */
export class GameOutcomeMonitor {
    private readonly omni: ReachabilitySolver;

    constructor(
        private readonly grid: VoxelGrid,
        private readonly board: HiveBoard,
        private readonly selector: TargetSelector,
        maxTurns: number,
    ) {
        this.omni = new ReachabilitySolver(grid, maxTurns);
    }

    evaluate(reserved: Uint8Array, pendingGrabs: number): OutcomeReport {
        const active = this.board.activeHives();
        const fromAnyView = (color: number) => this.hasTargetFromAnyView(color, reserved);
        const outcome = evaluateOutcome({
            aliveCubes: this.grid.aliveCount,
            freeSlots: this.board.freeSlotCount,
            beesInFlight: pendingGrabs,
            activeColors: active.map((h) => h.spec.color),
            hasTargetFromAnyView: fromAnyView,
        });
        const idleHere = active.length > 0 && pendingGrabs === 0
            && active.every((h) => this.selector.next(h.spec.color, reserved) === -1);
        const rotateHint = outcome === 'playing' && idleHere && active.some((h) => fromAnyView(h.spec.color));
        return { outcome, rotateHint };
    }

    private hasTargetFromAnyView(color: number, reserved: Uint8Array): boolean {
        if (!this.omni.isUpToDate(ALL_DIRS_MASK)) this.omni.solve(ALL_DIRS_MASK);
        const g = this.grid;
        for (let i = 0; i < g.cellCount; i++) {
            if (reserved[i] === 0 && g.colorAt(i) === color && this.omni.isReachable(i)) return true;
        }
        return false;
    }
}
