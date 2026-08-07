# CLAUDE.md

This file provides guidance to coding agents working with code in this repository.

## 项目简介

`project-fur-paws` —— 为“有点小狗工作室”（英文暂用 `dite dog`）制作的兽装主页和轻量管理后台。

> **当前阶段：阶段 D · P1 一期增强。** 阶段 C 与 C.1 已于 2026-08-07 经用户浏览器人工验收，`GATE-C1` 已通过。阶段 D 范围已锁定为 **T35 返图模型 → T36 无水印 `/returns` 返图墙 → T37 轻量展会掉落 → T42 总门禁**。T38、T40 已取消；T39 当前版本取消并转未来迭代备忘录；T41 不再单列。
>
> **2026-08-08 进度**：T35–T37 的工程主体已落地（前向迁移 0022/0023、返图一图一记录模型、`return-display-v1` 无水印返图墙、返图管理、轻量展会掉落与 `/adoptions` 三筛选），本地 lint/typecheck/unit 122/unit+integration 152 通过，并在 1440×900 真实双 Bucket 下核对。**尚未完成**：三项的新上下文独立 Review、T36/T37 的 390×844 手机闭环、针对返图 operation 的 SIGKILL 与重复重启重放、用户人工验收与 T42。不得把这些描述为已通过。当前阶段和任务权威始终以 `agent_docs/需求1-兽装工作室主页/STATE.md` 与 `implementation/TASKS.md` 为准。

GitHub Actions 当前已知仍未全绿：`image-build` 成功，`checks` 在 Production build 失败，`e2e` 跳过。该遗留由 T49 统一关闭，不阻断阶段 D；不得把当前状态描述为远端全绿或正式发布就绪。

## 网站核心原则（景宸确认）

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- **展示主体只有兽装。** 页面首先服务于兽装作品和返图的观看，视觉层级始终以图片为最高优先级。
- **保持简洁。** 不用复杂版式、动效、状态面板或通用 CMS 抢夺作品注意力。
- **图片是主要表达方式。** 页面结构、留白和内容节奏优先保障图片尺寸、清晰度、方向和连续浏览体验。
- **Logo、文字和符号均为辅助。** 只承担品牌识别、必要说明、导航和状态提示，不遮挡图片或形成更强视觉焦点。
- **文字简短且必要。** 能由图片表达的内容不重复堆砌。
- **景宸不是开发人员。** 管理端文案使用清楚中文，不展示内部任务号、数据库术语、Object Key 或中英混杂错误信息。

## 工作流：spec-driven 开发

所有需求文档位于 `agent_docs/`。`CLAUDE.md` / `AGENTS.md` 只提供入口和稳定纪律，不能代替当前权威文档。

每次编码前至少完整阅读：

1. `agent_docs/需求1-兽装工作室主页/STATE.md`：当前阶段、范围和下一步；
2. `foundation/README.md`：产品目标与不可突破边界；
3. `requirements/SPEC.md`：当前业务与验收契约；
4. `requirements/MEDIA-PUBLICATION-POLICY.md`：媒体公开与保护唯一事实源；
5. `planning/PLAN.md`：技术方案和实施顺序；
6. `implementation/TASKS.md`：唯一任务、依赖和勾选权威；
7. `implementation/EXECUTION_ROUTING.md`：模型分工、main 写入和 Review 方法；
8. `models/README.md`、`.design/README.md`、`artifacts/ARTIFACTS.md` 与 `implementation/notes/README.md`：模型、设计、产物和证据入口。

执行纪律：

- 不能只依据聊天摘要、历史记忆、旧 commit 或本文件开始编码；
- 契约变化先改 SPEC、PLAN、TASKS，再改代码；代码偏离契约即 bug；
- dated notes、调研、原型和历史截图只记录当时事实，不能覆盖当前活文档；
- 只有会改变公开行为、数据事实或管理心智模型的问题才升级给用户；普通技术取舍由实现者按现有架构完成；
- 不允许删除或清空 `.env`；
- 不重写已经执行的历史迁移；
- `AGENTS.md` 是指向本文件的软链接；
- 只跑必要的测试。每跑一次集成测试/E2E调用阿里云OSS都会产生流量费用，还很消耗时间。因此仅在必要的情况下才进行完整的集成测试/E2E。

