# 实施计划

> **角色**：描述当前阶段仍有效的技术方案、执行顺序与边界。
> **最后更新**：2026-08-06。
> **当前阶段**：C.1 · P0 收口修复。

## 1. 稳定技术基线

- Nuxt 4、Vue 3、Nitro、Node.js 24、pnpm 11；
- SQLite + Drizzle，单实例、单写者；
- 阿里云 OSS 私有原图 Bucket + 公开衍生图 Bucket；
- 公开 Host 与管理 Host 由同一应用按 Host 严格隔离；
- Docker 镜像由 GitHub Actions 构建，目标平台暂定 `linux/amd64`；
- 正式域名、TLS、线上 Compose、升级与回滚演练延期到后续部署阶段。

## 2. 已经形成的 C.1 能力

截至 2026-08-06，以下主体已经落地，但仍需通过后续总门禁复核：

- `site-display-v1` 与 `none | watermark` 保护模式；
- 首页和委托 Hero 的无水印公开配方；
- 首页委托与领养入口的独立无水印 usage；
- 首页聚合投影、统一业务入口与详情竖图布局；
- 六个文案分区、独立版本、稳定 FAQ ID 与分区级 409；
- 稳定业务错误 `reason`；
- 过期上传主动清扫；
- 按可信主体分桶的限流与可信代理解析；
- Node 24 Dockerfile、Compose/Nginx 草案、live/ready、质量与镜像发布工作流。

已落地不等于已经通过 GATE-C1。当前远端 CI 失败，且 F1、F3、F4、F5 仍有明确缺口。

## 3. 当前必须关闭的问题

### 3.1 F1 · 既有站点展示媒体 reconcile

迁移 0017 只建立新身份与兼容读取，不会自动为所有既有已启用 Hero 和已发布领养补齐无水印变体。下一步需要增加幂等 reconcile 能力：

1. 扫描当前启用的首页 Hero；
2. 扫描当前启用的委托 Hero；
3. 扫描首页委托入口源；
4. 扫描首页领养入口源；
5. 核对并补齐缺失的 `site-display-v1` 变体；
6. 失败可重试，只清理当前 attempt 新建对象；
7. 验证 profile 切换不改变站点展示 URL 与摘要；
8. 在真实双 Bucket 凭据可用时执行匿名读取和私有原图不可读验证。

旧 Hero 水印变体继续作为迁移期 fallback，只有新投影稳定并经用户验收后才能清理。

### 3.2 F2/F3 · 小型产品契约收口

- 首页区块顺序必须在代码与公开站 IA 之间统一；当前权威目标为 `Hero → 精选作品 → 统一业务入口 → 当前领养`。
- 官方邮箱、QQ、抖音号和防诈骗提醒应归入同一个官方渠道 Card 与同一个 contact 分区；首屏设置不再承担邮箱、QQ 编辑。

### 3.3 F4/F5 · 服务边界与长任务恢复

> **2026-08-07 状态：已实现。** 五个层次落为 `server/utils/` 下的五个目录
> （`repository/`、`service/`、`runner/`、`recipe/`、`route/`），根目录只留跨层
> 基础设施。operation 模型的 attempt/lease/heartbeat/recovery_reason 由迁移
> 0020 落地，恢复流程见 `runner/operation-recovery.ts` 与插件 02。
> 本节保留为层次定义，新增后端代码继续按此归类。

不要继续向 `home-management.ts`、`work-publication.ts` 和 `watermark-branding.ts` 堆叠职责。围绕以下层次拆分：

- repository：SQL、行映射和条件更新；
- service：同步业务规则、校验和 DTO 组合；
- runner：持久 operation、OSS 副作用、阶段推进、清理与恢复；
- recipe/identity：纯函数与不可变媒体身份；
- route：Host、认证、Origin、CSRF、Schema、调用和安全错误转换。

operation 模型至少增加：

- `attempt`；
- `lease_owner`；
- `lease_expires_at`；
- `heartbeat_at`；
- `recovery_reason`；
- 必要时增加 `next_retry_at`。

恢复流程：

