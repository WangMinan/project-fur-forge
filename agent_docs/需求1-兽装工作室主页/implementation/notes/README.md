# 实施备注索引

> **角色**：记录阶段 4 的执行事实、浏览器操作和验证证据。正式契约由 foundation、SPEC/增量、PLAN/增量、`.design`、TASKS 和 STATE 决定，本目录不作为需求来源。
> **整理原则**：记录按任务阶段归入稳定子目录，移动时同步修正全仓引用并执行链接检查；历史内容不因目录整理而改写。后续新记录使用 `Txx-<意图>-YYYY-MM-DD.md`，截图放在对应任务组内的证据子目录。

## 1. 当前执行入口

- [`P0-C-STAGE-READINESS-2026-08-02.md`](./P0-C-STAGE-READINESS-2026-08-02.md)：阶段 C 启动条件、T22 边界、四个执行波次、main 直推纪律、自动化与 GPT-5.6 Sol 浏览器/视觉 Review 方法。
- [`../EXECUTION_ROUTING.md`](../EXECUTION_ROUTING.md)：前端模型池、GPT-5.6 Sol 后端/Review、串行交接和测试策略。
- [`../TASKS.md`](../TASKS.md)：唯一可勾选任务清单；T23 工程与 T25 服务端交接已就绪，但两项均保持未勾选，T24 UI 未实现。
- [`T23-ENGINEERING-2026-08-03.md`](./t23-t25/T23-ENGINEERING-2026-08-03.md)：T23 多图关系、角色约束、按需 recipe、迁移兼容和活动 profile 原子切换工程记录；等待独立 Review。
- [`T25-BACKEND-HANDOFF-2026-08-03.md`](./t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md)：用户授权的 T25 regular adoption 发布与公开读取服务端交接；T24 UI 未实现，T25 保持未勾选。
- [`../../materials/MATERIAL-MANIFEST.md`](../../materials/MATERIAL-MANIFEST.md)：Logo、出厂照、横版设定图、返图与首页候选的正式输入清单；EXT-01 已完成。

当前新任务只在本节增加一个“启动/交接/收口”主记录，不再为同一小修补创建多个相互重叠的状态文件。需要保留详细失败证据时，在主记录内分节或放入对应截图/trace 子目录。

当前目录分组：

- `t01-t09/`：应用、配置、生产视觉方向和 T09 工程收口；
- `t10-t13/`：OSS 预检、SQLite、P0 Schema、认证和 S2 Review；
- `t14-t18/`：上传、媒体核验、配方、作品 CRUD、发布与管理 UI；
- `gate07-watermark/`：可配置居中水印的文档、工程、UI、收口与截图；
- `t19-t22/`：公开站、首页、T21 门禁、T22 完整字段与独立 Review；
- `t23-t25/`：T23 服务端工程与 T25 后端读取/发布交接；任务勾选仍由各自 Review 和验收决定；
- 根目录只保留本索引和仍作为阶段 C 当前基线的 `P0-C-STAGE-READINESS-2026-08-02.md`。

## 2. 最近收口记录

### T23–T25 角色化媒体与常规领养

- [`T23-ENGINEERING-2026-08-03.md`](./t23-t25/T23-ENGINEERING-2026-08-03.md)：设定图/出厂照关系、数量/顺序/主图、按需 variant、迁移和 profile 切换；T23 未勾选。
- [`T25-BACKEND-HANDOFF-2026-08-03.md`](./t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md)：regular adoption 发布检查、公开 adoption 列表、统一详情媒体分区和前端恢复契约；T25 未勾选。

### T19–T22 与首页/公开站

