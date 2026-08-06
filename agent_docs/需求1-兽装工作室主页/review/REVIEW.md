# 当前评审记录

> **角色**：记录当前 SPEC、代码、部署文件、GitHub Actions 与任务状态之间的差异。
> **评审日期**：2026-08-06。
> **代码基线**：`aac745167e640e5ef20b4d054539a9a245ca109e`。
> **结论**：`PASS WITH REQUIRED CLOSURE`。

## 1. 总结论

阶段 C 的主业务链已经建立，T34-F1–F3 也完成了大部分产品改造；但是当前不能结束阶段 C，原因包括：

1. 最新 `quality` 工作流的 `checks`、`image-build`、`e2e` 全部失败；
2. 既有已启用 Hero 和既有已发布领养没有统一 reconcile 到无水印站点变体；
3. 长任务没有 lease、heartbeat 和启动恢复；
4. 后端 repository/service/runner 边界未完成；
5. 首页顺序、官方渠道入口和 readiness 严格迁移校验仍有小型契约缺口；
6. T34-F8 尚未由用户执行。

因此 T34-F1、F2、F3、F6、F7 需要按“部分完成/待验证”重新打开，F4、F5继续保持未完成。

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
- 容器运维命令、live/ready、Nginx 双 Host 和镜像发布流程骨架。

## 3. 必须关闭的 finding

### R-17 · 当前 GitHub Actions 失败

复核时最新运行：

- `checks` 在 TypeScript typecheck 失败：`ControlBody` 没有 `placement`；
- `image-build` 因 pnpm 11 `ERR_PNPM_IGNORED_BUILDS` 失败，未批准 `better-sqlite3`、`esbuild`、`ffmpeg-static`、`unrs-resolver`；
- `e2e` 因测试服务未成功启动而失败；
- 原 Compose 检查通过 source `.env.compose.example` 注入环境，示例中的 `<...>` 与空必填值不适合作为 CI 环境；
- 旧 Action 版本触发 Node.js 20 弃用警告。

本次配置提交已：

- Dockerfile 依赖阶段复制版本控制内的 `pnpm-workspace.yaml`，执行既有 `allowBuilds` / `strictDepBuilds`；
- 将 Action 更新到 2026-08-06 核验的稳定版本；
- 使用 `pnpm/setup@v2.0.0`；
- 让 Compose 检查使用显式 dummy 环境；
- 将 E2E 设为依赖 checks，避免基础门禁失败后继续浪费运行资源。

`ControlBody.placement` 属于业务测试 fixture，本次按用户要求不修改，留给下一轮 Codex。

### R-18 · 既有站点素材没有迁移闭环

新发布路径能够生成 `site-display-v1`，但迁移 0017 主要改变数据库身份，不会主动为所有既有对象生成新文件。公开 Hero 仍存在旧水印回退，已发布领养入口也可能没有独立变体。

必须增加幂等 reconcile：

- 扫描当前启用首页 Hero；
- 扫描当前委托 Hero；
- 扫描首页委托入口源；
- 扫描当前及必要的已发布常规领养入口源；
- 生成/验证缺失变体；
- 记录失败并可重试；
- 只清理当前 attempt 新对象；
- 旧投影持续可用；
- 真实双 Bucket 验证。

### R-19 · 长任务重启恢复尚未实现

当前 publication/watermark operation 缺少：

- attempt；
- lease owner；
- lease expiry；
- heartbeat；
- recovery reason；
- 启动扫描与接管。

必须覆盖 Hero 发布、Hero 放大、作品发布/下架、水印预览/应用和 reconcile。需要真实杀死 Node 进程并在生成、验证、提交边界重启，确认不会永久卡住或产生半套公开对象。

### R-20 · 后端职责仍过度集中

`home-management.ts`、`work-publication.ts` 和水印逻辑仍混合 SQL、规则、OSS、operation 和清理。F4 应与 F5 一起完成：

- repository：SQL 和映射；
- service：业务规则与事务入口；
- runner：operation、lease、OSS 副作用、恢复与清理；
- recipe/identity：纯函数；
- route：权限、Schema 和安全响应。

重构前先补 characterization tests，重构后比较 API、SQL、公开 DTO、状态机与浏览器行为。

### R-21 · F2/F3 尚有两个产品边界

- 当前 `index.vue` 的业务入口与精选作品顺序和公开站 IA 不一致；必须统一代码或 IA；
- 官方渠道 Card 中邮箱和 QQ 仍为只读，管理员需要回“首屏设置”修改；必须把邮箱、QQ、抖音和防诈骗说明放入同一个可编辑并发分区。

### R-22 · readiness 校验不足

现有 readiness 主要比较已应用迁移数量与文件数量。项目已有迁移 hash/顺序验证能力，应复用严格检查，防止数量相同但历史不同的数据库错误返回 ready。

### R-23 · Compose 网络和健康路由

旧 Compose 只把 app 接入 `internal:true` 网络，会阻断应用主动访问阿里云 OSS。旧 Nginx 只屏蔽 `/api/health/`，没有屏蔽固定返回 ok 的 `/api/health`。

本次配置提交已：

- 将文件命名统一为 `docker-compose.yaml`；
- 增加 app 专用 egress 网络；
- backend 使用小型可配置子网，并与可信代理 CIDR 对齐；
- 精确屏蔽 `/api/health` 与 `/api/health/`；
- app/migrate 使用只读根文件系统、`no-new-privileges` 与 capabilities 收缩。

## 4. 本次配置提交的允许范围

允许修改：

- `agent_docs/`；
- `Dockerfile`；
- `compose.yaml` → `docker-compose.yaml`；
- `.env.compose.example`；
- `deploy/nginx/`；
- `docs/DEPLOYMENT.md`；
- `.github/workflows/`；
- `.github/dependabot.yml`。

明确不修改：

- `app/`；
- `server/`；
- `shared/`；
- `tests/`；
- `scripts/` 中的业务与运维实现；
- 数据库迁移；
- `package.json` 与 lockfile。

因此，本次提交后 `quality` 仍可能因已知 TypeScript 业务错误失败；这不是通过放宽门禁解决，而是下一轮业务修复入口。

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
- GitHub Actions `checks`、`image-build`、`e2e` 在最新 main 全绿；
- 完整非 Docker 本地门禁通过；
- 用户完成 T34-F8 视觉验收；
- 新上下文独立 Review 为 `PASS`。

正式域名、TLS、线上 Compose、空卷部署、升级、回滚、恢复和 Docker Hub 正式发布仍延期到部署阶段，不属于本轮 GATE-C1。
