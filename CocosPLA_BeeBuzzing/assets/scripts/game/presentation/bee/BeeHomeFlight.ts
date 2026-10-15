import { math, Vec3 } from 'cc';
import { Bee } from './BeePool';
import { tumble } from './BeeEffects';
import { gateDoor, RouteAnchor, walkRounded } from './FreeFlightRoute';
import { SculptureClearance } from './SculptureClearance';

/** How far past the hole (world units, upward) bees fly: inside, behind the front hive layer. */
const ENTER_DEPTH = 0.6;
/** The entry ends in a straight rise of this length (world units) up into the hole, as in the reference. */
const ENTRY_RISE = 0.9;
/** The carried cube hangs this far below the bee. */
const CUBE_HANG = 0.14;
/** Bee wingspan (world units at scale 1) and the share of the hole width bee + wings take there. */
const BEE_SPAN = 0.32;
const HOLE_FILL = 0.85;
const MIN_ENTRY_SCALE = 0.35;
/** A climb over the model must stay this far below the hole, or it would pass behind the hive. */
const UNDER_HIVE = 0.3;

const hang = new Vec3();
const side = new Vec3();
const rayNear = new Vec3();
const rayFar = new Vec3();
const rimL = new Vec3();
const rimR = new Vec3();

type Entrance = (out: Vec3, planeZ?: number, across?: number) => Vec3;

/**
 * Sets up the flight home from the gate, built from the sculpture's free zones (see
 * SculptureClearance). The hive is 2D, so the bee may enter it at any depth along the camera ray
 * through the hole: it does so in the free zone in front of the model, which leaves room for a
 * straight rise into the hole on any screen. Route: out through the gate's door, (from a side door:
 * around the model to the front, over it or under it — never behind the hive), to below the hole,
 * straight up into it.
 */
export function startHomeFlight(bee: Bee, anchor: RouteAnchor, entrance: Entrance): void {
    const c = anchor.clearance, route = bee.home, pts = bee.homePoints;
    route.length = 0;
    const gate = pts[0].set(anchor.gate);
    const door = gateDoor(anchor, pts[1], side);
    const hole = frontEntrance(c, entrance, pts[4]);
    const below = pts[3].set(hole.x, hole.y - ENTRY_RISE, hole.z);
    const inside = pts[5].set(hole.x, hole.y + ENTER_DEPTH, hole.z);
    route.push(gate, door);
    if (Vec3.dot(side, c.front) < 0.999) {
        // A side door: round the model to the front, over its top when that stays below the hole.
        const over = Math.max(c.aboveLevel + 2 * CUBE_HANG, c.along(below), c.along(door));
        const level = over < c.along(hole) - UNDER_HIVE ? over : Math.min(c.belowLevel, c.along(door), c.along(below));
        route.push(c.withAlong(door, level, pts[2]), c.withAlong(below, level, pts[6]));
    }
    route.push(below, hole, inside);
    bee.s = walkRounded(route, Number.POSITIVE_INFINITY, null);
    entrance(rimL, hole.z, -1);
    entrance(rimR, hole.z, 1);
    bee.entryScale = math.clamp(HOLE_FILL * Vec3.distance(rimL, rimR) / BEE_SPAN, MIN_ENTRY_SCALE, 1);
}

/**
 * The hole on its camera ray, far enough in front of the model that the whole vertical entry (and
 * the cube hanging under the bee) stays in the free front zone.
 */
function frontEntrance(c: SculptureClearance, entrance: Entrance, out: Vec3): Vec3 {
    entrance(rayNear, 0);
    Vec3.subtract(rayFar, entrance(rayFar, 1), rayNear);
    const reach = Math.abs(c.front.y) * (ENTRY_RISE + ENTER_DEPTH + CUBE_HANG);
    const toward = Vec3.dot(rayFar, c.front);
    if (toward < 1e-3) return out.set(rayNear); // no projection (fallback hive): board plane
    return Vec3.scaleAndAdd(out, rayNear, rayFar, (c.sideLevel + reach - c.ahead(rayNear, c.front)) / toward);
}

/**
 * One frame of the flight home carrying the cube (reference): straight up into the hole, bee and
 * cube shrinking during the rise to fit it; the cube hangs under the bee and slips in after it,
 * hidden by the front hive layer once past the hole's upper rim. Writes the bee position into
 * `pos`; returns true once the bee is inside.
 */
export function stepHomeFlight(bee: Bee, speed: number, dt: number, cubeScale: number, pos: Vec3): boolean {
    // Full speed into the hive: an ease-out would park bees in the entrance hole.
    const travelled = Math.min(bee.timer * speed, bee.s);
    walkRounded(bee.home, travelled, pos);
    // The route ends with ENTRY_RISE up to the hole, then ENTER_DEPTH into the hive.
    const rising = math.clamp01(1 - (bee.s - travelled - ENTER_DEPTH) / ENTRY_RISE);
    const k = math.lerp(1, bee.entryScale, rising);
    bee.parts.root.setScale(k, k, k);
    const cube = bee.cube!;
    cube.setWorldPosition(Vec3.scaleAndAdd(hang, pos, Vec3.UNIT_Y, -CUBE_HANG * k));
    cube.setScale(cubeScale * k, cubeScale * k, cubeScale * k);
    tumble(cube, dt);
    return travelled >= bee.s;
}
