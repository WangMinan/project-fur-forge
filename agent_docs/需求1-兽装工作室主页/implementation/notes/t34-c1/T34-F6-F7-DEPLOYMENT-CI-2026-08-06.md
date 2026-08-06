# T34-F6 / T34-F7 · 运行镜像、Compose、Nginx 与 CI

> 状态：两项均完成。commit `1ffe68c`。
> **本地没有构建过镜像，也没有运行过容器——这是用户明确要求，不是遗漏。**

## T34-F6 交付文件

| 文件 | 说明 |
| --- | --- |
| `Dockerfile` | Node 24 三阶段（deps / build / runtime），非 root，tini 转发 SIGTERM |
| `compose.yaml` | migrate + app + nginx，只引用已发布镜像 |
| `.env.compose.example` | 环境示例，无真实 Secret、无真实域名 |
| `deploy/nginx/app.conf.template` | 双 Host 模板，域名与证书路径均可配置 |
| `deploy/nginx/upgrade-map.conf` | WebSocket 升级映射 |
| `docs/DEPLOYMENT.md` | 部署与运维说明 |

### 关键修正：不再手工复制依赖闭包

旧 Dockerfile 用 `node -e` 遍历 `pnpm list --prod --json`，手工把 `ali-oss` 的整棵依赖树复制到 `/runtime-node-modules`。已彻底删除，改用 **pnpm 官方 `pnpm deploy --prod`**，闭包完整性、版本一致性和 native 依赖由包管理器保证。没有为任何单个包写手工复制脚本。

### 运维命令可真正执行

`scripts/container-ops.ts` 在 build 阶段被 esbuild bundle 成单个 `ops/ops.mjs`。因此运行镜像：

- 不含 tsx、Playwright 或任何测试依赖；
- 不会出现"复制了 TypeScript 源码却缺少执行器"的情况。

子命令：`migrate`、`init-admin`、`reset-admin-password`、`backup`、`restore`、`restore-verify`、`preflight`、`cleanup-expired-uploads`。

**实际验证**（非 Docker，本地跑真实 bundle）：

| 命令 | 结果 |
| --- | --- |
| `migrate` | `{"applied":20,...}` 全部迁移生效 |
| `cleanup-expired-uploads` | `{"scanned":0,...,"dryRun":true}` 默认 dry-run |
| `backup` | 生成备份文件 |
| `restore-verify` | `{"verified":true}` |
| `reset-admin-password`（无 confirm） | 正确拒绝 |

### 健康检查

- `/api/health/live`：只证明进程能响应，不碰数据库与 OSS；
- `/api/health/ready`：打开数据库、比对迁移数量、校验 `site_content` / `site_branding` 基础记录；未就绪返回 503。**刻意不探测远端 OSS**，那属于 `preflight`。

**实际验证**（对真实生产构建产物）：

```
pre-migrate  live : 200 {"status":"live"}
pre-migrate  ready: 503 {"databaseOpen":false,"migrationsCurrent":false,"baselineRecords":false}
post-migrate live : 200 {"status":"live"}
post-migrate ready: 200 {"databaseOpen":true,"migrationsCurrent":true,"baselineRecords":true}
```

迁移前后行为不同，证明它是真实检查而不是固定 `ok`；响应体不含路径、SQL 或 Secret。

### 安全边界

`app` / `migrate` 只在 `internal: true` 网络且**不发布任何端口**，仅 `nginx` 暴露 80/443；未知 Host 由 `default_server` 返回 421，不回落公开站；保留原始 `Host` 并转发 `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto`；请求体上限 32 MB 与 30 MB 原图策略一致；管理端响应不进共享缓存；`.dockerignore` 排除 `.env*`。

## T34-F7 工作流

| 文件 | 触发 | 内容 |
| --- | --- | --- |
| `.github/workflows/quality.yml` | push main / PR / 手动 / `workflow_call` | frozen install、lint、typecheck、unit、integration、build、`verify:production`、secret/content scan、`docker compose config`、**CI 内 Dockerfile 构建**、完整 E2E |
| `.github/workflows/release-image.yml` | `push tags: v*` / 手动 | 复用质量门禁 → login → buildx → build-push |

- Secrets 仅 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`，**PR 不读取、不尝试发布、不 echo PAT**；
- 默认镜像 `${DOCKERHUB_USERNAME}/project-fur-forge`，标签含 Git tag、短 SHA，`latest` 只跟随正式版本 tag；
- 默认平台仅 `linux/amd64`：`better-sqlite3` 与 `ffmpeg-static` 平台相关，无经过验证的 arm64 依据前不加多架构；
- 无远程部署 job、无 SSH、不创建 GitHub Release；
- `concurrency` 取消同分支旧运行，`permissions: contents: read`；
- 截图与 trace 只进 artifact，不写回 `agent_docs`。

### secret scan 经过反向验证

`scripts/ci-secret-scan.mjs` 检测 Aliyun AK、Docker Hub PAT、PEM 私钥与长 secret 赋值，放行文档占位值与自标注的测试 fixture。

不只验证"干净仓库通过"，还用一个含合成 `LTAI…` 与 `dckr_pat_…` 的 canary 文件确认**它真的会失败**（exit 1），随后删除 canary。一个永不报警的扫描器没有价值。

## 顺带落地的 T34-F5 片段

F6 的命令清单需要 `cleanup-expired-uploads`，因此先实现了 F5 的上传清扫：

- 迁移 0019 增加 `upload_sessions.cleaned_at`；
- 只扫描已过期且未完成的会话，**基于数据库记录逐个删除精确 Object Key，绝不使用宽泛 prefix delete**；
- 幂等、默认 dry-run、失败可重试、日志脱敏、永久原图不受影响。

F5 其余部分（operation lease / 心跳 / 启动恢复 / 限流分桶）**仍未完成**，任务保持未勾选。

## 本轮未执行（用户明确要求）

- 本地 `docker build`、`docker compose up`、空卷演练、本地 Nginx 验收；
- 创建 `v*` tag、触发发布工作流、推送任何镜像；
- 正式域名、真实 TLS、线上部署验收、升级/回滚/恢复演练。

只做了不依赖 Docker daemon 的静态检查：compose YAML 解析并断言结构（服务集合、app 不发布端口、healthcheck、`stop_grace_period`、`depends_on` 条件、命名卷、internal 网络隔离）、工作流 `run` 块 `bash -n`、环境变量引用与示例文件交叉核对、Dockerfile 与 package script 路径存在性。

## 验证

| 项目 | 结果 |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` | 通过 |
| `pnpm build` | 通过 |
| `pnpm verify:production` | 通过 |
| `pnpm test`（unit） | 19 files / 108 通过 |
| `pnpm test:integration` | 13 files / 107 通过 |
| 迁移 0019 | 全新库 20 项、`integrity_check ok`、外键 0 违规 |
| ops bundle 真实执行 | 5 个命令逐个验证（见上表） |
| 健康检查真实探测 | 迁移前 503 / 迁移后 200 |
| secret scan 反向验证 | canary 触发 exit 1 |
