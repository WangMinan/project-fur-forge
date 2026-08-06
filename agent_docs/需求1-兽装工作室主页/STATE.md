# 状态

> **角色**：当前需求的状态机与执行入口。只记录现在有效的阶段、阻断项和下一步；历史过程见 `implementation/notes/`。
> **最后更新**：2026-08-06。
> **复核基线**：`aac745167e640e5ef20b4d054539a9a245ca109e`；当前配置收口 HEAD 为 `3b384c5f54610c92e22e3f2e069cb5365e27bcc6`。

## 当前阶段

项目仍处于 **阶段 C.1 · P0 收口修复**。

阶段 C 的作品、常规领养、首页、委托、管理端、双 Bucket、发布、备份和安全主链已经成立；本轮重新核对代码、文档与 GitHub Actions 后，结论继续保持：

> **PASS WITH REQUIRED CLOSURE**

当前不能勾选 `T34-F8` 或 `GATE-C1`，也不能进入 T35。主要原因不是页面主功能缺失，而是既有素材迁移、长任务重启恢复、后端边界和完整远端门禁尚未闭环。

本次配置收口只修改：

- `agent_docs/` 当前状态和下一步；
- `Dockerfile`、`docker-compose.yaml`、Nginx 与部署说明；
- `.github/workflows/` 与 `.github/dependabot.yml`；
- Compose 环境示例。

**没有修改 `app/`、`server/`、`shared/`、`tests/` 或数据库迁移等业务代码。**

## 已确认且继续有效的产品决策

