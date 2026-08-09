# 部署说明

> **状态**：部署骨架已存在，剩余产品与上线基线开发全部归阶段 E。本文必须在 T52-E6 完成、并由 GATE-E 冻结后，才能由阶段 F 的用户/远程开发机执行。阶段 F 可受控补充不进入发布镜像的独立运维脚本，但不得热改应用或冻结部署契约。

正式操作以 [`../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 为逐项权威。

## 阶段边界

### 阶段 E 负责开发

- Endpoint 与运行时 Schema；
- CDN URL signer、刷新 operation 和恢复；
- OSS/CDN preflight；
- Dockerfile、app-only Compose、与现有宿主机 Nginx/acme.sh 兼容的配置模板；
- migrate、init、backup、restore、recover、升级和回滚命令；
- 空卷/持久卷/镜像/健康检查的受控演练；
- CI、独立 Review、最终回归和 GATE-E。

### 阶段 F 负责执行

- 用户填写真实备案、域名、Secret、预算和阈值；
- 用户操作阿里云控制台；
- 用户授权发布/传送 GATE-E 冻结镜像；
- 远程执行者先填写并校验生产 `.env`，再按冻结交付路径发布/传送、拉取/载入并核对镜像摘要，随后运行本文命令；
- 正式域名验证、恢复/回滚演练和用户验收。

阶段 F 可提交受控运维脚本、最小脚本测试、Runbook 和证据/状态同步；这些提交不替换冻结应用 SHA/镜像。只有超出该范围、需要改变应用或冻结部署契约时，才停止执行并返回阶段 E，新发布提交必须重跑 T49/T50/GATE-E。

## 文件组成

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | Node 24 多阶段构建、非 root runtime、生产依赖自检 |
| `docker-compose.yaml` | T52-E6 收敛为唯一常驻 app；migrate/ops 以同一镜像的一次性容器运行 |
| `.env.compose.example` | 生产 Compose 配置语义，不含真实 Secret |
| `.env.example` | 本地/非 Compose 配置语义，不含真实 Secret |
| `deploy/nginx/app.conf.template` | T52-E6 改为宿主机 Nginx：双 Host、loopback upstream、未知 Host 拒绝、安全头和 TLS 入口 |
| `.github/workflows/quality.yml` | 代码、镜像与 E2E 门禁 |
| `.github/workflows/release-image.yml` | 授权后的镜像发布 |

镜像使用 pnpm 正式 production deploy/install 机制，不手工复制单个依赖。runtime 构建期自检 SQLite、`ali-oss` 与内嵌 FFmpeg。

## 生产媒体拓扑

- 私有源图 Bucket：原图、处理源、品牌候选和草稿；
- 网页衍生 Bucket：只保存已发布并验证的网页衍生图；
- 两只 Bucket 均 private + BPA；
- CDN 只私有回源衍生 Bucket；
- 浏览器只使用约 24 小时 CDN 鉴权 URL；
- 下架先移除业务投影，再对精确 URL 强制刷新，服务器侧目标约 5～6 分钟。

这些行为在阶段 E 实现；ACL/CDN 的真实切换与验证在阶段 F 执行。

## Endpoint 场景

| 场景 | 地址 | 阶段 |
| --- | --- | --- |
| 本机开发/运维 | 杭州公网 OSS Endpoint | E 开发/测试 |
| 杭州远程机 app/migrate/ops | 杭州内网 OSS Endpoint | F 生产 `.env` |
| 浏览器条件上传 | 私有 Bucket 公网域名 | E 实现，F 验证 |
| CDN 回源 | CDN 控制台私有 OSS 源站 | F 配置 |
| 公开页面图片 | CDN 自定义域名 | E 实现，F 验证 |

T52-E1 必须让 `OSS_UPLOAD_BASE_URL` 真正控制浏览器签名 Host。`.env.example`、`.env.compose.example`、生产变量 Schema、`config/runtime.example.json`、测试和 production verify 同步。

T52-E3 的固定配置名为 `CDN_URL_AUTH_ACTIVE_KEY`（`primary|secondary`）、`CDN_URL_AUTH_PRIMARY_KEY`、`CDN_URL_AUTH_SECONDARY_KEY` 和 `CDN_URL_AUTH_TTL_SECONDS=86400`。GATE-E 前必须完成 runtime 支持，阶段 F 只填真实 Secret。

继续使用当前静态 AK/SK。凭据只进入远程 Secret/生产 `.env`，不得提交、回显或写入截图。

## 宿主机、Compose 与端口边界

- ECS 宿主机现有 Nginx 是唯一公网入口；记录当前版本/配置目录，继续由 systemd 管理并监听 80/443；
- Compose 唯一常驻服务是非 root Nuxt/Nitro `app`；不包含 Nginx 容器或常驻 migrate 服务；
- app 把容器 3000 端口固定只发布到 `127.0.0.1:3000`；安全组不开放 3000；
- Nginx upstream 固定指向 `127.0.0.1:3000`；真实 Host、scheme 与客户端地址按冻结 proxy header/trusted proxy 契约传递；
- migrate、preflight、init、backup、restore、recover 都以同一冻结 app 镜像的一次性容器运行；
- app 仍需要受控 egress 访问 OSS/CDN API；T52-E6 必须验证 Nginx 可达 loopback、外网不可达 app 端口。

## 宿主机 TLS 与 ACME

- 复用宿主机现有 acme.sh `3.1.5`、`dns_ali`、Let's Encrypt DNS-01 和 `ditedog.com` / `*.ditedog.com` ECDSA 证书；不改用 Certbot 或 `nginx-module-acme`；
- 复用现有每 6 小时执行 `acme.sh --cron` 的 root cron；不增加 systemd timer 或第二份 cron，不因文档整理重装客户端或重签有效证书；
- 使用 `--install-cert --ecc` 维护 `/etc/nginx/ssl/ditedog.com/fullchain.pem` 与 `privkey.pem` 稳定路径；Nginx 不直接读取 acme.sh 内部目录；续期 reload 唯一语义为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`；
- wildcard 只用于证书覆盖；正式 Nginx `server_name` 只列公开/管理精确域名，其他 Host/SNI 由默认 server 拒绝；
- DNS-01 不要求 80 端口；80 如开放只负责 HTTP→HTTPS 跳转；
- ACME 使用独立 DNS-only RAM API Key，只允许承载公开/管理域名的 DNS zone（跨 zone 时逐个列出）的 `alidns:DescribeDomainRecords`、`alidns:AddDomainRecord`、`alidns:DeleteDomainRecord`；不复用应用 AK/SK；
- `Ali_Key` / `Ali_Secret` 由 acme.sh 保存到 root 限权 config-home，因此不写入应用 `.env`、Compose、镜像、仓库或普通备份；
- 媒体域名在阿里云 CDN 终止 TLS，不使用宿主机证书；80 如开放只负责 HTTP→HTTPS 跳转。

## 阶段 F 远程命令骨架

以下命令只有在 GATE-E 后执行；T52-E6 必须在冻结前核对命令与实际 ops 入口一致。

```bash
cp .env.compose.example .env
# 只在远程机填写真实镜像、域名、Bucket、CDN、凭据、Session Secret 与阈值

docker compose -f docker-compose.yaml pull
# T52-E6 将以下一次性操作全部固定为同一 app 镜像的命令覆盖；不再有 migrate/nginx 常驻服务
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs migrate
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs preflight
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs init-admin
docker compose -f docker-compose.yaml up -d app
```

备份与恢复：

```bash
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose -f docker-compose.yaml run --rm --no-deps app node ops/ops.mjs recover-operations
```

若 GATE-E 记录的实际命令不同，以冻结 artifact 为准。目标环境需要诊断、检查、备份/恢复包装或证据采集时，可在仓库中补充独立运维脚本：单独提交，不进入或重建发布镜像，默认 dry-run、输出脱敏、目标明确并有回滚/针对性验证。不得在服务器或容器内编写未提交替代脚本来掩盖核心命令缺失；可写任务必须显式 `--no-dry-run` 才产生副作用。

## 健康与门禁

- `/api/health/live`：进程存活；
- `/api/health/ready`：数据库、严格迁移历史、基础记录和生产依赖就绪；
- 宿主机 Nginx 不向公网暴露健康端点；app 端口固定只在 `127.0.0.1:3000`；
- 证书门禁包含链/SAN/有效期、acme.sh cron、最近续期结果、TXT 清理、稳定证书路径、`nginx -t` 和 reload；
- GATE-E：同一 SHA CI/Review/E2E、部署包、环境契约和回滚入口冻结；
- T53-F3：远程空卷、迁移、初始化、私有 Bucket/CDN、升级、恢复和回滚；
- T53-F4/F5：正式全链验证与用户验收。

## 品牌与备案

阶段 E 完成公开导航“有点小狗”、备案空值/有值配置和测试；阶段 F 写入真实审批值并验证正式页。管理端内部名称不做机械全局替换，备案号不得预填猜测值。
