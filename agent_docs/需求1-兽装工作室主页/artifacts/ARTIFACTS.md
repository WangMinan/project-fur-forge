# 产物索引

> **角色**：列出当前可用产物、交付配置和历史证据入口，不复制需求或任务状态。
> **当前阶段**：阶段 D；T35–T37 工程主体已落地，待独立 Review 与用户验收。
> 状态见 [`../STATE.md`](../STATE.md)。
> **最后校准**：2026-08-08。

## 1. 当前权威入口

| 主题 | 文件 |
| --- | --- |
| 产品边界 | [`../foundation/README.md`](../foundation/README.md) |
| 功能规格 | [`../requirements/SPEC.md`](../requirements/SPEC.md) |
| 媒体公开与保护 | [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) |
| 技术计划 | [`../planning/PLAN.md`](../planning/PLAN.md) |
| 未来候选备忘 | [`../planning/FUTURE-ITERATIONS.md`](../planning/FUTURE-ITERATIONS.md) |
| 数据模型 | [`../models/README.md`](../models/README.md) |
| 设计入口 | [`../.design/README.md`](../.design/README.md) |
| 任务清单 | [`../implementation/TASKS.md`](../implementation/TASKS.md) |
| 执行路由 | [`../implementation/EXECUTION_ROUTING.md`](../implementation/EXECUTION_ROUTING.md) |
| 当前评审 | [`../review/REVIEW.md`](../review/REVIEW.md) |
| 历史证据索引 | [`../implementation/notes/README.md`](../implementation/notes/README.md) |

未来候选备忘不是实施授权；只有 SPEC、PLAN、TASKS 能把候选提升为当前工作。

## 2. 阶段 C 业务代码产物

主分支已经包含：

- Nuxt 4 公开站与管理端；
- SQLite/Drizzle schema、迁移、备份与验证恢复；
- 唯一管理员认证、Host/Origin/CSRF、限流和安全日志；
- 私有原图/公开衍生图双 OSS Bucket；
- 作品、常规领养、首页、委托和站点内容管理；
- 设定图/出厂照上传、核验、作品发布/下架；
- 活动 `brand-centered-v2` 作品水印；
- `site-display-v1` 无水印站点展示配方；
- 首页聚合投影、统一业务入口与方向感知详情图集；
- 文案 Card、分区版本和 FAQ 稳定 ID；
- 上传清扫、可信代理和按主体限流；
- publication/watermark/reconcile 的 lease、heartbeat、恢复和精确清理；
- unit、integration 与 Playwright 测试。

阶段 C 已完成并通过用户浏览器人工验收。历史“仍缺 reconcile、operation 恢复或后端分层”的描述已经失效。

## 3. 阶段 D 产物（2026-08-08 已落地）

### T35（工程完成，待独立 Review）

- 前向迁移 `0022_t35_return_photos.sql` 与 `return_photos`；
- 一图一记录（`asset_id` 单列 + 唯一索引）、作品/资产关联触发器、
  状态、版本与可选私有授权字段；
- `shared/schemas/return-photo.ts`、`repository/return-photo-repository.ts`、
  `service/return-photo.ts`、`api/admin/v1/returns/*`；
- `tests/integration/return-photo-management.test.ts`（10 项）；
- 记录：[`../implementation/notes/stage-d/T35-ENGINEERING-2026-08-08.md`](../implementation/notes/stage-d/T35-ENGINEERING-2026-08-08.md)。

### T36（工程主体完成，待补验证与 Review）

- `return_photo` 上传（`return` 归属）与完成核验；
- `recipe/return-display-recipe.ts`：`return-wall` / `return-display-v1`
  无水印变体，原比例、EXIF 收敛、480/768/1080 按源宽收敛；
- `runner/return-photo-publication.ts`：发布/下架/精确清理 + 启动恢复 resumer；
- `repository/public-return-repository.ts` 公开投影；
- `/admin/returns`（列表 + 新建 + 一图一记录编辑七分区）；
- 一级导航返图墙 `/returns`（CSS Grid row-span 原比例瀑布流 + 编号分页）；
- 管理预览服务端缩放 `?w=`（返图缩略图 711 KB → 11 KB）；
- 记录：[`../implementation/notes/stage-d/T36-ENGINEERING-2026-08-08.md`](../implementation/notes/stage-d/T36-ENGINEERING-2026-08-08.md)。

