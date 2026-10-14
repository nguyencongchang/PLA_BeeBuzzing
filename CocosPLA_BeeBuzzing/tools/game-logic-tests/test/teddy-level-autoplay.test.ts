import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeLevel } from '../../../assets/scripts/game/infrastructure/LevelDecoder';
import { VoxelGrid } from '../../../assets/scripts/game/domain/VoxelGrid';
import { ReachabilitySolver } from '../../../assets/scripts/game/domain/ReachabilitySolver';
import { TargetSelector } from '../../../assets/scripts/game/domain/TargetSelector';
import { HiveBoard } from '../../../assets/scripts/game/domain/HiveBoard';
import { ALL_DIRS_MASK } from '../../../assets/scripts/game/domain/GridDirections';
import { evaluateOutcome } from '../../../assets/scripts/game/domain/GameRules';

// npm test runs from tools/game-logic-tests
const LEVEL_PATH = path.resolve(process.cwd(), '../../assets/resources/bee/levels/teddy.level.json');
const SLOT_COUNT = 5;
const MAX_TURNS = 2;

/**
 * Greedy bot that may look from any angle (omni exits) and never taps a hive whose
 * color has no reachable cube unless nothing better exists. Proves the shipped level
 * is solvable with the shipped slot count and turn budget.
 */
test('teddy level is solvable by a greedy player with 5 slots', () => {
    const level = decodeLevel(JSON.parse(fs.readFileSync(LEVEL_PATH, 'utf8')));
    const grid = new VoxelGrid(level.width, level.height, level.depth, level.cells);
    assert.equal(grid.aliveCount, 4003);

    const solver = new ReachabilitySolver(grid, MAX_TURNS);
    const selector = new TargetSelector(grid, solver);
    const board = new HiveBoard(level.hives, level.lineCount, SLOT_COUNT);
    const reserved = new Uint8Array(grid.cellCount);
    const view = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const hasTarget = (color: number) => selector.next(color, reserved) !== -1;

    let taps = 0;
    for (let guard = 0; guard < 100000; guard++) {
        solver.solve(ALL_DIRS_MASK);
        selector.rebuild(view);

        let fired = false;
        for (const hive of board.activeHives()) {
            let target = selector.next(hive.spec.color, reserved);
            while (target !== -1 && hive.slot !== -1) {
                grid.remove(target);
                board.consumeAmmo(hive);
                fired = true;
                target = selector.next(hive.spec.color, reserved);
            }
        }
        if (fired) continue;

        const outcome = evaluateOutcome({
            aliveCubes: grid.aliveCount,
            freeSlots: board.freeSlotCount,
            beesInFlight: 0,
            activeColors: board.activeHives().map((h) => h.spec.color),
            hasTargetFromAnyView: hasTarget,
        });
        if (outcome !== 'playing') {
            assert.equal(outcome, 'win', `deadlock with ${grid.aliveCount} cubes left after ${taps} taps`);
            assert.equal(board.queuedCount, 0);
            return;
        }

        // Prefer a line whose front hive can shoot right away.
        let line = -1;
        for (let l = 0; l < board.lineCount && line === -1; l++) {
            const front = board.line(l)[0];
            if (front && hasTarget(front.spec.color)) line = l;
        }
        for (let l = 0; l < board.lineCount && line === -1; l++) if (board.line(l).length) line = l;
        assert.notEqual(line, -1, 'no hive to tap while the game is still playing');
        assert.ok(board.tap(line).ok);
        taps++;
    }
    assert.fail('autoplay did not terminate');
});

test('solver performance on the teddy grid stays within a frame budget', () => {
    const level = decodeLevel(JSON.parse(fs.readFileSync(LEVEL_PATH, 'utf8')));
    const grid = new VoxelGrid(level.width, level.height, level.depth, level.cells);
    const solver = new ReachabilitySolver(grid, MAX_TURNS);
    solver.solve(ALL_DIRS_MASK); // warm-up
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) solver.solve((1 << 4) | (1 << 2));
    const avg = (performance.now() - t0) / 20;
    console.log(`  avg solve: ${avg.toFixed(2)} ms`);
    assert.ok(avg < 8, `solve too slow: ${avg.toFixed(2)} ms`);
});
