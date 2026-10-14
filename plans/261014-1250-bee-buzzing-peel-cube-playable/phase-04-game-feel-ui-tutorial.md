# Phase 4 — Game Feel, UI/UX, Tutorial, End Card (D4 morning)

## Overview
Priority: P1 (bonus points — cuttable). Status: pending. Depends: Phase 3.

## Items (in priority order; stop when time runs out)
1. **Background/UI**: `Dark BG 01` tiled + gradient, `Bottom Leaf` hanging decoration, `Layer 02/03` hanging hives; `Slot.png` slots; progress bar (`ProgressBarComponent` prefab) showing % removed; X2 SPEED button (on/off state).
2. **Tutorial**: hand (`hand.png`, `FingerTutorial`) on the first line's front hive → after the first tap, the hand disappears; on the first `RotateHintSignal` → "Drag to rotate" hint + swipe hand. Idle 4s → show the tap hint again.
3. **Juice**: pluck pop (scale punch + small particle in the cube's color), hive jump squash/stretch, tap on a full slot → shake, light camera shake when a hive runs out of ammo, confetti on win.
4. **Audio**: BGM after the first touch (existing `PlayableHelper`), `shoot` per bee (throttled ≤ 15/s), pluck, hive jump, win/lose. Add the names to `Constant.AUDIO_NAME`.
5. **End cards**: Win/Lose views already exist (`EndCardView`) → swap in the game's art; CTA → `CTAService` (set the real store link in `Constant.SRORE_LINK` → `com.artoon.bee.buzz.pixel.puzzle`).
6. Fix the dangling `@property` decorator in `GameView.ts` (the "Enable tutorial" tooltip is attached to `loadingView`).

## Success Criteria
- A first-time player understands tap → bees fly without explanation; rotating has a hint.
- Audio does not spam; no frame drops from particles (pool them).

## Risk Assessment
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| Running out of time | 4 | 2 | 8 | Order items by priority, cut from the bottom |
| Particles/audio cost FPS | 2 | 3 | 6 | Pool + throttle |

## Timeline
| Task | Effort |
|---|---|
| UI + tutorial | 2h |
| Juice + audio + end card | 2h |
