# CLAUDE.md

This file provides guidance to coding agents working with code in this repository.

## 项目简介

`project-fur-paws` —— 为“有点小狗工作室”（英文 `DITE DOG`）制作的兽装主页和轻量管理后台。

**当前阶段与任务状态一律以 `agent_docs/需求1-兽装工作室主页/STATE.md` 与 `implementation/TASKS.md` 为准。**本文只提供入口与稳定纪律，不记录进度：进度写在这里会过期，然后误导下一个 Agent。

GitHub Actions 已知未全绿（`checks` 在 Production build 失败，`e2e` 跳过），由 T49 统一关闭。不得把本地门禁通过描述为远端全绿或正式发布就绪。

## 网站核心原则（景宸确认）

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- **展示主体只有兽装。** 页面首先服务于兽装作品和返图的观看，视觉层级始终以图片为最高优先级。
- **保持简洁。** 不用复杂版式、动效、状态面板或通用 CMS 抢夺作品注意力。
- **图片是主要表达方式。** 页面结构、留白和内容节奏优先保障图片尺寸、清晰度、方向和连续浏览体验。
- **Logo、文字和符号均为辅助。** 只承担品牌识别、必要说明、导航和状态提示，不遮挡图片或形成更强视觉焦点。
- **文字简短且必要。** 能由图片表达的内容不重复堆砌；不写防御性、啰嗦的说明文案。
- **景宸不是开发人员。** 管理端文案使用清楚中文，不展示内部任务号、数据库术语、Object Key 或中英混杂错误信息。

## 工作流：spec-driven 开发

所有需求文档位于 `agent_docs/`。每次编码前至少完整阅读：

1. `需求1-兽装工作室主页/STATE.md`：当前阶段、范围和下一步；
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
- 不重写已经执行的历史迁移，只新增前向迁移；
- `AGENTS.md` 是指向本文件的软链接；
- 只跑必要的测试。每次集成测试/E2E 调用阿里云 OSS 都产生流量费用且耗时，仅在必要时跑完整套件。

未来分享与 URL 策略见 `planning/FUTURE-ITERATIONS.md`，该文件不是实施授权。

## 当前写入策略

所有代码、文档、Review 和修复直接在最新 `main` 串行完成：

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

返图与作品**彻底解耦**，两级模型：**设定 `return_characters` + 它的多张返图 `return_photos`**。

- 设定有自己的名称、公开 slug 与可选 `@昵称`；关联作品**可选**，`work_id` FK 为 `set null`；
- 返图能否发布**不取决于**关联作品是否存在或已发布：老作品没上架、甚至没有作品记录，也可以有返图；
- 一个设定可以有多张返图（横竖混放），`is_primary` 指定设定页的圆形主图；返图不设人工排序；
- 可选授权来源、确认时间和备注按设定保存，只进入受认证管理 DTO，不进入公开 DTO、HTML、图片元数据或日志；
- 公开返图使用 `return-wall` / `return-display-v1` / `protection_mode=none`，**不加水印**；
- 私有原图仍在私有 Bucket，公开页只消费预生成、验证完成、去除不需要 EXIF 的公开衍生图；
- `/returns` 是一级导航独立页面：每张返图独立平铺、每次请求随机打乱、纯净瀑布流（不标名称），点击进入 `/returns/{slug}` 设定页；
- 删除设定连带删除它的返图（已发布的先自动下架并精确清理公开对象），私有原图保留；
- 不建设返图者主页、搜索、点赞、评论、公开投稿，也不建设返图或全站回收站。

### 展会掉落

- 底层继续使用 `purpose=adoption`、`adoption_method=event_drop`；
- 管理端可以显示“委托作品 / 常规领养 / 展会掉落 / 纯展示”，但不能新增第四种底层 purpose；
- event_drop 只增加展会名称 `event_name` 与展会时间展示文本 `event_time`；
- 复用现有领养状态、价格、设定图、出厂照、作品水印、发布和下架；
- `/adoptions` 提供全部/常规领养/展会掉落筛选；首页和详情显示展会名称与时间；
- 展会时间不自动改变业务状态；
- 不创建 `events` 表、展会管理页、展会详情、地点、摊位、封面或历史归档。

### 公开排序与首页

- `/works` 与 `/adoptions` 按发布时间倒序（越新越前）；
- 人工 `sort_order` **只**服务首页精选，且已发布作品仍可直接修改顺序与精选并立即生效；
- 首页自动轮播写死：固定开启、10 秒一张，不是配置项（仍尊重 `prefers-reduced-motion`）。

### 取消项

