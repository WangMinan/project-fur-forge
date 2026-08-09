# 部署说明

> Endpoint 与运行时配置已由 T52-E1 收敛；部署骨架仍需由 T52-E2～E6 完成。真实部署只在 GATE-E 冻结后执行。逐步命令以 [`PRODUCTION-LAUNCH-HANDBOOK.md`](../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 为准。

## 生产结构

- ESA 是 `ditedog.com` 的权威 DNS 和公网入口，客户端 TLS 在 ESA 终止；
- 页面/API 由 ESA 通过 HTTP/80 回源宿主机 Nginx，再代理到 `127.0.0.1:3000`；
- `public-media.ditedog.com` 同账号私有回源 `project-furry-forge-public`；回源 STS 由阿里云自动完成，应用不参与；
- 两只 OSS Bucket 上线时均为 private + BPA；私有原图与网页衍生物严格分桶；
- 首版不做自定义边缘 URL 鉴权；管理端登录、Session、Host/Origin/CSRF 等应用认证边界保持不变；
- Compose 唯一常驻服务是 app；Nginx 由宿主机 systemd 管理，只监听 80；宿主机没有证书、ACME 或 443。

## Endpoint

| 场景 | 地址 |
| --- | --- |
| 本地 app/ops | 杭州公网 OSS Endpoint |
| ECS app/migrate/ops | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 管理浏览器条件 PUT | 私有 Bucket 原始公网 OSS 域名 |
| 公开媒体 | `https://public-media.ditedog.com` |
| ESA 媒体 origin | 网页衍生 Bucket 公网 OSS 域名 |

`OSS_UPLOAD_BASE_URL` 已真实控制浏览器签名 PUT Host；`MEDIA_BASE_URL` 生产固定为 ESA HTTPS 媒体 origin。`ESA_SITE_ID`、`ESA_ACCESS_KEY_ID`、`ESA_ACCESS_KEY_SECRET` 与 OSS 凭据分组配置，且生产 Schema 拒绝复用同一个 AccessKey ID。

## 部署产物目标

| 文件 | T52 目标 |
| --- | --- |
| `Dockerfile` | Node 24、非 root、正式 production dependency closure 与运行时自检 |
| `docker-compose.yaml` | 唯一常驻 app；`127.0.0.1:3000:3000`；migrate/ops 一次性运行 |
| `.env.compose.example` / `.env.example` | OSS 内外网、上传基址、ESA Site/API 配置，不含真实 Secret |
| `deploy/nginx/app.conf.template` | 宿主机 HTTP/80、精确 Host、loopback upstream、未知 Host 421 |
| `scripts/container-ops.ts` | migrate、preflight、init、backup、restore、recover |

## 缓存与下架

- `/_nuxt/**` 与不可变媒体长缓存；管理 Host、`/api/**`、登录/会话/写操作绕过共享缓存；公开 SSR HTML 首版绕过共享缓存；
- 下架先撤销数据库公开投影，再删除无引用衍生物；
- 使用阿里云官方 TypeScript/Node.js SDK 调用 `PurgeCaches(Type=file)`，保存 `TaskId` 并用 `DescribePurgeTasks` 收敛；
- 只刷新 manifest 中的精确媒体 URL，不做全站或前缀刷新；失败可重试，重启不丢状态。

SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)；刷新参数与返回值以 [PurgeCaches API](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches) 为准。

## 阶段边界

阶段 E 完成运行时配置、preflight、ESA 精确刷新、app-only Compose、HTTP-only Nginx、运维命令、测试、T49/T50 和 GATE-E。阶段 F 只填写真实值、配置控制台、部署冻结镜像、演练并验收；如果需要改应用、迁移、运行时契约、Compose/Nginx 模板或镜像，必须返回阶段 E。