### T37（工程主体完成，待补验证与 Review）

- 前向迁移 `0023_t37_event_drop_fields.sql`：`event_name`（由
  `current_event_name` 规范）与 `event_time`，草稿容忍/发布强制的 CHECK；
- 作品编辑器四业务选项映射与展会两项字段；
- 发布检查 `EVENT_DROP_FIELDS_REQUIRED`；
- `/adoptions` 全部/常规领养/展会掉落筛选（普通链接、SSR 可用）；
- 首页当前领养、领养卡片与统一详情的展会信息；
- `tests/integration/event-drop-projection.test.ts`（3 项）；
- 未产生独立 event 模型、页面或媒体配方；
- 记录：[`../implementation/notes/stage-d/T37-ENGINEERING-2026-08-08.md`](../implementation/notes/stage-d/T37-ENGINEERING-2026-08-08.md)。

### 尚未产出的产物

- T35/T36/T37 的新上下文独立 Review 记录；
- T36/T37 的 390×844 手机闭环证据；
- 针对返图 operation 的 SIGKILL / 重复重启证据；
- 用户人工验收记录与 T42 门禁记录。

T38–T41 不产生代码产物。

## 4. 当前部署与 CI 产物

根目录和 `.github/` 提供：

- `Dockerfile`：Node 24 多阶段构建；
- `docker-compose.yaml`：migrate、app、nginx、数据卷和受控网络；
- `.env.compose.example`：不含真实 Secret 的环境模板；
- `deploy/nginx/`：公开/管理双 Host、未知 Host 拒绝和 upgrade map；
- `docs/DEPLOYMENT.md`：部署契约；
- `.github/workflows/quality.yml`：代码、Compose、镜像和 E2E 门禁；
- `.github/workflows/release-image.yml`：Docker Hub 镜像发布；
- `.github/dependabot.yml`：Actions、npm/pnpm 与 Docker 更新。

Node 24 runtime 镜像已经由 `image-build` 成功验证。当前 `checks` 的 Production build 失败和跳过的 E2E 由 T49 收口；正式域名、TLS、线上 Compose、空卷、升级、回滚和恢复演练由 T52 收口。

## 5. 品牌、素材与设计

正式素材来源和角色映射：

- [`../materials/MATERIAL-MANIFEST.md`](../materials/MATERIAL-MANIFEST.md)；
- `../materials/picture-examples/`；
- `public/brand/` 中的站点图标。

设计 Token 与信息架构：

- `../.design/public-site/`；
- `../.design/admin-console/`。

素材文档不决定水印。当前规则：站点展示和返图无水印，标准作品及所有领养使用活动水印。

调研、原型和历史截图只是输入与证据，不是生产源码模板或当前规则源。

## 6. 当前证据

### 阶段 C

- `../implementation/notes/t34-c1/`：C.1 实施与用户验收；
- `T34-C1-USER-ACCEPTANCE-2026-08-07.md`：阶段 C 用户验收与 CI 后置结论。

### 阶段 D

- [`../implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md`](../implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md)：返图、轻量掉落、取消项和顺序的用户确认记录。

后续 T35、T36、T37 分别建立实施、Review 和浏览器证据。普通 Playwright screenshot、trace 和 CI 产物进入 `test-results/`、`playwright-report/` 或 Actions artifact，不覆盖历史截图。

## 7. 历史与归档

历史记录集中在 `../implementation/notes/`。GATE-07、旧 T34 和调研文档对当时事实有效，但不能覆盖：

- 返图无水印；
- `/returns` 一级独立页面；
- 展会掉落复用领养且没有独立 event 实体；
- T38/T40 取消、T39 当前取消、T41 合并。

各目录的 `WATERMARK-CENTERED-V2.md` 只作为归档指针。