阶段 D 决策记录：

- `implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md`；
- 未来分享与 URL 策略：`planning/FUTURE-ITERATIONS.md`，该文件不是实施授权。

## 当前写入策略

所有后续代码、文档、Review 和修复直接在最新 `main` 串行完成：

1. 不创建功能分支，不发起 PR；
2. 写入前读取远端最新 `main`，确认没有其他 Agent 正在修改同一批文件；
3. 后端 → 前端 → Review → 用户验收依次交接；
4. 提交保持小而可回滚，不 force push、不硬 reset、不重写已验收历史；
5. 只读分析可以并行，任何写入必须串行。

默认角色：

- `BACKEND_PRIMARY`：GPT-5.6 Sol；
- `FRONTEND_PRIMARY`：由用户在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中逐任务指定；
- `REVIEW`：GPT-5.6 Sol 在新的独立上下文中执行；
- 同一实现者不得为自己的实现代签独立 Review。

## 阶段 D 已锁定业务事实

### 返图

- 一张返图对应一条记录，必须关联已有作品和一张 `return_photo` 私有原图；
- 可选授权来源、确认时间和备注只在后台保存，不进入公开 DTO、HTML、图片元数据或日志；
- 公开返图使用 `return-wall` / `return-display-v1` / `protection_mode=none`，**不加水印**；
- 私有原图仍在私有 Bucket，公开页只消费预生成、验证完成、去除不需要 EXIF 的公开衍生图；
- `/returns` 是一级导航独立页面，使用原比例 masonry/瀑布流；
- 不在作品详情建设返图 Tab，不建设返图详情页、返图者主页、点赞、评论或公开投稿；
- 作品下架后，关联返图从公开查询隐藏；存在返图关联时阻止作品永久删除；
- 阶段 D 不建设返图或全站回收站。

### 展会掉落

- 底层继续使用 `purpose=adoption`、`adoption_method=event_drop`；
- 管理端可以显示“委托作品 / 常规领养 / 展会掉落 / 纯展示”，但不能新增第四种底层 purpose；
- event_drop 只增加展会名称 `event_name` 与展会时间展示文本 `event_time`；
- 复用现有领养状态、价格、设定图、出厂照、作品水印、发布和下架；
- `/adoptions` 提供全部/常规领养/展会掉落筛选；首页和详情显示展会名称与时间；
- 展会时间不自动改变业务状态；
- 不创建 `events` 表、展会管理页、展会详情、地点、摊位、封面或历史归档。

### 取消项

- T38 不实施更多站点文字内容；
- T39 当前版本不实施 slug 改址历史；
- T40 不实施 30 天回收站；
- T41 不作为独立任务，手机轻量能力分别并入 T36、T37；
- Agent 不得为这些任务预建通用表、空路由、空页面或空导航。

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

门禁命令统一使用 `APP_ENV=test`。`nuxt.config.ts` 只在该环境下把 E2E fixture 纳入编译，否则本地 typecheck 可能漏掉 CI 可见错误。

运维命令默认 dry-run，需显式 `--no-dry-run` 才执行写操作：

```bash
pnpm media:cleanup-expired-uploads
pnpm media:reconcile-site-display
```

测试按风险选择：

- 常规改动执行 lint/typecheck；
- 改动 Nuxt 路由、运行时、迁移或生产输出时执行 build；
- 运行与本次 Schema、API、迁移和页面路径直接相关的 unit/integration/E2E；
- 跨层媒体、发布、恢复和阶段门禁执行完整相关测试与真实进程中断检查。

自动化不能替代页面验收。含 UI、公开投影、媒体或用户操作的任务，独立 Review 必须实际启动应用、区分管理/公开 Host、模拟管理员和新访客点击，检查成功、冲突、失败、恢复、重载、图片解码、横竖请求、三视口、焦点/键盘、console/network、截图或 trace。

## 本地查看前端与人工验收

```powershell
cd D:\code\project-fur-forge
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理端：`http://localhost:3000`；
- 公开端：`http://127.0.0.1:3000`；
- 不要混用两个 Host；
- 固定验收视口：`390×844`、`768×1024`、`1440×900`；
- 阶段 D 完成后重点检查 `/admin/returns`、`/returns`、展会掉落作品编辑、`/adoptions` 筛选、首页当前领养和统一作品详情。

