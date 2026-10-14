# Code Review: Bee Cube gameplay (scripts/game/**, level-compactor, game-logic-tests)

Scope: commits ef1db66..4bf05d0, `CocosPLA_BeeBuzzing/assets/scripts/game/**`, `tools/level-compactor/compact-level.mjs`, `tools/game-logic-tests/test/*.ts`, plus the parameter edits. Read-only review.

Edge-case scouting: there was no sub-agent tool in this session, so I did it in-process. I wrote a throwaway fuzz harness in the session scratchpad. It compares `ReachabilitySolver` against a brute-force BFS on 400 random grids (1–6 per axis, random density, random exit mask, maxTurns 0–3). It covered 7,325 traced paths, 7,029 of them 2-point paths. I also traced after random removals with a stale cost field. Everything passed. The existing 12 tests also pass.

## Critical (must fix)
None found.

## Important (fix before merge)

1. **GameHud.ts:119, 125 — hint tweens are never stopped, so they pile up.** `tween(opacity).stop()` and `tween(this.hint).stop()` each build a new, empty Tween. `Tween.stop()` only removes that instance's own `_finalAction` (engine `cocos/tween/tween.ts:358`), so both calls do nothing.
   - Scenario: every time the hint shows, line 123 adds another `repeatForever` scale tween that never stops, and they fight over `hint.scale`.
   - Hide → show inside the 0.2 s fade: the old fade-out still runs its `.call(() => hint.active = false)`, so the hint ends up hidden while `hintVisible === true`.
   - Fix: `Tween.stopAllByTarget(opacity); Tween.stopAllByTarget(this.hint);` (TutorialHand already does this correctly).

2. **BeeGameBootstrap.ts:78 — if boot fails, the ad is dead.** `boot().catch(e => console.error(...))` only logs.
   - Any required asset failing to load leaves the game on GAMEPLAY with no board and no end card: the level JSON, effect, or bee/hive/cube prefab.
   - So does any throw during init: an unknown palette color in `HiveBoardView.init → ModelKit.createHive → MaterialFactory.gameColor` throws, and so does a grid over 255 cells per axis in `VoxelGrid`.
   - Only the corner CTA can still convert.
   - Fix: in the catch, go to a terminal state (`GameView.instance?.onLose()` or show the end card / CTA) so the ad still works.

3. **BoardBackdrop.ts:80-82, 123-155 — static layout is redrawn every frame.** `lateUpdate → layout()` does all of this every frame:
   - `Graphics.clear()` plus re-tessellation of 6 round-rects
   - `setContentSize` on every slot sprite
   - 2N+3 `convertToUINode` calls

   That costs CPU and memory churn every frame on mobile, for geometry that only changes on resize or camera change. Fix: cache `worldRoot.worldScale.x`, `view.getVisibleSize()` and the camera position, and re-layout only when one of them changes.

4. **GameplayController.ts:137-139 — the bee cap causes fire-timer debt and starves later slots.** When `swarm.count >= maxBeesInFlight`, the function `return`s.
   - Each capped frame still subtracts dt from the timers of slots ≤ the current slot, so `fireTimers` builds up unbounded negative debt.
   - When capacity frees, slot 0 is always visited first and takes every freed bee. Slots 1–4 are starved until slot 0's debt is paid off.
   - When it triggers: at the default FireInterval 0.05 (~100 bees/s with 5 hives) the headless run peaks around 120 bees, close to the cap of 160. The dashboard allows FireInterval down to 0.02 (~250 bees/s), which reliably hits the cap.
   - Fix: when capped, clamp the timer to `Math.max(fireTimers[slot], 0)` and stop; rotate the starting slot each frame (round-robin).

5. **HiveBoardView.ts:67-77 — repeated rejected taps make the hive drift.** Each rejected tap captures `base = view.node.position.clone()`, which may already be mid-shake.
   - Scenario: all slots are full and the player double-taps a line within 0.15 s. The second tween finishes last and leaves the front hive up to 0.12 units off its line.
   - It stays off until that line is re-laid out. Frustrated multi-tapping on a full board is a normal input.
   - Fix: `Tween.stopAllByTarget(view.node)` and take `base` from `queuePosition(line, lineCount, 0, …)`.

