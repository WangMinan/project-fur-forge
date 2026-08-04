# 产物索引

> **角色**：登记当前契约、状态路由、正式素材、历史证据和实施产物。

## 当前契约

水印相关条款按以下局部增量读取；冲突时增量优先，其他内容继续由原主文件约束：

| 层级 | 主文件 | 当前水印增量 |
| --- | --- | --- |
| 地基 | `foundation/README.md` | `foundation/WATERMARK-CENTERED-V2.md` |
| 规格 | `requirements/SPEC.md` | `requirements/WATERMARK-CENTERED-V2.md` |
| 计划 | `planning/PLAN.md` | `planning/WATERMARK-CENTERED-V2.md` |
| 模型投影 | `models/README.md` | `models/WATERMARK-CENTERED-V2.md` |
| 设计 | `.design/` | `.design/WATERMARK-CENTERED-V2.md` |
| 任务 | `implementation/TASKS.md` | T01–T27、EXT-01/02 与 GATE-06/07 已完成；T26-F1、T27-F1 实现方自测完成，独立 Review/用户验收待执行 |
| 状态 | `STATE.md` | 阶段 C：先完成 T26-F1、T27-F1 独立 Review/用户验收，再进入 T28；OQ-120 已确认并完成默认值登记；main 直推继续生效 |

## 当前执行入口

| 产物 | 状态 | 说明 |
| --- | --- | --- |
| `implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md` | 当前 | 阶段 C 启动条件、T22 边界、执行波次、main 纪律和验收方法 |
| `implementation/EXECUTION_ROUTING.md` | 当前 | 前端模型池、GPT-5.6 Sol 后端/Review、串行交接、定向自动化与真实浏览器 Review |
| `implementation/TASKS.md` | 当前 | 唯一可勾选清单；T26–T27 已勾选，T26-F1、T27-F1 保持未勾选并等待独立 Review/用户验收 |
| `materials/MATERIAL-MANIFEST.md` | 已确认 | Logo、作品、横版设定图、返图与页面候选的正式输入和衍生职责；EXT-01 完成 |
| `implementation/notes/README.md` | 当前 | 按当前/收口/历史/截图整理全部实施记录，不移动已被引用的旧路径 |

## 已完成实施与证据

