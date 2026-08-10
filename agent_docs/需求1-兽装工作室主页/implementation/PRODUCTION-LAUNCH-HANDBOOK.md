# 有点小狗 · 上线手册

> 当前不能上线：T52-E1～E6 工程已完成，T49、T50 和 GATE-E 尚未完成。本手册只保留目标环境真正要执行的内容。

## 1. 已知生产参数

| 项目 | 当前值 |
| --- | --- |
| ESA Site | `ditedog.com`，Site ID `171890925863148` |
| 权威 NS | `nasser.ns.atrustdns.com`、`hindu-kush.ns.atrustdns.com` |
| ECS origin | `120.26.51.205:80`，HTTP |
| app upstream | `127.0.0.1:3000` |
| 公开媒体 Host | `public-media.ditedog.com` |
| 媒体 origin | `project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com` |
| 私有原图 Bucket | `project-furry-forge-private` |
| 网页衍生 Bucket | `project-furry-forge-public` |
| ECS OSS Endpoint | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 正式公开 Host | `ditedog.com`；其他精确 Host 在 T53-F1 确认 |
| 正式管理 Host | T53-F1 确认 |
| 冻结 commit/镜像 | GATE-E 填写 |

### 目标机实测基线（2026-08-10，只读）

| 项目 | `root@120.26.51.205` 实际状态 |
| --- | --- |
| 系统 | Ubuntu 24.04.4 LTS（Noble），Linux 6.8.0-124-generic，amd64 |
| Nginx | 官方 `nginx.org` Noble 包 `1.30.4-1~noble`；systemd enabled + active |
| Nginx 文件 | `/etc/nginx/nginx.conf` 包含 `/etc/nginx/conf.d/*.conf`；站点为 `ditedog.conf`，连接 map 为 `00-connection-map.conf` |
| 监听 | Nginx 监听 IPv4/IPv6 80；没有 443 和 3000 |
| Docker | Engine 29.6.2；Compose v5.3.1；systemd enabled + active |
| 仓库 | `/root/project-fur-forge`；当时为干净 `main@19d0b3c8`，部署时必须前向更新到 GATE-E SHA |
| 当前业务容器/卷 | 没有容器、业务 volume 或自定义 network；没有 `.env` |
| 磁盘 | 根盘 40 GiB，已用约 8.8 GiB，可用约 29 GiB |
| 主机防火墙 | UFW inactive；ESA 源站保护依赖阿里云安全组当前规则，不能把 UFW 状态当作源站保护证据 |

该表只用于让部署基线符合现有机器，不表示 T53 已完成。部署期间若系统、包、端口、目录或 Docker 版本漂移，先停止并重新评估，不运行通用安装器覆盖现状。

已完成：ESA NS 接入、边缘证书、ECS HTTP/80 回源限制、`public-media` 同账号私有 OSS 回源；宿主机 acme.sh、续期 cron、本地证书和 443 已卸载，Nginx 仅监听 80。

首版不做自定义边缘 URL 鉴权。ESA 到私有 OSS 的 STS 回源签名由阿里云自动完成，应用不创建、保存或刷新 STS。管理员条件上传仍直连私有 Bucket 的公网 OSS 域名。

## 2. 固定拓扑

```text
浏览器 --HTTPS--> ESA
                    |-- 页面/API --HTTP:80--> 宿主机 Nginx --> 127.0.0.1:3000 --> app
                    `-- public-media --> ESA 托管 STS 私有回源 --> 网页衍生 Bucket