首页/委托页大图推荐横版至少 `1920×1080`、竖版至少 `1080×1920`。较小图片允许保存，启用时提示清晰度风险，确认后使用内嵌 FFmpeg Lanczos 生成私有适配源；该放大不会恢复不存在的细节。

忘记本地管理员密码时，停止开发服务后执行：

```powershell
pnpm auth:reset-password --confirm RESET_SINGLE_ADMIN_PASSWORD
```

`planning/prototype-v1/` 是历史原型，不得复制为生产 UI。

## 当前已落地基线

主分支已经包含：

- Nuxt 4 公开站与管理端双访问面；
- SQLite/Drizzle、唯一管理员认证、Host/Origin/CSRF、限流和安全日志；
- 私有原图/公开衍生图双 Bucket、30 MB 原图、FFmpeg 私有处理源；
- 作品、三种底层用途、常规领养、首页、委托、关于、政策页和文案配置；
- 设定图/出厂照角色化上传、核验、发布、下架与公开投影；
- 活动 `brand-centered-v2` 可配置作品水印与 `recipe-v2`；
- 首页/委托 Hero 和首页业务入口的无水印 `site-display-v1`；
- 首页聚合、精选作品、统一业务入口、当前领养、作品筛选和方向感知详情；
- 分区文案 Card、FAQ 稳定 ID 和 409 草稿保留；
- publication/watermark/reconcile operation 的 attempt、lease、heartbeat、SIGKILL 恢复和精确清理；
- Node 24 镜像、`docker-compose.yaml`、Nginx 双 Host、live/ready 和运维子命令；
- 阶段 C 本地非 Docker 门禁、真实双 Bucket 9/9、三视口和用户人工验收。

阶段 D 已追加（2026-08-08）：

- `return_photos` 一图一记录模型、`return_photo` 私有上传与 `return` 上传归属；
- `return-wall` / `return-display-v1` / `protection_mode=none` 无水印公开衍生，
  复用 operation lease/heartbeat/恢复，profile 切换不影响返图；
- 管理端返图管理（列表 + 一图一记录编辑）与公开一级导航返图墙 `/returns`；
- 轻量展会掉落：四选项业务类型映射、`event_name` / `event_time`、
  `/adoptions` 全部/常规领养/展会掉落筛选、卡片与详情展示；
- 管理端预览支持服务端缩放（`?w=`）以节省 OSS 流量。

不要把仍待完成的独立 Review、手机闭环、返图 SIGKILL 重放和用户验收写成已完成。

## 后端分层

`server/utils/` 按职责分目录：

| 目录 | 只放什么 |
| --- | --- |
| `repository/` | SQL、行映射、条件更新、版本与 lease CAS |
| `service/` | 同步业务规则、参数/状态校验、DTO 组合、事务入口 |
| `runner/` | 持久 operation、OSS 副作用、阶段推进、心跳、失败、清理、启动恢复 |
| `recipe/` | 纯函数：处理串、不可变媒体身份、Object Key、尺寸推导 |
| `route/` | Host、Session、Origin、CSRF、Schema、安全错误转换 |

根目录只留跨层基础设施，例如 `database`、`media-storage`、`runtime-config`、`safe-log`、`service-error`、`api-error`、`password`、`private-response`。

`server/routes/` 是 Nitro 文件路由；`server/utils/route/` 是 handler 辅助层，不得合并。

返图 publication 必须复用 operation lease、heartbeat 和 recovery 基础设施；不要新建第二套上传器、第二套公开 URL 生成规则或第二套任务状态机。

## CI 与部署纪律

- 阶段 D 实现者运行相关本地门禁并记录真实结果，但不得把本地通过写成远端全绿；
- 不得在未授权情况下把 T49 流水线修复混入 T35–T37；
- 不得删除测试、放宽类型、安全、媒体或 E2E 断言；
- 不创建 `v*` tag，不触发 Docker Hub 正式发布；
- 运行镜像使用 pnpm 正式 production deploy/install 机制，不手工复制单个依赖闭包；
- 正式域名、TLS、线上 Compose、空卷、升级、回滚和恢复演练由 T52 处理。
