# 实施备注索引

> **角色**：记录阶段 4 的执行事实、浏览器操作和验证证据。正式契约由 foundation、SPEC/增量、PLAN/增量、`.design`、TASKS 和 STATE 决定，本目录不作为需求来源。
> **整理原则**：记录按任务阶段归入稳定子目录，移动时同步修正全仓引用并执行链接检查；历史内容不因目录整理而改写。后续新记录使用 `Txx-<意图>-YYYY-MM-DD.md`，截图放在对应任务组内的证据子目录。

## 1. 当前执行入口

- [`P0-C-STAGE-READINESS-2026-08-02.md`](./P0-C-STAGE-READINESS-2026-08-02.md)：阶段 C 启动条件、T22 边界、四个执行波次、main 直推纪律、自动化与 GPT-5.6 Sol 浏览器/视觉 Review 方法。
- [`../EXECUTION_ROUTING.md`](../EXECUTION_ROUTING.md)：前端模型池、GPT-5.6 Sol 后端/Review、串行交接和测试策略。
- [`../TASKS.md`](../TASKS.md)：唯一可勾选任务清单；T31–T32 已收口，当前进入 T33；T26-F1、T27-F1、T30 等待用户验收。
- [`T26-F1-T27-F1-INDEPENDENT-REVIEW-2026-08-05.md`](./t26-t27/T26-F1-T27-F1-INDEPENDENT-REVIEW-2026-08-05.md)：保留初始 FAIL、7 个 findings、持久适配/移动菜单/测试契约修复和独立复测证据。
- [`T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md`](./t26-t27/T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md)：公开信息架构、0015、服务/隐私页、导航/页脚、状态呈现和实现方自动化/浏览器证据。
- [`T28-T30-PUBLIC-CORE-INDEPENDENT-REVIEW-2026-08-05.md`](./t28-t34/T28-T30-PUBLIC-CORE-INDEPENDENT-REVIEW-2026-08-05.md)：首页完整顺序、详情导航/301、SEO、品牌图标、初始 findings、修复与独立 Chrome 复验。
- [`T31-BACKUP-RESTORE-2026-08-05.md`](./t28-t34/T31-BACKUP-RESTORE-2026-08-05.md)：验证恢复命令、迁移 hash、数据一致性、失败清理和恢复库 production Chrome，独立 Review 最终 `PASS`。
- [`T32-SECURITY-GATE-2026-08-05.md`](./t28-t34/T32-SECURITY-GATE-2026-08-05.md)：64 KiB JSON、请求级限流、Host/Origin/CSRF/DTO、日志脱敏、真实 OSS/secret scan、初始 findings 与独立复验，最终 `PASS`。
- [`T25-DESIGN-SHEET-WATERMARK-FOLLOW-UP-2026-08-05.md`](./t23-t25/T25-DESIGN-SHEET-WATERMARK-FOLLOW-UP-2026-08-05.md)：高分辨率设定图水印固定像素根因、960 px 基准修复、当前活动 profile 原子重建与真实 OSS/浏览器证据。
- [`T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md`](./t26-t27/T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md)：委托页独立大图的规格、最小复用方案、低分辨率追加实现与验证证据。
- [`T26-F1-HERO-WATERMARK-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-F1-HERO-WATERMARK-FOLLOW-UP-2026-08-04.md)：首页/委托页大图复用作品媒体水印布局与视觉比例、现有公开对象原子重建和真实浏览器复核。
- [`T26-T27-OQ120-SEED-UX-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-T27-OQ120-SEED-UX-FOLLOW-UP-2026-08-04.md)：OQ-120 正式默认值、0014 迁移、当前库注入、“大图管理”统一命名、委托锚点修复与返图墙任务边界。
- [`T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`](./t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md)：用户下班后可直接照做的双 Host 人工核对步骤，含 T26-F1 独立大图与可选 409 复核。
- [`T26-T27-BACKEND-HANDOFF-2026-08-04.md`](./t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md)：受限固定字段、独立营业状态、管理/公开 API、迁移与自动化。
- [`T26-T27-FRONTEND-2026-08-04.md`](./t26-t27/T26-T27-FRONTEND-2026-08-04.md)：首页管理固定区块、三公开页、空值隐藏、浏览器自测与 OQ-120 缺失清单。
- [`T26-T27-VISUAL-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-T27-VISUAL-FOLLOW-UP-2026-08-04.md)：公开标题、作品查找/筛选/分页、委托背景引导区、独立文案配置与五张视觉证据。
- [`T26-T27-INDEPENDENT-REVIEW-2026-08-04.md`](./t26-t27/T26-T27-INDEPENDENT-REVIEW-2026-08-04.md)：新上下文初始 findings、最小修复、自动化、真实浏览器/图片/三视口/键盘、安全边界与 `PASS WITH FOLLOW-UP`。
- [`T23-T25-CLOSURE-2026-08-04.md`](./t23-t25/T23-T25-CLOSURE-2026-08-04.md)：用户确认独立 Agent Review 完成后的三任务最终收口。
- [`T25-BACKEND-HANDOFF-2026-08-03.md`](./t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md)：用户授权的 T25 regular adoption 发布与公开读取服务端交接。
- [`T23-T25-USER-ACCEPTANCE-2026-08-04.md`](./t23-t25/T23-T25-USER-ACCEPTANCE-2026-08-04.md)：用户人工核验、`/works` 出厂照边界、`recipe-v2` 左右双水印、真实 OSS 与剩余独立 Review 门禁。
- [`../../materials/MATERIAL-MANIFEST.md`](../../materials/MATERIAL-MANIFEST.md)：Logo、出厂照、横版设定图、返图与首页候选的正式输入清单；EXT-01 已完成。

当前新任务只在本节增加一个“启动/交接/收口”主记录，不再为同一小修补创建多个相互重叠的状态文件。需要保留详细失败证据时，在主记录内分节或放入对应截图/trace 子目录。

当前目录分组：

- `t01-t09/`：应用、配置、生产视觉方向和 T09 工程收口；
- `t10-t13/`：OSS 预检、SQLite、P0 Schema、认证和 S2 Review；
- `t14-t18/`：上传、媒体核验、配方、作品 CRUD、发布与管理 UI；
- `gate07-watermark/`：可配置居中水印的文档、工程、UI、收口与截图；
- `t19-t22/`：公开站、首页、T21 门禁、T22 完整字段与独立 Review；
- `t23-t25/`：T23–T25 工程、前端检查点、用户人工核验与最终收口；
- `t26-t27/`：T26–T27 服务端/前端交接、独立 Review、截图与收口记录；
- `t28-t34/`：阶段 C 长程批次的公开核心、恢复、安全、性能和 P0 总门禁证据；
- 根目录只保留本索引和仍作为阶段 C 当前基线的 `P0-C-STAGE-READINESS-2026-08-02.md`。

## 2. 最近收口记录

### T23–T25 角色化媒体与常规领养

- [`T23-ENGINEERING-2026-08-03.md`](./t23-t25/T23-ENGINEERING-2026-08-03.md)：设定图/出厂照关系、数量/顺序/主图、按需 variant、迁移和 profile 切换；T23 未勾选。
- [`T25-BACKEND-HANDOFF-2026-08-03.md`](./t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md)：regular adoption 发布检查、公开 adoption 列表、统一详情媒体分区和前端恢复契约；T25 未勾选。
- [`T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md`](./t23-t25/T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md)：管理媒体分区、公开领养页、自动保存发布与浏览器检查点。
- [`T23-T25-USER-ACCEPTANCE-2026-08-04.md`](./t23-t25/T23-T25-USER-ACCEPTANCE-2026-08-04.md)：用户人工核验通过与 `recipe-v2` 正式素材真实 OSS 证据；独立 Review 待执行。
- [`T23-T25-CLOSURE-2026-08-04.md`](./t23-t25/T23-T25-CLOSURE-2026-08-04.md)：用户确认 Agent Review 已完成后解除门禁，T23–T25 勾选收口。
- [`T25-DESIGN-SHEET-WATERMARK-FOLLOW-UP-2026-08-05.md`](./t23-t25/T25-DESIGN-SHEET-WATERMARK-FOLLOW-UP-2026-08-05.md)：T25 收口后高分辨率设定图水印比例缺陷修复；不改写历史结论。

### T26–T27 固定内容与营业状态

- [`T26-F1-T27-F1-INDEPENDENT-REVIEW-2026-08-05.md`](./t26-t27/T26-F1-T27-F1-INDEPENDENT-REVIEW-2026-08-05.md)：T26-F1/T27-F1 新上下文独立 Review；初始 `FAIL` 后 7 个 findings 全部关闭，最终 `PASS WITH FOLLOW-UP`，用户验收待执行。
- [`T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md`](./t26-t27/T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md)：关于/联系合并、服务条款/隐私政策独立页、0015、导航/页脚、营业状态与双 Host 三视口实现方自测；独立 Review/用户验收待执行。
- [`T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md`](./t26-t27/T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md)：委托页独立大图管理、公开投影、迁移、低分辨率适配和实现方验证；统一的独立 Review/验收待执行。
- [`T26-F1-HERO-WATERMARK-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-F1-HERO-WATERMARK-FOLLOW-UP-2026-08-04.md)：共享 `recipe-v2` 将横版大图改为设定图式左右双水印，竖版大图保持作品卡式单个居中水印；当前库已原子切换。
- [`T26-T27-OQ120-SEED-UX-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-T27-OQ120-SEED-UX-FOLLOW-UP-2026-08-04.md)：用户确认 OQ-120 后的默认值迁移与当前库注入，以及“大图管理”命名和锚点遮挡跟进。
- [`T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`](./t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md)：T26/T27 页面、状态、文案、邮件操作、委托独立大图及冲突恢复的人工验收清单。
- [`T26-T27-BACKEND-HANDOFF-2026-08-04.md`](./t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md)：0012 迁移、受限纯文本/FAQ、独立状态版本、现有首页管理聚合 API、公开投影与全量测试。
- [`T26-T27-FRONTEND-2026-08-04.md`](./t26-t27/T26-T27-FRONTEND-2026-08-04.md)：管理固定区块、`/commission` `/about` `/contact`、实现方浏览器自测与截图；**OQ-120 开放，T26/T27 未勾选**。
- [`T26-T27-VISUAL-FOLLOW-UP-2026-08-04.md`](./t26-t27/T26-T27-VISUAL-FOLLOW-UP-2026-08-04.md)：用户追加视觉/管理体验的实现、自动化与 Chrome 证据；**不代替独立 Review**。
- [`T26-T27-INDEPENDENT-REVIEW-2026-08-04.md`](./t26-t27/T26-T27-INDEPENDENT-REVIEW-2026-08-04.md)：保留修复前 findings，追加修复与复测；最终 `PASS WITH FOLLOW-UP`，本轮 USER_GATE 为否，T26/T27 已勾选。OQ-120 仍是正式内容门禁。

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
- `t26-t27/screenshots/visual-follow-up-*`：T26–T27 追加委托引导区三视口、后台作品查找与独立文案配置。
- `t26-t27/screenshots/independent-review-*`：T26–T27 独立 Review 的委托页双视口、关于页与联系页最终视觉证据。
- `t26-t27/screenshots/t27-f1-*`：T27-F1 关于二级导航、政策页、页脚、后台法律字段、领养状态与委托移动端圆角状态框。

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
