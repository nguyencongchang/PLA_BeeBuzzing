# Phase 3 — Bee Swarm, Firing Loop, Win/Lose, X2 (D3)

## Overview
Priority: P0 (this is the required "correct game logic"). Status: pending. Depends: Phase 2.

## Requirements
- An active hive in a slot fires continuously: each `fireInterval` (base ~0.05s) → TargetSelector → reserve the cube → spawn a bee. No target → idle and keep retrying (rotation may open targets).
- Bee lifecycle (tick-driven, `dt * GameTime.scale`):
  1. **Launch** from the hive (small pop, staggered so bees "line up").
  2. **Fly-in** along a Catmull-Rom spline: hive → points outside the sculpture → reversed path waypoints (Phase 1 solver) → in front of the target face. Waypoints are in **sculpture-local space**, evaluated through the current world matrix each frame → the bee follows the target while the model rotates.
  3. **Grab** — punch scale at the face, 0.08s.
  4. **Pull** — `grid.remove(idx)` at this moment (the voxel disappears from the mesh, solver/mesher dirty), spawn a flying cube (bee-cube-2, color instance) at the old position, pull outward along d0 by 1 cell.
  5. **Carry-out** — bee + cube fly along the exit path then toward the screen edge, shrink, recycle into the pool.
- Total time per bee ~0.6–0.9s at x1. Cap concurrent bees (~150); when the cap is hit the hive waits.
- `GameRules` evaluated when: a slot frees up, the board changes, rotation settles. Win → `GameView.onWin()`, Lose → `GameView.onLose()`; the hint signal → "Rotate!" text.
- X2 SPEED: `GameTime.scale` toggles 1↔2; all gameplay motion/timers read it (do not use `cc.tween` for gameplay).

## Architecture
- `application/GameTime.ts` — static scale + `scaledDt(dt)`.
- `application/GameplaySignals.ts` — `HiveTappedSignal`, `CubeRemovedSignal`, `HiveDepletedSignal`, `RotateHintSignal`, `LevelProgressSignal(pct)`.
- `application/GameplayController.ts` (Component, `@RegisterLifecycle`) — owns domain instances; fire loop per slot; reservations `Uint8Array`; throttles solver (≤10Hz + on rotation settled); calls GameRules.
- `presentation/bee/BeeSwarm.ts` — pool (`ObjectPoolManager`) + update for all active bees in **one** tick loop (struct-of-arrays, no per-bee Component update). Bee model = Bee_2 with **no** skeletal animation per instance (procedural wing flap via scale/bob) → GPU instancing for ~150 bees.
- `presentation/bee/FlyingCubePool.ts` — bee-cube-2 mesh, one shared material per color (13 colors) with instancing on.

## Throughput target (30–60s)
4003 cubes, 5 slots firing at once ⇒ ~90 cube/s needed for ~45s at x1 ⇒ effective interval per slot ≈ 0.055s. `fireInterval` is a parameter; tune by playtest so 30–60s holds with normal taps (88 hives ≈ 1 tap / 0.5s).

## Steps
1. GameTime + signals + controller skeleton; fire loop with an instant remove (no animation) → verify the logic/win end-to-end.
2. BeeSwarm with spline + 5 states; reserve → remove at the pull step.
3. Lose/hint; X2 button.
4. Playtest: tune fireInterval, K, τ, bee speed; record the level completion time.

## Success Criteria
- Teddy completes with no deadlock under normal play; win → WinView.
- Deliberately filling slots with hives that have no reachable target (in any rotation) → LoseView.
- No bee ever targets a cube that is blocked from the current view (debug overlay check).
- ≥ 50fps with 150 bees on a mid Android phone (Chrome remote / profiler).

## Risk Assessment
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| A bee's path passes through a cube reserved by another bee that hasn't been removed yet | 3 | 2 | 6 | Accept it (visually fine); the cube is removed when grabbed |
| Too many bees → frame drops | 3 | 4 | 12 | Cap + instancing + SoA tick; reduce cap at runtime when FPS < 45 |
| Model rotates mid-flight → path goes through cubes | 3 | 2 | 6 | Path in local space → always valid relative to the model |
| Lose triggers early while bees are still in flight | 2 | 4 | 8 | Lose requires bees-in-flight == 0 and a solver that is up to date |

## Timeline
| Task | Effort |
|---|---|
| Controller + logic loop | 2.5h |
| Bee swarm + animation | 4h |
| Lose/X2/tuning | 1.5h |
