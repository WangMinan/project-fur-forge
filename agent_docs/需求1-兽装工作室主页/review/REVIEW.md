# 当前评审记录

> **角色**：记录当前 SPEC、代码、部署文件、GitHub Actions 与任务状态之间的差异。
> **评审日期**：2026-08-06，2026-08-07 更新 finding 关闭状态。
> **初始代码基线**：`aac745167e640e5ef20b4d054539a9a245ca109e`。
> **本轮业务收口起点**：`10a18291edc62a13296859ac7a2102c744086907`。
> **结论**：`PASS WITH REQUIRED CLOSURE`（实施项已关闭，等待远端全绿与用户验收）。

## 1. 总结论

阶段 C 主业务链成立，T34-F1–F6 的实施项已在 2026-08-07 全部关闭：R-18 至 R-22
逐项完成，R-17 的业务侧门禁错误已修复且本地完整非 Docker 门禁通过。

当前不能结束阶段 C 的原因只剩两项，且都不在实施者手里：

1. `quality` 三个 job 尚未在同一 SHA 全绿——被自托管 runner 未接单阻断，
   Compose 静态检查也因此没有真正执行到；
2. T34-F8 需由用户执行视觉验收，并由新上下文独立 Review 给出 `PASS`。

因此 T34-F1–F6 可按实际证据勾选，T34-F7 等待远端 runner，
T34-F8 与 GATE-C1 保持未通过。

## 2. 已确认有效的实现

以下能力应保留，不推倒重写：

- `protection_mode` 与 `site-display-v1`；
- 首页/委托 Hero 及两个业务入口的无水印 usage；
- 作品和领养展示位的活动水印；
- 首页聚合 DTO、统一业务入口和竖图详情布局；
- 文案分区 Card、分区版本、FAQ 稳定 ID 与 409 草稿保留；
- 稳定 API `reason` 和前端英文消息匹配清理；
- 过期上传主动清扫；
- 可信代理解析与按主体限流；
- 容器运维命令、live/ready、Nginx 双 Host 和镜像发布流程骨架；
- 经 GitHub Actions 验证可成功构建的 Node 24 runtime 镜像。

## 3. finding 关闭状态（2026-08-07 更新）

### R-17 · 远端质量门禁 —— **业务侧已关闭，等待 runner**

`ControlBody.placement` 已用共享 `HeroPlacement` 类型修复。本地 `APP_ENV=test`
下 lint、typecheck、unit(118)、integration(137+)、build、verify:production、
secret scan 与 E2E 全部通过。

远端仍未取得同一 SHA 三 job 全绿：最近几次 push 的 job 以
`The job was not acquired by Runner of type hosted` 结束，属于自托管 runner
未接单，不是代码失败。需用户确认 runner 后重跑。

### R-18 · 既有站点素材迁移 —— **已关闭**

迁移 0021 增加 `site_display_reconcile_operations`；
`pnpm media:reconcile-site-display` 与容器 `reconcile-site-display` 子命令扫描
启用首页 Hero、启用委托 Hero、首页委托入口源与已发布常规领养入口源。
幂等（重复运行 `skipped` 命中、不新增对象）、可重试、可恢复（接管同一条
operation）、失败保留旧投影。真实双 Bucket 9/9 通过，含 profile 切换后站点
展示 URL 与摘要不变。

### R-19 · 长任务重启恢复 —— **已关闭**

迁移 0020 为两张 operation 表加入 attempt、lease_owner、lease_expires_at、
heartbeat_at、recovery_reason、next_retry_at。事务内抢占、OSS 前后心跳、
提交时对 status/版本/attempt/lease_owner 做 CAS、启动扫描接管或转明确失败。
覆盖 HOME PUBLISH/UPSCALE、WORK PUBLISH/UNPUBLISH、WATERMARK
PREVIEW/REBUILD 与 reconcile 六类。

真实 SIGKILL 子进程测试覆盖生成、公开对象验证与数据库提交三个边界，并用新的
子进程执行恢复；断言不卡运行态、不出现半套 SourceSet、重复重启幂等、既有有效
对象不被删除、日志不泄漏 Object Key 或凭据。

### R-20 · 后端职责边界 —— **已关闭**

抽出 `hero-repository`、`publication-repository`、`watermark-repository`、
`variant-repository`；`media-recipe` 与 `site-display-recipe` 的 SQL 计数归零。
`server/utils` 按 repository/service/runner/recipe/route 分目录，层次体现在
路径上。SQL 文本与列别名逐字保留，API、公开 DTO、状态机与浏览器行为不变。

### R-21 · F2/F3 产品边界 —— **已关闭**

首页顺序改为 Hero → 精选作品 → 统一业务入口 → 当前领养，与公开站 IA 一致。
官方邮箱、QQ、抖音号与防诈骗提醒统一在 contact 分区 Card 编辑；
`updateHomeSettingsRequestSchema` 为 strict，旧字段被拒绝，不存在两个入口。

### R-22 · readiness 校验 —— **已关闭**

readiness 复用 `migrationState`，同时比较数量、顺序、created_at/folderMillis
与 hash。七条负/正路径用例覆盖 hash 不同、顺序不同、有待应用迁移、缺基础记录、
数据库不存在与正确数据库，并断言响应体不泄漏路径、SQL、表名或栈。
旧 `/api/health` 不再固定返回 ok。

### R-23 · Compose 网络与健康路由 —— **配置已完成，等待流水线执行到**

配置修订已在上一轮完成。`docker compose -f docker-compose.yaml config --quiet`
仍需在 runner 恢复后的运行里真正执行到。

## 4. 本次配置提交的允许范围

本轮仅修改：

- `agent_docs/`；
- `Dockerfile`；
- `compose.yaml` → `docker-compose.yaml`；
- `.env.compose.example`；
- `deploy/nginx/`；
- `docs/DEPLOYMENT.md`；
- `.github/workflows/`；
- `.github/dependabot.yml`。

明确未修改：

- `app/`；
- `server/`；
- `shared/`；
- `tests/`；
- `scripts/` 中的业务与运维实现；
- 数据库迁移；
- `package.json` 与 lockfile。

因此，当前 `checks` 的 TypeScript 失败是刻意留给下一轮业务修复的边界，不是通过放宽门禁解决。

## 5. C.1 通过条件

只有以下条件全部满足，才允许把本文件结论改为 `PASS`：

- 既有站点素材 reconcile 完成；
- 站点展示无水印、作品/领养展示继续有水印；
- profile 切换不改变站点展示 URL 与摘要；
- 首页顺序和官方渠道入口收口；
- 后端边界完成且行为不回归；
- 长任务 lease、heartbeat、启动恢复与进程中断测试通过；
- 过期上传清扫与限流保持通过；
- readiness 使用严格迁移校验；
- GitHub Actions `checks`、`image-build`、`e2e` 在同一最新 main 全绿；
- 完整非 Docker 本地门禁通过；
- 用户完成 T34-F8 视觉验收；
- 新上下文独立 Review 为 `PASS`。

正式域名、TLS、线上 Compose、空卷部署、升级、回滚、恢复和 Docker Hub 正式发布仍延期到部署阶段，不属于本轮 GATE-C1。
