import { math, Vec3 } from 'cc';
import { Bee } from './BeePool';
import { tumble } from './BeeEffects';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';

/** Fraction of the home flight spent shrinking as the bee disappears inside the hive. */
const ENTER_FRACTION = 0.15;
const ENTER_SCALE = 0.7;
/** How far past the entrance (world units, upward) bees fly: inside, behind the front layer. */
const ENTER_DEPTH = 0.35;
/** The carried cube hangs this far below the bee. */
const CUBE_HANG = 0.14;

const hang = new Vec3();
const side = new Vec3();
let warnedLowHive = false;

/**
 * Sets up the flight home from the gate, built from the sculpture's free zones (see
 * SculptureClearance): out through the gate's door, up beside the model to above it, across over
 * it to under the hive, then straight up through the entrance (vertical entry, as in the reference).
 * The route is fixed in world space; its legs are spin-proof except the short one by the gate.
 */
export function startHomeFlight(bee: Bee, anchor: RouteAnchor, entrance: (out: Vec3) => Vec3): void {
    const [gate, door, front, over, hive] = bee.home;
    gate.set(anchor.gate);
    gateDoor(anchor, door, side);
    entrance(hive).y += ENTER_DEPTH;
    const c = anchor.clearance;
    // Over the model the carried cube hangs below the bee: keep it clear as well.
    const above = c.aboveLevel + 2 * CUBE_HANG;
    if (c.along(hive) < above && !warnedLowHive) {
        warnedLowHive = true;
        console.warn('[BeeHomeFlight] hive entrance is level with the sculpture; bees may cross its top');
    }
    const level = Math.min(above, c.along(hive));
    c.withAlong(hive, level, over);
    c.withAlong(c.withAhead(over, side, c.sideLevel, front), Math.max(level, c.along(door)), front);
    bee.s = walkRounded(bee.home, Number.POSITIVE_INFINITY, null);
}

/**
 * One frame of the flight home carrying the cube, into the hive (the front hive layer hides it once
 * inside), shrinking slightly at the very end. Writes the bee position into `pos`; returns true once
 * the bee is inside.
 */
export function stepHomeFlight(bee: Bee, speed: number, dt: number, cubeScale: number, pos: Vec3): boolean {
    const t = math.clamp01((bee.timer * speed) / bee.s);
    walkRounded(bee.home, bee.s * t * (2 - t), pos);
    const k = t < 1 - ENTER_FRACTION ? 1 : math.lerp(1, ENTER_SCALE, (t - 1 + ENTER_FRACTION) / ENTER_FRACTION);
    bee.parts.root.setScale(k, k, k);
    const cube = bee.cube!;
    cube.setWorldPosition(Vec3.scaleAndAdd(hang, pos, Vec3.UNIT_Y, -CUBE_HANG * k));
    cube.setScale(cubeScale * k, cubeScale * k, cubeScale * k);
    tumble(cube, dt);
    return t >= 1;
}
