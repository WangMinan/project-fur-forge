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
| 任务 | `implementation/TASKS.md` | T01–T25、EXT-01/02 与 GATE-06/07 已完成；T26–T27 服务端完成但未勾选 |
| 状态 | `STATE.md` | 阶段 C 的 T26–T27 前端/Review 交接，main 直推和浏览器 Review 继续生效 |

## 当前执行入口

| 产物 | 状态 | 说明 |
| --- | --- | --- |
| `implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md` | 当前 | 阶段 C 启动条件、T22 边界、执行波次、main 纪律和验收方法 |
| `implementation/EXECUTION_ROUTING.md` | 当前 | 前端模型池、GPT-5.6 Sol 后端/Review、串行交接、定向自动化与真实浏览器 Review |
| `implementation/TASKS.md` | 当前 | 唯一可勾选清单；T26–T27 服务端完成，下一步是真实内容确认、前端与独立 Review |
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
| T19/T20 工程/UI/收口 | 已完成 | 真实作品详情/列表/首页 SSR、双源轮播、首页管理、真实浏览器和泄漏/清理证据 |
| T21 首次独立审查 | NOT PASS（历史） | `implementation/notes/t19-t22/T21-REVIEW-2026-08-01.md`；findings 已完成修复 |
| T21 人工验收与收口 | 已完成 | `implementation/notes/t19-t22/T21-MANUAL-UI-FIX-2026-08-02.md`；用户明确确认 |
| T22 后端/前端/独立 Review/用户验收 | 已完成 | `implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md`、`T22-FRONTEND-2026-08-03.md`、`T22-INDEPENDENT-REVIEW-2026-08-03.md` |
| T23–T25 角色化媒体与常规领养 | 已完成 | `implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md` 及同目录工程、前端、人工验收证据 |
| T26–T27 服务端 | 已完成待前端/Review | `implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md`；任务未勾选 |
| EXT-01 正式素材 | 已完成 | `materials/MATERIAL-MANIFEST.md`；文件交付和角色映射完成，T30/T51 继续生成/校准衍生物 |

## 历史证据边界

- `materials/`：用户/景宸提供的项目素材与竞品参考并存；只有 `MATERIAL-MANIFEST.md` 登记的项目输入可进入公开内容，竞品截图只读参考；
- `planning/prototype-v1/`：只保留页面职责和交互参考；
- `implementation/notes/`：记录当时事实，既有路径不批量迁移；
- `brand-standard-v1`：18% 宽度、70% 不透明度、四角水印的历史实现；
- `brand-centered-v2`：当前目标，居中、默认 50% 不透明度、60% 缩放、可选私有 Logo 候选。

## 当前质量口径

- 每个任务运行与改动风险直接相关的 lint/typecheck、build、unit/integration/E2E；
- 完整自动化和 `verify:production` 主要放在 T31–T34、跨层高风险修复和明确总门禁；
- 含 UI、公开投影、媒体或用户操作的任务，GPT-5.6 Sol 必须实际使用浏览器和视觉模拟点击，检查成功、失败、恢复、重载、图片解码、三视口、console/network、截图或 trace；
- 测试总数、HTTP 200、元素数量和选择器存在不能单独证明任务完成。

## 下一批预期产物

T26–T27 前端与独立 Review 预期补齐：

- 现有“首页管理”中的营业状态、委托 FAQ、关于/约定和联系固定区块，不增加第五导航；
- `/commission`、`/about`、`/contact` SSR 对公开安全投影的消费和空值隐藏；
- 双 Host、三视口、成功/校验/409/刷新、键盘/焦点、console/network 与 ownerContact 泄漏复核；
- 用户确认后的真实文案登记和最终验收结论。

T26、T27 在前端与独立 Review 前保持未勾选；不提前进入 T29 或 T37。
