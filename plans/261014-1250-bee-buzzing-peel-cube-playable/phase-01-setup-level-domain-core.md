# Phase 1 — Setup + Level Data + Domain Core (D1)

## Overview
Priority: P0 (critical path). Status: pending.
Bring assets in, compact the level, and build all game logic as pure TS with unit tests — **no rendering yet**.

## Context
- Level: `~/Downloads/Bee Game Asset/LevelData/Marketing_teddy_burgundy.json`
- Palette: `BoxyBlast_Cube_Colors.pdf` (enum 0–30, 14/17 unused)
- Existing: `scripts/constant/constant.ts`, `PLAGameFoundation/signalBus`, `async/AsyncTask`

## Steps
1. **Repo setup**: commit staged project rename; fix CLAUDE.md paths. Import assets:
   - `game-assets/fbxs/` ← 3 FBX; `game-assets/images/` ← 5 sprites; `game-assets/effects/` ← `bee-master.effect`.
   - Verify on import: Bee_2 has `Take 001` clip + skinning? bee-cube-2 = bevel cube? Note mesh pivot/scale.
2. **`tools/level-compactor/compact-level.mjs`** (Node, no deps):
   - In: raw JSON. Out: `assets/game-assets/levels/teddy.level.json` with
     `{ size:[23,25,19], cell:0.2, origin:[..], rot:[45,0,0], lines:5, cells:"<base64 Uint8Array W*H*D, value=color+1, 0=empty>", hives:[[line,index,color,ammo],...] }`.
     Sort hives by `(line, index)` (raw data has index 3/4 out of order).
   - Validate: unique positions, in-bounds, Health==1, Σammo[color]==count[color], no special shooter fields → fail loudly.
   - Print raw vs compact size (number for the write-up).
3. **`infrastructure/GamePalette.ts`**: `GAME_COLORS: Record<number,string>` hex from PDF (single SSOT).
4. **`domain/`** (relative imports only, no `cc`):
   - `LevelTypes.ts` — `LevelData`, `HiveSpec { id, line, color, ammo }`.
   - `Direction.ts` — 6 axis dirs, `perpendicular(d)`, `opposite(d)`.
   - `VoxelGrid.ts` — `Uint8Array` cells, `idx(x,y,z)`, `colorAt`, `remove`, `countByColor`, `aliveCount`, `version` counter.
   - `ReachabilitySolver.ts` — see algorithm below. Preallocated typed arrays, zero alloc per solve.
   - `TargetSelector.ts` — pick target for color c: candidates = reachable ∧ color==c ∧ !reserved; sort by world pos (rotation passed as 3×3 matrix): **y desc → depth to camera asc → x desc** (epsilon = cell/2 per tier). Keep per-color candidate lists; rebuild on solver update.
   - `HiveBoard.ts` — `lines: HiveSpec[][]` queues, `slots: (ActiveHive|null)[]`. `canTap(line)` = front exists ∧ free slot. `tap(line)` → move front to first free slot. `consumeAmmo(slot)`; ammo 0 ∧ no bee pending → slot free.
   - `GameRules.ts` — `isWin` = aliveCount==0. `isLose` = no free slot ∧ no bees in flight ∧ every slot hive has **no target in omni mode** (all 6 dirs count as exits = reachable from *any* rotation). If not-lose but nothing reachable from current view → emit `RotateHintSignal`.
5. **`tools/game-logic-tests/`** vitest (package.json local, imports `../../assets/scripts/game/domain/*`):
   - Solver: exposed cube; fully buried cube; pocket needing 1 turn (reachable at K=1, not K=0); 2-turn L-tunnel; camera-set restriction (exit only +Z).
   - Monotonicity: removing a cube never makes a reachable cube unreachable (random fuzz 200 iters).
   - Selector ordering; HiveBoard queue/slot transitions; GameRules win/lose/hint.
   - Teddy integration: greedy auto-play (always tap a line whose front color has omni-reachable target) completes with 5 slots → proves level solvable.

## ReachabilitySolver algorithm
```
Padded grid P = (W+2)(H+2)(D+2); empty = !alive (padding always empty).
Exit set F ⊆ 6 local dirs: dir d ∈ F iff dot(R·d, toCamera) ≥ τ (τ≈0.3); omni mode: F = all.
cost[p,d] = min 90°-turns for a bee at empty cell p moving in dir d to escape.
Init (0-1 BFS deque): every padding cell p, d ∈ F, with p+d outside → cost 0.
Relax backwards from (p,d,c):
  straight: q = p-d, q empty → (q,d) cost c          (push front)
  turn:     q = p-d, q empty → (q,d') cost c+1 for d' ⊥ d, if c+1 ≤ K   (push back)
Cube t reachable iff ∃ face d0: n=t+d0 empty ∧ cost[n,d0] ≤ K.
Path for bee: from (n,d0) greedily step to neighbor state with cost non-increasing; record corner points → bee spline (reverse for fly-in).
```
Size: 25·27·21·6 ≈ 85k states → ~1–2 ms/solve. Triggers: grid.version changed (throttled ≤10Hz) or rotation settled / changed > 15°.

## Success Criteria
- `npm test` in `tools/game-logic-tests` green; teddy auto-play solves.
- Compact level ≤ 20KB; compactor validation passes.
- 3–5 small conventional commits (`chore: import assets`, `feat(level): compactor`, `feat(domain): reachability`...).

## Risk Assessment
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| Hiểu sai "rẽ 90° về phía camera" | 3 | 4 | 12 | Exit = thoát grid với hướng ∈ F; K & τ là param, tune bằng mắt ở P3 |
| Greedy auto-play bế tắc dù level đúng | 2 | 3 | 6 | Solver dùng omni; nếu vẫn kẹt → tăng slot/K, ghi lại |
| Cocos import ts path `db://` vỡ test Node | 2 | 3 | 6 | domain chỉ relative import, không `cc` |
| FBX import sai scale/pivot | 2 | 2 | 4 | Wrap trong prefab, chỉnh trên prefab |

## Timeline
| Task | Effort |
|---|---|
| Setup + import | 1–2h |
| Compactor | 1h |
| Domain + tests | 4–5h |
