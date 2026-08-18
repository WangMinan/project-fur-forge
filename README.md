# project-fur-forge

为“有点小狗工作室”建设的图片主导型公开站与轻量内容管理后台。

- 中文品牌：有点小狗工作室
- 英文品牌：`DITE DOG`
- 公开站：Nuxt SSR
- 管理端：Nuxt CSR
- 媒体：私有 OSS 原图、受控公开派生、ESA 分发
- 当前活跃增量：[`agent_docs/需求4-站点视觉升级与内容合规/`](./agent_docs/需求4-站点视觉升级与内容合规/)

## 环境

- Node.js 24
- Corepack
- pnpm 11.18

## 本地启动

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
# 填写 PUBLIC_BASE_URL、ADMIN_BASE_URL、MEDIA_BASE_URL、OSS_UPLOAD_BASE_URL 等配置
pnpm db:migrate
pnpm dev
```

PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

非测试环境不提供域名 fallback；公开、管理、媒体和浏览器上传 origin 必须由环境变量或活动配置显式提供。

## 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm run verify:production
```

仓库当前不要求 GitHub required check；执行者仍须按改动风险运行对应门禁，并在公开 UI 结构变化时完成真实浏览器验收。

## 文档入口

- 编码 Agent 稳定入口：[`CLAUDE.md`](./CLAUDE.md)
- 需求与任务索引：[`agent_docs/README.md`](./agent_docs/README.md)
- 生产部署基线：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
