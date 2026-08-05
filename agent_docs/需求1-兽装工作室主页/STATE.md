# 状态

> **角色**：当前需求的状态机与执行入口。只记录现在有效的阶段、已确认决策、阻断项和下一步；历史过程见 `implementation/notes/`。
> **最后更新**：2026-08-05。

## 当前阶段

项目进入 **阶段 C.1 · P0 收口修复**。当前进度：**T34-F1、T34-F2、T34-F3 已实现并推送 `main`；T34-F4 待开始。T34-F8 与 GATE-C1 保持未勾选，等待用户最终 Review。**

阶段 C 的作品、领养、首页、委托、管理、OSS、发布、备份和安全主链已经完成工程实现；T34 的历史独立 Review 结论仍保留为 `PASS`。本轮完整审查确认，当前版本在视觉一致性、媒体保护契约、代码边界、长任务恢复和可重复部署方面仍有必须关闭的问题，因此不再把现有镜像和页面视为正式上线候选，也不提前进入 T35 之后的 P1 功能。

本轮结论：

> **PASS WITH REQUIRED CLOSURE**：阶段 C 功能主链成立；完成 T34-F1 至 T34-F8 后再进行 P0 用户验收。

本次文档收敛只修改 `agent_docs/需求1-兽装工作室主页/`，不改产品代码。现有代码仍包含站点大图带水印、文案整包保存和最小 Docker 镜像等旧行为。

## 已确认产品决策

### 媒体保护

