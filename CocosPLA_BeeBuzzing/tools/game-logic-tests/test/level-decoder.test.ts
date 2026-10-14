import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeLevel } from '../../../assets/scripts/game/infrastructure/LevelDecoder';

/** 2×1×1 grid: one cube of color 3 and one of color 5 (cell value = color + 1). */
const level = (hives: [number, number, number][]) => ({
    v: 1, size: [2, 1, 1], cell: 0.3, origin: [0, 0, 0], rot: [0, 0, 0], lines: 1,
    cells: Buffer.from([4, 6]).toString('base64'), hives,
});

test('decodes a level whose bees match its cubes per color', () => {
    const decoded = decodeLevel(level([[0, 3, 1], [0, 5, 1]]));
    assert.equal(decoded.hives.length, 2);
    assert.deepEqual([...decoded.cells], [4, 6]);
});

test('rejects a level whose bees do not match its cubes', () => {
    assert.throws(() => decodeLevel(level([[0, 3, 2], [0, 5, 1]])), /color 3/);
    assert.throws(() => decodeLevel(level([[0, 3, 1]])), /color 5/);
});

test('rejects editor-format JSON', () => {
    assert.throws(() => decodeLevel({ GridSize: { x: 2, y: 1, z: 1 }, Cubes: [] }), /unsupported level version/);
});
