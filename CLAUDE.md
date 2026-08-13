# CLAUDE.md

本文件是 `project-fur-forge` 编码 Agent 的稳定入口。`AGENTS.md` 是指向本文件的软链接。

这里不记录当前任务进度、临时 SHA、Actions run 或一次性结论；这些内容会过期。实际阶段、范围、验收和勾选状态必须回到 `agent_docs/` 的活文档确认。

## 1. 项目与文档权威

本项目为“有点小狗工作室”（英文固定为 `DITE DOG FURSUIT`）提供图片优先的兽装主页和轻量管理后台。

### 开工前必读

需求1是全站产品、媒体、安全与生产基线。每次编码前至少完整阅读：

1. `agent_docs/需求1-兽装工作室主页/STATE.md`；
2. `agent_docs/需求1-兽装工作室主页/foundation/README.md`；
3. `agent_docs/需求1-兽装工作室主页/requirements/SPEC.md`；
4. `agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md`；
5. `agent_docs/需求1-兽装工作室主页/planning/PLAN.md`；
6. `agent_docs/需求1-兽装工作室主页/implementation/TASKS.md`；
7. `agent_docs/需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`；
8. 同目录的 `models/README.md`、`.design/README.md`、`artifacts/ARTIFACTS.md` 和 `implementation/notes/README.md`。

若改动属于需求2或后续增量需求，还必须完整阅读该需求目录下的 `STATE.md`、`foundation/README.md`、`requirements/SPEC.md`、`planning/PLAN.md`、`implementation/TASKS.md` 及其模型、设计、产物和证据入口。后续需求可以增加产品行为，但不能暗中放宽需求1的媒体、安全和生产边界。

### 文档执行纪律

- 不能只依据聊天摘要、历史记忆、旧 commit 或本文件开始编码。
- 当前范围与下一步看 `STATE.md`；业务契约看 `SPEC.md`；实现顺序看 `PLAN.md`；勾选权威只看 `TASKS.md`。
- 契约变化先同步 SPEC、PLAN、TASKS，再改代码；代码偏离契约即 bug。
- dated notes、Review、调研、原型和截图只记录当时事实，不能覆盖活文档。
- `planning/FUTURE-ITERATIONS.md` 只记录未来候选，不是实施授权。
- 只有改变公开行为、数据事实或管理心智模型的问题才升级给用户；普通技术取舍按现有架构完成。

## 2. 产品与文案原则

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- 展示主体只有兽装；页面首先服务作品和返图观看。
- 保持简洁；不让复杂版式、动效、状态面板或通用 CMS 抢夺图片注意力。
- Logo、文字和符号只承担品牌、必要说明、导航和状态提示。
- 文字短而必要；能由图片表达的内容不重复堆砌。
- 景宸不是开发人员；管理端使用清楚中文，不展示任务号、数据库术语、Object Key 或中英混杂错误。
- 公开桌面与移动导航品牌固定为“有点小狗”，不带“工作室”；不要机械替换其它位置的完整名称。

## 3. Spec 驱动的 Git 与 PR 工作流

所有代码、文档、Review 和修复都通过任务分支与 PR 合入 `main`。

1. 写入前先 `git fetch origin`，核对远端 `main`、当前分支和 upstream SHA。
2. 需要更新当前任务分支时一律使用 `git pull --rebase`；禁止裸 `git pull` 制造 merge commit。rebase 前先确认工作区状态，不能用 reset 或覆盖来丢弃用户改动。
3. 从 `origin/main` 新建任务分支：功能 `feat/*`、修复 `fix/*`、纯文档 `docs/*`。禁止直接在 `main` 提交或推送。
4. 只读分析可以并行；任何写入、迁移和会改状态的门禁必须串行。
5. 提交前再次 fetch，确认远端任务分支没有并发推进；精确暂存本任务文件，不默认 `git add -A`。
6. 提交保持小而可回滚；不 force push、不硬 reset、不重写已验收历史。
7. 推送任务分支并更新以 `main` 为目标的 PR；不创建 `v*` tag，不触发未授权的正式发布。
8. 本地通过只能记录为本地结果。必须查询最终 PR HEAD 对应的 Actions；旧 SHA、旧 run 和下游尚未结束的 job 都不能描述为远端全绿。
9. 后端实现、前端实现、独立 Review、用户验收和正式发布是不同门禁；同一实现者不能为自己的实现代签独立 Review。

模型与角色分工以当前需求的 `implementation/EXECUTION_ROUTING.md` 为准，不在这里固化容易过期的模型版本。

