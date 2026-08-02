# CLAUDE.md

This file provides guidance to coding agents working with code in this repository.

## 项目简介

project-fur-paws —— 为“有点小狗工作室”（英文暂用 `dite dog`）制作的兽装（fursuit）主页网站。

> **当前阶段：阶段 4 IMPLEMENTATION，T01–T21、GATE-06、GATE-07、EXT-01 与 EXT-02 已完成。** 阶段 C“P0 可部署核心”已解锁，下一任务为 T22“完整作品字段与约束”。

## 网站核心原则（景宸确认）

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- **展示主体只有兽装。** 页面首先服务于兽装作品的观看与浏览，视觉层级始终以兽装图片为最高优先级。
- **保持简洁。** 控制非必要的信息、装饰和交互，不以复杂版式、动效或视觉技巧抢夺作品本身的注意力。
- **图片是主要表达方式。** 页面结构、留白和内容节奏优先保障图片尺寸、清晰度与连续浏览体验。
- **Logo、文字和符号均为辅助。** 只承担品牌识别、必要说明、导航和状态提示；不得遮挡图片或形成比作品更强的视觉焦点。
- **文字简短且必要。** 能由作品图片表达的内容不重复堆砌文案。
- **以是否有助于兽装展示作为取舍标准。** 无法说明价值的非图片元素应删除或弱化。

## 工作流：spec-driven 开发（agent_docs）

本项目遵循 `D:\code\spec.template` 的 spec-driven 开发流程。所有需求文档放在 `agent_docs/` 下，每个需求一个文件夹。

- **编码前先读** `agent_docs/需求1-兽装工作室主页/STATE.md` 与 `foundation/README.md`。
- 当前任务、依赖和完成定义只以 `implementation/TASKS.md` 为准。
- 当前模型分工、main 直推和 Review 方法见 `implementation/EXECUTION_ROUTING.md`。
- 阶段 C 启动基线见 `implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md`。
- 正式素材输入见 `materials/MATERIAL-MANIFEST.md`。
- 七阶段闭环：地基 → 规格 → 计划 → 任务 → 实施 → 评审 → 闭环。
- **OQ 门禁**：阶段 1/2 的开放问题必须全部已答/已搁置才能编码。遇到无法自答的问题，登记 OQ 后停止等待用户，不假设推进。
- 契约先行：SPEC 锁定接口/数据/存储契约；代码偏离契约即 bug。契约变更先改文档再改代码。
- 不允许删除或清空 `.env`。

`AGENTS.md`（项目根）为指向本文件的软链接，供其他 coding agent 复用同一套指令。

## 当前写入策略

所有后续代码、文档、Review 和修复直接在 `main` 串行完成：

1. 不创建功能分支，不发起 PR；
2. 写入前读取远端最新 `main`，确认没有另一个 Agent 正在修改同一批文件；
3. 后端 → 前端 → Review 依次交接，一个任务收口后再进入下一任务；
4. 提交保持小而可回滚，不 force push、不硬 reset、不重写已验收历史；
5. 只读分析可以并行，任何写入必须串行。

当前角色：

- 后端固定由 GPT-5.6 Sol 负责；
- 前端由用户按额度在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中逐任务选择；
- Review 固定由 GPT-5.6 Sol 在新的上下文中执行，并且必须使用浏览器与视觉模拟真实点击。

## 常用命令

Node.js 24 LTS 与 pnpm 11.18 为当前基线：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify:production
```

这些命令不是每个小任务必须机械全跑的固定套餐：

- 常规执行 lint/typecheck；
- 改动 Nuxt 路由、运行时、迁移或生产输出时执行 build；
- 运行与本次 Schema、API、迁移和页面路径直接相关的 unit/integration/E2E；
- 完整 test/integration/e2e/verify 主要用于 T31–T34、跨层高风险修复和明确总门禁。

自动化测试不能替代页面验收。含 UI、公开投影、媒体或用户操作的任务，GPT-5.6 Sol Review 必须实际启动应用、区分管理/公开 Host、模拟管理员与新访客点击，检查成功、冲突、失败、恢复、重载、图片解码、横竖请求、三视口、焦点/键盘、console/network、截图或 trace。

## 本地查看前端与人工验收

先迁移开发数据库，再启动同时监听公开端与管理端 Host 的 Nuxt 开发服务：

```powershell
cd D:\code\project-fur-forge
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理端使用 `http://localhost:3000`：重点查看 `/admin/works`、`/admin/site/home` 与 `/admin/site/branding`。
- 公开端使用 `http://127.0.0.1:3000`：重点查看 `/`、`/works` 与 `/works/{slug}`；不要混用两个 Host。
- 首页轮播验收素材：横版至少 `1920×1080`，竖版至少 `1080×1920`，否则固定配方尺寸门禁会阻止启用。
- 三个固定验收视口：`390×844`、`768×1024`、`1440×900`。

忘记本地管理员密码时，停止开发服务后执行：

```powershell
pnpm auth:reset-password --confirm RESET_SINGLE_ADMIN_PASSWORD
```

当前规划原型的独立验证入口仍见 `agent_docs/需求1-兽装工作室主页/planning/prototype-v1/README.md`，不得把原型样式复制进生产应用。

## 当前仓库状态

根目录现含 Nuxt 4 工程、`app/`、`server/`、`shared/`、`scripts/`、`tests/` 与阶段文档。当前已落地：

- 双访问面、公开/管理视觉基线；
- SQLite/Drizzle、唯一管理员认证；
- 双 Bucket、30 MB 原图、FFmpeg 私有处理源；
- 角色化上传、媒体核验、`recipe-v1`、发布/下架；
- 活动 `brand-centered-v2` 可配置居中水印和原子全站切换；
- 真实作品详情/列表、首页双源轮播、首页管理和联系方式投影；
- T21 第一作品垂直切片完整用户验收。

`brand-standard-v1` 只保留为历史身份，当前发布必须匹配活动 `brand-centered-v2`。下一任务 T22 要把数据库已预留的完整作品字段真正接入共享 Schema、管理 API/UI 和公开投影，不提前进入多图或展会完整矩阵。