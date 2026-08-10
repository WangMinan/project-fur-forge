# 生产部署操作清单

> 这份文件直接写给站点所有者和实际部署人。所有服务器命令都在
> `root@120.26.51.205` 上执行，并以
> `/root/project-fur-forge` 为工作目录。
>
> 只有 T49、T50、GATE-E 完成并得到冻结 SHA 与
> `repository@sha256:digest` 后，才能执行首次正式部署。当前不要创建
> `v*` Git tag，也不要在服务器构建镜像。

## 1. 第一次部署前，先在阿里云控制台确认

按以下顺序检查；任一项不满足就先停止，不要靠放开 OSS 公读或开放 3000
端口绕过。

1. **正式 Host**
   - 公开 Host，例如 `ditedog.com`；
   - 管理 Host，必须与公开 Host 不同；
   - `public-media.ditedog.com` 只用于媒体，不进入 Nuxt。
2. **ESA DNS 与 TLS**
   - wildcard 临时记录已经收敛为公开/管理精确记录；
   - ESA 边缘证书覆盖正式公开、管理和媒体 Host；
   - 浏览器侧强制 HTTPS；
   - 页面/API 回源固定为 `120.26.51.205:80`、协议 HTTP；
   - 回源 Host 保留访客请求的精确 Host。
3. **ESA 媒体回源**
   - `public-media.ditedog.com` 使用同账号私有 OSS 回源；
   - origin 只指向 `project-furry-forge-public`；
   - 阿里云托管 STS 已开启，应用不保存 STS。
4. **两只 OSS Bucket**
   - `project-furry-forge-private` 与
     `project-furry-forge-public` 都是 private；
   - 两只都开启 Bucket Block Public Access；
   - 历史 Object ACL、Bucket Policy 没有遗留公开权限；
   - 私有 Bucket 的 CORS 只允许正式管理 Origin 条件 PUT；
   - 私有永久原图没有会误删它的生命周期规则。
5. **ESA 缓存与防护**
   - 按 `deploy/esa/cache-policy.json` 配置；
   - `/api/**`、管理 Host、登录/会话、写操作和首版 SSR HTML 绕过共享缓存；
   - `/_nuxt/**` 与 `prod/web/**` 使用不可变资源缓存；
   - 404 短缓存，源站错误/404 不提供 stale；
   - 启用源站保护/WAF；ECS 安全组的 80 只允许 ESA 回源地址；
   - ECS 不开放 443 和 3000；
   - 配置流量、4xx/5xx、purge、证书、ECS 磁盘、Nginx、容器和 ready 告警。
6. **Secret**
   - 本版本 OSS 与 ESA API 共用现有一套全权限阿里云 AK/SK；
   - 不再创建或填写第二套 `ESA_ACCESS_KEY_*`；
   - AK/SK 只写远程 `.env`，不贴进聊天、日志、截图、Git 或镜像；
   - 记录 ESA Site ID 和 API Endpoint
     `https://esa.cn-hangzhou.aliyuncs.com`。

控制台检查完成后，本地仓库还应先通过：

```bash
pnpm run verify:esa-cache
pnpm run verify:observability
```

## 2. 发布冻结镜像：不在服务器执行

GATE-E 后，在 GitHub Actions 手动运行 `release-image`：

1. ref 选择 `main`；
2. `image_tag` 填本次可识别的镜像标签，不用 `latest`；工作流会额外自动更新
   `latest` 便于人工查看和临时拉取；
3. `confirmation` 精确填写 `PUBLISH_GATE_E_IMAGE`。

工作流直接发布 ref 选择器对应的 `GITHUB_SHA`，无需再手工输入 40 位 Git
SHA。完成后，Actions Summary 会直接显示可复制的 `FROZEN_SHA=...` 与
`APP_IMAGE_REF=repository@sha256:...`；`image-release-evidence.json` 也保存
完整 `imageRef`。服务器仍使用该 digest 部署，不使用会随下次发布变化的
`latest`。无需创建 `v*` Git tag。

## 3. 第一次服务器部署

### 3.1 登录、确认变量和更新冻结代码

```bash
ssh root@120.26.51.205
cd /root/project-fur-forge

export FROZEN_SHA='替换为GATE-E的40位SHA'
export PUBLIC_HOST='替换为正式公开Host'
export ADMIN_HOST='替换为正式管理Host'

git fetch origin main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$FROZEN_SHA"
test -z "$(git status --porcelain)"
```

如果最后两个 `test` 任一失败，停止部署。

### 3.2 创建目录与生产配置

目标机已经有仓库、Nginx、Docker 和 Compose，不需要安装器。只创建证据/Nginx
备份目录和仓库根目录下的 `.env`：

```bash
cd /root/project-fur-forge
install -d -m 700 .data/evidence
install -d -m 700 /var/backups/project-fur-forge

test ! -e .env
install -m 600 .env.compose.example .env
vi .env
chmod 600 .env
```

在 `.env` 中逐项替换：

