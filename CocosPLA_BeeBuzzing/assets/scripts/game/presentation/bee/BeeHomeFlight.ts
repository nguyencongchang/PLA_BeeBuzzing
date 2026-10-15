import { math, Vec3 } from 'cc';
import { Bee } from './BeePool';
import { tumble } from './BeeEffects';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';
import { SculptureClearance } from './SculptureClearance';

/** Bee scale once fully inside the hive (it shrinks from the entrance on). */
const ENTER_SCALE = 0.7;
/** How far past the entrance (world units, upward) bees fly: well inside, behind the front layer. */
const ENTER_DEPTH = 0.6;
/** The carried cube hangs this far below the bee. */
const CUBE_HANG = 0.14;

/** The entry ends in a straight rise of this length (world units) up into the hole, as in the reference. */
const ENTRY_RISE = 0.9;

const hang = new Vec3();
const side = new Vec3();
const rayNear = new Vec3();
const rayFar = new Vec3();

/**
 * Sets up the flight home from the gate, built from the sculpture's free zones (see
 * SculptureClearance). The hive is 2D, so the bee may enter it at any depth along the camera ray
 * through the hole: it does so in the free zone in front of the model, which leaves room for a
 * straight rise into the hole on any screen. Route: out through the gate's door, (from a side door:
 * over the top to the front), to below the hole, straight up into it.
 */
export function startHomeFlight(bee: Bee, anchor: RouteAnchor, entrance: (out: Vec3, planeZ?: number) => Vec3): void {
    const c = anchor.clearance, route = bee.home, pts = bee.homePoints;
    route.length = 0;
    const gate = pts[0].set(anchor.gate);
    const door = gateDoor(anchor, pts[1], side);
    const hole = frontEntrance(c, entrance, pts[4]);
    const below = pts[3].set(hole.x, hole.y - ENTRY_RISE, hole.z);
    const inside = pts[5].set(hole.x, hole.y + ENTER_DEPTH, hole.z);
    route.push(gate, door);
    if (Vec3.dot(side, c.front) < 0.999) {
        // A side door: climb over the model (above zone), come down in front to below the hole.
        const top = Math.max(c.aboveLevel + 2 * CUBE_HANG, c.along(below));
        route.push(c.withAlong(door, Math.max(top, c.along(door)), pts[2]), c.withAlong(below, top, pts[6]));
    }
    route.push(below, hole, inside);
    bee.s = walkRounded(route, Number.POSITIVE_INFINITY, null);
}

/**
 * The hole on its camera ray, far enough in front of the model that the whole vertical entry (and
 * the cube hanging under the bee) stays in the free front zone.
 */
function frontEntrance(c: SculptureClearance, entrance: (out: Vec3, planeZ?: number) => Vec3, out: Vec3): Vec3 {
    entrance(rayNear, 0);
    Vec3.subtract(rayFar, entrance(rayFar, 1), rayNear);
    const reach = Math.abs(c.front.y) * (ENTRY_RISE + ENTER_DEPTH + CUBE_HANG);
    const toward = Vec3.dot(rayFar, c.front);
    if (toward < 1e-3) return out.set(rayNear); // no projection (fallback hive): board plane
    return Vec3.scaleAndAdd(out, rayNear, rayFar, (c.sideLevel + reach - c.ahead(rayNear, c.front)) / toward);
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
    // The last ENTER_DEPTH of the route runs from the hole up into the hive.
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