管理员浏览器 --签名 PUT--> 私有 Bucket 公网 OSS 域名
app/migrate/ops --杭州内网 Endpoint--> 两只 OSS Bucket
```

两只 Bucket 上线时都设为 private 并开启 Bucket 级 Block Public Access。应用新写入网页衍生 Bucket 的生产对象只能是已验证、允许公开展示的派生图片；永久原图、处理源和管理预览只能在私有原图 Bucket。既有 `dev/web/**` 等本地测试衍生对象可以暂时保留，预检不要求它们与当前生产数据库一致，也不会清理它们。

## 3. GATE-E 前必须交付

- app-only Compose：唯一常驻服务是 app，端口只映射 `127.0.0.1:3000`；migrate、preflight、init、backup、restore、recover 使用同一镜像的一次性容器。
- 宿主机 Nginx 模板：只监听 80，只接受正式公开/管理精确 Host，未知 Host 返回 `421`，向应用传递受控 `X-Forwarded-Proto=https`。
- 生产配置：浏览器上传基址、OSS 内外网 Endpoint、ESA Site/API Endpoint 显式分离；OSS 与 ESA API 共用 `.env` 中现有一套阿里云 AK/SK，Secret 不进仓库、镜像、日志或截图。
- ESA 精确刷新：应用使用阿里云官方 SDK 调用 `PurgeCaches(Type=file)`，保存 `TaskId`，再用 `DescribePurgeTasks` 收敛；不做全站刷新。
- 同一 SHA 通过 T49、T50，并由 GATE-E 写入唯一镜像摘要和回滚摘要。

SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)；刷新参数、返回值与任务状态以 [PurgeCaches API](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches)、[DescribePurgeTasks API](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks) 为准。

## 4. ESA 与 OSS 上线配置

1. 把临时 wildcard 路由收敛为正式公开/管理精确 Host；ESA 与 Nginx 都拒绝未知 Host。
2. 保持客户端 HTTPS 强制、ECS 回源 HTTP/80；生产启用源站保护后，ECS 80 只允许 ESA 回源地址。
3. `public-media` 保持同账号私有 OSS 回源，origin 精确指向网页衍生 Bucket。该授权由 ESA 使用 STS 完成，业务应用不参与；不要配置自定义边缘鉴权、签名查询参数、媒体鉴权 Key/TTL 或业务侧 STS。
4. 两只 Bucket 切为 private + BPA；核对历史 Object ACL、Bucket Policy、CORS 和生命周期规则。CORS 在排障期可以保持通配 Origin/Header，只需确保正式管理 Origin 的条件 PUT 可用；衍生 Bucket 是否存在 CORS 不作为预检阻断。
5. 按 `deploy/esa/cache-policy.json` 的优先级配置缓存：管理 Host 与 `/api/**`/会话/写操作绕过，公开 SSR HTML 初始绕过，`/_nuxt/**` 缓存 365 天，`public-media` 的 `prod/web/**` 节点缓存 30 天、浏览器缓存 7 天并忽略全部无业务意义 query；404 缓存 60 秒，禁止源站错误或 404 时提供 stale。其他媒体路径拒绝。
6. 记录现有全权限阿里云 AK/SK 的权限边界和保管位置；OSS 与 ESA API 共用该凭据，不创建第二套 ESA AccessKey。preflight 只验证本任务实际所需的 OSS/ESA 能力，不以控制面拒绝作为通过条件。

控制台保存后先停止写入并核对：两只 OSS 原站匿名 GET/HEAD 为 403；数据库中已发布的 `prod/web/**` 通过 `public-media` 返回 200；响应最终地址和响应头不暴露 OSS 原站。既有本地测试衍生对象或未登记旧对象不参与生产数据库双向一致性门禁，也不要求清理。其余失败不得靠放开 Bucket ACL、添加自定义签名或把私有对象移入网页衍生 Bucket 规避。

配置前后都运行 `pnpm run verify:esa-cache` 校验仓库基线。阶段 F 将控制台实际规则逐项抄入脱敏证据并与同一 JSON 比对；不得只凭浏览器 `Cache-Control` 判断 ESA 节点缓存，query 合并、404 TTL 和 stale 禁用还要用目标域名的冷/热请求实测。

官方依据：[ESA 私有 OSS 回源](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/use-esa-to-accelerate-oss-resource-access)、[ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)、[ESA 边缘证书](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/configure-edge-certificates/)。

## 5. 防盗刷、预算与可观测性

仓库基线是 `deploy/esa/security-observability-policy.json`，先运行：

```bash
pnpm run verify:observability
```

该基线固定以下边界：Free 只用于开发/验证，正式环境必须在 T53-F1/F2 当日确认生产套餐和配额；ESA 边缘强制 HTTPS、证书只由 ESA 托管，ECS 回源只用 HTTP/80；正式环境启用源站保护，ECS 80 只允许控制台当前列出的 ESA 融合节点 IP，app 仍只监听 `127.0.0.1:3000`。ESA 节点 IP 清单变化必须重新复核安全组，不能把旧清单永久当常量。

WAF 开启托管防护并从 observe-first 开始；管理员认证、公开统计写入和公开读取分别配置速率规则。基线只固化 Host/path/度量维度和“观察后再 block/challenge”的动作顺序，所有 QPS、错误率、延迟、流量、磁盘、证书提前量、purge 用时和费用数字保持 `null`。不得凭本机结果或经验值直接写生产阈值；T53 先测量正常流量，再把结果、误报检查和最终阈值写入脱敏证据。

目标环境页面响应、首次/重复请求、缓存证据头、请求量和受控峰值入口：

```bash
pnpm run measure:production -- \
  --target "public-home=https://${PUBLIC_HOST}/" \
  --target "public-works=https://${PUBLIC_HOST}/works" \
  --target "admin-login=https://${ADMIN_HOST}/admin/login" \
  --target "public-media=https://public-media.ditedog.com/prod/web/EXACT-PUBLISHED-OBJECT" \
  --output .data/evidence/production-baseline.json
```

默认只做每个精确 HTTPS URL 的两轮顺序请求、HTTP→HTTPS 跳转和 ESA 边缘证书检查；只保存页面/文件响应字节、时延、状态与缓存相关响应头，不保存响应正文、Cookie、query、凭据或任意 Secret。输出把两轮写作 `first-observed` / `repeat-observed`；只有另有精确 purge 完成、全新不可变对象或控制台 cache miss 证据时，才能把首次观测标成 cold，重复请求也必须结合 ESA 节点缓存响应头/控制台指标判断，不能只看浏览器 `Cache-Control`。

受控请求量/峰值探测默认关闭。只有用户明确授权目标、请求数和并发后才运行，工具硬限制最多 100 请求、并发最多 10：

```bash
pnpm run measure:production -- \
  --target "public-home=https://${PUBLIC_HOST}/" \
  --load-target public-home \
  --load-requests MEASURED_REQUEST_COUNT \
  --load-concurrency MEASURED_CONCURRENCY \
  --allow-load-probe \
  --output .data/evidence/production-load-probe.json
```

告警清单必须逐项留证：ESA 套餐/配额、流量、源站 5xx、边缘 4xx/5xx、缓存命中、purge 失败/用时、实际公开 Host 的 ESA 托管证书；ECS 磁盘、Nginx active/config test/reload/HTTP origin、app 容器与 ready。证书告警不检查 ECS/宿主机证书，因为宿主机不应保存或终止 TLS。

预算只配置通知；不得把通知、套餐配额或用量封顶描述成无延迟的强制停费开关。月预算、通知档位、套餐配额/用量封顶是否可用及其统计延迟，都在 T53-F1/F2 按当日产品能力记录。脱敏证据从 `deploy/esa/observability-evidence.example.json` 复制到仓库外或被忽略的 `.data/evidence/` 后填写；不覆盖旧文件，不提交 Secret、控制台 Cookie、AccessKey、完整请求头或带 query 的 URL。

宿主机验证入口如下；第一条默认只读，第二条只有在第一条全 PASS 后才显式验证安全 reload：

```bash
mkdir -p .data/evidence
sudo bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST" \
  | tee .data/evidence/host-http-origin-before-reload.txt

sudo bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST" \
  --reload \
  | tee .data/evidence/host-http-origin-after-reload.txt
```

必须同时通过：`nginx -t`、监听 80、无监听 443、app 仅 loopback 3000、无 acme.sh/Certbot/Let’s Encrypt service/timer/process/文件、ready 200、公开/管理精确 Host 的 HTTP origin 可用。任一 FAIL 立即停止；reload 前已有 FAIL 时脚本不会 reload。管道执行时应在支持 `pipefail` 的 shell 中运行并保留脚本退出码。

官方依据：[ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)、[ESA 安全规则](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/security-rules)、[ESA 频率控制](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/frequency-control-rules)、[ESA 缓存命中率优化](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/improve-cache-hit-ratio-on-esa)。

## 6. 部署命令

以下命令只针对上表实测的 `root@120.26.51.205:/root/project-fur-forge`。不安装第二套 Nginx、不运行 Nginx 容器、不创建 TLS/ACME 文件，也不在远程 build 应用镜像。

### 6.1 用户授权后的唯一镜像发布入口

只有 GATE-E 写入冻结 SHA 且用户在 T53-F1 明确授权后，才从 GitHub Actions 手动运行 `release-image`。必须在 ref 选择器选 `main`，并填写：

- `image_tag`：非 `latest` 的可识别发布标签；工作流会额外自动更新 `latest` 便于人工查看和临时拉取；
- `confirmation`：精确 `PUBLISH_GATE_E_IMAGE`。

工作流直接使用 ref 选择器对应的 `GITHUB_SHA`，不再要求手工重复输入 40 位 Git SHA；它先复用该 SHA 的完整 quality，再发布可识别标签、短 SHA 标签和 `latest`，并输出 `image-release-evidence.json`。Actions Summary 直接给出可复制的 `FROZEN_SHA=...` 与 `APP_IMAGE_REF=repository@sha256:...`，证据 JSON 同时保存完整 `imageRef`。远程部署仍只使用该 digest；不得使用 tag、短 SHA、`latest` 或服务器现场 build。阶段 E 不执行该工作流、不创建 `v*` tag。

### 6.2 目标机取冻结代码与配置

```bash
ssh root@120.26.51.205
cd /root/project-fur-forge
git fetch origin main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$FROZEN_SHA"
test -z "$(git status --porcelain)"

test ! -e .env
install -m 600 .env.compose.example .env
# 使用编辑器填写真实值；不要 source、cat、截图或提交该文件。

docker compose config --quiet
test "$(docker compose config --services)" = "app"
IMAGE_REF="$(docker compose config --images)"
test "$(printf '%s\n' "$IMAGE_REF" | wc -l)" = "1"
printf '%s\n' "$IMAGE_REF" | grep -Eq '@sha256:[0-9a-f]{64}$'
docker pull "$IMAGE_REF"
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$IMAGE_REF" \
  | grep -Fx "$IMAGE_REF"
```

`.env` 中 `ESA_API_ENDPOINT` 使用阿里云 ESA API HTTPS origin；`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` 同时供 OSS 与 ESA API 使用，不配置 `ESA_ACCESS_KEY_*`。`TRUSTED_PROXY_CIDRS` 必须包含固定 Compose gateway `172.30.250.1/32` 和 T53-F2 当日控制台/安全组证据里的全部 ESA 代理 CIDR。模板里的 `replace-me` 故意不合法；未替换时生产 runtime 必须拒绝启动。阿里云安全组负责公网 80 只允许 ESA 回源，UFW inactive 不改变该责任。

### 6.3 空卷初始化与唯一常驻 app

```bash
docker compose run --rm --no-deps app node ops/ops.mjs migrate
# 默认 dry-run：不访问或写云侧；证据写入 app-backups volume。
docker compose run --rm --no-deps app node ops/ops.mjs preflight
# F2 完成后才允许 live；会创建并清理本次 run 的精确测试对象和 file purge。
docker compose run --rm --no-deps app node ops/ops.mjs preflight --no-dry-run
docker compose run --rm --no-deps app node ops/ops.mjs init-admin
docker compose up --detach --no-build --no-deps app

test "$(docker compose config --services)" = "app"
docker compose ps
curl --fail --silent --show-error --header "Host: $PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health/ready
ss -lntp | grep '127.0.0.1:3000'
! ss -lntp | grep -E '(0.0.0.0|\[::\]):3000'
```

两次 preflight 都创建不可覆盖的脱敏 JSON 证据。默认模式变量错误，或 live 模式出现 FAIL/blocked、非零退出、`exact-test-object-cleanup` 失败时立即停止；只按证据 run ID 核对精确前缀，不做 Bucket 清空或模糊递归删除。`docker compose ps` 只能出现常驻 `app`；migrate/init/preflight/backup/restore/recover 都必须是 `run --rm` 一次性容器。

### 6.4 按目标机现有路径收敛 Nginx

目标机已经安装正确包，不重复安装。先核对：

```bash
nginx -v 2>&1 | grep -Fx 'nginx version: nginx/1.30.4'
apt-cache policy nginx | sed -n '1,20p'
systemctl is-enabled nginx
systemctl is-active nginx
```

T53-F1 确认精确 Host 后，使用仓库模板替换当前临时 wildcard 配置。下面只备份/写入目标机实际存在的两个文件；不触碰 `/etc/nginx/nginx.conf`、包仓库、证书或其他服务：

```bash
PUBLIC_HOST='T53-F1-CONFIRMED-PUBLIC-HOST'
ADMIN_HOST='T53-F1-CONFIRMED-ADMIN-HOST'
MEDIA_HOST='public-media.ditedog.com'
for EXACT_HOST in "$PUBLIC_HOST" "$ADMIN_HOST" "$MEDIA_HOST"; do
  printf '%s\n' "$EXACT_HOST" | grep -Eq '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
  [[ "$EXACT_HOST" != *..* ]]
done
test "$PUBLIC_HOST" != "$ADMIN_HOST"
test "$PUBLIC_HOST" != "$MEDIA_HOST"
test "$ADMIN_HOST" != "$MEDIA_HOST"

NGINX_BACKUP="/var/backups/project-fur-forge/nginx-$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$NGINX_BACKUP"
install -d -m 700 "$NGINX_BACKUP"
cp -a /etc/nginx/conf.d/ditedog.conf "$NGINX_BACKUP/"
cp -a /etc/nginx/conf.d/00-connection-map.conf "$NGINX_BACKUP/"

sed \
  -e "s/@@PUBLIC_HOST@@/$PUBLIC_HOST/g" \
  -e "s/@@ADMIN_HOST@@/$ADMIN_HOST/g" \
  -e "s/@@MEDIA_HOST@@/$MEDIA_HOST/g" \
  deploy/nginx/app.conf.template >/tmp/ditedog.conf.candidate
grep -q '@@' /tmp/ditedog.conf.candidate && exit 1
install -m 0644 /tmp/ditedog.conf.candidate /etc/nginx/conf.d/ditedog.conf
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

bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" --admin-host "$ADMIN_HOST" --reload
test "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Host: $MEDIA_HOST" http://127.0.0.1/)" = "421"
test "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Host: unknown.ditedog.invalid' http://127.0.0.1/)" = "421"
```

包版本本次不需要升级。如果未来检查发现漂移，先记录 `dpkg-query -W nginx` 和 `apt-cache policy nginx`，取得用户授权后才用当前已配置的官方 Noble 源执行精确版本安装；失败时用同一源的已记录旧版本 `apt-get install --allow-downgrades nginx=OLD_VERSION` 回退。配置回退使用上面 `NGINX_BACKUP` 两个精确文件，`nginx -t` 通过后 reload；不下载通用安装脚本。

### 6.5 备份、恢复、升级与回滚

```bash
docker compose run --rm --no-deps app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose run --rm --no-deps app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose run --rm --no-deps app node ops/ops.mjs recover-operations
```

恢复永远写新路径，不覆盖活动数据库：

```bash
docker compose stop app
docker compose run --rm --no-deps app node ops/ops.mjs restore \
  --backup /app/backups/manual.db --output /app/data/restored-UTC.db
# 验证后把 .env 的 DATABASE_FILE 改为 /app/data/restored-UTC.db，再启动。
docker compose config --quiet
docker compose up --detach --no-build --no-deps app
```

升级前记录当前 `IMAGE_REF`、数据库路径并创建新备份；新镜像仍按 6.2 校验摘要，再执行 migrate/up/ready。回滚镜像必须是 GATE-E 记录的旧 `repository@sha256:digest`，先确认本地存在，再临时覆盖而不远程重建：

```bash
APP_IMAGE_REF="$ROLLBACK_IMAGE_REF" docker compose up \
  --detach --no-build --no-deps --force-recreate app
curl --fail --silent --show-error --header "Host: $PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health/ready
```

通过后才把 `.env` 的 `APP_IMAGE_REF` 持久改为回滚摘要。若旧镜像不能读取前向迁移后的数据库，停止 app，按上面的新路径恢复对应备份，并同时切换 `DATABASE_FILE`；不得在线覆盖 `studio.db`。首次正式部署前目标机没有旧业务镜像，失败回退是停止 app、保留卷/证据并恢复 Nginx 备份，不能虚构“旧生产镜像已回滚”。

部署后确认：Nginx `nginx -t`、systemd active、80 正常、443 和公网 3000 关闭；app ready；公开/管理 Host 隔离；媒体/未知 Host 421；图片可解码；浏览器上传走公网 OSS，服务端走杭州内网 OSS。宿主机 `mihomo` 的既有 1053/7890/7891/9090 等监听不属于本应用，本任务不修改；安全组仍必须只把应用源站 80 暴露给 ESA。

## 7. 下架、验证与回滚

下架顺序固定为：事务撤销公开投影 → 固化精确媒体 URL/Object Key → 删除无引用衍生对象 → `PurgeCaches(Type=file)` → 保存 `TaskId` → `DescribePurgeTasks` 到终态。页面下架与 ESA 缓存刷新是两个状态；失败必须保留 manifest 并可重试/重启恢复。

正式验收只保留这些结果：

- 两只原始 OSS 域名匿名读取为 403，`public-media` 能读取已发布衍生物；
- 公开 HTML/DTO 不含 OSS Bucket 域名、私有 Object Key 或 Secret；
- warm cache 下架后页面立即消失，ESA 刷新完成后旧媒体不再返回，并记录实测用时；
- 三固定视口、主要公开/管理流程、console/network、告警、备份、恢复到新路径、升级和旧镜像回滚通过。

回滚不恢复 OSS 匿名公开访问。镜像问题切回 GATE-E 记录的摘要；数据问题停止 app 后恢复到新路径并验证完整性；若需要改应用、Schema、Compose、Nginx 模板或发布镜像，停止阶段 F 并返回阶段 E。