- `APP_IMAGE_REF`：冻结的 `repository@sha256:digest`；
- `PUBLIC_HOST`、`ADMIN_HOST`、`PUBLIC_BASE_URL`、`ADMIN_BASE_URL`；
- `MEDIA_BASE_URL=https://public-media.ditedog.com`；
- `DATABASE_FILE=/app/data/studio.db`；
- `OSS_REGION=oss-cn-hangzhou`；
- `OSS_ENDPOINT=https://oss-cn-hangzhou-internal.aliyuncs.com`；
- 私有/衍生 Bucket 名和私有 Bucket 公网上传 Origin；
- 现有 `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`；
- `ESA_SITE_ID` 与
  `ESA_API_ENDPOINT=https://esa.cn-hangzhou.aliyuncs.com`；
- `SESSION_SECRET`、备案字段；
- `TRUSTED_PROXY_CIDRS`：至少包含
  `172.30.250.1/32` 和控制台当日确认的全部 ESA 代理 CIDR。

没有 SMTP 配置。不要 `source .env`，也不要 `cat .env`。

### 3.3 校验 Compose 与镜像摘要

```bash
cd /root/project-fur-forge

docker compose config --quiet
test "$(docker compose config --services)" = "app"

IMAGE_REF="$(docker compose config --images)"
test "$(printf '%s\n' "$IMAGE_REF" | wc -l)" = "1"
printf '%s\n' "$IMAGE_REF" | grep -Eq '@sha256:[0-9a-f]{64}$'

docker pull "$IMAGE_REF"
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' \
  "$IMAGE_REF" | grep -Fx "$IMAGE_REF"
```

摘要不一致就停止；不要改用 tag，也不要在服务器 `docker build`。

### 3.4 迁移、生产预检、初始化管理员并启动

```bash
cd /root/project-fur-forge

docker compose run --rm --no-deps app node ops/ops.mjs migrate

# 先做无网络 dry-run。
docker compose run --rm --no-deps app node ops/ops.mjs preflight

# 第 1 节全部确认后才执行 live；它会创建并精确清理本次测试对象。
docker compose run --rm --no-deps app \
  node ops/ops.mjs preflight --no-dry-run

# 交互输入管理员用户名和密码。
docker compose run --rm --no-deps app node ops/ops.mjs init-admin

docker compose up --detach --no-build --no-deps app
docker compose ps

curl --fail --silent --show-error \
  --header "Host: $PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health/ready

ss -lntp | grep '127.0.0.1:3000'
! ss -lntp | grep -E '(0.0.0.0|\[::\]):3000'
```

`preflight` 任一 FAIL、blocked、非零退出或测试对象清理失败，都停止部署。
`docker compose ps` 只能有一个常驻 `app`。

### 3.5 安装与目标机匹配的 Nginx 配置

先确认现有环境：

```bash
cd /root/project-fur-forge

nginx -v 2>&1 | grep -Fx 'nginx version: nginx/1.30.4'
systemctl is-enabled nginx
systemctl is-active nginx
```

然后只备份并替换目标机实际使用的两个文件：

```bash
cd /root/project-fur-forge

for EXACT_HOST in "$PUBLIC_HOST" "$ADMIN_HOST"; do
  printf '%s\n' "$EXACT_HOST" | grep -Eq '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
  [[ "$EXACT_HOST" != *..* ]]
done
test "$PUBLIC_HOST" != "$ADMIN_HOST"

# MEDIA_BASE_URL 已经写在 .env；只读取这一条非 Secret 配置并取出 Host。
MEDIA_ORIGIN="$(sed -n 's/^MEDIA_BASE_URL=//p' .env)"
test "$(printf '%s\n' "$MEDIA_ORIGIN" | wc -l)" = "1"
MEDIA_HOST="${MEDIA_ORIGIN#https://}"
test "$MEDIA_ORIGIN" = "https://$MEDIA_HOST"
printf '%s\n' "$MEDIA_HOST" | grep -Eq '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
[[ "$MEDIA_HOST" != *..* ]]
test "$MEDIA_HOST" != "$PUBLIC_HOST"
test "$MEDIA_HOST" != "$ADMIN_HOST"

NGINX_BACKUP="/var/backups/project-fur-forge/nginx-$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$NGINX_BACKUP"
install -d -m 700 "$NGINX_BACKUP"
cp -a /etc/nginx/conf.d/ditedog.conf "$NGINX_BACKUP/"
cp -a /etc/nginx/conf.d/00-connection-map.conf "$NGINX_BACKUP/"

NGINX_CANDIDATE="$(mktemp)"
trap 'rm -f "$NGINX_CANDIDATE"' EXIT
sed \
  -e "s/@@PUBLIC_HOST@@/$PUBLIC_HOST/g" \
  -e "s/@@ADMIN_HOST@@/$ADMIN_HOST/g" \
  -e "s/@@MEDIA_HOST@@/$MEDIA_HOST/g" \
  deploy/nginx/app.conf.template >"$NGINX_CANDIDATE"
! grep -q '@@' "$NGINX_CANDIDATE"

install -m 0644 "$NGINX_CANDIDATE" /etc/nginx/conf.d/ditedog.conf
install -m 0644 deploy/nginx/00-connection-map.conf \
  /etc/nginx/conf.d/00-connection-map.conf

if ! nginx -t; then
  cp -a "$NGINX_BACKUP/ditedog.conf" /etc/nginx/conf.d/ditedog.conf
  cp -a "$NGINX_BACKUP/00-connection-map.conf" \
    /etc/nginx/conf.d/00-connection-map.conf
  nginx -t
  exit 1
fi

systemctl reload nginx

set -o pipefail
bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST" \
  --reload | tee .data/evidence/host-http-origin.txt
```

