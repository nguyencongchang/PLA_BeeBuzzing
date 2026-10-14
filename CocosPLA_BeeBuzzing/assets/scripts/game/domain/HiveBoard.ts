import { HiveSpec } from './LevelTypes';

export interface HiveState {
    readonly spec: HiveSpec;
    /** Bees not yet launched. */
    ammo: number;
    /** Slot index while active, -1 while queued or after depletion. */
    slot: number;
}

export type TapResult =
    | { readonly ok: true; readonly hive: HiveState; readonly slot: number }
    | { readonly ok: false; readonly reason: 'empty-line' | 'slots-full' };

/**
 * Hive queues (lines) at the bottom of the screen and the slots hives jump into.
 * Only the front hive of a line can be tapped; an active hive leaves its slot as soon
 * as its last bee has launched.
 */
export class HiveBoard {
    readonly lineCount: number;
    readonly slotCount: number;

    private readonly lines: HiveState[][];
    private readonly slots: (HiveState | null)[];

    constructor(hives: readonly HiveSpec[], lineCount: number, slotCount: number) {
        if (slotCount <= 0) throw new Error(`[HiveBoard] slotCount must be > 0, got ${slotCount}`);
        this.lineCount = lineCount;
        this.slotCount = slotCount;
        this.lines = Array.from({ length: lineCount }, () => []);
        this.slots = new Array(slotCount).fill(null);
        for (const spec of hives) {
            if (spec.line < 0 || spec.line >= lineCount) throw new Error(`[HiveBoard] hive ${spec.id} on invalid line ${spec.line}`);
            this.lines[spec.line].push({ spec, ammo: spec.ammo, slot: -1 });
        }
    }

    /** Queue of a line, front first. */
    line(line: number): readonly HiveState[] {
        return this.lines[line];
    }

    slot(slot: number): HiveState | null {
        return this.slots[slot];
    }

    get freeSlotCount(): number {
        let n = 0;
        for (const s of this.slots) if (!s) n++;
        return n;
    }

    get queuedCount(): number {
        let n = 0;
        for (const l of this.lines) n += l.length;
        return n;
    }

    activeHives(): HiveState[] {
        return this.slots.filter((s): s is HiveState => s !== null);
    }

    tap(line: number): TapResult {
        const queue = this.lines[line];
        if (!queue || queue.length === 0) return { ok: false, reason: 'empty-line' };
        const slot = this.slots.indexOf(null);
        if (slot === -1) return { ok: false, reason: 'slots-full' };
        const hive = queue.shift()!;
        hive.slot = slot;
        this.slots[slot] = hive;
        return { ok: true, hive, slot };
    }

    /** Launches one bee. Returns true when this emptied the hive (its slot is now free). */
    consumeAmmo(hive: HiveState): boolean {
        if (hive.slot === -1 || hive.ammo <= 0) throw new Error(`[HiveBoard] hive ${hive.spec.id} cannot fire`);
        hive.ammo--;
        if (hive.ammo > 0) return false;
        this.slots[hive.slot] = null;
        hive.slot = -1;
        return true;
    }
}
