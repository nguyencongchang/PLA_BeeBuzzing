import { math, Vec3 } from 'cc';
import { bezier, homeArc } from './BeeFlightPath';
import { Bee } from './BeePool';
import { tumble } from './BeeEffects';

/** Fraction of the home flight spent shrinking as the bee disappears inside the hive. */
const ENTER_FRACTION = 0.15;
const ENTER_SCALE = 0.7;
/** How far past the entrance (world units, upward) bees fly: inside, behind the front layer. */
const ENTER_DEPTH = 0.35;
/** The carried cube hangs this far below the bee. */
const CUBE_HANG = 0.14;

const hang = new Vec3();

/** Sets up the flight home from `from` to the hive entrance (`entrance` writes it into its arg). */
export function startHomeFlight(bee: Bee, from: Vec3, entrance: (out: Vec3) => Vec3): void {
    bee.leaveFrom.set(from);
    entrance(bee.leaveTo).y += ENTER_DEPTH;
    bee.s = homeArc(bee.leaveFrom, bee.leaveTo, bee.leaveCtrl);
}

/**
 * One frame of the flight home carrying the cube, up through the entrance into the hive (the
 * front hive layer hides it once inside), shrinking slightly at the very end. Writes the bee
 * position into `pos`; returns true once the bee is inside.
 */
export function stepHomeFlight(bee: Bee, speed: number, dt: number, cubeScale: number, pos: Vec3): boolean {
    const t = math.clamp01((bee.timer * speed) / bee.s);
    bezier(pos, bee.leaveFrom, bee.leaveCtrl, bee.leaveTo, t * (2 - t));
    const k = t < 1 - ENTER_FRACTION ? 1 : math.lerp(1, ENTER_SCALE, (t - 1 + ENTER_FRACTION) / ENTER_FRACTION);
    bee.parts.root.setScale(k, k, k);
    const cube = bee.cube!;
    cube.setWorldPosition(Vec3.scaleAndAdd(hang, pos, Vec3.UNIT_Y, -CUBE_HANG * k));
    cube.setScale(cubeScale * k, cubeScale * k, cubeScale * k);
    tumble(cube, dt);
    return t >= 1;
}
