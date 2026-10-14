# Phase 2 — Sculpture Render + Rotation + Hive Board (D2)

## Overview
Priority: P0. Status: pending. Depends: Phase 1 (VoxelGrid, HiveBoard, LevelLoader).
Render 4003 cubes cheaply, let the player rotate them, and lay out the hive lines + slots with tap interaction.

## Requirements
- Sculpture ≤ ~40 draw calls, rotation at 60fps on mid Android WebView.
- Idle auto-rotate (slow yaw), drag to rotate (yaw + clamped pitch ±60°), inertia, resume auto-rotate after 2s idle.
- 5 hive lines at the bottom, front hive tappable; 5 hexagon slots (`Slot.png`) above them.

## Architecture
- `infrastructure/LevelLoader.ts` — `@property(JsonAsset)` → decode base64 → `VoxelGrid` + `HiveSpec[]`.
- `presentation/sculpture/SculptureMesher.ts` — chunk 8×8×8 (3×4×3 = 36 chunks). Per chunk: emit a quad for each face of an alive cube whose neighbor is empty; vertex color = palette; UV 0..1 per face for the edge/bevel texture. Build with `utils.createMesh` / `Mesh.reset` with dynamic buffers (preallocate per-chunk max).
- `presentation/sculpture/SculptureView.ts` — owns chunk MeshRenderers under `SculptureRoot`; `markDirty(x,y,z)` (also neighbour chunk when on a border); rebuilds **≤ 2 chunks per frame**. Exposes `cellToWorld(idx)`, `rotationMatrix()` for the selector/solver.
- `presentation/sculpture/SculptureRotator.ts` — handles drag, emits `SculptureRotatedSignal(settled:boolean)`. DefaultRotation x=45° from level.
- Voxel material: copy `bee-master.effect` → `voxel-toon.effect` + add `a_color` vertex color multiply (same toon look as bees) **or** a light lambert+edge-texture effect if the TCP2 port is too heavy — decide by testing FPS.
- `presentation/hive/HiveBoardView.ts` — 5 columns, hive `hive-hexa.fbx` tinted by color with an ammo label; shift the queue forward when the front leaves (tween).
- `presentation/hive/SlotView.ts` — slot positions; active hive jumps in (arc tween + squash).
- Input zones: bottom ~30% of the screen = hive taps (raycast or 2D UI buttons); everything else = drag-rotate. Tap vs drag threshold 10px.
- Camera: perspective, framed so the 23×25×19 grid × 0.2 fits (≈5×5 units) in the upper ~60% of 1080×1920.

## Steps
1. LevelLoader + scene node structure (`SculptureRoot`, `HiveBoard`, `Slots`, `UI`).
2. Mesher + view; verify cube count/faces, draw calls in the profiler.
3. Rotator + input zones.
4. HiveBoard view + slots + tap → `HiveBoard.tap()` (no firing yet).
5. Debug overlay toggle: tint reachable cubes (call the Phase 1 solver with the current rotation) — the main visual check that reachability is correct.

## Success Criteria
- Teddy renders correctly (compare with DefaultRotation in the source game), smooth rotation.
- `grid.remove()` called from a debug key → the cube disappears, chunk rebuild < 2ms.
- Tapping a hive moves it into a slot; with all 5 slots full, taps are rejected (shake feedback).

## Risk Assessment
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| Dynamic mesh API 3.8.7 (reset/update buffers) cumbersome | 3 | 3 | 9 | Fallback: rebuild with `utils.createMesh` + swap mesh per chunk (only 1–2 chunks/frame) |
| TCP2 toon effect too heavy on 36 chunks | 2 | 3 | 6 | Light lambert variant for voxels |
| Bevel look lost when merging the mesh | 3 | 2 | 6 | Edge-darkening texture/UV per face + vertex AO |

## Timeline
| Task | Effort |
|---|---|
| Loader + mesher + view | 4h |
| Rotator + input | 1.5h |
| Hive board + slots | 2.5h |