- T38 不实施更多站点文字内容；
- T39 当前版本不实施 slug 改址历史；
- T40 不实施 30 天回收站；
- T41 不作为独立任务，手机轻量能力分别并入 T36、T37；
- Agent 不得为这些任务预建通用表、空路由、空页面或空导航。

## 阶段 E/F 已锁定生产事实

- 公开桌面与移动导航条品牌固定为“有点小狗”，不带“工作室”；这是公开导航显示规则，不做全仓机械替换；
- 复用现有私有源图 Bucket 与公开衍生图 Bucket，不保留旧的直连公开 OSS 兼容路径；正式切换时两个 Bucket 都设为 private 并开启 Block Public Access；
- CDN 只私有回源公开衍生图 Bucket，不能读取私有源图 Bucket；浏览器只消费约 24 小时有效的 CDN 鉴权 URL；
- 下架后公开查询立即移除，服务端对精确 CDN URL 发起强制刷新并追踪，CDN 服务器侧撤销目标约 5～6 分钟；不得声称能删除客户端已保存副本；
- 杭州同地域 ECS 内的 Nitro、migrate 和 ops 使用 `oss-cn-hangzhou-internal.aliyuncs.com`；本机、浏览器条件上传、CDN 回源和公开图片 URL 必须使用各自公网/CDN 场景，不能混用内网 Endpoint；
- 继续使用当前静态 AK/SK 方案，本阶段不引入实例 RAM 角色；Secret 不得进入仓库、日志、截图或客户端；
- `.env`、`.env.example`、`.env.compose.example` 与运行时校验必须同步。当前条件上传签名器必须在 T52-F1 真正使用独立公网上传基址，不能只校验 `OSS_UPLOAD_BASE_URL`；
- 生产 Bucket、CDN、域名、TLS、监控、部署、回滚和恢复按 `implementation/PRODUCTION-LAUNCH-HANDBOOK.md` 逐项执行；T49–T52 前不得提前切 ACL。

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

门禁命令统一使用 `APP_ENV=test`。`nuxt.config.ts` 只在该环境下把 E2E fixture 纳入编译，否则本地 typecheck 可能漏掉 CI 可见错误。**但 `pnpm build` 要用 `APP_ENV=production`**：内容守卫会拦下 test 环境故意编入的 fixture。

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
- 固定验收视口：`390×844`、`768×1024`、`1440×900`。

首页/委托页大图推荐横版至少 `1920×1080`、竖版至少 `1080×1920`。较小图片允许保存，启用时提示清晰度风险，确认后使用内嵌 FFmpeg Lanczos 生成私有适配源；该放大不会恢复不存在的细节。

忘记本地管理员密码时，停止开发服务后执行：

```powershell
pnpm auth:reset-password --confirm RESET_SINGLE_ADMIN_PASSWORD
```

`planning/prototype-v1/` 是历史原型，不得复制为生产 UI。

## 前端约定

- 公开端图片统一圆角：用 `--radius-image`，不要在各页面各写一份；
- `/works` 与 `/adoptions` 的筛选条共用 `PublicFilterChips`；
- 管理端列表页（作品管理、返图管理）的页头、查找条与表格共用 `admin-base.css` 里的 `.admin-list-page*` / `.admin-list-toolbar*` / `.admin-list-table` 类。**不要在页面里再复制一份这些样式**：过去两个列表页各自维护同样的 CSS，结果每加一次需求就漂移一次（表头字号、按钮大小、标题换行都对不上）；
- 若确实要覆盖共用类，选择器同时带上共用类（如 `.admin-list-toolbar.work-list-toolbar`）以提高 specificity，不要依赖样式表加载顺序。

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

## 开源许可

`/licenses` 是写死页面，不进文案编辑。copyleft 依赖（当前是 FFmpeg，GPL-3.0）必须内嵌许可证全文并给出源码获取途径；许可证正文以文件形式存在 `app/assets/licenses/`，原样取自实际分发的二进制所带 LICENSE，不手工转述。MIT / Apache 依赖只给仓库地址。升级依赖时同步该页与许可证文件。

## CI 与部署纪律

- 实现者运行相关本地门禁并记录真实结果，但不得把本地通过写成远端全绿；
- 不得在未授权情况下把 T49 流水线修复混入其他任务；
- 不得删除测试、放宽类型、安全、媒体或 E2E 断言；
- 不创建 `v*` tag，不触发 Docker Hub 正式发布；
- 运行镜像使用 pnpm 正式 production deploy/install 机制，不手工复制单个依赖闭包；
- 正式域名、TLS、线上 Compose、空卷、升级、回滚和恢复演练由 T52 处理。
