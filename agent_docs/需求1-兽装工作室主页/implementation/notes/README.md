# 实施备注索引

> **角色**：记录阶段 4 的执行事实、浏览器操作和验证证据。正式契约由 foundation、SPEC/增量、PLAN/增量、`.design`、TASKS 和 STATE 决定，本目录不作为需求来源。
> **整理原则**：既有记录和截图路径已经被多个文档引用，因此不为“目录好看”批量移动或改名；本索引把它们按当前、收口、历史和截图分组。后续新记录使用 `Txx-<意图>-YYYY-MM-DD.md`，截图放入 `notes/txx-<意图>/screenshots/`。

## 1. 当前执行入口

- [`T22-BACKEND-2026-08-03.md`](./T22-BACKEND-2026-08-03.md)：T22 差异审计、三用途 Schema/API、无迁移决定、历史展会兼容、公开精选与前端交接；状态为后端完成，等待前端/Review/用户验收。
- [`P0-C-STAGE-READINESS-2026-08-02.md`](./P0-C-STAGE-READINESS-2026-08-02.md)：阶段 C 启动条件、T22 边界、四个执行波次、main 直推纪律、自动化与 GPT-5.6 Sol 浏览器/视觉 Review 方法。
- [`../EXECUTION_ROUTING.md`](../EXECUTION_ROUTING.md)：前端模型池、GPT-5.6 Sol 后端/Review、串行交接和测试策略。
- [`../TASKS.md`](../TASKS.md)：唯一可勾选任务清单；T22 仍为 `[ ]`，当前等待前端接线。
- [`../../materials/MATERIAL-MANIFEST.md`](../../materials/MATERIAL-MANIFEST.md)：Logo、出厂照、横版设定图、返图与首页候选的正式输入清单；EXT-01 已完成。

当前新任务只在本节增加一个“启动/交接/收口”主记录，不再为同一小修补创建多个相互重叠的状态文件。需要保留详细失败证据时，在主记录内分节或放入对应截图/trace 子目录。

## 2. 最近收口记录

### T19–T21 与首页/公开站

- [`T19-T20-ENGINEERING-2026-08-01.md`](./T19-T20-ENGINEERING-2026-08-01.md)：公开读取、首页发布、缓存与安全契约。
- [`T19-T20-UI-HANDOFF.md`](./T19-T20-UI-HANDOFF.md)：公开页与首页管理的工程交接。
- [`T19-T20-UI-2026-08-01.md`](./T19-T20-UI-2026-08-01.md)：前端实现和浏览器证据。
- [`T19-T20-CLOSURE-2026-08-01.md`](./T19-T20-CLOSURE-2026-08-01.md)：最终工程审查、完整门禁、真实 OSS、空库迁移、泄漏扫描和精确清理。
- [`T21-REVIEW-2026-08-01.md`](./T21-REVIEW-2026-08-01.md)：首次独立审查 NOT PASS 与 findings 修复历史。
- [`T21-REVIEW-PREP.md`](./T21-REVIEW-PREP.md)：首次复审准备清单；T21 收口后仅作历史证据，不再作为当前执行路由。
- [`T21-MANUAL-UI-FIX-2026-08-02.md`](./T21-MANUAL-UI-FIX-2026-08-02.md)：用户人工验收回归、完整门禁和最终确认。

### GATE-07 可配置居中水印

- [`DOCS-WATERMARK-CENTERED-V2-2026-08-01.md`](./DOCS-WATERMARK-CENTERED-V2-2026-08-01.md)：代码/文档 Review、阿里云参数、产品决定和任务映射。
- [`GATE07-WATERMARK-ENGINEERING-2026-08-01.md`](./GATE07-WATERMARK-ENGINEERING-2026-08-01.md)：迁移、种子、API、真实 OSS、原子切换、清理和工程验证。
- [`GATE07-UI-HANDOFF.md`](./GATE07-UI-HANDOFF.md)：管理 UI 工程交接。
- [`GATE07-WATERMARK-UI-2026-08-01.md`](./GATE07-WATERMARK-UI-2026-08-01.md)：管理页面、三视口和浏览器 E2E。
- [`GATE07-CLOSURE-2026-08-02.md`](./GATE07-CLOSURE-2026-08-02.md)：联调修复、全站应用进度、失败恢复、质量规则和用户验收。

