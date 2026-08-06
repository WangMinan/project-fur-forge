# 部署说明（T34-F6 / T34-F7）

> 当前只准备交付文件和 GitHub Actions。根据用户要求，本地不执行 Docker build、Docker Compose、Nginx 或空卷验收。
> 正式域名、TLS、线上部署、升级和回滚延期到部署阶段。

## 文件组成

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | Node 24.18.0 多阶段构建、受控依赖脚本策略、非 root runtime |
| `docker-compose.yaml` | migrate + app + nginx、数据卷、备份卷、内部网络与 OSS egress |
| `.env.compose.example` | Shell 安全的环境示例，不含真实 Secret |
| `deploy/nginx/app.conf.template` | 双 Host、未知 Host 拒绝、安全头和健康端点屏蔽 |
| `deploy/nginx/upgrade-map.conf` | WebSocket upgrade map |
| `.github/workflows/quality.yml` | 代码门禁、Compose 静态检查、镜像构建和 E2E |
| `.github/workflows/release-image.yml` | tag/手动触发的 Docker Hub 发布 |
| `.github/dependabot.yml` | GitHub Actions、npm/pnpm 和 Docker 更新 |

## Dockerfile

镜像使用：

```text
node:24.18.0-bookworm-slim
pnpm 11.18.0
linux/amd64
```

pnpm 11 默认拒绝未批准的依赖构建脚本。Dockerfile 会在依赖阶段同时复制版本控制内的 `pnpm-workspace.yaml`，严格执行其中的 `allowBuilds` 与 `strictDepBuilds`；此前 Docker 构建遗漏该文件，才导致 `ERR_PNPM_IGNORED_BUILDS`。

仓库 package、lockfile 与依赖构建策略不会在镜像内被临时改写。生产依赖由 `pnpm deploy --prod --legacy` 生成，不手工复制 `ali-oss` 或其他单包依赖树。

runtime 构建期自检会：

- 创建 SQLite 内存数据库并执行查询；
- 加载 `ali-oss`；
- 确认 `ffmpeg-static` 路径存在且可执行。

## Compose 网络

`docker-compose.yaml` 使用三个网络：

- `backend`：`internal:true`，仅用于 Nginx、app 和 migrate 之间通信；
- `egress`：app 主动访问阿里云 OSS；
- `edge`：Nginx 发布 80/443。

app 不发布宿主机端口。`BACKEND_SUBNET` 与 `TRUSTED_PROXY_CIDRS` 默认都为 `172.30.250.0/24`；如与宿主机网络冲突，必须同时修改。

## 运维命令

首次部署前：

```bash
cp .env.compose.example .env
# 填入真实镜像、域名、Bucket、凭据和 Session Secret
```

常用命令：

```bash
docker compose -f docker-compose.yaml pull
docker compose -f docker-compose.yaml run --rm migrate
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs init-admin
docker compose -f docker-compose.yaml up -d

docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs preflight
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs cleanup-expired-uploads --dry-run
```

管理员初始化不会在每次启动时重置密码。危险操作继续要求显式确认。

## 健康检查

- `/api/health/live`：Node 进程存活；
- `/api/health/ready`：数据库可打开、迁移历史（数量、顺序、时间戳与 hash）严格匹配、基础记录就绪；
- `/api/health`：旧兼容端点，已改为与 ready 相同的诚实判定（未就绪返回 503），Nginx 仍明确对公网返回 404。

Compose 直接在 app 容器内访问 `/api/health/ready`。Nginx 不向公网暴露任何健康端点。

readiness 后续仍需由业务代码复用严格迁移 history/hash 校验；当前不应仅凭迁移数量作为最终上线证据。

## GitHub Actions

### `quality.yml`

在 main push、PR、手动触发和 reusable workflow 中运行：

- frozen install；
- lint；
- typecheck；
- unit；
- integration；
- production build；
- production verify；
- secret/content scan；
- `docker compose -f docker-compose.yaml config --quiet`；
- Dockerfile `linux/amd64` build；
- 完整 Chromium E2E；
- artifact 上传。

Compose 静态检查使用 workflow 内显式 dummy 环境，不读取真实 Secret，也不 source 人类示例文件。

### `release-image.yml`

触发方式：

- `push tags: v*`；
- `workflow_dispatch` 并提供 `image_tag`。

发布前复用完整 quality workflow。镜像名：

```text
${DOCKERHUB_USERNAME}/project-fur-forge
```

需要 Repository Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

工作流不 SSH、不远程部署、不创建 GitHub Release、不回显 PAT。

## 当前不执行

- 本地 `docker build`；
- 本地 `docker compose up`；
- 本地 Nginx/TLS；
- 空卷 migrate/init/ready；
- 正式域名和证书；
- 创建 `v*` tag；
- Docker Hub 正式发布；
- 线上升级、回滚和恢复。

这些不是遗漏，而是已经明确延期的部署阶段工作。
