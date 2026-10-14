---
title: Bee Buzzing — Peel the Cube Playable (Cocos 3.8.7)
status: done
created: 2026-10-14
branch: main
deadline: 4 ngày kể từ khi nhận test (iKame Technical Test V4.0)
---

# Bee Buzzing — Peel the Cube Playable

Playable ad 3D: ong từ tổ bắn/gỡ dần các ô voxel màu khỏi mô hình lớn đang xoay.
Dựng trên template sẵn có (`CocosPLA_BeeBuzzing/`): GameView flow, CTAService, Parameter system, PLAGameFoundation.

## Input assets (`~/Downloads/Bee Game Asset/`) — đã kiểm tra
| Asset | Nội dung thực tế | Hệ quả cho plan |
|---|---|---|
| `LevelData/Marketing_teddy_burgundy.json` (780KB) | Grid 23×25×19, CellSize 0.2, DefaultRotation x=45°, **4003 cube** (1378 bề mặt / 2625 bên trong), 13 màu, Health=1 hết; **88 shooter** trong `LineCount=5` hàng, ammo 4–80; tổng ammo/màu == số cube/màu (khớp tuyệt đối) | Không cần .vox converter. Cần **compact level** (780KB → ~15KB). 4003 cube ⇒ **không thể 1 node/cube** → chunked mesh |
| `BoxyBlast_Cube_Colors.pdf` | Palette enum 0–30 (bỏ 14, 17), hex chuẩn | `GamePalette.ts` đúng index enum |
| `Shaders/bee-master.effect` | Toon (TCP2 port) + outline, **không có instancing / vertex color** | Dùng cho ong/tổ; cần biến thể voxel (vertex color) cho sculpture |
| `FBXs/Bee_2.fbx` | Ong + anim `Take 001`, tham chiếu texture `Bee Smile.png` **không có trong folder** | Hỏi lại texture hoặc dùng màu flat |
| `FBXs/bee-cube-2.fbx`, `hive-hexa.fbx` | Mesh cube bevel (ô bay) + tổ lục giác | Cube bay + hive 3D |
| `Sprites/` | `Slot.png` (lục giác), `Layer 02/03.png` (tổ ong treo), `Bottom Leaf.png` (lá trang trí), `Dark BG 01.png` | UI slot + nền |

Shooter đặc biệt (`IsMystery`, `FrozenAmmo`, `Tunnel`, `SecondColor`, `ConnectionGroup`) **đều rỗng** trong level này → không implement (YAGNI); loader assert + warn nếu gặp.

## Decisions
| Topic | Chốt |
|---|---|
| Scope | 1 màn — teddy (data được giao), 30–60s hoàn thành |
| Level data | Dùng JSON được giao → tool nén sang compact format lúc build |
| Art | FBX được giao (primitive placeholder chỉ khi import lỗi) |
| CTA flow | Win/Lose → end card; CTA luôn hiện; redirect-after-N-clicks có sẵn |

## Key technical calls
1. **Sculpture = chunked face-culled mesh** (chunk 8³, chỉ sinh mặt kề ô trống, vertex color = palette). Xoay = xoay 1 node cha → 0 chi phí/cube. Remove → rebuild chunk dirty, tối đa 1 lần/frame.
2. **Reachability = reverse 0-1 BFS** trên grid padded (state = ô × 6 hướng, cost = số lần rẽ 90°), tính 1 lần cho mọi ô. Gỡ cube chỉ *mở thêm* đường (monotonic) → dữ liệu cũ luôn an toàn ⇒ recompute lười (≤ 10Hz) + khi xoay xong.
3. **Throughput**: 4003 cube / ~45s ≈ 90 cube/s ⇒ fire interval rất ngắn, ~60–120 ong cùng lúc ⇒ ong + cube bay dùng pool + GPU instancing, chuyển động tick-driven (không `tween` từng con) để X2 speed scale dt.

## Architecture (domain không import `cc` → test bằng Node)
```
assets/scripts/game/
  domain/          VoxelGrid, Direction, ReachabilitySolver, TargetSelector, HiveBoard, GameRules, LevelTypes
  application/     GameplayController, GameTime (x2), GameplaySignals
  presentation/    SculptureMesher/View/Rotator, HiveBoardView/HiveView/SlotView, BeeSwarm, HUD
  infrastructure/  LevelLoader (compact → LevelData), GamePalette
tools/level-compactor/   JSON → compact (.bin base64/JSON nhỏ) + validator (auto-play solver)
tools/game-logic-tests/  vitest cho domain/
```
Flow: `tap hive → HiveBoard.moveToSlot → fire tick → TargetSelector(reachable ∩ màu ∩ !reserved) → reserve → Bee in → grab → pull → out → VoxelGrid.remove → mesher dirty + solver dirty → GameRules`.

## Phases (4 ngày)
| # | Phase | Ngày | Effort | Depends | Status |
|---|---|---|---|---|---|
| 1 | [Setup + level data + domain core + tests](phase-01-setup-level-domain-core.md) | D1 | M | – | done |
| 2 | [Sculpture render + rotation + hive board](phase-02-sculpture-render-hive-board.md) | D2 | M | 1 | done |
| 3 | [Bee swarm, firing loop, win/lose, X2](phase-03-bee-swarm-gameplay-loop.md) | D3 | M | 2 | done |
| 4 | [Game feel, UI/UX, tutorial, end card](phase-04-game-feel-ui-tutorial.md) | D4 sáng | S | 3 | done |
| 5 | [Build, size optimization, write-up, submit](phase-05-build-optimize-submit.md) | D4 chiều | S | 4 | done |

Critical path: 1 → 2 → 3 → 5. Phase 4 cắt được nếu trễ (logic đúng là bắt buộc, game feel là điểm cộng).

## Global Risks
| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| 4 ngày không đủ cho cả logic + juice + build | 4 | 5 | 20 | Logic-first; Phase 4 cắt được; commit nhỏ, đều mỗi ngày (họ chấm theo commit history) |
| Reachability sai → thua/bế tắc vô lý | 3 | 5 | 15 | Unit test các case lồng/rẽ góc; debug overlay tô ô bắn được; validator auto-play |
| FPS tụt khi ~100 ong + rebuild mesh | 3 | 4 | 12 | Instancing, chunk rebuild ≤ 1/frame, ong không skinned (bob procedural), cap số ong bay |
| Build > 5MB | 2 | 4 | 8 | Compact level, strip engine modules, nén texture, `tools/optimize-size` |
| Texture `Bee Smile.png` thiếu | 3 | 2 | 6 | Flat color toon; hỏi lại nếu cần |
| Drag xoay xung đột tap tổ | 3 | 3 | 9 | Phân vùng input + threshold 10px |

## Repo hygiene
- Commit rename `CocosPlayableAdsTemplate → CocosPLA_BeeBuzzing` + `.gitmodules` đang dở trước khi bắt đầu; sửa path cũ trong CLAUDE.md.
- **Không commit** `.docx` đề bài + PDF (đề bài bảo mật); repo `origin` phải public lúc nộp.

## Assumptions (Parameter ở P5)
Slot count 5, max turns 2, build ≤ 5MB single HTML.

Cook handoff: `/t1k:cook plans/261014-1250-bee-buzzing-peel-cube-playable/plan.md`