## Minor / Suggestions

6. **BeeSwarm.ts:155 + 254-265 — a flying cube is drawn one frame at a stale position.** In the GRAB phase, `acquireCube` sets `active = true` but does not position the cube; the position is first set on the next frame, in PULL.
   - A freshly created cube renders at the `Bees` node origin, i.e. mid-screen between the sculpture and the slots. This is visible as flicker during the first ~160 grabs.
   - A pooled cube renders at its last leave point, which is off-screen.
   - Fix: set the cube's world position to the cube center (`localToWorld(bee.center, faceDir, 0)`) before activating it.

7. **GameplayController.ts:189-192 — "Drag to rotate!" can show when rotating can't help.** `stuckHere` only checks the current view. The `RotateHintSignal` doc promises "could after rotating", but nothing checks that.
   - Scenario: slots are free, and the active hives' cubes are buried from every angle. The hint says rotate, while the correct move (and the TutorialHand) says tap a hive.
   - Fix: also require at least one active color with `hasUnreservedTarget(omniSolver, …)`.

8. **SculptureView.ts:10, 88-96 — a grabbed cube can briefly appear twice.** Chunks rebuild in FIFO order with a budget of 3 per frame. The teddy level has 36 chunks and ~100 grabs/s, so a grabbed cube can stay in the sculpture mesh for up to ~12 frames while its flying copy is already being pulled out of the same spot. Fix: rebuild the grabbed cell's own chunk first (push it to the queue front), or raise the budget when the queue is long.

9. **X2 timing mismatch — GameplayController.ts:27 vs HiveBoardView.ts:8.** `FIRST_SHOT_DELAY` (0.3) runs on game time, but the jump tween runs on real time (0.32 s). At X2 the first bee leaves after 0.15 s real time, from the empty slot, before the hive lands. Fix: time the first-shot delay in real time, or make the scaled delay ≥ the tween length.

10. **Allocations in hot paths** (no single one is critical; together they add GC pressure):
    - `HiveBoardView.lateUpdate` (104, 113): a `forEach` closure plus a template string per visible hive, every frame. Assign the label only when `ammo` changes.
    - Each bee launch: the `LaunchRequest` object literal (GameplayController.ts:147), `new BeeLaunchedSignal`, and `SignalBus.fire` copying the callback array (SignalBus.ts:67). Each grab also creates 2 signal objects plus 2 array copies.
    - `CubePulledSignal` (GameplayController.ts:158, 162) has **no subscribers**. It also carries the shared, mutable `this.pulledPos`, which is a latent aliasing bug for any future async subscriber. Remove it (and the `gridToWorld` call) or pass a copy.
    - `SculptureMesher.build` allocates 5 growable `number[]` per rebuild (up to 3 per frame). Reuse typed scratch buffers.