1. 事务内抢占 lease；
2. 外部 OSS 操作前后更新 heartbeat；
3. 提交阶段使用状态、版本和 lease 条件更新；
4. 启动时扫描非终止 operation；
5. 核对业务状态与已生成对象；
6. 可安全重放则接管，不可安全重放则转为可恢复失败；
7. 真实杀死 Node 进程并覆盖生成、验证和提交边界；
8. 多次重启保持幂等，旧有效公开版本持续可见。

范围至少覆盖：作品发布/下架、Hero 发布、Hero 放大、水印 profile 应用与站点展示 reconcile。

## 4. 数据库与 readiness

- 不修改已经执行的历史迁移；所有模型变化使用新的前向迁移。
- 长任务迁移需要同时更新 Drizzle schema、迁移元数据、约束、索引与测试 fixture。
- readiness 必须复用严格的迁移历史校验：数量、顺序、时间戳与 hash 均匹配；不能只比较迁移数量。
- readiness 不轮询 OSS；远端 Bucket、凭据与匿名读取验证放在 preflight。

## 5. Dockerfile

Dockerfile 采用标准多阶段构建：

1. 固定 Node 24 具体补丁版本；
2. 依赖阶段复制 package、lock 与版本控制内的 `pnpm-workspace.yaml`；
3. 使用 pnpm store cache 与 frozen install；
4. 严格执行仓库已审查的 `allowBuilds` 与 `strictDepBuilds`；
5. build 阶段构建 Nuxt 与 bundle 运维 CLI；
6. runtime 只包含 `.output`、生产依赖、迁移和运维文件；
7. 非 root、tini、持久数据与备份目录；
8. 构建期实际加载 SQLite、OSS SDK，并确认 FFmpeg 可执行。

不允许恢复为手工遍历并复制 `ali-oss` 或其他单包依赖树。

## 6. Docker Compose 与 Nginx

正式文件名统一为 `docker-compose.yaml`。

网络分为：

- `backend`：Nginx 与 app 的内部网络，不直接连公网；
- `egress`：app 访问 OSS 等外部服务；
- `edge`：Nginx 对外网络。

要求：

- app 不发布宿主机端口；
- migrate 与 app 复用同一镜像和数据卷；
- Nginx 等待 app ready；
- `TRUSTED_PROXY_CIDRS` 与 backend 的固定小网段一致；
- 未知 Host 返回 421；
- 精确屏蔽旧 `/api/health` 与 `/api/health/*`；
- 当前不生成证书、不硬编码真实域名、不启用 HSTS；
- 正式域名和 TLS 就位后再做线上验收。

## 7. CI 与 Dependabot

质量工作流包括：

- frozen install；
- lint、typecheck、unit、integration；
- production build 与 `verify:production`；
- secret/content scan；
- `docker compose -f docker-compose.yaml config`；
- GitHub Actions 内 Dockerfile 构建；
- 完整 E2E 与 artifact。

工作流使用当前受支持的 Action 主版本，并由 Dependabot维护：

- `github-actions`；
- npm/pnpm 依赖；
- Dockerfile 与 Compose 中的镜像引用。

Dependabot 自动合并不属于本任务。所有更新 PR 必须经过质量门禁和人工查看。

镜像发布工作流只在 `v*` tag 或手动触发时读取：

- `DOCKERHUB_USERNAME`；
- `DOCKERHUB_TOKEN`。

本阶段不创建 tag、不触发推送、不远程部署。

## 8. 下一步执行顺序

1. 人工配置 Docker Hub Repository Secrets，并观察本轮配置提交触发的 Actions；
2. Codex 修复当前业务代码 Typecheck/E2E 阻断；
3. 完成 F4/F5 的服务拆分与 operation 恢复；
4. 完成 F1 的站点媒体 reconcile 与真实双 Bucket 验证；
5. 完成 F2/F3 的首页顺序和官方渠道管理收口；
6. readiness 使用严格迁移历史校验；
7. 重放完整非 Docker 门禁和 GitHub Actions；
8. 用户执行 T34-F8 视觉、业务和独立 Review；
9. 用户确认后再勾选 GATE-C1，并决定是否进入 T35。

## 9. 非目标

C.1 不实现：

- 返图墙、完整展会模型、回收站、邮件找回、CSV 中心、访问统计、CDN 专项；
- 多管理员、多实例和分布式队列；
- 正式域名、真实 TLS、远程自动部署；
- 本地 Docker 构建与 Compose 验收；
- 提前进入 T35–T53。