验证媒体 Host 与未知 Host 被拒绝：

```bash
test "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Host: $MEDIA_HOST" http://127.0.0.1/)" = "421"

test "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Host: unknown.ditedog.invalid' http://127.0.0.1/)" = "421"
```

### 3.6 创建首次备份并记录状态

```bash
cd /root/project-fur-forge

BACKUP_FILE="/app/backups/first-production-$(date -u +%Y%m%dT%H%M%SZ).db"
docker compose run --rm --no-deps app \
  node ops/ops.mjs backup --output "$BACKUP_FILE"

docker compose run --rm --no-deps app \
  node ops/ops.mjs recover-operations

docker compose ps
nginx -t
systemctl is-active nginx
ss -lntp | grep -E '(:80|127.0.0.1:3000)'
! ss -lntp | grep ':443'
```

之后再从正式域名做三视口、登录、上传、发布、下架/purge、告警和恢复验收。

## 4. 后续更新服务器镜像

先通过 `release-image` 得到新冻结 SHA 和新镜像摘要。然后在服务器执行：

```bash
ssh root@120.26.51.205
cd /root/project-fur-forge

export NEW_FROZEN_SHA='替换为新的40位SHA'
export PUBLIC_HOST='正式公开Host'
export ADMIN_HOST='正式管理Host'

git fetch origin main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$NEW_FROZEN_SHA"
test -z "$(git status --porcelain)"

# 用编辑器只更新 APP_IMAGE_REF；如契约未变，不改其他生产值。
vi .env
chmod 600 .env

docker compose config --quiet
NEW_IMAGE_REF="$(docker compose config --images)"
printf '%s\n' "$NEW_IMAGE_REF" | grep -Eq '@sha256:[0-9a-f]{64}$'
docker pull "$NEW_IMAGE_REF"
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' \
  "$NEW_IMAGE_REF" | grep -Fx "$NEW_IMAGE_REF"

UPGRADE_BACKUP="/app/backups/pre-upgrade-$(date -u +%Y%m%dT%H%M%SZ).db"
docker compose run --rm --no-deps app \
  node ops/ops.mjs backup --output "$UPGRADE_BACKUP"

docker compose run --rm --no-deps app node ops/ops.mjs migrate
docker compose up --detach --no-build --no-deps --force-recreate app

for attempt in $(seq 1 60); do
  curl --fail --silent --show-error \
    --header "Host: $PUBLIC_HOST" \
    http://127.0.0.1:3000/api/health/ready && break
  sleep 2
done

curl --fail --silent --show-error \
  --header "Host: $PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health/ready

docker compose ps
bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST"
```

验收完成前不要删除旧镜像和升级前备份。

## 5. 单独执行 db:migrate

任何时候需要单独迁移，都必须在仓库根目录、使用当前 `.env` 指向的冻结镜像：

```bash
ssh root@120.26.51.205
cd /root/project-fur-forge

docker compose config --quiet
docker compose run --rm --no-deps app node ops/ops.mjs migrate
```

迁移命令会先校验历史迁移，并在需要时创建验证备份。不要进入容器手改 SQLite，
不要在线覆盖当前数据库。

## 6. 回滚镜像与数据库

先把当前镜像摘要、回滚镜像摘要和升级前备份路径记下来。

只回滚镜像：

```bash
cd /root/project-fur-forge

export ROLLBACK_IMAGE_REF='repository@sha256:替换为旧摘要'
export PUBLIC_HOST='正式公开Host'

APP_IMAGE_REF="$ROLLBACK_IMAGE_REF" docker compose up \
  --detach --no-build --no-deps --force-recreate app

curl --fail --silent --show-error \
  --header "Host: $PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health/ready
```

确认通过后，才把 `.env` 的 `APP_IMAGE_REF` 持久改为旧摘要。

如果旧镜像不能读取迁移后的数据库，停止 app，把备份恢复到**新文件**：

```bash
cd /root/project-fur-forge

docker compose stop app
docker compose run --rm --no-deps app node ops/ops.mjs restore \
  --backup /app/backups/替换为升级前备份.db \
  --output /app/data/restored-$(date -u +%Y%m%dT%H%M%SZ).db
```

然后用 `vi .env` 同时切换 `DATABASE_FILE` 和 `APP_IMAGE_REF`，再执行：

```bash
docker compose config --quiet
docker compose up --detach --no-build --no-deps app
```

永远不要把 Bucket 改回 public-read，也不要覆盖活动数据库文件。
