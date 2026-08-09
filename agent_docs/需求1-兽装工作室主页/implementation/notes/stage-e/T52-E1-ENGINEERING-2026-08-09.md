# T52-E1 Endpoint 与运行时配置工程记录

> 日期：2026-08-09
>
> 基线 commit：`f2e20f10b237351b60c22fdc128d3320485c46e1`
>
> 证据性质：实现者工程自测，不代签 T49 独立 Review，也不代表真实阿里云环境已经切换。

## 范围与结果

- 服务端私有/公开 OSS client 继续只使用 `OSS_ENDPOINT`；
- 浏览器条件 PUT 改由独立 OSS client 使用 `OSS_UPLOAD_BASE_URL`，签名结果不再继承服务端内网 Endpoint；
- production 将服务端 Endpoint 固定为杭州内网地址，将上传基址固定为私有 Bucket 杭州公网地址，将公开媒体 origin 固定为 `https://public-media.ditedog.com`；
- 新增完整成组的 `ESA_SITE_ID`、`ESA_ACCESS_KEY_ID`、`ESA_ACCESS_KEY_SECRET`，并拒绝 ESA 与 OSS 复用 AccessKey ID；
- 同步 `.env.example`、`.env.compose.example`、Compose 传入、runtime JSON、production verify、部署说明和边界测试；本机被忽略的 `.env` 只把 `MEDIA_BASE_URL` 调整为当前 ESA 媒体域名，没有写入或输出新 Secret；
- 不实现阿里云托管回源 STS，不增加 ESA SDK，不操作真实 Bucket、ESA 或 DNS；这些分别属于云平台托管边界和后续 T52-E2～E4。

## 契约修正

- Review 中发现公安备案官方地址现使用 `beian.mps.gov.cn` 且查询路径位于 fragment；运行时白名单已支持这一官方形式，ICP 地址仍保持禁止 fragment；
- 用户再次确认英文品牌是 `DITE DOG FURSUIT`。实现常量保持该值不变，仅把错误测试期望和现行基础文档改回同一事实。

## 验证证据

| 命令/检查 | 结果 |
| --- | --- |
| `pnpm test` | PASS，23 个文件、134 项测试 |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `APP_ENV=production pnpm build` | PASS，production content guard 通过 |
| `pnpm verify:production` | PASS，health、公开 SSR、管理 CSR 通过 |
| `pnpm exec vitest run tests/integration/upload-session.test.ts --config vitest.integration.config.ts` | PASS，5 项测试 |
| `pnpm exec vitest run tests/integration/health.test.ts --config vitest.integration.config.ts` | PASS，9 项测试 |
| 使用本机 `.env` 做一次仅生成、不输出签名 URL 的 SDK 检查 | PASS，上传 origin 与 `OSS_UPLOAD_BASE_URL` 相同且不含内网 Host；没有网络请求 |

完整 `pnpm test:integration` 两次都超过外层 180/300 秒时限，未取得完整套件结论；残留的精确 Vitest/Nuxt 测试进程经核对 PID/命令行后已停止。上表只声明本任务直接相关的定向 integration 结果，完整 integration 仍由 T49 在冻结 SHA 上重跑。

## 后续边界

下一步是 T52-E2 私有 Bucket/BPA 与 ESA 访问 preflight。T52-E1 的实现和自测仍需在 T49 由新上下文独立 Review；本记录不关闭该门禁。
