import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReachabilitySolver } from '../../../assets/scripts/game/domain/ReachabilitySolver';
import { ALL_DIRS_MASK } from '../../../assets/scripts/game/domain/GridDirections';
import { makeGrid, mulberry32, solidBox } from './test-helpers';

const PLUS_Z = 1 << 4; // camera looking down -Z: escaping along +Z means toward the camera
const PLUS_Y = 1 << 2;

test('solid 3x3x3: only cubes on camera-facing face are reachable with 0 turns', () => {
    const g = makeGrid(3, 3, 3, solidBox(3));
    const s = new ReachabilitySolver(g, 0);
    s.solve(PLUS_Z);
    for (let i = 0; i < g.cellCount; i++) {
        assert.equal(s.isReachable(i), g.zs[i] === 2, `cell ${g.xs[i]},${g.ys[i]},${g.zs[i]}`);
    }
});

test('center of a solid box is never reachable, even omni with many turns', () => {
    const g = makeGrid(3, 3, 3, solidBox(3));
    const s = new ReachabilitySolver(g, 5);
    s.solve(ALL_DIRS_MASK);
    assert.equal(s.isReachable(g.index(1, 1, 1)), false);
    assert.equal(s.isReachable(g.index(0, 0, 0)), true);
});

test('cube exposed only upward needs exactly one turn to reach the camera', () => {
    // 3x2x3 grid: target at (1,0,1) covered by a ring on its layer, open above (y=1).
    // Camera exit only +Z. Path: up into (1,1,1), turn +Z, leave the grid.
    const filled: number[][] = [];
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) filled.push([x, 0, z, 0]);
    const g = makeGrid(3, 2, 3, filled);
    const target = g.index(1, 0, 1);

    const noTurn = new ReachabilitySolver(g, 0);
    noTurn.solve(PLUS_Z);
    assert.equal(noTurn.isReachable(target), false);

    const oneTurn = new ReachabilitySolver(g, 1);
    oneTurn.solve(PLUS_Z);
    assert.equal(oneTurn.isReachable(target), true);

    const path: number[] = [];
    assert.ok(oneTurn.tracePath(target, path));
    assert.deepEqual(path, [1, 0, 1, 1, 1, 1, 1, 1, 3]);
});

test('leaving the grid in a non camera-facing direction is a dead end', () => {
    // Single cube; camera only +Y, but every face may exit. Only the +Y face counts.
    const g = makeGrid(1, 1, 1, [[0, 0, 0, 0]]);
    const s = new ReachabilitySolver(g, 2);
    s.solve(PLUS_Y);
    assert.equal(s.bestFace(0), 2);
});

test('blocked corridor: removing the blocker opens the target', () => {
    // 1x1x3 column along Z: target z=0, blocker z=1, camera +Z.
    const g = makeGrid(1, 1, 3, [[0, 0, 0, 0], [0, 0, 1, 1]]);
    const s = new ReachabilitySolver(g, 2);
    s.solve(PLUS_Z);
    assert.equal(s.isReachable(0), false);
    assert.equal(s.isReachable(1), true);
    g.remove(1);
    assert.equal(s.isUpToDate(PLUS_Z), false);
    s.solve(PLUS_Z);
    assert.equal(s.isReachable(0), true);
});

test('monotonic: removing cubes never makes a reachable cube unreachable (fuzz)', () => {
    const rnd = mulberry32(42);
    for (let iter = 0; iter < 40; iter++) {
        const n = 5;
        const filled = solidBox(n).filter(() => rnd() < 0.8);
        const g = makeGrid(n, n, n, filled);
        const mask = 1 + Math.floor(rnd() * ALL_DIRS_MASK);
        const s = new ReachabilitySolver(g, 2);
        s.solve(mask);
        const before = Array.from({ length: g.cellCount }, (_, i) => s.isReachable(i));
        const alive = Array.from({ length: g.cellCount }, (_, i) => i).filter((i) => g.isAlive(i));
        for (const i of alive) if (rnd() < 0.3) g.remove(i);
        s.solve(mask);
        for (let i = 0; i < g.cellCount; i++) {
            if (before[i] && g.isAlive(i)) assert.equal(s.isReachable(i), true, `iter ${iter} cell ${i}`);
        }
    }
});

test('traced paths only travel through empty cells and use at most maxTurns corners', () => {
    const rnd = mulberry32(7);
    const n = 6;
    const g = makeGrid(n, n, n, solidBox(n).filter(() => rnd() < 0.6));
    const s = new ReachabilitySolver(g, 2);
    s.solve(PLUS_Z | PLUS_Y);
    const path: number[] = [];
    for (let i = 0; i < g.cellCount; i++) {
        if (!s.isReachable(i)) continue;
        assert.ok(s.tracePath(i, path));
        const corners = path.length / 3 - 2;
        assert.ok(corners <= 2, `too many corners: ${corners}`);
        for (let k = 0; k + 3 < path.length; k += 3) {
            const [ax, ay, az, bx, by, bz] = path.slice(k, k + 6);
            const steps = Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bz - az);
            for (let t = 1; t <= steps; t++) {
                const x = ax + Math.sign(bx - ax) * t, y = ay + Math.sign(by - ay) * t, z = az + Math.sign(bz - az) * t;
                if (g.inBounds(x, y, z)) assert.equal(g.isAlive(g.index(x, y, z)), false, `path through a cube`);
            }
        }
    }
});
