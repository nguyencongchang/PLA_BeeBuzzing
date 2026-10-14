import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HiveBoard } from '../../../assets/scripts/game/domain/HiveBoard';
import { evaluateOutcome } from '../../../assets/scripts/game/domain/GameRules';
import { ReachabilitySolver } from '../../../assets/scripts/game/domain/ReachabilitySolver';
import { TargetSelector } from '../../../assets/scripts/game/domain/TargetSelector';
import { makeGrid, solidBox } from './test-helpers';

const IDENTITY_VIEW = [1, 0, 0, 0, 1, 0, 0, 0, 1];

test('HiveBoard: tap moves the front hive to the first free slot and rejects when full', () => {
    const board = new HiveBoard([
        { id: 0, line: 0, color: 1, ammo: 2 },
        { id: 1, line: 0, color: 2, ammo: 1 },
        { id: 2, line: 1, color: 3, ammo: 1 },
    ], 2, 1);
    const r1 = board.tap(0);
    assert.ok(r1.ok);
    assert.equal(r1.ok && r1.hive.spec.id, 0);
    assert.deepEqual(board.tap(1), { ok: false, reason: 'slots-full' });
    assert.equal(board.line(0).length, 1);

    const hive = board.slot(0)!;
    assert.equal(board.consumeAmmo(hive), false);
    assert.equal(board.consumeAmmo(hive), true);
    assert.equal(board.freeSlotCount, 1);
    assert.throws(() => board.consumeAmmo(hive));
    assert.deepEqual(board.tap(2), { ok: false, reason: 'empty-line' });
});

test('TargetSelector: within the front face, highest then right-most', () => {
    // 3x3x3 solid; camera +Z only → only the z=2 face is reachable.
    const g = makeGrid(3, 3, 3, solidBox(3, 4));
    const solver = new ReachabilitySolver(g, 0);
    solver.solve(1 << 4);
    const selector = new TargetSelector(g, solver);
    selector.rebuild(IDENTITY_VIEW);
    const reserved = new Uint8Array(g.cellCount);

    const first = selector.next(4, reserved);
    assert.deepEqual([g.xs[first], g.ys[first], g.zs[first]], [2, 2, 2]);
    reserved[first] = 1;
    const second = selector.next(4, reserved);
    assert.deepEqual([g.xs[second], g.ys[second], g.zs[second]], [1, 2, 2]);
    assert.equal(selector.next(9, reserved), -1);
});

test('TargetSelector: the face closest to the camera beats a higher cube further back', () => {
    // Two cubes reachable from any side: (1,2,0) is high but at the back, (1,0,2) low but in front.
    const g = makeGrid(3, 3, 3, [[1, 2, 0, 4], [1, 0, 2, 4]]);
    const solver = new ReachabilitySolver(g, 0);
    solver.solve(0b111111);
    const selector = new TargetSelector(g, solver);
    selector.rebuild(IDENTITY_VIEW); // row 3 = toward camera = +Z
    const first = selector.next(4, new Uint8Array(g.cellCount));
    assert.deepEqual([g.xs[first], g.ys[first], g.zs[first]], [1, 0, 2]);
});

test('GameRules: win, lose only on a true deadlock', () => {
    const base = { aliveCubes: 10, freeSlots: 0, beesInFlight: 0, activeColors: [1, 2], hasTargetFromAnyView: () => false };
    assert.equal(evaluateOutcome({ ...base, aliveCubes: 0 }), 'win');
    assert.equal(evaluateOutcome(base), 'lose');
    assert.equal(evaluateOutcome({ ...base, freeSlots: 1 }), 'playing');
    assert.equal(evaluateOutcome({ ...base, beesInFlight: 3 }), 'playing');
    assert.equal(evaluateOutcome({ ...base, hasTargetFromAnyView: (c) => c === 2 }), 'playing');
});
