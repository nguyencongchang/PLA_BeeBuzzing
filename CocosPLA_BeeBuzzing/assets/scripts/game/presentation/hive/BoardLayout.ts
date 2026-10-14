import { Vec3 } from 'cc';

/**
 * World-space layout of the play field (camera looks down -Z at the origin).
 * Top: sculpture. Middle: active-hive slots. Bottom: hive queues (lines).
 */
export const BOARD_LAYOUT = {
    sculptureY: 2.3,
    slotY: -1.9,
    slotSpacing: 1.25,
    lineSpacing: 1.3,
    lineFrontY: -3.35,
    lineStep: 1.1,
    /** Queue entries drawn per line; deeper hives wait hidden behind the last one. */
    visibleQueue: 3,
    /** Half-extent of the play field the camera must always fit (world units). */
    minHalfWidth: 3.9,
    minHalfHeight: 6.9,
    /** Tap below this world Y targets a hive line. */
    lineTapMaxY: -2.6,
} as const;

export function slotPosition(slot: number, slotCount: number, out: Vec3): Vec3 {
    return out.set((slot - (slotCount - 1) / 2) * BOARD_LAYOUT.slotSpacing, BOARD_LAYOUT.slotY, 0);
}

export function lineX(line: number, lineCount: number): number {
    return (line - (lineCount - 1) / 2) * BOARD_LAYOUT.lineSpacing;
}

export function queuePosition(line: number, lineCount: number, queueIndex: number, out: Vec3): Vec3 {
    const visibleIndex = Math.min(queueIndex, BOARD_LAYOUT.visibleQueue - 1);
    return out.set(lineX(line, lineCount), BOARD_LAYOUT.lineFrontY - visibleIndex * BOARD_LAYOUT.lineStep, -0.05 * queueIndex);
}

/** Line index under a world X, or -1 if between columns. */
export function lineAtX(x: number, lineCount: number): number {
    const line = Math.round(x / BOARD_LAYOUT.lineSpacing + (lineCount - 1) / 2);
    if (line < 0 || line >= lineCount) return -1;
    return Math.abs(x - lineX(line, lineCount)) <= BOARD_LAYOUT.lineSpacing / 2 ? line : -1;
}
