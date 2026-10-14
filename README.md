# Bee Cube — Playable Ad (Cocos Creator 3.8.7)

A "peel the cube" playable: tap a hive, it jumps into a slot and fires bees that pull
same-colored cubes out of a slowly rotating 3D voxel sculpture (teddy, 4003 cubes).
Hidden inner layers open up as the outside is peeled away. Drag to rotate the sculpture,
X2 SPEED to speed up. Win = every cube removed; lose = every slot taken by hives that can
no longer reach any cube from any angle. Win / Lose / CTA open the store.

## Run

1. Open `CocosPLA_BeeBuzzing/` with Cocos Creator **3.8.7**, open `assets/scene/MainScene`.
2. Press Preview. The gameplay boots itself (`assets/scripts/game/BeeGameBootstrap.ts`).

## Build (single HTML per ad network)

Close the editor, then:

```bash
./ci/build-cocos.sh
```

Outputs `CocosPLA_BeeBuzzing/build/super-html/**` (single-file HTML / ZIP per network).

## Tests

```bash
cd CocosPLA_BeeBuzzing/tools/game-logic-tests && npm install && npm test && npm run typecheck
```

## Tools

| Tool | Purpose |
|---|---|
| `tools/level-compactor` | Raw editor level JSON (780 KB) → validated compact level (15.5 KB) |
| `tools/asset-optimizer` | Palette-quantizes PNG sprites in place (keeps Cocos meta uuids) |
| `tools/optimize-size` | Post-build size analyzer (template) |

## Docs

- [Gameplay architecture](docs/bee-cube-architecture.md) — layers, pathfinding, rendering
- [Optimization report](docs/optimization-report.md) — build size and runtime performance
- [Template guide](CocosPLA_BeeBuzzing/README.md) — parameter system, SDK adapters, CTA