- [`T19-T20-ENGINEERING-2026-08-01.md`](./t19-t22/T19-T20-ENGINEERING-2026-08-01.md)：公开读取、首页发布、缓存与安全契约。
- [`T19-T20-UI-HANDOFF.md`](./t19-t22/T19-T20-UI-HANDOFF.md)：公开页与首页管理的工程交接。
- [`T19-T20-UI-2026-08-01.md`](./t19-t22/T19-T20-UI-2026-08-01.md)：前端实现和浏览器证据。
- [`T19-T20-CLOSURE-2026-08-01.md`](./t19-t22/T19-T20-CLOSURE-2026-08-01.md)：最终工程审查、完整门禁、真实 OSS、空库迁移、泄漏扫描和精确清理。
- [`T21-REVIEW-2026-08-01.md`](./t19-t22/T21-REVIEW-2026-08-01.md)：首次独立审查 NOT PASS 与 findings 修复历史。
- [`T21-REVIEW-PREP.md`](./t19-t22/T21-REVIEW-PREP.md)：首次复审准备清单；T21 收口后仅作历史证据，不再作为当前执行路由。
- [`T21-MANUAL-UI-FIX-2026-08-02.md`](./t19-t22/T21-MANUAL-UI-FIX-2026-08-02.md)：用户人工验收回归、完整门禁和最终确认。
- [`T22-BACKEND-2026-08-03.md`](./t19-t22/T22-BACKEND-2026-08-03.md)：三用途 Schema/API、迁移决定、历史展会兼容和公开精选交接。
- [`T22-FRONTEND-2026-08-03.md`](./t19-t22/T22-FRONTEND-2026-08-03.md)：三用途管理 UI、价格、排序/精选、用途切换和公开端接线的实施阶段记录。
- [`T22-INDEPENDENT-REVIEW-2026-08-03.md`](./t19-t22/T22-INDEPENDENT-REVIEW-2026-08-03.md)：初始 findings、真实浏览器/三视口/泄漏/恢复证据、`PASS WITH FOLLOW-UP` 与用户最终确认。

### GATE-07 可配置居中水印

- [`DOCS-WATERMARK-CENTERED-V2-2026-08-01.md`](./gate07-watermark/DOCS-WATERMARK-CENTERED-V2-2026-08-01.md)：代码/文档 Review、阿里云参数、产品决定和任务映射。
- [`GATE07-WATERMARK-ENGINEERING-2026-08-01.md`](./gate07-watermark/GATE07-WATERMARK-ENGINEERING-2026-08-01.md)：迁移、种子、API、真实 OSS、原子切换、清理和工程验证。
- [`GATE07-UI-HANDOFF.md`](./gate07-watermark/GATE07-UI-HANDOFF.md)：管理 UI 工程交接。
- [`GATE07-WATERMARK-UI-2026-08-01.md`](./gate07-watermark/GATE07-WATERMARK-UI-2026-08-01.md)：管理页面、三视口和浏览器 E2E。
- [`GATE07-CLOSURE-2026-08-02.md`](./gate07-watermark/GATE07-CLOSURE-2026-08-02.md)：联调修复、全站应用进度、失败恢复、质量规则和用户验收。

## 3. 已完成工程记录

### T01–T09 应用与视觉底座

- [`T01-2026-07-28.md`](./t01-t09/T01-2026-07-28.md)：Nuxt 双访问面最小切片。
- [`T02-T03-2026-07-29.md`](./t01-t09/T02-T03-2026-07-29.md)：配置、Host/日志和共享契约初版。
- [`T02-ORIGIN-ENV-CLOSURE-2026-07-31.md`](./t01-t09/T02-ORIGIN-ENV-CLOSURE-2026-07-31.md)：非测试 origin 与配置硬编码收口。
- [`T04-T05-2026-07-29.md`](./t01-t09/T04-T05-2026-07-29.md)：公开设计系统和首页精选方案。
- [`T06-T07-2026-07-29.md`](./t01-t09/T06-T07-2026-07-29.md)：作品页面和管理工作台视觉样张。
- [`t06-t07/T08-REVIEW-PREP.md`](./t01-t09/t06-t07/T08-REVIEW-PREP.md)：T08 用户视觉门禁。
- [`T09-ENGINEERING-CORE-2026-07-30.md`](./t01-t09/T09-ENGINEERING-CORE-2026-07-30.md)：T09 工程契约修正。
- [`T09-UI-2026-07-30.md`](./t01-t09/T09-UI-2026-07-30.md)：T09 UI 与三视口证据。
- [`T09-CLOSURE-2026-07-31.md`](./t01-t09/T09-CLOSURE-2026-07-31.md)：T09 最终收口。

### T10–T13 媒体、数据与认证底座

