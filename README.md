# project-fur-paws

为“有点小狗工作室”（暂用英文名 `dite dog`）建设的图片主导型主页与内容管理站。

## 环境

- Node.js 24 LTS
- Corepack
- pnpm 10.33

## 本地命令

```bash
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
# 在 .env 中填写 PUBLIC_BASE_URL、ADMIN_BASE_URL、MEDIA_BASE_URL、OSS_UPLOAD_BASE_URL
pnpm dev
```

非测试环境不提供域名 fallback；四个 origin 必须由 `.env`、进程环境变量或活动配置文件显式提供。Nuxt 原生加载 `.env`，已有进程环境变量优先于文件值。

质量门禁：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

公开站默认使用 SSR；`/admin/**` 使用 CSR。当前阶段状态、任务依赖与验收证据以 `agent_docs/需求1-兽装工作室主页/` 为准。
