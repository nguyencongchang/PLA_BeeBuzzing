# Bee Cube — Gameplay Architecture

Playable ad (Cocos Creator 3.8.7): bees from hives pull colored voxel cubes out of a
rotating 3D sculpture (teddy level, 4003 cubes, 88 hives, 13 colors).

## Layers

```
assets/scripts/game/
  domain/          Pure TS, no 'cc' import → unit-tested in Node
    VoxelGrid            dense Uint8Array grid (color+1, 0 = empty), cached xyz per index
    GridDirections       6 axis dirs; opposite = d^1, axis = d>>1
    ReachabilitySolver   "can a bee pull this cube out?" for every cube in one pass
    TargetSelector       per-color priority lists: highest → closest → right-most
    HiveBoard            5 hive queues + N slots, tap / ammo rules
    GameRules            win / true-deadlock lose
  application/     GameplayController (fire loop, reservations, outcome), GameTime (x2),
                   GameplayConfig (+ dashboard binding), GameplaySignals (SignalBus events)
  infrastructure/  LevelDecoder (compact level), ResourceLoader, GamePalette
  presentation/    sculpture/ (mesher, view, rotator, view math), bee/ (swarm, flight path),
                   hive/ (board view, layout), input/, rendering/ (materials, model kit), hud/
  BeeGameBootstrap Loads resources/bee/*, builds the world at runtime, forwards the outcome
                   to the template GameView (Win/Lose end cards + CTA)
```

`BeeGameBootstrap` attaches itself to the launched scene (`Director.EVENT_AFTER_SCENE_LAUNCH`)
unless the scene already contains one, so MainScene needs no manual wiring.

## Reachability (pathfinding)

Rule: a bee leaves the target through a face, flies straight through empty cells, may turn
90° at most `maxTurns` times, and must leave the grid **heading toward the camera** (the
camera-facing direction set is recomputed from the sculpture rotation, `dot ≥ 0.3`).

Instead of one search per target, a **reverse layered 0-1 BFS** computes for every
`(cell, direction)` the minimum turns needed to escape:

```
h(p, e) = 0                                     if p+e is outside the grid and e faces the camera
h(p, e) = min(h(q, e), 1 + min_{d ⊥ e} h(q, d)) if q = p+e is inside and empty
cube t reachable  ⇔  min_e h(t, e) ≤ maxTurns
```

- 23×25×19 grid × 6 dirs = 65 550 states, ~1 ms per solve, zero allocations.
- Removing cubes only opens paths (monotonic, fuzz-tested), so a stale solve is always safe:
  the controller re-solves at most 10×/s while cubes are removed, and immediately when the
  camera-facing mask changes.
- `tracePath` walks the cost field to produce the corner list the bee animation follows.
- Lose uses a second "omni" solve (all 6 directions are exits): the game is only lost when
  rotating could not help either.

## Rendering

- **Sculpture**: 36 chunk meshes (8³ cells), only faces next to an empty cell are emitted,
  palette color baked per vertex, edge darkening in the shader. Rotation moves one node.
  A removal rebuilds 1–2 chunks (budget 3 per frame).
- **Bees / flying cubes**: plain nodes sharing instanced materials (`voxel-lit.effect`,
  `USE_INSTANCING`), pooled, driven by one update loop (no per-bee component). Wings flap
  procedurally on hinge pivots — the FBX ships no animation clip.
- Flight: slot → quadratic-Bezier arc bulging outward (streams fan out like a fountain) →
  solver escape route in reverse → grab → pull → carry back out → Bezier arc home into the
  hanging hive's entrance (top center), shrinking into the hole. The entrance is a BG-canvas
  sprite projected into the 3D board plane (`BoardBackdrop.hiveEntrance`).
- Flight paths are stored in sculpture-local space and evaluated through the current world
  matrix (lengths in world units via the sculpture scale), so bees keep tracking their cube
  while the player rotates the model.

## Gameplay loop

`tap line → HiveBoard.tap → slot → every fireInterval: TargetSelector.next(color) → reserve
cube → BeeSwarm.launch(path) → grab: grid.remove + chunk rebuild → GameRules`.
Every bullet maps to exactly one cube (validated by the level compactor: Σammo per color ==
cubes per color), and reservations prevent two bees from targeting the same cube.

## Tests

`cd CocosPLA_BeeBuzzing/tools/game-logic-tests && npm install && npm test` — solver rules,
monotonicity fuzz, path validity, selector order, board, rules, and a greedy bot that solves
the shipped teddy level with 5 slots. `npm run typecheck` type-checks the whole project.
