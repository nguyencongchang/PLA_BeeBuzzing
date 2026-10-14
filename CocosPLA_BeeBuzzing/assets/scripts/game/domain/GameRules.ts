export type GameOutcome = 'playing' | 'win' | 'lose';

export interface GameSnapshot {
    readonly aliveCubes: number;
    readonly freeSlots: number;
    readonly beesInFlight: number;
    /** Colors of the hives currently sitting in slots. */
    readonly activeColors: readonly number[];
    /** True if some cube of this color can be pulled out from at least one view angle. */
    readonly hasTargetFromAnyView: (color: number) => boolean;
}

/**
 * Win: every cube removed.
 * Lose: a true deadlock — all slots taken, nothing in flight, and no active hive could
 * shoot even after rotating the sculpture (so rotating would not help).
 */
export function evaluateOutcome(s: GameSnapshot): GameOutcome {
    if (s.aliveCubes === 0) return 'win';
    if (s.freeSlots > 0 || s.beesInFlight > 0) return 'playing';
    for (const color of s.activeColors) {
        if (s.hasTargetFromAnyView(color)) return 'playing';
    }
    return 'lose';
}
