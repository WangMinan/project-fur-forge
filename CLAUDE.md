# CLAUDE.md

This file provides guidance to coding agents working with code in this repository.

## 项目简介

project-fur-paws —— 为“有点小狗工作室”（英文暂用 `dite dog`）制作的兽装（fursuit）主页网站。

> **当前阶段：阶段 4 IMPLEMENTATION，T01–T29、GATE-06、GATE-07、EXT-01 与 EXT-02 已完成。** T26-F1/T27-F1 等待用户验收；T30 工程与独立 Review 为 `PASS WITH FOLLOW-UP`，等待品牌图标用户验收。当前进入 T31 备份、恢复与迁移冒烟。**OQ-120 已由用户整批确认，并由 0014/0015 登记默认值。**

## 网站核心原则（景宸确认）

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- **展示主体只有兽装。** 页面首先服务于兽装作品的观看与浏览，视觉层级始终以兽装图片为最高优先级。
- **保持简洁。** 控制非必要的信息、装饰和交互，不以复杂版式、动效或视觉技巧抢夺作品本身的注意力。
- **图片是主要表达方式。** 页面结构、留白和内容节奏优先保障图片尺寸、清晰度与连续浏览体验。
- **Logo、文字和符号均为辅助。** 只承担品牌识别、必要说明、导航和状态提示；不得遮挡图片或形成比作品更强的视觉焦点。
- **文字简短且必要。** 能由作品图片表达的内容不重复堆砌文案。
- **以是否有助于兽装展示作为取舍标准。** 无法说明价值的非图片元素应删除或弱化。
- **景宸是兽装制作者而非开发人员** 所有文案的编写都需要考虑简洁易懂，不能使用中英混杂或者内部编号。

## 工作流：spec-driven 开发（agent_docs）

本项目遵循 `D:\code\spec.template` 的 spec-driven 开发流程。所有需求文档放在 `agent_docs/` 下，每个需求一个文件夹。`CLAUDE.md` / `AGENTS.md` 只提供入口和稳定纪律，**不得代替对 `agent_docs/` 当前权威文档的阅读**。

- **每次编码前必须从 `agent_docs/` 获取当前项目背景和阶段信息**，至少完整阅读：
  1. `agent_docs/需求1-兽装工作室主页/STATE.md`：当前阶段、已完成能力、开放问题和下一步；
  2. `agent_docs/需求1-兽装工作室主页/foundation/README.md`：产品目标、范围与不可突破的基础边界；
  3. `agent_docs/需求1-兽装工作室主页/requirements/SPEC.md`：当前需求和验收契约；
  4. `agent_docs/需求1-兽装工作室主页/planning/PLAN.md`：当前技术方案与实施顺序；
  5. `agent_docs/需求1-兽装工作室主页/implementation/TASKS.md`：唯一任务、依赖和勾选权威；
  6. `agent_docs/需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`：模型分工、main 写入和 Review 方法；
  7. `agent_docs/需求1-兽装工作室主页/artifacts/ARTIFACTS.md` 与 `implementation/notes/README.md`：当前产物和证据入口。
- 不能只依据聊天摘要、历史记忆、旧 commit 或本文件中的“当前仓库状态”开始编码；发现文档互相冲突时，先停止写代码并按七阶段职责校准文档。
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
- T26/T27 下班后人工核对步骤见 `agent_docs/需求1-兽装工作室主页/implementation/notes/t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`。
- 首页/委托页大图推荐横版至少 `1920×1080`、竖版至少 `1080×1920`；较小图片允许保存，启用时页面会提示清晰度风险，确认后使用内嵌 FFmpeg Lanczos 生成私有适配源。该放大不会恢复原图不存在的细节。
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
- 角色化上传、媒体核验、`recipe-v2`（完整 v1 集合兼容回退）、发布/下架；
- 活动 `brand-centered-v2` 可配置水印与原子全站切换；出厂照及站点竖版大图为单个居中水印，横版设定图及站点横版大图为左右双水印，站点大图复用对应作品图的视觉比例；
- 真实作品详情/列表、首页双源轮播、大图管理和联系方式投影；
- T21 第一作品垂直切片完整用户验收；
- T22 三用途共享 Schema、管理 API/service、管理 UI、公开投影、历史展会兼容、精选 6 项上限和完整用户验收；
- T24 设定图/出厂照管理分区、同源原图与活动水印预览、上传恢复、列表媒体摘要；
- T25 `/adoptions` 横版设定图列表和统一详情媒体分区；只有设定图的领养不进入 `/works`。
- T23–T25 已完成独立 Agent Review 与用户确认，任务清单和阶段文档已同步收口。
- T26–T27 已落地受限固定字段、委托/领养独立营业状态、版本冲突、管理 Host/Origin/CSRF/no-store 和无版本/无私有联系人的公开投影；固定内容位于独立“文案配置”，OQ-120 正式默认值已由 0014 迁移注入，委托背景引导区、公开标题和作品列表跟进完成独立 Review。
- T26-F1 已完成委托页独立大图和可刷新恢复的低分辨率 FFmpeg 私有适配；T27-F1 已完成关于/联系合并、政策页、二级导航、页脚法律区与营业状态呈现；两项独立 Review 为 `PASS WITH FOLLOW-UP`，等待用户验收。
- T28 首页完整内容顺序与 T29 筛选/详情导航/301 已通过独立 Chrome Review；T30 canonical、结构化数据、Sitemap/robots 和品牌图标技术 Review 已通过，等待用户视觉验收。

`brand-standard-v1` 只保留为历史身份，当前发布必须匹配活动 `brand-centered-v2` 和 `recipe-v2`。当前下一交接为 T31 备份、恢复与迁移冒烟；OQ-120 已关闭，后续文案修改继续通过“文案配置”完成。不建设万能 CMS，也不提前进入 T37 展会完整矩阵。