## 3. 已完成工程记录

### T01–T09 应用与视觉底座

- [`T01-2026-07-28.md`](./T01-2026-07-28.md)：Nuxt 双访问面最小切片。
- [`T02-T03-2026-07-29.md`](./T02-T03-2026-07-29.md)：配置、Host/日志和共享契约初版。
- [`T02-ORIGIN-ENV-CLOSURE-2026-07-31.md`](./T02-ORIGIN-ENV-CLOSURE-2026-07-31.md)：非测试 origin 与配置硬编码收口。
- [`T04-T05-2026-07-29.md`](./T04-T05-2026-07-29.md)：公开设计系统和首页精选方案。
- [`T06-T07-2026-07-29.md`](./T06-T07-2026-07-29.md)：作品页面和管理工作台视觉样张。
- [`t06-t07/T08-REVIEW-PREP.md`](./t06-t07/T08-REVIEW-PREP.md)：T08 用户视觉门禁。
- [`T09-ENGINEERING-CORE-2026-07-30.md`](./T09-ENGINEERING-CORE-2026-07-30.md)：T09 工程契约修正。
- [`T09-UI-2026-07-30.md`](./T09-UI-2026-07-30.md)：T09 UI 与三视口证据。
- [`T09-CLOSURE-2026-07-31.md`](./T09-CLOSURE-2026-07-31.md)：T09 最终收口。

### T10–T13 媒体、数据与认证底座

- [`T10-OSS-PREFLIGHT-2026-07-31.md`](./T10-OSS-PREFLIGHT-2026-07-31.md)：双 Bucket、30 MB、FFmpeg、OSS 水印和跨桶实测。
- [`T11-SQLITE-2026-07-31.md`](./T11-SQLITE-2026-07-31.md)：SQLite/Drizzle 和备份底座。
- [`T12-P0-SCHEMA-2026-07-31.md`](./T12-P0-SCHEMA-2026-07-31.md)：P0 Schema、媒体角色和投影。
- [`T13-AUTH-2026-07-31.md`](./T13-AUTH-2026-07-31.md)：唯一管理员认证工程。
- [`S2-REVIEW-CLOSURE-2026-07-31.md`](./S2-REVIEW-CLOSURE-2026-07-31.md)：阶段 2 工程 Review 收口。
- [`T13-AUTH-UI-2026-07-31.md`](./T13-AUTH-UI-2026-07-31.md)：认证前端和 GATE-06。

### T14–T18 第一作品写链

- [`T14-UPLOAD-ENGINEERING-2026-07-31.md`](./T14-UPLOAD-ENGINEERING-2026-07-31.md)：条件直传。
- [`T15-MEDIA-VALIDATION-2026-07-31.md`](./T15-MEDIA-VALIDATION-2026-07-31.md)：媒体核验和私有预处理源。
- [`T16-RECIPE-WATERMARK-2026-07-31.md`](./T16-RECIPE-WATERMARK-2026-07-31.md)：`recipe-v1` 与历史 `brand-standard-v1`。
- [`T17-WORK-CRUD-ENGINEERING-2026-07-31.md`](./T17-WORK-CRUD-ENGINEERING-2026-07-31.md)：最小非领养作品 CRUD。
- [`T18-PUBLICATION-ENGINEERING-2026-07-31.md`](./T18-PUBLICATION-ENGINEERING-2026-07-31.md)：发布/下架和补偿。
- [`T14-T18-UI-HANDOFF.md`](./T14-T18-UI-HANDOFF.md)：管理端接线交接。
- [`t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md`](./t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md)：UI 修复和用户联合验收。

## 4. 截图与二进制证据目录

以下目录保留原路径，不在当前整理中迁移：

- `t06-t07/screenshots/`：T06–T08 生产视觉样张；
- `t09-ui/screenshots/`：T09 三视口；
- `t14-t18-ui/screenshots/`：作品管理、上传、发布/下架和失败状态；
- `gate07-watermark/screenshots/`：全局水印管理、预览、应用和三视口；
- `t19-t20/screenshots/`：首页、作品列表、作品详情和首页管理。

新任务的截图目录使用小写任务号，例如 `t22-complete-work-fields/screenshots/`。截图文件名包含页面、状态和视口，例如 `admin-work-adoption-conflict-1440x900.png`。

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
