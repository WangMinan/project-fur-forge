# 部署说明

> **状态**：部署骨架已经存在，生产切换尚未执行。正式操作以 [`../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 为逐项权威；先完成 T49/T50/T51、T52-F1、F2a preflight 重写和 F3/F4 应用能力，再由 Handbook 第 5～6 节执行 CDN 先行配置与 Bucket ACL/BPA 切换。F2 只有云上验证通过后才算完成。

## 组成

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | Node 24 多阶段构建、非 root runtime、生产依赖自检 |
| `docker-compose.yaml` | migrate + app + nginx、数据/备份卷和隔离网络 |
| `.env.compose.example` | 生产 Compose 配置语义，不含真实 Secret |
| `.env.example` | 本地/非 Compose 配置语义，不含真实 Secret |
| `deploy/nginx/app.conf.template` | 双 Host、未知 Host 拒绝、安全头和 TLS 入口 |
| `.github/workflows/quality.yml` | 代码、镜像与 E2E 门禁 |
| `.github/workflows/release-image.yml` | 授权后的镜像发布 |

镜像使用 pnpm 正式 production deploy/install 机制，不手工复制单个依赖。runtime 构建期应自检 SQLite、`ali-oss` 与内嵌 FFmpeg。

## 生产媒体拓扑

复用现有两个 Bucket：

- 私有源图 Bucket：原图、处理源、品牌候选和草稿；
- 公开衍生图 Bucket：只保存已发布并验证的网页衍生图。

正式目标是两个 Bucket 都设为 `private` 并开启 Block Public Access。公开衍生图 Bucket 只授权 CDN 私有 OSS 回源；浏览器只使用 CDN 自定义域名下约 24 小时有效的鉴权 URL，不再直连 OSS。

下架分两段：业务查询立即移除；服务端随后对精确 CDN URL 发起 `Force=true` 刷新并追踪任务，目标约 5～6 分钟完成 CDN 服务器侧撤销。客户端已经下载、截图或第三方转存的副本不在承诺内。

## Endpoint 场景

| 场景 | `OSS_ENDPOINT` | 说明 |
| --- | --- | --- |
| 本机开发/本机运维 | `https://oss-cn-hangzhou.aliyuncs.com` | 本机不能访问阿里云内网 Endpoint |
| 杭州同地域 ECS 内的 app/migrate/ops | `https://oss-cn-hangzhou-internal.aliyuncs.com` | 服务端 SDK 读写，走内网 |
| 浏览器条件上传 | 私有 Bucket 公网 Bucket 域名 | 浏览器在公网，不得签内网地址 |
| CDN 回源 | 阿里云 CDN 配置的私有 OSS 源站 | 不读取应用的 `OSS_ENDPOINT` |
| 公开页面图片 | CDN 自定义域名 | 不出现 OSS 域名 |

当前代码仍需由 T52-F1 完成真正的场景拆分：服务端签发浏览器条件上传时不能因为 `OSS_ENDPOINT` 使用内网地址；`OSS_UPLOAD_BASE_URL` 必须成为实际签名边界，而不只是已校验配置。`.env.example`、`.env.compose.example` 和生产 `.env` 必须同任务同步。

T52-F3 的固定配置名为 `CDN_URL_AUTH_ACTIVE_KEY`（`primary|secondary`）、`CDN_URL_AUTH_PRIMARY_KEY`、`CDN_URL_AUTH_SECONDARY_KEY` 和 `CDN_URL_AUTH_TTL_SECONDS`（生产固定 `86400`）。当前 runtime 尚不支持，因此示例文件只保留目标注释而不伪装成可用配置；T52-F3 必须一次性同步 `.env` 模板、`config/runtime.example.json`、Schema、测试与 production verify 后才可使用。

继续使用当前静态 AK/SK 方案；本阶段不引入 ECS 实例 RAM 角色。凭据只能进入 Secret/生产 `.env`，不得提交、回显或写入截图。

## Compose 网络

- `backend`：`internal:true`，Nginx、app、migrate 内部通信；
- `egress`：app 主动访问 OSS/CDN API；
- `edge`：Nginx 发布 80/443；
- app 不直接发布宿主机端口；
- `BACKEND_SUBNET` 与 `TRUSTED_PROXY_CIDRS` 必须同步，不能只改其一。

## 首次部署命令骨架

以下命令只能在 Handbook 前置门禁和配置复核通过后执行：

```bash
cp .env.compose.example .env
# 填入真实镜像、域名、Bucket、CDN、凭据、Session Secret 与监控阈值

docker compose -f docker-compose.yaml pull
docker compose -f docker-compose.yaml run --rm migrate
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs preflight
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs init-admin
docker compose -f docker-compose.yaml up -d
```

备份与恢复检查：

```bash
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose -f docker-compose.yaml run --rm app node ops/ops.mjs recover-operations
```

所有可写运维任务继续默认 dry-run，必须显式 `--no-dry-run` 才能产生副作用。

## 健康与门禁

- `/api/health/live`：进程存活；
- `/api/health/ready`：数据库、严格迁移历史、基础记录和生产依赖就绪；
- Nginx 不向公网暴露健康端点；
- T49 必须让 `checks`、`image-build`、`e2e` 在同一 `main` SHA 全绿；
- T52 必须完成空卷、迁移、管理员初始化、真实私有 Bucket/CDN、升级、回滚和恢复演练；
- 不创建 `v*` tag、不推正式镜像、不切 DNS，除非对应任务和用户门禁已通过。

## 品牌与备案

备案网站名称为“有点小狗”。公开桌面/移动导航必须显示“有点小狗”，不带“工作室”；管理端内部名称不做机械全局替换。备案号、正式域名、证书与页脚链接在 T51 按实际审批结果填写，不能预填猜测值。
