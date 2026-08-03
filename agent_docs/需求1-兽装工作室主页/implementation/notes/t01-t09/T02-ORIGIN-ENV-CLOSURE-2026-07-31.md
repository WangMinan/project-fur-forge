# T02 非测试 origin 配置收口（2026-07-31）

## 结论

- `PUBLIC_BASE_URL`、`ADMIN_BASE_URL`、`MEDIA_BASE_URL`、`OSS_UPLOAD_BASE_URL` 不再从版本化运行模板获得域名 fallback；development/production 缺失时由既有 Zod 运行配置校验直接失败。
- 本机开发 origin 已写入被 Git 忽略的 `.env`；`.env.example` 只保留键和显式配置说明，不固化本机或部署域名。
- OSS 预检未传 `--origin` 时必须从 `ADMIN_BASE_URL` 读取，不再回退到硬编码本机 origin。
- 本次同时固化全局规范：除测试文件中的隔离值外，所有配置项的具体值都不得硬编码在应用代码、脚本或版本化文档/模板中，必须通过 `.env`、进程环境变量或不入库的活动配置文件提供。
- 测试环境继续在测试配置中显式使用隔离 origin。本次不启动 T14，不修改上传、CRUD、媒体处理或认证前端。

## 变更路径

- `.env`、`.env.example`、`config/runtime.example.json`
- `scripts/oss-preflight.mjs`、`tests/unit/runtime-boundaries.test.ts`
- `README.md`
- foundation、SPEC、PLAN、模型、管理端设计、TASKS、STATE 与产物索引

## 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 13 个文件、86 项通过 |
| `pnpm test:integration` | 5 个文件、34 项通过 |
| `pnpm test:e2e` | 78 项通过；首次两次启动超时来自 3100 端口占用，释放端口后全量通过 |
| `pnpm build` | 通过，production content guard 通过 |
| `pnpm verify:production` | health、公开 SSR、后台 CSR 通过 |
| `pnpm dev` + `http://localhost:3000/api/health` | 未注入测试环境变量，仅使用本机 `.env` 启动并返回 200 |

## 剩余边界

- 测试文件和生产验证脚本仍可显式使用回环地址，因为它们运行在 `APP_ENV=test` 的隔离进程中。
- `.env` 不进入 Git；部署环境必须单独注入真实 origin，不能依赖仓库模板。
