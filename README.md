# project-fur-forge

为“有点小狗工作室”建设的图片主导型公开站与轻量内容管理后台。

- 中文品牌：有点小狗工作室
- 英文品牌：`DITE DOG`
- 公开站：Nuxt SSR
- 管理端：Nuxt CSR
- 媒体：私有 OSS 原图、受控公开派生、ESA 分发
- 当前活跃增量：[`需求4阶段 E`](./agent_docs/需求4-站点视觉升级与内容合规/)（仅 UI、布局、响应式与动效优化）

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

## 当前可用验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test            # 等价于 test:core
pnpm test:core
pnpm test:smoke
pnpm test:release    # 人工/发布路径
pnpm build
pnpm run verify:production
```

这些是当前仓库仍可调用的命令，不表示每次改动都要顺序执行全套。验证已经收敛为快速 core、少量 smoke 和显式 release 流程；旧实现型 unit/integration/E2E 套件已退役，测试选择与人工浏览器门禁以 [`CLAUDE.md`](./CLAUDE.md) 为准。

仓库当前不要求 GitHub required check。公开视觉、真实图片、动效和文案最终由王旻安/景宸人工验收，自动化只保护稳定不变量和基础可运行性。

## 文档入口

- 编码 Agent 稳定入口：[`CLAUDE.md`](./CLAUDE.md)
- 需求与任务索引：[`agent_docs/README.md`](./agent_docs/README.md)
- 生产部署基线：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
