# Cocos Playable Ads Template

Template dự án **Cocos Creator 3.8.7** để phát triển Playable Ads HTML5 cho nhiều ad networks.

---

## Cấu Trúc Tổng Quan

```
CocosPlayableAdsTemplate/
├── assets/                         # Game assets và scripts
│   ├── scripts/                    # Code game (project-specific)
│   ├── PLAGameFoundation/          # Framework core (git submodule)
│   ├── PlayableParamterTool/       # Parameter & SDK tool (git submodule)
│   ├── packages/                   # Packages bổ sung
│   ├── game-assets/                # Assets game (sprites, 3D, effects)
│   ├── resources/                  # Audio, fonts, prefabs
│   ├── scene/                      # Scenes
│   └── ParameterToolBuild/         # Parameter tool build configs
├── build/                          # Output builds
├── extensions/                     # Super HTML extension
├── tools/                          # Tool optimize file size
├── library/                        # Cache assets (auto-generated)
├── profiles/                       # Build profiles
├── settings/                       # Editor settings
└── temp/                           # Files tạm
```

---

## 1. Assets Scripts (Project Code)

```
assets/scripts/
├── [Name-Project]/                 # Thư mục code cho project cụ thể
│                                   # (Đổi tên theo tên project)
│
├── constant/
│   └── constant.ts                 # Constants (audio names, store links)
│
├── parameter/                      # Hệ thống parameter
│   ├── config/
│   │   ├── PlayableConfig.ts       # Central config - TẤT CẢ parameters
│   │   ├── CustomParameter.ts      # Custom parameter types
│   │   └── ParameterConfig.ts      # Parameter registry
│   ├── ParameterController.ts      # Logic điều khiển parameter
│   ├── ParameterManager.ts         # Quản lý SDK parameters
│   ├── ParameterRegister.ts        # Đăng ký parameters
│   └── ParameterUtils.ts           # Utility functions
│
├── services/
│   └── cta/
│       └── CTAService.ts           # Call-to-Action (redirect store)
│
├── UI/
│   ├── GameViewComponents/         # Components cho GameView
│   ├── GameView.ts                 # Game state manager (SINGLETON)
│   ├── EndCardView.ts              # End card
│   ├── LoadingView.ts              # Loading screen
│   ├── WinView.ts                  # Win screen
│   ├── LoseView.ts                 # Lose screen
│   └── HighlightOverlay.ts         # UI overlay effects
│
├── PlayableHelper.ts               # Core playable ads logic
└── UIScreenResolution.ts           # UI resolution scaling
```

### Mô tả chi tiết:

**[Name-Project]/**
- Thư mục chứa code game cụ thể
- Đổi tên theo tên project (ví dụ: `MergeGame/`, `ShootingGame/`)

**constant/**
- `constant.ts`: Chứa constants (tên audio, store links, config values)

**parameter/**
- `PlayableConfig.ts`: Central config chứa TẤT CẢ parameters
- `CustomParameter.ts`: Định nghĩa parameter types (NodeParameter, LabelParameter, SpriteParameter, ButtonParameter, CameraParameter)
- `ParameterConfig.ts`: Parameter registry
- `ParameterController.ts`: Logic điều khiển parameter
- `ParameterManager.ts`: Quản lý SDK parameters
- `ParameterRegister.ts`: Đăng ký parameters
- `ParameterUtils.ts`: Utility functions để apply parameters

**services/cta/**
- `CTAService.ts`: Xử lý CTA click và redirect store

**UI/**
- `GameView.ts`: Game state manager (singleton)
- `EndCardView.ts`, `LoadingView.ts`, `WinView.ts`, `LoseView.ts`: UI screens
- `GameViewComponents/`: Components cho GameView
- `HighlightOverlay.ts`: UI overlay effects

**Root files:**
- `PlayableHelper.ts`: Core playable ads logic (auto-play BGM, redirect counting)
- `UIScreenResolution.ts`: UI resolution scaling

---