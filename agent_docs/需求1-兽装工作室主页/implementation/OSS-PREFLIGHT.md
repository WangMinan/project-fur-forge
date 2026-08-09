# OSS/ESA 生产预检契约

> T52-E2 实现单一、可重复的预检入口；T53 在目标环境运行。失败必须非零退出，输出必须脱敏。

## 固定边界

| 场景 | 地址/责任 |
| --- | --- |
| ECS app/migrate/ops | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 本地服务端 | `https://oss-cn-hangzhou.aliyuncs.com` |
| 管理浏览器条件 PUT | 私有 Bucket 原始公网域名 |
| 公开媒体 | `https://public-media.ditedog.com` |
| ESA 回源 | 网页衍生 Bucket，同账号私有访问 |

ESA 首次开启同账号私有 OSS 回源后，由阿里云使用 STS 临时令牌和回源 `Authorization` 自动读取对象；应用不实现 STS、不保存 STS，也不向浏览器下发 STS。首版不部署自定义边缘 URL 鉴权。

## 自动检查

预检必须覆盖：

- 生产运行时变量完整，无 placeholder；`OSS_ENDPOINT`、`OSS_UPLOAD_BASE_URL`、`MEDIA_BASE_URL` 不混用，浏览器上传 Host 不含 `-internal`；
- 两只 Bucket 均为 private + Bucket 级 BPA，原始 OSS 域名匿名 GET/HEAD 为 403，历史 Object ACL/Policy 不允许匿名读；
- 应用凭据能完成业务所需的 HEAD/GET/PUT/处理/精确删除，越权操作被拒绝；
- `public-media` 通过 ESA 可读取已知 READY 衍生对象，公开响应不出现原始 OSS 域名或私有 Object Key；
- 私有原图、处理源和管理预览不进入网页衍生 Bucket；
- CORS 只允许实际管理 origin 和条件 PUT 所需方法/头，过期、篡改、错误 MD5、错误来源和越权 Key 前缀有明确失败；
- ESA 客户端 HTTPS 正常，ECS origin 为 HTTP/80，宿主机只监听 80，公网 3000/443 不可达；
- 管理 Host、`/api/**`、登录、会话、写操作和健康检查绕过共享缓存；公开 SSR HTML 首版绕过共享缓存；静态资源与不可变媒体按规则缓存。

## ESA 精确刷新

应用使用官方 TypeScript/Node.js SDK 对目标 Site 调用：

1. `PurgeCaches`：`SiteId` 固定为当前 Site，`Type=file`，`Content.Files` 只包含数据库 manifest 中的精确 `public-media` URL；
2. 保存响应 `TaskId`；
3. `DescribePurgeTasks` 查询到 `Complete` 或 `Failed`；
4. API 失败、限流、进程中断和重复启动不丢 manifest，且不重复改变业务下架终态。

不允许用全站、Host、目录或前缀刷新替代精确 file 刷新。预检要验证凭据可执行上述两个 API，并拒绝 DNS、证书、套餐和其他控制面写操作。

SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)；参数与状态以 [PurgeCaches](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches)、[DescribePurgeTasks](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks) 为准。

## 证据

只记录环境名、冻结 commit/镜像摘要、脱敏 Bucket/Host、检查项 PASS/FAIL、HTTP 状态、稳定 reason、脱敏 TaskId 与完成耗时。不得记录 Secret、完整 OSS 签名 URL、私有 Object Key 或个人信息。
