# 产物索引

> **角色**：列出当前可用产物、交付配置和历史证据入口，不复制需求或任务状态。
> **当前阶段**：C.1 P0 收口；状态见 [`../STATE.md`](../STATE.md)。
> **最后校准**：2026-08-06。

## 1. 当前权威入口

| 主题 | 文件 |
| --- | --- |
| 产品边界 | [`../foundation/README.md`](../foundation/README.md) |
| 功能规格 | [`../requirements/SPEC.md`](../requirements/SPEC.md) |
| 媒体公开与保护 | [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) |
| 技术计划 | [`../planning/PLAN.md`](../planning/PLAN.md) |
| 数据模型 | [`../models/README.md`](../models/README.md) |
| 设计入口 | [`../.design/README.md`](../.design/README.md) |
| 任务清单 | [`../implementation/TASKS.md`](../implementation/TASKS.md) |
| 执行路由 | [`../implementation/EXECUTION_ROUTING.md`](../implementation/EXECUTION_ROUTING.md) |
| 当前评审 | [`../review/REVIEW.md`](../review/REVIEW.md) |
| 历史证据索引 | [`../implementation/notes/README.md`](../implementation/notes/README.md) |

## 2. 当前业务代码产物

主分支已经包含：

- Nuxt 4 公开站与管理端；
- SQLite/Drizzle schema、迁移、备份与验证恢复；
- 唯一管理员认证、Host/Origin/CSRF 与安全日志；
- 私有原图/公开衍生图双 OSS Bucket；
- 作品、常规领养、首页、委托和站点内容管理；
- 作品发布/下架、Hero 发布/放大与水印 profile；
- `site-display-v1` 无水印站点展示配方；
- 首页聚合投影、统一业务入口与方向感知详情图集；
- 六个文案 Card、分区版本和 FAQ 稳定 ID；
- 上传过期清扫、可信代理和按主体限流；
- unit、integration 与 Playwright 测试。

这些能力是 C.1 的实现基础，但当前仍缺少既有媒体 reconcile、operation 重启恢复、完整后端分层、少量产品契约和全绿 CI。不能据此宣布 P0 正式候选。

## 3. 当前部署与 CI 产物

根目录和 `.github/` 当前提供：

- `Dockerfile`：Node 24.18.0 多阶段构建；
- `docker-compose.yaml`：migrate、app、nginx、数据卷、backend/egress/edge 网络；
- `.env.compose.example`：不含真实 Secret 的环境模板；
- `deploy/nginx/app.conf.template`：公开/管理双 Host 与未知 Host 拒绝；
- `deploy/nginx/upgrade-map.conf`：WebSocket upgrade map；
- `docs/DEPLOYMENT.md`：当前部署契约；
- `.github/workflows/quality.yml`：代码、Compose、镜像和 E2E 门禁；
- `.github/workflows/release-image.yml`：Docker Hub 镜像发布；
- `.github/dependabot.yml`：Actions、npm/pnpm 与 Docker 更新。

当前只准备和远端验证这些文件。本地 Docker/Compose、正式域名、TLS、线上升级与回滚仍延期。

## 4. 品牌、素材与设计

正式素材来源和角色映射见：

- [`../materials/MATERIAL-MANIFEST.md`](../materials/MATERIAL-MANIFEST.md)；
- `../materials/picture-examples/`；
- `public/brand/` 中的站点图标。

设计 Token 和信息架构见：

- `../.design/public-site/`；
- `../.design/admin-console/`。

素材文档不决定是否打水印；媒体保护只以当前媒体策略为准。`planning/prototype-v1/` 和 dated screenshots 只属于历史验证，不是生产源码模板或自动视觉基线。

## 5. C.1 当前证据

目录：`../implementation/notes/t34-c1/`

当前包含 F1–F5 的实施记录，以及：

- [`../implementation/notes/t34-c1/T34-C1-RECHECK-2026-08-06.md`](../implementation/notes/t34-c1/T34-C1-RECHECK-2026-08-06.md)：最新代码、Actions、部署与任务边界复核。

普通 Playwright screenshot、trace 和 CI 产物进入 `test-results/`、`playwright-report/` 或 GitHub Actions artifact，不写回历史目录。

## 6. 历史证据与归档

历史记录集中在 `../implementation/notes/`，保留各阶段首次失败、修复、截图与结论。历史 T34 `PASS` 只代表当时约定的最小镜像和门禁，不覆盖 C.1 的新增要求。

以下旧水印文件只作为归档指针：

- `../.design/WATERMARK-CENTERED-V2.md`；
- `../foundation/WATERMARK-CENTERED-V2.md`；
- `../requirements/WATERMARK-CENTERED-V2.md`；
- `../planning/WATERMARK-CENTERED-V2.md`；
- `../models/WATERMARK-CENTERED-V2.md`。

只有 T34-F8 和 GATE-C1 通过后，当前业务代码、部署配置、CI 与 C.1 证据才共同构成 P0 候选。