- [`T10-OSS-PREFLIGHT-2026-07-31.md`](./t10-t13/T10-OSS-PREFLIGHT-2026-07-31.md)：双 Bucket、30 MB、FFmpeg、OSS 水印和跨桶实测。
- [`T11-SQLITE-2026-07-31.md`](./t10-t13/T11-SQLITE-2026-07-31.md)：SQLite/Drizzle 和备份底座。
- [`T12-P0-SCHEMA-2026-07-31.md`](./t10-t13/T12-P0-SCHEMA-2026-07-31.md)：P0 Schema、媒体角色和投影。
- [`T13-AUTH-2026-07-31.md`](./t10-t13/T13-AUTH-2026-07-31.md)：唯一管理员认证工程。
- [`S2-REVIEW-CLOSURE-2026-07-31.md`](./t10-t13/S2-REVIEW-CLOSURE-2026-07-31.md)：阶段 2 工程 Review 收口。
- [`T13-AUTH-UI-2026-07-31.md`](./t10-t13/T13-AUTH-UI-2026-07-31.md)：认证前端和 GATE-06。

### T14–T18 第一作品写链

- [`T14-UPLOAD-ENGINEERING-2026-07-31.md`](./t14-t18/T14-UPLOAD-ENGINEERING-2026-07-31.md)：条件直传。
- [`T15-MEDIA-VALIDATION-2026-07-31.md`](./t14-t18/T15-MEDIA-VALIDATION-2026-07-31.md)：媒体核验和私有预处理源。
- [`T16-RECIPE-WATERMARK-2026-07-31.md`](./t14-t18/T16-RECIPE-WATERMARK-2026-07-31.md)：`recipe-v1` 与历史 `brand-standard-v1`。
- [`T17-WORK-CRUD-ENGINEERING-2026-07-31.md`](./t14-t18/T17-WORK-CRUD-ENGINEERING-2026-07-31.md)：最小非领养作品 CRUD。
- [`T18-PUBLICATION-ENGINEERING-2026-07-31.md`](./t14-t18/T18-PUBLICATION-ENGINEERING-2026-07-31.md)：发布/下架和补偿。
- [`T14-T18-UI-HANDOFF.md`](./t14-t18/T14-T18-UI-HANDOFF.md)：管理端接线交接。
- [`t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md`](./t14-t18/t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md)：UI 修复和用户联合验收。

## 4. 截图与二进制证据目录

截图与二进制证据跟随所属任务组：

- `t01-t09/t04-t05/screenshots/`、`t01-t09/t06-t07/screenshots/`、`t01-t09/t09-ui/screenshots/`：T04–T09 生产视觉样张；
- `t10-t13/t13-auth-ui/screenshots/`：认证与管理入口三视口；
- `t14-t18/t14-t18-ui/screenshots/`：作品管理、上传、发布/下架和失败状态；
- `gate07-watermark/screenshots/`：全局水印管理、预览、应用和三视口；
- `t19-t22/t19-t20/screenshots/`：首页、作品列表、作品详情和首页管理；
- `t19-t22/t22-independent-review/screenshots/`：T22 管理端、公开首页与作品列表三视口。

新任务的截图目录放在对应任务组下，例如 `t23-t25/t23-role-media/screenshots/`。截图文件名包含页面、状态和视口，例如 `admin-work-design-sheet-1440x900.png`。

## 5. 后续记录模板

T22 起每个任务主记录至少包含：

1. **范围与非范围**：本任务完成什么、明确不提前完成什么；
2. **契约/迁移差异**：Schema、API、数据库和公开投影；
3. **自动化**：为什么选择这些命令和用例，覆盖了什么风险；
4. **浏览器与视觉 Review**：实际点击步骤、管理/公开 Host、三视口、console/network、图片解码、失败/恢复；
5. **结果**：`PASS / PASS WITH FOLLOW-UP / NOT PASS`；
6. **用户验收**：需要用户确认时记录原始结论；
7. **风险与下一任务边界**。

只写“lint/typecheck/E2E 全绿”不再是合格的实施记录。全量 E2E 主要保留给 T31–T34 和跨层高风险门禁；每个小任务运行与其风险直接相关的最小充分集合。

旧 `brand-standard-v1` 和四角水印记录仍是当时的真实历史，不得回写成当时已经实现居中可配置水印。
