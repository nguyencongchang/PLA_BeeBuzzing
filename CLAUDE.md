# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cocos Creator 3.8.7 template for building **Playable Ads** (HTML5 interactive ads) targeting multiple ad networks. The game runs inside an iframe, receives parameter updates from the ad dashboard via `postMessage`, and redirects to the app store on CTA click.

## Repository Structure

This is a monorepo with 5 git submodules:

| Path | Purpose |
|------|---------|
| `CocosPlayableAdsTemplate/` | Main Cocos Creator project |
| `CocosPlayableAdsTemplate/assets/PLAGameFoundation/` | Shared game framework (SignalBus, AudioService, InputService, ObjectPool, FSM, AsyncTask) |
| `CocosPlayableAdsTemplate/assets/PlayableParamterTool/` | Parameter system & SDK abstraction (TCMPlay, Voodoo) |
| `CocosPlayableAdsTemplate/tools/optimize-size/` | Post-build file size analyzer (Express app on port 3456) |
| `ConfigPath/` | Jenkins build config templates with placeholder tokens |

**Note:** `PlayableParamterTool` has a typo in the name ("Paramter") - this is intentional for backward compatibility.

## Build & Development

**No CLI build commands exist.** Building is done through Cocos Creator 3.8.7 Editor GUI.

```bash
# Initial project setup (Windows, run as admin)
SetupProject.bat   # Renames project, re-adds submodules, npm install

# Size analysis tool (after building)
cd CocosPlayableAdsTemplate/tools/optimize-size && npm start
# Opens http://localhost:3456

# Jenkins CI (automated)
# Jenkinsfile/Cocos contains: cocos(this)
# Uses cfgTemplate.json / cfgAndroidTemplate.json with placeholder tokens
```

**No linting, no test suite, no TypeScript compilation CLI** - all compilation happens inside the Cocos Editor.

**TypeScript config:** ES2017 target, `strict: false`, extends Cocos-generated `temp/tsconfig.cocos.json`.

**Dependencies:** Only `bytebrew-web-sdk` (analytics) and `@types/node`.

## Architecture

### Parameter System (Core Innovation)

The entire template revolves around a **TypeScript-first parameter system** that auto-generates `playable-config.json` for the ad dashboard:

1. **`PlayableConfig.ts`** - Single source of truth for all configurable parameters (camera, CTA buttons, loading screen, tutorial, volumes, end cards)
2. **`ConfigWatcher`** (editor-only) - Auto-generates `ParameterToolBuild/playable-config.json` on save
3. **At runtime:** SDK sends parameter values via `postMessage` -> `BaseSdkAdapter.onParameterUpdated` -> `PlayableParameterUpdates` updates config -> each parameter's `onUpdate` callback applies to scene nodes
4. **`ParametersReadySignal`** fires after all parameters initialize (LoadingView waits for this)

**Parameter type hierarchy:**
```
NodeParameter (position, rotation, scale)
  └── UINodeParameter (+enable, contentSize)
       ├── SpriteParameter (+spriteFrame, color)
       │    └── ButtonParameter (+label fields with "label" prefix)
       └── LabelParameter (+string, color, fontSize, outline, shadow)
CameraParameter extends NodeParameter (+fov)
RedirectParameter (active, count)
```

### SDK Abstraction

`SdkFactory` + `BaseSdkAdapter` pattern. SDK selection via `CURRENT_SDK` constant in `PlayableConfig.ts`:
- `SdkType.THE_ONE` - TCMPlay platform (default; legacy identifier retained for SDK compatibility)
- `SdkType.VOODOO` - Voodoo ad network

### Game Flow

`GameView` (singleton Cocos Component) manages: **Loading -> FTUE -> Gameplay -> Win/Lose**

- `LoadingView` - Progress bar + fade out, waits for `AllAsyncParametersReadySignal`
- `WinView` / `LoseView` - Extend `EndCardView` (abstract), play audio + CTA
- `PlayableHelper` - First touch -> play BGM; optional redirect-after-N-clicks
- `CTAService` - Routes CTA click to correct store link via `DetectPlatform` (iOS/Android)

### Framework Patterns (PLAGameFoundation)

- **SignalBus** - Typed pub/sub singleton. Signals are plain TS classes. Supports `waitFor()`.
- **AudioService** - Singleton, uses ObjectPool of AudioEmitter prefabs. Audio clips loaded from `resources/audio/` by name.
- **InputService** - Cocos Component, fires `TapSignal`, `SwipeSignal`, `DragSignal`, `FirstInteractionSignal`
- **GameLifecycleManager** - Manages Update/LateUpdate/FixedUpdate for objects implementing `ITickable`/`ILateTickable`/`IFixedTickable`. Use `@RegisterLifecycle()` decorator.
- **StateManager** - Generic FSM with `changeState<T>()` and type-safe `StateConstructor<T>`
- **ObjectPoolManager** - Static singleton, Spawn/Recycle pattern for prefabs
- **AsyncTask** - Promise utilities: `Delay`, `WaitUntil`, `WhenAll`, `Retry`

### Asset Conventions

- **`resources/`** - Runtime-loaded assets (`resources.load()`). Audio, fonts, prefabs here.
- **`game-assets/`** - Static art (sprites, effects, materials, VFX). Referenced directly in scene.
- **`ParameterToolBuild/`** - Auto-generated. **Never edit manually.**
- **Single scene:** `scene/MainScene.scene`
- **Design resolution:** 1080x1920, fitHeight mode

## Key Patterns to Follow

### Adding a New Parameter

1. Define the parameter in `PlayableConfig.ts` using existing types (`ObjectParameter<SpriteParameter>`, `RangeParameter`, `ColorParameter`, etc.)
2. Add to appropriate category in `Categories` const
3. Wire `onUpdate` callback in `ParameterController.SetUpOnUpdate()` using `ParameterUtils` helpers (`applyNodeParams`, `applySpriteParams`, `applyLabelParams`, `applyButtonParams`)
4. `ConfigWatcher` auto-regenerates `playable-config.json` on save in editor

### Adding Audio

1. Place audio file in `CocosPlayableAdsTemplate/assets/resources/audio/`
2. Add name constant to `constant/constant.ts` -> `AUDIO_NAME`
3. Play via `AudioService.instance.playMusic(name)` or `AudioService.instance.playSFX(name)`

### Cocos Import Paths

Use `db://` protocol for cross-submodule imports:
```typescript
import { SignalBus } from "db://assets/PLAGameFoundation/signalBus/SignalBus";
import { SdkType } from "db://assets/PlayableParamterTool/GameConfig";
import { CTAService } from "db://assets/scripts/services/cta/CTAService";
```

### Store Links

Configure in `constant/constant.ts` -> `STORE_LINK.ANDROID_LINK` / `STORE_LINK.IOS_LINK`. `CTAService` and `DetectPlatform` route to the correct link based on user agent.

## ClickUp

- Workspace: TCMPlay
- Project tracking list: TBD