11. **Level data validation gaps.**
    - `compact-level.mjs:38` accepts colors 0–254, but the palette only has 0–30 minus 14 and 17. Those slip through and throw at runtime (which leads to #2).
    - The compactor doesn't check `GridSize ≤ 255` per axis or `LineCount > 0`.
    - `s.SecondColor !== -1` rejects shooters where the field is absent (`undefined`).
    - `LevelDecoder` trusts the compactor completely: an ammo-0 hive would make `consumeAmmo` throw inside `update`.
    - Fix: validate against the `GAME_COLOR_HEX` keys and the size limits in the compactor; add cheap asserts in `decodeLevel` (ammo > 0, line in range).

12. **TargetSelector.ts:5-6, 42-45 — the sort-key packing can overflow on big grids.** Keys are packed assuming every rotated offset rounds into ±127. `VoxelGrid` allows up to 255 per axis, and a rotated offset can reach about √3 × half-extent, so grids above ~146 per axis would silently mis-order targets. Teddy (23×25×19) is fine. Add an assert in the constructor.

13. **The level's default rotation is ignored.**
    - `defaultRotation` (teddy `rot = [45,0,0]`) is decoded but never used; the `initialTilt` of 25 replaces it.
    - `origin` is emitted by the compactor but never decoded.
    - If the editor's default view matters, convert it (left-handed → right-handed) and apply it; otherwise drop both fields.

14. **GameInputRouter.ts:59-89 — touch moves and touch ends aren't filtered by touch ID.**
    - A second finger's move adds to the rotation delta.
    - A second finger's touch-end ends the drag, or registers a tap at the second finger's position.
    - Fix: store the tracked ID in `onTouchStart` and ignore other IDs in move and end.

15. **BeeGameBootstrap.ts:171 — subscription after destroy.** If the component is destroyed while `boot()` is still awaiting assets (e.g. a scene reload during loading), boot resumes and subscribes after `onDestroy` already ran. That subscription leaks. Guard with `if (!this.isValid) return;` after the `await`.

### Files over 200 lines (project rule)
- `presentation/bee/BeeSwarm.ts` (277): move the bee/cube pool (`acquireBee`, `acquireCube`, `release`) into `BeeSwarmPool.ts`, and the launch-path builder (lines 84-115) into `BeeLaunchPathBuilder.ts`.
- `BeeGameBootstrap.ts` (216): move asset loading plus `buildPalette` into `infrastructure/BeeAssetLoader.ts`, and `frameWorld` into `presentation/WorldFramer.ts`.
- `application/GameplayController.ts` (215): move `checkOutcome`, `hasUnreservedTarget` and `setHint` into `application/GameOutcomeMonitor.ts`.

### Test suggestions
- Add the brute-force equivalence fuzz to the suite. It is strictly stronger than the current monotonic and trace tests.
- The fire-loop accounting (reserve → launch → consumeAmmo; the cap) is only covered by the headless autoplay. A pure `FireScheduler` in the domain layer would make the cap starvation in #4 unit-testable.

## Checked and found OK (with evidence)
- **Solver and path trace:** results match brute force exactly. Traces only pass through empty cells, use ≤ maxTurns corners, every turn is 90°, and the exit direction is in the mask. A stale cost field is still safe to trace after removals. 2-point paths work in `BeeSwarm.launch`: `last = 3` gives runway → exit cell → hover.
- **Reservations:** set at launch and cleared only in `onGrab`. Every bee reaches GRAB deterministically (there is no abort path), so reservations can't leak. Two hives of the same color can't both target one cube. The selector is always rebuilt right after a solve and on view changes, so the `selected unreachable cube` throw at line 145 can't happen.
- **Ammo vs. cubes:** the compactor enforces per-color equality. A hive freeing its slot while its bees are still pending is covered, because `pendingGrabs` is part of the lose rule.
- **Lose / win:**
  - No false win.
  - No false lose: with `pendingGrabs === 0` no cube is reserved, and the omni solver is re-solved whenever the grid version changes.
  - The all-directions omni mask is valid with the default camera (z = 16, no pitch): the tilt range [-60°, 75°] plus free yaw lets each of the 6 directions face the camera at ≥ 0.3 (−Y at −60° tilt gives ~0.93).
  - Caveat: if the dashboard pitches `MainCamera` steeply, the omni check becomes optimistic. The result would be a softlock, not a false lose.
- **No softlock with free slots:** given ammo == cubes per color, once the lines are empty the outermost cube is always reachable from some angle and its hive must be active.
- **GameTime:** used consistently inside `BeeSwarm` and the fire loop. Pooled bee fields are reset on launch. Every SignalBus subscribe has a matching unsubscribe in `onDestroy`.

### Score: 7.5/10
The core logic (solver, reservations, rules) is solid and checked against brute force. The issues are lifecycle and visual problems plus one throughput issue (#4).

### Unresolved questions
- Is ignoring the level's `defaultRotation` [45,0,0] intentional (#13)?
- Should the dashboard be allowed to pitch the camera? If so, the omni lose check needs to use the directions actually reachable with the rotator's limits.