水印由公开展示位置决定，不由图片方向决定。当前唯一事实源为 [`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md)。

- 首页 Hero 横图、竖图：无水印；
- 委托页 Hero 横图、竖图：无水印；
- 首页委托与领养入口大图：生成独立无水印站点展示衍生图；
- 作品列表、作品详情、领养列表、领养设定图：继续使用活动水印；
- 永久原图、预处理源和 Logo 候选：始终私有。

### 首页信息架构

不继续保留独立的“委托/领养入口区”和“当前状态区”。两个业务入口合并为统一入口卡，每张卡在图片上或相邻信息区表达业务名称、当前状态、短说明和行动入口。

### 作品详情竖图

详情图集按当前图片方向渲染。竖图不再放入横向满宽灰色舞台；保持完整显示、合理限宽和白色页面背景。切换作品时必须重置图集选中状态。

### 管理端文案

现有 `SiteContentCard.vue` 拆为多个业务 Card，至少覆盖：

- 委托基础文案；
- 委托 FAQ；
- 关于工作室与制作范围；
- 服务条款；
- 隐私政策；
- 官方渠道与防诈骗提示。

每个分区独立保存和版本控制，不再通过完整旧草稿覆盖其他管理员已经更新的分区。

## 必须关闭的问题

### 1. 媒体契约

- 增加无水印站点展示配方和数据库表达；
- 首页两个业务入口使用独立派生用途；
- 水印 profile 切换只影响作品保护图片；
- 迁移期间保持旧公开页面可用，完成后再清理旧 Hero 水印对象。

### 2. 视觉与前端状态

- 合并首页入口和状态；
- 修复详情竖图舞台；
- 拆分后台文案 Card；
- 补充横竖图、路由复用、图集重置和三视口视觉回归。

### 3. 代码边界

- 拆分 `home-management.ts`、`media-recipe.ts`、`watermark-branding.ts`、`work-publication.ts` 等巨型服务；
- 拆分 `useAdminHome.ts` 和大型管理组件；
- API 增加稳定业务 `reason`，前端不再匹配英文错误文案；
- 删除经本地引用检查确认的重复或失效图片原语。

### 4. 可靠性

- 为 Hero 发布、Hero 放大和水印应用增加 lease、心跳、超时和启动恢复；
- 进程重启后运行中任务不得永久卡死，也不得永久阻塞新操作；
- 增加过期上传会话主动清扫，并用 OSS 生命周期规则只兜底临时前缀；
- 限流按可信主体分桶，避免匿名流量耗尽唯一管理员的全局窗口。

### 5. 部署

- 使用标准 Node 24 镜像完成完整 frozen 构建；
- 不再手工复制 `ali-oss` 依赖闭包；
- 运行镜像包含迁移、管理员初始化、备份和恢复所需脚本及迁移文件；
- 新增版本控制内的 Compose 和 Nginx 双 Host 配置；
- 提供 `live` 与 `ready` 健康检查。

**本轮范围限制（用户明确要求）**：T34-F6 只准备 Dockerfile、Compose、Nginx 与运维文件，并做不依赖 Docker daemon 的静态检查；**不在本地执行任何 Docker 构建或容器验收**。镜像构建验证由 T34-F7 的 GitHub Actions 执行。空数据卷演练、升级、回滚、恢复、正式域名与 TLS 延期到用户后续部署阶段，不计入 GATE-C1。

### 6. CI

新增 GitHub Actions：质量门禁（frozen install、lint、typecheck、unit、integration、production build、verify:production、secret/content scan、`docker compose config`、Dockerfile 构建验证）与镜像发布（tag `v*` 或手动触发，推送 Docker Hub）。完整 E2E 可以分为必跑核心集和手动/定时全量集。

镜像发布只使用 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN` 两个 Repository Secret；本轮完成 workflow 文件后不创建 tag、不触发发布、不添加远程部署。

## 当前任务状态

- T01–T29、T31–T33、GATE-06、GATE-07、EXT-01、EXT-02：历史完成状态保持有效；
- T26-F1、T27-F1、T30、T34：工程与独立 Review 事实保留，但不再单独等待验收，统一纳入 C.1 总门禁；
- T34-F0：本轮 Review 结论和文档去重，已授权执行；
- T34-F1：已实现并推送（迁移 0017、`site-display-v1`、首页业务入口独立派生、profile 切换边界），等待 T34-F8 用户验收；
- T34-F2：已实现并推送（首页聚合投影与故障隔离、统一业务入口卡、详情竖图方向感知与图集索引复位）；
- T34-F3：已实现并推送（迁移 0018、六个文案分区独立版本、FAQ 稳定 ID、分区级 409 保留草稿）；
- T34-F4–T34-F7：待按 [`implementation/TASKS.md`](./implementation/TASKS.md) 串行完成；
- T34-F8：由用户执行，实施者只交付可 Review 状态；
- T35 以后：暂不启动。

当前无开放 OQ。实现过程中若出现会改变业务事实、公开内容或正式部署域名的新问题，再登记 OQ；纯工程选择由实现者按 SPEC 与 PLAN 收敛。

## 执行顺序

1. T34-F1：站点无水印媒体契约与迁移；
2. T34-F2：首页和详情视觉修复；
3. T34-F3：文案 Card 与分区并发；
4. T34-F4：服务、组件和错误契约减债；
5. T34-F5：长任务恢复、上传清扫和限流；
6. T34-F6：完整镜像、Compose、Nginx、迁移与健康检查；
7. T34-F7：CI 门禁；
8. T34-F8：完整自动化、真实浏览器、重启恢复、部署演练和用户验收。

写入继续直接在最新 `main` 串行完成；后端、前端、Review 的责任和交接要求见 [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)。

## 当前权威文档

| 主题 | 权威文件 |
| --- | --- |
| 产品边界 | [`foundation/README.md`](./foundation/README.md) |
| 功能与验收 | [`requirements/SPEC.md`](./requirements/SPEC.md) |
| 媒体公开与保护 | [`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md) |
| 技术方案 | [`planning/PLAN.md`](./planning/PLAN.md) |
| 数据模型 | [`models/README.md`](./models/README.md) |
| 公开站与管理端信息架构 | [`.design/README.md`](./.design/README.md) |
| 任务状态 | [`implementation/TASKS.md`](./implementation/TASKS.md) |
| 执行分工 | [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md) |
| 当前评审 | [`review/REVIEW.md`](./review/REVIEW.md) |
| 产物索引 | [`artifacts/ARTIFACTS.md`](./artifacts/ARTIFACTS.md) |
| 历史证据 | [`implementation/notes/README.md`](./implementation/notes/README.md) |

dated notes、旧原型和归档指针只说明当时事实，不得覆盖以上当前权威文件。
