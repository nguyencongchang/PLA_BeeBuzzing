# Phase 5 — Build, Size Optimization, Write-up, Submit (D4 afternoon)

## Overview
Priority: P0 (required to "build and optimize file size, and present how it was optimized"). Status: pending.

## Steps
1. **Parameters** (`PlayableConfig.ts`, new `Gameplay` category + wiring in `ParameterController`): SlotCount, FireInterval, BeeSpeed, MaxTurns (K), CameraFacingThreshold (τ), AutoRotateSpeed, X2ButtonEnable. ConfigWatcher regenerates `playable-config.json`.
2. **Size optimization** (measure before/after each step, record the numbers):
   - Level JSON 780KB → compact base64 (~15KB).
   - `settings/v2/packages/engine.json`: strip unused modules (physics 2D/3D, spine, dragonbones, terrain, particle-2d, tiled-map, video, webview, xr, marionette if unused...).
   - Textures: resize to their actual display size, compress PNG (pngquant/tinypng), remove unused template images.
   - FBX: drop unused animation, mesh compression/quantize in the import settings, remove the missing `Bee Smile.png` texture slot.
   - Audio: mono, low bitrate mp3/ogg, trim.
   - Font: subset or use a bitmap/system font if `LilitaOne/Baloo` are heavy.
   - Analyze with `tools/optimize-size` (localhost:3456) → screenshot for the write-up.
3. **Build**: web-mobile → single HTML (the template's existing pipeline/Jenkins `cfgTemplate.json`); test in mobile Chrome + iOS Safari, network-style iframe, portrait 1080×1920 + other aspect ratios.
4. **Performance pass**: profiler on a real device — draw calls, FPS with peak bee count, GC spikes (no allocations in tick loops).
5. **Write-up** `docs/optimization-report.md` (+ export .doc/.pdf to submit): architecture, reachability algorithm, render strategy (chunk mesh, instancing), before/after size table, perf numbers.
6. **Submit**: README (how to run/build), make the repo public, zip source + HTML build + write-up → email. Check that the `.docx` brief/PDF are **not** in the repo.

## Success Criteria
- Single HTML ≤ 5MB (target ≤ 3MB), works offline, CTA opens the store.
- Write-up has real before/after numbers.
- Commit history shows steady progress over the 4 days.

## Risk Assessment
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| Stripping engine modules breaks the build | 2 | 4 | 8 | Strip one at a time, build-test |
| Single-HTML inline step fails | 2 | 4 | 8 | Use the template's existing tool; build-test from D3 evening |
| Not enough time to test on a real device | 3 | 3 | 9 | Test on a real device as early as end of D2 |

## Timeline
| Task | Effort |
|---|---|
| Params | 1h |
| Size + build + test | 2.5h |
| Write-up + submit | 1h |