| 产物 | 状态 | 说明 |
| --- | --- | --- |
| T01–T13 | 已完成 | 应用底座、配置/Host/日志、共享契约、视觉基线、SQLite/P0 Schema、唯一管理员认证 |
| GATE-06 | 已完成 | 登录/Session/退出/改密和浏览器安全证据 |
| T10/EXT-02 | 已完成 | 双 Bucket、30 MB 原图、FFmpeg 私有处理源、OSS 水印和跨桶保存实测 |
| T14–T18 后端记录 | 已完成 | `implementation/notes/t14-t18/T14-UPLOAD-ENGINEERING-2026-07-31.md` 至 `T18-PUBLICATION-ENGINEERING-2026-07-31.md` |
| T14–T18 UI/修复记录 | 已完成 | `implementation/notes/t14-t18/t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md` |
| 水印 v2 文档校准 | 已完成 | `implementation/notes/gate07-watermark/DOCS-WATERMARK-CENTERED-V2-2026-08-01.md` |
| GATE-07 工程/UI/收口 | 已完成 | 迁移、管理 API/UI、真实 OSS、原子切换、持续进度、三视口和用户验收 |
| T19/T20 工程/UI/收口 | 已完成 | 真实作品详情/列表/首页 SSR、双源轮播、大图管理、真实浏览器和泄漏/清理证据 |
| T21 首次独立审查 | NOT PASS（历史） | `implementation/notes/t19-t22/T21-REVIEW-2026-08-01.md`；findings 已完成修复 |
| T21 人工验收与收口 | 已完成 | `implementation/notes/t19-t22/T21-MANUAL-UI-FIX-2026-08-02.md`；用户明确确认 |
| T22 后端/前端/独立 Review/用户验收 | 已完成 | `implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md`、`T22-FRONTEND-2026-08-03.md`、`T22-INDEPENDENT-REVIEW-2026-08-03.md` |
| T23–T25 角色化媒体与常规领养 | 已完成 | `implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md` 及同目录工程、前端、人工验收证据 |
| T26–T27 服务端 | 已完成 | `implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md` |
| T26–T27 前端与追加跟进 | 已完成 | `implementation/notes/t26-t27/T26-T27-FRONTEND-2026-08-04.md` 与 `T26-T27-VISUAL-FOLLOW-UP-2026-08-04.md` |
| T26–T27 独立 Review | PASS WITH FOLLOW-UP | `implementation/notes/t26-t27/T26-T27-INDEPENDENT-REVIEW-2026-08-04.md`；初始 findings、最小修复、44 项定向测试、SSR/Host/DTO/私有 Bucket、真实图片、三视口、键盘和截图证据 |
| T26–T27 OQ-120 与界面跟进 | 已完成 | `implementation/notes/t26-t27/T26-T27-OQ120-SEED-UX-FOLLOW-UP-2026-08-04.md`；0014 默认值、当前库注入、“大图管理”与锚点修复 |
| T26-F1 委托页独立大图 | 实现方自测完成 | `implementation/notes/t26-t27/T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md`；复用首页上传/排序/发布链，独立公开投影，并完成低分辨率确认与 FFmpeg 私有适配；独立 Review/用户验收待执行 |
| T27-F1 公开信息架构与政策页 | 实现方自测完成 | `implementation/notes/t26-t27/T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md`；0015、管理/公开投影、独立法律页、导航/页脚、合并联系、营业状态与双 Host 三视口证据；独立 Review/用户验收待执行 |
| 首页/委托页大图水印跟进 | 已完成 | `implementation/notes/t26-t27/T26-F1-HERO-WATERMARK-FOLLOW-UP-2026-08-04.md`；共享配方按作品媒体规则生成横版左右双水印、竖版单个居中水印，并完成现有公开对象原子重建与浏览器复核 |
| T26/T27 回家人工核对 | 当前 | `implementation/notes/t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`；双 Host、文案/状态、委托独立大图、三公开页和可选 409 复核 |
| EXT-01 正式素材 | 已完成 | `materials/MATERIAL-MANIFEST.md`；文件交付和角色映射完成，T30/T51 继续生成/校准衍生物 |

## 历史证据边界

- `materials/`：用户/景宸提供的项目素材与竞品参考并存；只有 `MATERIAL-MANIFEST.md` 登记的项目输入可进入公开内容，竞品截图只读参考；
- `planning/prototype-v1/`：只保留页面职责和交互参考；
- `implementation/notes/`：记录当时事实，既有路径不批量迁移；
- `brand-standard-v1`：18% 宽度、70% 不透明度、四角水印的历史实现；
- `brand-centered-v2`：当前目标，默认 50% 不透明度、60% 缩放、可选私有 Logo 候选；出厂照/站点竖图单个居中，设定图/站点横图左右双水印。

## 当前质量口径

- 每个任务运行与改动风险直接相关的 lint/typecheck、build、unit/integration/E2E；
- 完整自动化和 `verify:production` 主要放在 T31–T34、跨层高风险修复和明确总门禁；
- 含 UI、公开投影、媒体或用户操作的任务，GPT-5.6 Sol 必须实际使用浏览器和视觉模拟点击，检查成功、失败、恢复、重载、图片解码、三视口、console/network、截图或 trace；
- 测试总数、HTTP 200、元素数量和选择器存在不能单独证明任务完成。

## 下一批预期产物

- T26-F1、T27-F1 统一后的新上下文独立 Review 与用户验收记录；
- T28 首页完整内容顺序的后端/前端/Review 记录；
- 用户如愿意补充的后台双上下文 409 与完整文案投影人工证据。

T29 在 T28 后串行推进；不提前进入 T37。
