# 当前评审记录

> **角色**：记录当前 SPEC、代码、部署文件、GitHub Actions 与任务状态之间的差异。
> **评审日期**：2026-08-06。
> **初始代码基线**：`aac745167e640e5ef20b4d054539a9a245ca109e`。
> **配置收口验证 HEAD**：`3b384c5f54610c92e22e3f2e069cb5365e27bcc6`。
> **结论**：`PASS WITH REQUIRED CLOSURE`。

## 1. 总结论

阶段 C 的主业务链已经建立，T34-F1–F3 也完成了大部分产品改造；但是当前不能结束阶段 C，原因包括：

1. 最新 `quality` 的 `image-build` 已成功，但 `checks` 仍在业务 TypeScript fixture 处失败，`e2e` 因依赖 `checks` 正确跳过；
2. 既有已启用 Hero 和既有已发布领养没有统一 reconcile 到无水印站点变体；
3. 长任务没有 lease、heartbeat 和启动恢复；
4. 后端 repository/service/runner 边界未完成；
5. 首页顺序、官方渠道入口和 readiness 严格迁移校验仍有小型契约缺口；
6. T34-F8 尚未由用户执行。

因此 T34-F1、F2、F3、F4、F5、F6、F7 均未满足完整完成定义，T34-F8 与 GATE-C1 保持未通过。

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

## 3. 必须关闭的 finding

### R-17 · 远端质量门禁仍未全绿

本轮配置修复经历并关闭了三个镜像构建问题：

1. Dockerfile 未复制 `pnpm-workspace.yaml`，pnpm 11 报 `ERR_PNPM_IGNORED_BUILDS`；
2. `pnpm deploy` 未显式选择 workspace package，报 `ERR_PNPM_NOTHING_TO_DEPLOY`；
3. deploy 输出到仓库已有的 `/app/deploy`，报 `ERR_PNPM_DEPLOY_DIR_NOT_EMPTY`。

最终 Dockerfile 使用：

```bash
pnpm --filter=project-fur-paws --prod deploy --legacy /app/runtime-deploy
```

在 commit `3b384c5` 的 `quality` run 中：

- `image-build`：**SUCCESS**；
- `checks`：仍在 `tests/fixtures/runtime/e2e-fake-media-control.ts` 的 `ControlBody.placement` TypeScript 错误处失败；
- `e2e`：因 `needs: checks` 正确跳过；
- Compose 静态检查位于 `checks` 后半段，尚未执行到。

下一轮必须修复业务 fixture 并继续处理随后暴露的真实失败，不能通过跳过 typecheck、放宽 Schema 或移除 E2E 让流水线变绿。

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
- app/migrate 使用只读根文件系统、`no-new-privileges` 与 capabilities 收缩；
- Compose 静态检查改用显式 dummy 环境，不再 source 人类示例文件。

Compose config 仍需在 `checks` 修复后由流水线实际执行到并通过。

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
