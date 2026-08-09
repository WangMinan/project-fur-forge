# OSS/ESA 生产预检契约

> T52-E2 已实现单一、可重复的预检入口；T53 在目标环境执行 live 模式。失败使用非零退出码，输出与证据均脱敏。

## 入口与执行模式

```bash
# 默认模式：只校验生产变量契约并列出计划检查，不访问网络、不写云资源
pnpm run preflight:oss

# 目标 ECS/冻结镜像：显式开启 live 模式
pnpm run preflight:oss --no-dry-run
```

容器内使用同一入口：

```bash
node ops/ops.mjs preflight
node ops/ops.mjs preflight --no-dry-run
```

每次运行默认在 `test-results/production-preflight/` 创建一份不可覆盖的 JSON 证据；也可用 `--evidence <new-file>` 指向新的证据文件。`--run-id` 只接受 `t52e2-YYYYMMDDTHHMMSSZ-8位十六进制`，所有 live 测试对象都被限制在该次 run 的可恢复前缀内。没有 `--no-dry-run` 时不得发起 OSS/ESA 请求，也不得创建、刷新或删除云资源。

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
- `.env` 中现有一套阿里云 AK/SK 同时完成 OSS 与 ESA 业务所需操作；预检只验证业务能力，不把控制面权限拒绝当作凭据门禁；
- `public-media` 通过 ESA 可读取已知 READY 衍生对象，公开响应不出现原始 OSS 域名或私有 Object Key；
- 私有原图、处理源和管理预览不进入网页衍生 Bucket；
- CORS 只允许实际管理 origin 和条件 PUT 所需方法/头，过期、篡改、错误 MD5、错误来源和越权 Key 前缀有明确失败；
- ESA 客户端 HTTPS 正常，ECS origin 为 HTTP/80，宿主机只监听 80，公网 3000/443 不可达；
- 管理 Host、`/api/**`、登录、会话、写操作和健康检查绕过共享缓存；公开 SSR HTML 首版绕过共享缓存；静态资源与不可变媒体按规则缓存。

T52-E2 的 live 入口已经实现前六项 OSS/ESA 媒体与凭据检查：

- 读取两只 Bucket 的 identity、region、ACL、BPA、Policy Status、Object ACL、CORS、生命周期和完整对象清单；
- 把网页衍生 Bucket 的每个对象与生产数据库中 `READY + PUBLIC` 的变体身份双向核对，拒绝未跟踪对象、缺失对象和任何非 `prod/web/` 对象；
- 用现有共享凭据执行私有对象条件 PUT、HEAD/GET、跨 Bucket 图片处理与精确删除；浏览器签名仍由应用策略限制到本次 run 的精确 Key 前缀；
- 验证正确/错误 CORS Origin、禁止覆盖、篡改 MD5、过期签名，以及两只原始 OSS 域名的匿名 GET/HEAD 均为 403；
- 验证 ESA 对本次衍生物返回 200，响应地址/头不暴露 OSS 原站或私有 Key，并确认同路径不能暴露私有 Bucket 对象；
- 使用官方 `@alicloud/esa20240910` SDK 验证 `DescribePurgeTasks` 与精确 file purge 可用；不再执行 `ListSites`、`DeleteSite` 等控制面权限负向探针。

第七、八项的源站端口、Host/代理链和缓存规则属于 T52-E4/E6；对应实现完成后由同一生产验证包组合执行，不在 E2 脚本中虚构本机无法证明的云侧结果。

live 模式会在 `finally` 中只删除本次 run 已记录的精确测试对象。若证据中的 `exact-test-object-cleanup` 失败，立即停止后续部署，按 run ID 人工核对该唯一前缀；不得用 Bucket 清空、递归前缀删除或模糊匹配补救。

## ESA 精确刷新

应用使用官方 TypeScript/Node.js SDK 对目标 Site 调用：

1. `PurgeCaches`：`SiteId` 固定为当前 Site，`Type=file`，`Content.Files` 只包含数据库 manifest 中的精确 `public-media` URL；
2. 保存响应 `TaskId`；
3. `DescribePurgeTasks` 查询到 `Complete` 或 `Failed`；
4. API 失败、限流、进程中断和重复启动不丢 manifest，且不重复改变业务下架终态。

不允许用全站、Host、目录或前缀刷新替代精确 file 刷新。预检只验证凭据可执行上述两个业务 API，不通过站点枚举、删除或其他控制面操作探测权限范围，也不改变真实 DNS、证书、套餐或 Site 配置。

SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)；参数与状态以 [PurgeCaches](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches)、[DescribePurgeTasks](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks) 为准。

## 证据

只记录环境名、脱敏 Bucket/Host、凭据指纹、检查项 PASS/FAIL/SKIP、HTTP 状态、稳定 reason、脱敏 RequestId/TaskId 与开始/完成时间。冻结 commit/镜像摘要由 T52-E6/GATE-E 注入同一远程证据包。不得记录 Secret、完整 OSS 签名 URL、私有 Object Key 或个人信息。

脚本顶层固定声明 `secretsRecorded=false`、`objectKeysRecorded=false`、`signedUrlsRecorded=false`；单元测试还会用合成 Secret 执行默认 dry-run，并反向检查证据文本不含这些值。阶段 E 没有用真实生产凭据运行 live 模式，因此此处只证明入口和判定契约，不声称 Bucket/ESA 已通过生产预检。