## 4. 命令、测试与浏览器验收

Node.js、pnpm 和依赖版本以仓库当前 manifest/lockfile 为准。安装使用：

```powershell
pnpm install --frozen-lockfile
```

门禁命令显式设置环境，并串行执行：

```powershell
$env:APP_ENV='test'; pnpm lint
$env:APP_ENV='test'; pnpm typecheck
$env:APP_ENV='test'; pnpm test
$env:APP_ENV='test'; pnpm test:integration
$env:APP_ENV='production'; pnpm build
pnpm run verify:production
```

`nuxt.config.ts` 只在 `APP_ENV=test` 时编入 E2E fixture；`pnpm build` 必须使用 `APP_ENV=production`，并通过生产内容守卫。

### Playwright 精确执行

指定单个或多个 spec 时直接调用本地 Playwright：

```powershell
pnpm exec playwright test tests/e2e/admin-updates.spec.ts
pnpm exec playwright test tests/e2e/public-home.spec.ts tests/e2e/public-updates.spec.ts
pnpm exec playwright test tests/e2e/admin-updates.spec.ts --grep '陈旧版本'
```

不要使用：

```powershell
pnpm test:e2e -- tests/e2e/admin-updates.spec.ts
```

这里的 `--` 会被 Playwright 当成选项终止符，文件参数可能不再作为 spec 过滤条件，实际意外启动全量套件。启动后先核对 Playwright 输出的测试总数；数量超出预期就立即停止并改用 `pnpm exec playwright test <spec...>`。

并发/异步 E2E 不能只等待 `click()`：Vue 事件处理器中的网络 Promise 不会被 Playwright 点击自动等待。下一步操作前必须等待用户可观察的完成状态，例如按钮恢复、表单复位、列表内容更新或明确响应；不要用固定 sleep 掩盖竞态。

### 按风险选测试

- 常规代码执行 lint、typecheck 和直接相关 unit。
- Nuxt 路由、运行时、迁移或生产输出改动执行 production build。
- Schema、API、迁移、页面路径只运行直接相关 integration/E2E；跨层媒体、发布、恢复和阶段门禁才跑完整相关套件。
- 集成/E2E 可能调用阿里云 OSS，产生费用并耗时；不要因命令写错意外跑全量，也不要为“变绿”删除、跳过或放宽断言。
- 首次失败要记录真实命令、错误和根因；修复后先精确重跑，再决定是否需要合并或全量回归。

### 真实浏览器

```powershell
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理端：`http://localhost:3000`；公开端：`http://127.0.0.1:3000`；两个 Host 不混用。
- 固定视口：`390×844`、`768×1024`、`1440×900`。
- 含 UI、公开投影、媒体或用户操作的改动，需要检查成功、冲突、失败、恢复、重载、图片解码、横竖请求、焦点/键盘、console/network 和截图/trace。
- 自动化不能替代独立 Review 或用户验收。

## 5. 已锁定的公开业务边界

### 返图

- 返图与作品解耦：`return_characters` 设定 + 多张 `return_photos`；`work_id` 可选且删除作品时 `set null`。
- 返图发布不依赖关联作品；一个设定可有多张横竖混合照片，`is_primary` 只指定设定页圆形主图，不设人工排序。
- 授权来源、确认时间和备注只进入认证管理 DTO，不进入公开 DTO、HTML、图片元数据或日志。
- 公开返图使用 `return-wall` / `return-display-v1` / `protection_mode=none`，不加水印；私有原图继续保存在私有 Bucket。
- `/returns` 是独立一级页：照片逐张平铺、每次请求随机打乱、不标名称，点击进入 `/returns/{slug}`。
- 删除设定会连带删除返图记录；已发布内容先下架并精确清理公开对象，私有原图保留。
- 不建设返图者主页、搜索、点赞、评论、公开投稿或回收站。

### 作品、领养与首页

- 展会掉落仍是 `purpose=adoption` + `adoption_method=event_drop`，只增加 `event_name` 和 `event_time`；不创建 `events` 表或展会管理系统。
- 展会时间只展示，不自动改变领养状态。
- `/works` 与 `/adoptions` 按发布时间倒序；人工 `sort_order` 只服务首页精选。
- 首页自动轮播固定开启、10 秒一张，保留显式暂停并尊重 `prefers-reduced-motion`。
- 当前不实施 slug 改址历史、30 天回收站、更多站点文字内容或独立手机任务；不得预建空表、空路由、空页面或空导航。

## 6. 媒体、安全与生产基线