媒体公开规则仍以 [`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源：

- 首页与委托页横竖 Hero 使用无水印站点展示变体；
- 首页委托和领养入口使用各自独立的无水印变体；
- 作品列表、作品详情、领养列表和领养设定图继续使用活动水印；
- 永久原图、处理源和 Logo 候选始终私有。

首页入口与营业状态合并为统一业务入口卡；作品详情竖图使用限宽舞台；管理端文案使用分区 Card 和分区版本。

## 当前任务状态

| 任务 | 当前状态 | 剩余工作 |
| --- | --- | --- |
| T34-F1 | **部分完成** | `site-display-v1` 与保护模式已落地；仍需为既有启用 Hero/已发布领养执行幂等 reconcile，并完成真实双 Bucket 与 profile 不变性验证 |
| T34-F2 | **主体完成，待收口** | 首页聚合、入口卡、竖图和索引复位已落地；需统一首页区块顺序并做最终三视口视觉回归 |
| T34-F3 | **主体完成，待收口** | 六个 Card、分区版本和 FAQ 稳定 ID 已落地；邮箱、QQ、抖音和防诈骗说明仍需统一为一个可编辑官方渠道入口 |
| T34-F4 | **部分完成** | 稳定错误 `reason` 与部分 composable 拆分完成；Hero、作品发布、水印应用和公开投影的 repository/service/runner 边界未完成 |
| T34-F5 | **部分完成** | 上传清扫、可信代理和按主体限流完成；operation lease、heartbeat、启动恢复和真实进程中断测试未完成 |
| T34-F6 | **配置修订完成，镜像构建通过，任务仍未关闭** | GitHub Actions `image-build` 已在 `3b384c5` 成功；仍需 readiness 严格迁移校验，并在 `checks` 修复后执行 Compose 静态检查 |
| T34-F7 | **重新打开** | 工作流与 Action 版本已更新；`checks` 仍被业务测试 fixture 的 TypeScript 错误阻断，`e2e` 因依赖 `checks` 正确跳过 |
| T34-F8 | **未开始** | 由用户执行最终视觉验收和新上下文独立 Review |
| GATE-C1 | **未通过** | 依赖以上全部关闭 |

## 已确认的当前阻断项

### 1. 远端 CI

配置收口后，最新可核验的 `quality` 结果为：

- `image-build`：**成功**。pnpm 依赖脚本批准、Nuxt production build、显式 workspace deploy、独立输出目录、runtime SQLite/OSS/FFmpeg 自检和 Buildx 全部通过；
- `checks`：在 `tests/fixtures/runtime/e2e-fake-media-control.ts` 的 `ControlBody` 缺少 `placement` 类型处失败；
- `e2e`：因为声明 `needs: checks`，在基础门禁失败时正确跳过。

本次按用户要求没有修改上述 TypeScript 业务测试 fixture。下一轮 Codex 必须先修复该错误，再让 unit、integration、build、verify、Compose config 和 E2E 真正执行。

### 2. 既有站点素材迁移

新发布路径能生成无水印变体，但现有已启用 Hero 和既有已发布领养不保证已经拥有完整 `site-display-v1`。需要持久、幂等的 reconcile 命令或 operation，不能依赖管理员手动禁用再启用。

### 3. 长任务恢复

`publication_operations` 和 `watermark_operations` 仍缺少 attempt、lease、heartbeat 和启动接管。Node 进程在生成、验证或提交阶段退出后，任务仍可能永久停在运行态并阻塞后续操作。

### 4. 后端职责边界

`home-management.ts`、`work-publication.ts`、`watermark-branding.ts` 等仍混合 SQL、业务规则、OSS 副作用、状态机和清理逻辑。F4 与 F5 应合并推进，先冻结行为测试，再形成 repository/service/runner 边界。

### 5. 小型产品契约

- 首页区块顺序需要与公开站 IA 统一；
- 官方邮箱、QQ、抖音和防诈骗说明需要在同一个 Card 中编辑；
- readiness 应复用严格迁移历史/hash 校验，而不只比较迁移数量。

## 部署与 CI 当前约束

- Compose 文件统一命名为根目录 `docker-compose.yaml`；
- 本地仍禁止执行 `docker build`、`docker compose up`、空卷演练或本地 Nginx 验收；
- Dockerfile 已由 GitHub Actions 成功构建验证；
- 当前没有正式域名，不生成证书、不启用 HSTS、不声称完成 TLS；
- 不创建 `v*` tag，不触发 Docker Hub 发布，不远程部署；
- 镜像发布只读取 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`；
- 正式域名、TLS、线上 Compose、升级、回滚和恢复演练延期到部署阶段。

## 下一步执行顺序

1. 用户在 GitHub 仓库配置 Docker Hub Secrets；
2. Codex 先修复 `ControlBody.placement` 及随之暴露的 CI 业务代码错误；
3. 合并完成 T34-F4 与 T34-F5：服务边界、operation lease/heartbeat/启动恢复和进程中断测试；
4. 完成 T34-F1 既有素材 reconcile 与真实双 Bucket 验证；
5. 收口 T34-F2/F3 的首页顺序和官方渠道入口；
6. 修正 readiness 严格迁移验证；
7. 重跑完整非 Docker 门禁与 GitHub Actions，要求 `checks`、`image-build`、`e2e` 全绿；
8. 用户执行 T34-F8，确认后再勾选 `GATE-C1` 并进入 T35。

具体 finding 和实施边界见：

- [`review/REVIEW.md`](./review/REVIEW.md)
- [`implementation/TASKS.md`](./implementation/TASKS.md)
- [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)
- [`implementation/notes/t34-c1/T34-C1-RECHECK-2026-08-06.md`](./implementation/notes/t34-c1/T34-C1-RECHECK-2026-08-06.md)

## 当前权威文档

| 主题 | 权威文件 |
| --- | --- |
| 产品边界 | [`foundation/README.md`](./foundation/README.md) |
| 功能与验收 | [`requirements/SPEC.md`](./requirements/SPEC.md) |
| 媒体公开与保护 | [`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md) |
| 总体技术方案 | [`planning/PLAN.md`](./planning/PLAN.md) |
| 当前任务与完成状态 | [`implementation/TASKS.md`](./implementation/TASKS.md) |
| 下一轮执行边界 | [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md) |
| 当前评审 | [`review/REVIEW.md`](./review/REVIEW.md) |
