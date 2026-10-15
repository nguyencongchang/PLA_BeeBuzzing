import { math, Vec3 } from 'cc';
import { Bee } from './BeePool';
import { tumble } from './BeeEffects';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';

/** Bee scale once fully inside the hive (it shrinks from the entrance on). */
const ENTER_SCALE = 0.7;
/** How far past the entrance (world units, upward) bees fly: well inside, behind the front layer. */
const ENTER_DEPTH = 0.6;
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
 * inside). While entering, the bee shrinks slightly and the cube hanging under it is pulled up into
 * it and shrinks away, so no cube is left showing in the entrance hole. Writes the bee position
 * into `pos`; returns true once the bee is inside.
 */
export function stepHomeFlight(bee: Bee, speed: number, dt: number, cubeScale: number, pos: Vec3): boolean {
    // Full speed into the hive: an ease-out would park bees in the entrance hole.
    const travelled = Math.min(bee.timer * speed, bee.s);
    walkRounded(bee.home, travelled, pos);
    // The last ENTER_DEPTH of the route runs from the entrance up into the hive.
    const entering = math.clamp01(1 - (bee.s - travelled) / ENTER_DEPTH);
    const k = math.lerp(1, ENTER_SCALE, entering);
    bee.parts.root.setScale(k, k, k);
    const cube = bee.cube!;
    const left = 1 - entering;
    cube.setWorldPosition(Vec3.scaleAndAdd(hang, pos, Vec3.UNIT_Y, -CUBE_HANG * k * left));
    const size = cubeScale * k * left;
    cube.setScale(size, size, size);
    tumble(cube, dt);
    return travelled >= bee.s;
}