- 私有源图与公开衍生图使用不同私有 Bucket；浏览器只消费验证完成的 ESA HTTPS 公开衍生 URL。
- 正式环境的服务端 OSS 使用杭州内网 Endpoint；本机、浏览器条件上传和 ESA 回源使用各自公网/边缘场景，不能混用。
- 条件上传签名器使用 `OSS_UPLOAD_BASE_URL`；服务端 SDK 使用 `OSS_ENDPOINT`。
- 生产媒体校验看 `APP_ENV`，不能根据 `MEDIA_BASE_URL` 域名猜环境。
- 下架后公开查询立即移除，并对精确 ESA File URL purge；保存并追踪 TaskId。不要声称能删除客户端已经保存的副本。
- `.env`、`.env.example`、`.env.compose.example`、运行时 Schema、测试和部署文档必须同步；URL 含 `#` 时在 dotenv/Compose 中加引号。
- 不删除或清空 `.env`，不输出 Secret。现有阿里云 AK/SK 不进入仓库、日志、截图或客户端。
- 正式部署是 app-only Compose：唯一常驻容器为 Nuxt/Nitro，端口只绑定 `127.0.0.1:3000`；migrate/ops 使用同一冻结镜像的一次性容器。
- Nginx 在 ECS 宿主机由 systemd 管理；ESA 边缘终止 TLS，源站固定 HTTP/80。宿主机不监听 443，不保存证书或 ACME DNS Secret。
- 正式 Host 只允许公开/管理精确域名。readiness 使用 `PUBLIC_BASE_URL` Host；原始 loopback Host 保持 421，不能为健康检查放宽隔离。
- `/_nuxt/**` 可长缓存；`/api/**`、会话、管理 Host 和写操作绕过共享缓存；公开 SSR HTML 在正式实测前默认绕过缓存。

## 7. 代码组织约定

### 前端

- 公开端图片统一使用 `--radius-image`。
- `/works` 与 `/adoptions` 的筛选条复用 `PublicFilterChips`；公开搜索复用 `PublicCatalogSearch`。
- 首页与 `/updates` 的动态卡片复用 `PublicUpdateCard` / `PublicUpdateList`，不要复制平行样式。
- 管理端列表页复用 `admin-base.css` 的 `.admin-list-page*`、`.admin-list-toolbar*`、`.admin-list-table`；覆盖时选择器同时带共用类，不依赖样式加载顺序。
- `planning/prototype-v1/` 是历史原型，不复制为生产 UI。

### 后端

`server/utils/` 按职责分层：

| 目录 | 职责 |
| --- | --- |
| `repository/` | SQL、行映射、条件更新、版本与 lease CAS |
| `service/` | 同步业务规则、参数/状态校验、DTO、事务入口 |
| `runner/` | 持久 operation、OSS 副作用、阶段推进、心跳、失败、清理、恢复 |
| `recipe/` | 纯函数：处理串、不可变媒体身份、Object Key、尺寸推导 |
| `route/` | Host、Session、Origin、CSRF、Schema、安全错误转换 |

根目录只留跨层基础设施。`server/routes/` 是 Nitro 文件路由，`server/utils/route/` 是 handler 辅助层，二者不能合并。

返图与其它 publication 必须复用现有 operation lease、heartbeat、recovery、上传器和公开 URL 规则，不新建第二套状态机。

### 迁移与许可证

- 不重写已执行的历史迁移，只新增前向迁移。
- `/licenses` 是写死页面，不进入文案编辑。
- FFmpeg 为 GPL-3.0；内嵌许可证全文和源码获取途径必须与实际分发二进制同步。MIT/Apache 依赖给仓库地址。

## 8. 本地维护与运维

- 首页/委托大图推荐横版至少 `1920×1080`、竖版至少 `1080×1920`。较小图片可在明确提示后用内嵌 FFmpeg Lanczos 生成私有适配源；放大不会恢复细节，原图保留。
- 低分辨率设定图同样允许保存；发布时按既有流程生成保持比例的私有适配源。
- 忘记本地管理员密码时，先停止开发服务，再运行：

```powershell
pnpm auth:reset-password --confirm RESET_SINGLE_ADMIN_PASSWORD
```

- 运维写操作默认 dry-run，必须显式 `--no-dry-run`：

```powershell
pnpm media:cleanup-expired-uploads
pnpm media:reconcile-site-display
```

- 正式部署、恢复和回滚以 `agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md` 及当前生产决策文档为准，不用通用模板替换实际主机架构。
