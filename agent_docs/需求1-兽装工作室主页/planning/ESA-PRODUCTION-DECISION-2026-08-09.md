# ESA 生产方案（2026-08-09）

> 用户确认后的当前生产依据。当前行为以本文、SPEC、媒体策略、PLAN 和 TASKS 为准。

## 决策

- `ditedog.com` 使用 ESA NS 接入；公开站、管理站和静态媒体统一经过 ESA。
- 客户端 TLS 由 ESA 托管边缘证书终止；ESA 到 ECS 固定使用 HTTP/80。
- ECS 宿主机 Nginx 只监听 80 并代理 `127.0.0.1:3000`；宿主机不维护证书、443 或 ACME。
- `public-media.ditedog.com` 同账号私有回源网页衍生 Bucket `project-furry-forge-public`。
- ESA 到私有 OSS 的 STS 临时凭据与回源 `Authorization` 由阿里云自动处理。业务应用不申请、不保存、不轮换 STS。
- 首版不做自定义边缘 URL 鉴权。公开媒体使用稳定的 ESA HTTPS URL；管理端登录、Session、Host/Origin/CSRF 等应用认证不受影响。
- 下架先撤销数据库公开投影，再对精确 `public-media` 文件 URL 调用 `PurgeCaches(Type=file)`，保存 `TaskId` 并用 `DescribePurgeTasks` 追踪终态。
- 不做全站、Host、目录或前缀刷新；完成时间在目标环境实测后记录，不预写时限。

## 已知配置

| 项目 | 当前值/状态 |
| --- | --- |
| ESA Site | `ditedog.com`，Site ID `171890925863148` |
| 权威 NS | `nasser.ns.atrustdns.com`、`hindu-kush.ns.atrustdns.com` |
| ECS | `120.26.51.205:80`，HTTP 回源已限制 |
| 公开媒体 | `public-media.ditedog.com` |
| 媒体 origin | `project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com` |
| 边缘证书 | 已配置 |
| 当前站点记录 | `@`、`*` 指向 ECS；正式上线前收敛为精确公开/管理 Host |

## OSS 与缓存边界

- 两只现有杭州 Bucket 上线时都设为 private 并开启 Bucket 级 BPA；不保留原始 OSS 匿名访问兼容路径。
- 网页衍生 Bucket 只能保存已验证、允许公开展示的派生对象。永久原图、处理源、Logo 候选和管理预览保留在私有原图 Bucket。
- `/_nuxt/**` 和不可变媒体可长缓存；管理 Host、`/api/**`、登录、会话、写操作和健康检查绕过共享缓存；公开 SSR HTML 首版绕过共享缓存；404 短缓存。
- 浏览器条件 PUT 仍使用私有 Bucket 原始公网域名；杭州 ECS 的 app/migrate/ops 使用内网 OSS Endpoint。

## SDK 与权限

应用通过阿里云官方 TypeScript/Node.js SDK 调用 ESA 2024-09-10 API。SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)，刷新参数、返回值和任务状态以 [PurgeCaches](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches) 与 [DescribePurgeTasks](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks) 为准。

ESA API 凭据与 OSS 应用凭据分离，并按阿里云实际支持的 action/resource 粒度授予刷新和任务查询所需最小权限；若暂不支持按 Site 收敛，必须记录实际权限边界。不得授予 DNS、证书、套餐等无关控制面写权限。

## 阶段分工

阶段 E 完成运行时配置、预检、ESA 精确刷新/恢复、app-only Compose、HTTP-only Nginx 模板、监控准备和测试。阶段 F 填写真实值、切 Bucket 权限、收敛精确 Host、启用源站保护/缓存/告警、部署冻结镜像并做正式验收。

官方依据：[ESA 私有 OSS 回源](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/use-esa-to-accelerate-oss-resource-access)、[ESA 边缘证书](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/configure-edge-certificates/)、[ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)。
