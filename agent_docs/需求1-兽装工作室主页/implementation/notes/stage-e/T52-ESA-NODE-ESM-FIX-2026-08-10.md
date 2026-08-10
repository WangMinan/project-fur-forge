# T52 远端 ESA Node ESM 修复记录

> 日期：2026-08-10
> 失败基线：`7c24de91b27275ca9cad197bc297181445e552de`
> 实现提交：`70538e0`
> 结论：工程修复、本地门禁与 SHA `4e24916` Actions PASS；独立 Review、
> 新镜像和 live preflight 尚未完成。

## 1. 范围与停止边界

远端备案前部署执行到 live preflight 时停止：

- migrate 成功，27 个迁移已应用；
- dry-run preflight 成功；
- live preflight 在建立 ESA client 时失败，发生在任何 OSS/ESA 云写入前，
  没有创建本次测试对象；
- app 尚未启动，管理员尚未初始化，Nginx 尚未替换。

该问题与 AK/SK、CIDR 或 Bucket 权限无关，是冻结应用/镜像中的真实代码
缺陷。按阶段 E/F 边界停止远端部署，禁止热改容器或绕过 live preflight。

## 2. 根因

`@alicloud/esa20240910@3.13.0` 是 CommonJS 包，入口最终执行
`exports.default = Client`。Node 24 原生 ESM 导入时：

- module namespace 的 `default` 是整个 CommonJS 导出对象；
- 真正的 client 构造器位于 `namespace.default.default`；
- purge/describe request 构造器可在 namespace 或 CommonJS 导出对象中取得。

原实现的两个入口都直接执行默认导入构造器：

- `scripts/oss-preflight.mjs`；
- `server/utils/public-media-cache.ts`，并被 Nitro 原样外部化到生产产物。

因此 Vitest/Vite 转译环境可通过，而 Node 原生 ESM live preflight 与生产
Nitro purge 会在真实构造时失败。旧 Docker 守卫只执行 `import()`，没有
实际构造 client/request，也没有覆盖该缺陷。

## 3. 修复

实现提交 `70538e0`：

1. 新增 `scripts/esa-sdk.mjs` 与类型声明；使用 namespace import，并同时兼容
   `default` 为 client 类或 CommonJS 模块对象；缺少任何构造器时立即失败；
2. preflight 与 Nitro `public-media-cache` 统一从该入口取得 client、
   `PurgeCachesRequest`、`PurgeCachesRequestContent` 和
   `DescribePurgeTasksRequest`；
3. 新增真实 Node 24 ESM 子进程回归，不触网但实际构造 client 和两类请求；
4. Docker runtime 依赖守卫复制同一入口，并从“只 import 包”改为实际构造
   client/request；
5. production build 产物已核对为
   `import * as EsaSdkNamespace from '@alicloud/esa20240910'`，不再包含错误的
   `import EsaClient ...`。

第一次修复尝试曾使用 `createRequire(import.meta.url)`；Nitro 2 会把
`import.meta.url` 改写为虚拟 `file:///_entry.js`，可能从错误目录解析依赖。
该方案在提交前被 production 产物检查发现并移除，最终实现不依赖虚拟 URL
或当前工作目录。

## 4. 验证

最终实现通过：

- `pnpm lint`；
- `pnpm typecheck`；
- `pnpm test`：31 个文件、167 项；
- 定向原生 ESM / preflight / cache / Docker 合约：4 个文件、16 项；
- `APP_ENV=test` 的完整串行 integration：20 个文件、172 项；
- `APP_ENV=production pnpm build` 与 production content guard；
- Nitro 产物检查：namespace import 存在，错误默认导入不存在；
- `pnpm run verify:production`：health、公开 SSR/API、管理 CSR 通过；
- `pnpm run verify:esa-cache`；
- `pnpm run verify:observability`；
- `node scripts/ci-secret-scan.mjs`。

失败历史保留：第一次完整 integration 未显式设置 `APP_ENV=test`，被测试专用
cache override 守卫拒绝；正确环境下默认并行运行又因 FFmpeg/Nuxt 并发资源
竞争出现一个超时和两个服务器启动失败。受影响三个文件逐个重放通过，最终
用单 worker 串行完整运行 172/172 通过。没有因此放宽超时、断言或安全守卫。

## 5. Review、发布与恢复

本记录只签实现、本地验证和已查询的 Actions，不代签独立 Review、镜像发布
或生产 live preflight。包含实现与本记录的 SHA `4e24916` 对应 Actions run
`31392080770` 已取得 `checks`、`image-build`、`e2e` 全部成功；旧镜像和旧
SHA 的 T49 Review 证据仍不能复用。

继续远端部署前必须：

1. 由新上下文完成 T49-R1 独立 Review；
2. Review 通过后重新发布并核对不可变 `repository@sha256:digest`；
3. 从 live preflight 重新开始，失败则继续停止，不直接启动 app 或切 Nginx。
