# 部署说明（T34-F6 / T34-F7）

> 本轮只准备交付文件。**本地没有构建过镜像，也没有运行过容器**——这是用户明确要求，不是遗漏。
> 镜像构建验证由 GitHub Actions 承担；正式域名、TLS 与线上 Compose 验收留到部署阶段。

## 组成

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | Node 24 多阶段构建（deps / build / runtime），非 root，tini 转发信号 |
| `compose.yaml` | migrate + app + nginx、持久卷、健康检查、网络隔离 |
| `.env.compose.example` | 环境示例，不含任何真实 Secret 或真实域名 |
| `deploy/nginx/app.conf.template` | 双 Host 反向代理模板，域名与证书路径均可配置 |
| `deploy/nginx/upgrade-map.conf` | WebSocket 升级映射（挂到 `conf.d`） |
| `.github/workflows/quality.yml` | 质量门禁 + CI 内镜像构建验证 + E2E |
| `.github/workflows/release-image.yml` | tag / 手动触发的镜像发布 |

## 镜像构建方式

生产依赖使用 **pnpm 官方的 `pnpm deploy --prod`**。旧实现手工遍历 `pnpm list` 复制
`ali-oss` 依赖闭包，已彻底删除：不再为任何单个包写手工复制脚本。

运维脚本在 build 阶段用 esbuild bundle 成单个 `ops/ops.mjs`，因此运行镜像：

- 不含 tsx、Playwright 或任何测试依赖；
- 也不会出现「复制了 TypeScript 源码却缺少执行器」的情况。

运行镜像实际包含：Nitro 生产输出、生产依赖闭包、数据库迁移文件、
运维脚本、FFmpeg runtime（`ffmpeg-static`）、`ali-oss`、`better-sqlite3` native binding。

## 容器内运维命令

同一镜像提供全部子命令：

```bash
docker compose run --rm app node ops/ops.mjs migrate
docker compose run --rm app node ops/ops.mjs init-admin
docker compose run --rm app node ops/ops.mjs reset-admin-password --confirm RESET_SINGLE_ADMIN_PASSWORD
docker compose run --rm app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose run --rm app node ops/ops.mjs restore --backup /app/backups/manual.db --output /app/data/restored.db
docker compose run --rm app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose run --rm app node ops/ops.mjs preflight
docker compose run --rm app node ops/ops.mjs cleanup-expired-uploads --dry-run
```

危险操作保留显式确认：`reset-admin-password` 必须带
`--confirm RESET_SINGLE_ADMIN_PASSWORD`；`cleanup-expired-uploads` 默认 dry-run，
真正删除需要显式 `--no-dry-run`。

管理员初始化**不会**在每次启动自动重置密码，只能通过上面的一次性命令执行。

## 健康检查

- `GET /api/health/live`：只证明 Node 进程能响应，不触碰数据库或 OSS。
- `GET /api/health/ready`：检查数据库可打开、迁移版本匹配、必要基础记录存在；
  未就绪返回 503。**刻意不探测远端 OSS**——那属于 `preflight`，避免每次探活都产生远端调用。

两个接口都不泄漏路径、SQL、Secret 或异常栈；Nginx 侧也拒绝对外暴露 `/api/health/`。

## 首次部署步骤（部署阶段执行）

```bash
cp .env.compose.example .env      # 填入真实镜像名、域名、Bucket 与 Secret
# 把正式证书放入 TLS_CERT_DIR 指向的目录
docker compose pull
docker compose run --rm migrate
docker compose run --rm app node ops/ops.mjs init-admin
docker compose up -d
curl -fsS https://<PUBLIC_HOST>/api/health/live   # 经 Nginx 外部不可达，需在内部网络验证
```

## 安全边界

- `app` 与 `migrate` 只接内部网络（`internal: true`），**不发布任何端口**；只有
  `nginx` 暴露 80/443。
- 未知 Host 由 `default_server` 明确拒绝（421），不回落到公开站。
- 保留原始 `Host`，并转发 `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto`。
- `TRUSTED_PROXY_CIDRS` 留空时不解析任何转发链，外部客户端无法伪造
  `X-Forwarded-For`。
- 请求体上限 32 MB，与 30 MB 原图上传策略一致。
- 管理端响应不进入任何共享缓存。
- `.dockerignore` 排除 `.env*`，Secret 不会进入镜像。

## GitHub Actions

`quality.yml`（push main / PR / 手动 / 被复用）：frozen install、lint、typecheck、
unit、integration、production build、`verify:production`、secret/content scan、
`docker compose config` 静态展开、**CI 内 Dockerfile 构建验证**、完整 E2E。
截图与 trace 只进 artifact，不写回 `agent_docs`。

`release-image.yml`（`push tags: v*` / 手动）：先复用质量门禁，再
`docker/login-action` → `setup-buildx` → `build-push`，推送版本 tag、短 SHA，
`latest` 只跟随正式版本 tag。

需要在仓库 Secrets 配置：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`（Docker Hub PAT）

默认镜像名 `${DOCKERHUB_USERNAME}/project-fur-forge`，默认平台仅 `linux/amd64`
（`better-sqlite3`、`ffmpeg-static` 是平台相关依赖，没有经过验证的 arm64 依据前不加多架构）。

PR 不会读取 Docker Hub Secret，也不会尝试发布。工作流不 echo PAT。

## 本轮未执行

- 本地 `docker build` / `docker compose up` / 空卷演练 / 本地 Nginx 验收；
- 创建 `v*` tag、触发发布工作流、推送任何镜像；
- 正式域名、真实 TLS 证书、线上部署验收；
- 升级 / 回滚 / 恢复演练。

以上留到用户部署阶段，不计入 GATE-C1。
