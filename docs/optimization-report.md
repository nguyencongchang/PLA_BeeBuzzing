# Bee Cube — Optimization Report

All numbers are measured, not estimated. Runtime numbers are from headless Chrome
(ANGLE/Metal, Apple M1) driving the **built single HTML** with an autoplay bot that taps a
hive every 350 ms while a slot is free.

## Result

| Metric | Value |
|---|---|
| Single-HTML playable (AppLovin, Unity, IronSource, Facebook, Moloco…) | **1.66 MB** |
| ZIP playables (Google, Mintegral, TikTok, Vungle, Pangle…) | **1.16 – 1.21 MB** |
| Level completion (autoplay) | **53.9 s** (88 taps) — requirement 30–60 s |
| Frame rate at peak (~100 bees in flight, 80 draw calls, ~100k tris) | **60 FPS**, JS frame tick 3.4 ms avg |

## Build size

| Step | Before | After | How |
|---|---|---|---|
| Level data | 780 KB raw editor JSON | **15.5 KB** (1.9 KB gzip) | `tools/level-compactor`: dense `Uint8Array` grid (color+1) as base64 + `[line, color, ammo]` hives. Validates bounds, palette, Σammo == cubes per color |
| Sprites (6 PNG) | 435 KB | **115 KB** | `tools/asset-optimizer`: libvips palette quantization (q85) in place, metas kept |
| Audio (5 clips) | 289 KB | **133 KB** | ffmpeg mono, 24–32 kHz; BGM 28 kbps, SFX 48–56 kbps |
| Engine modules | physics (bullet), physics-2d (box2d), spine 3.8, dragon-bones, tiled-map, terrain, light-probe, particle-2d, marionette, skeletal-animation, profiler, meshopt enabled | stripped | bullet asm.js 994 KB + box2d 411 KB + spine 381 KB alone ≈ 1.8 MB before base64 |
| Graphics backend | WebGL1 + WebGL2 | WebGL1 only | 1.85 → 1.82 MB, and **33 → 51 FPS** at peak (WebGL2 path was slower for many small instanced draws) |
| super-html JS obfuscation | on (hard-coded default) | **off** (`ci/repack-super-html.cjs`) | 1.82 → **1.74 MB** (1.66 MiB) and the decisive perf fix below |
| Sculpture rendering | — | no texture | Colors are vertex colors; bevel look is a shader edge term, so the 4003-cube model ships zero texture bytes |
| HUD | — | no texture | Progress bar, X2 button, trays drawn with `Graphics` |

## Runtime performance

| Problem | Fix | Effect |
|---|---|---|
| 4003 cubes as nodes would mean 4003 transforms + draw batches | 36 chunk meshes (8³), only faces next to empty cells are emitted; rotation moves one node | Sculpture costs ~0.4 ms/frame incl. rebuilds |
| "Which cubes can a bee pull out?" for every target every shot | One reverse layered 0-1 BFS over 65 550 (cell, direction) states, zero allocations, re-solved ≤ 10×/s (removal is monotonic → stale data is safe) | 1.0 ms in Node, 1.6 ms in the browser |
| ~100+ bees and carried cubes | Pooled plain nodes, one update loop (no per-bee component), shared instanced materials (`USE_INSTANCING`), procedural wing flap instead of skeletal animation | ~80 draw calls for ~500 instances; swarm update 0.6 ms |
| **super-html obfuscation** (string-array transform) routed every property access through a decoder call | Re-pack without obfuscation, keep minification | Solver **76 ms → 1.6 ms**, frame tick **97 ms → 3.4 ms**, **~25 → 60 FPS** |
| Backdrop / labels re-laid out every frame | Re-layout only when projection changes; labels only rewrite their string when ammo changes | Backdrop 0.01 ms, labels 0.04 ms |

## How it was measured

- Sizes: `ls` on `build/super-html/**` after `./ci/build-cocos.sh`.
- Per-component frame cost: wrapping `director.tick`, `GameplayController.update`,
  `BeeSwarm.update`, `SculptureView.lateUpdate`, … in the built page and averaging over
  ~200 frames at peak bee count.
- Solver speed: `tools/game-logic-tests` (`npm test` prints the average solve time) and an
  in-page timing of `solver.solve()` on the built HTML.

## Known limits

- The lose check assumes the player can turn every face toward the camera (true for the
  default camera and the −60°…75° tilt range). If the dashboard pitches the camera steeply,
  the check becomes optimistic (it would never declare a false loss, but could wait forever).
- The level's editor `DefaultRotation` is not applied; the initial view is the
  `InitialTilt` dashboard parameter (25°), tuned by eye for the portrait layout.
