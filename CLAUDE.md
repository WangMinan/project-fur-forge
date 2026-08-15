# CLAUDE.md

本文件是 `project-fur-forge` 编码 Agent 的稳定入口。`AGENTS.md` 是指向本文件的软链接。

这里不记录临时 SHA、Actions run、一次性 finding 或会迅速过期的任务进度。实际范围、阶段、验收和勾选状态必须回到 `agent_docs/` 的活文档确认。

## 1. 项目与文档权威

本项目为“有点小狗工作室”提供图片优先的兽装主页和轻量管理后台。英文品牌名固定为 `DITE DOG`，不得再使用 `DITE DOG FURSUIT`。

### 开工前必读

需求1继续是全站媒体、安全、生产和部署基线。每次编码前至少完整阅读：

1. `agent_docs/需求1-兽装工作室主页/STATE.md`；
2. `agent_docs/需求1-兽装工作室主页/foundation/README.md`；
3. `agent_docs/需求1-兽装工作室主页/requirements/SPEC.md`；
4. `agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md`；
5. `agent_docs/需求1-兽装工作室主页/planning/PLAN.md`；
6. `agent_docs/需求1-兽装工作室主页/implementation/TASKS.md`；
7. `agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`；
8. 同目录的 models、design、artifacts 和 evidence 入口。

当前活跃产品增量是需求3。任何需求3相关实现还必须完整阅读：

1. `agent_docs/需求3-站点业务简化与委托投递/STATE.md`；
2. `agent_docs/需求3-站点业务简化与委托投递/foundation/README.md`；
3. `agent_docs/需求3-站点业务简化与委托投递/requirements/SPEC.md`；
4. `agent_docs/需求3-站点业务简化与委托投递/models/README.md`；
5. `agent_docs/需求3-站点业务简化与委托投递/.design/README.md`；
6. `agent_docs/需求3-站点业务简化与委托投递/planning/PLAN.md`；
7. `agent_docs/需求3-站点业务简化与委托投递/planning/DATA-MIGRATION.md`；
8. `agent_docs/需求3-站点业务简化与委托投递/implementation/TASKS.md`；
9. `agent_docs/需求3-站点业务简化与委托投递/implementation/EXECUTION_ROUTING.md`。

需求2是已经落地的历史增量。改动官方渠道、二维码或名称搜索时仍应读取其相关文档；其中最新动态和委托 FAQ 已被需求3明确覆盖，不能继续作为当前目标。

### 权威顺序

- 当前范围与下一步看 `STATE.md`；
- 产品、数据、隐私和验收看 `requirements/SPEC.md`；
- 目标持久模型和 DTO 看 `models/README.md`；
- 实现顺序和破坏性停止点看 `planning/PLAN.md`、`planning/DATA-MIGRATION.md`；
- 勾选权威只看 `implementation/TASKS.md`；
- dated notes、旧 Review、截图、聊天摘要和历史 commit 只能说明当时事实。

后续需求只在其 SPEC 明确写出的范围内覆盖旧行为。未明确改变的双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线继续以需求1为准。

### 文档执行纪律

- 不能只依据本文件、聊天记忆或旧代码开始实现；
- 契约变化先同步 foundation、SPEC、models、PLAN、TASKS 和 STATE，再改代码；
- 当前代码尚未完成需求3时，不能把目标文档误述为已经上线；
- `planning/FUTURE-ITERATIONS.md` 只记录候选，不是实施授权；
- 只有改变公开行为、数据事实、隐私、安全或管理心智模型的问题才升级给用户；普通技术取舍按现有架构完成。

## 2. 产品与文案原则

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

- 展示主体是兽装成果；页面首先服务作品、领养和委托入口；
- 返图墙和最新动态已进入永久退役范围，不能新增兼容入口、只读归档或隐藏维护页；
- 文字短而必要；作品和作品详情只公开名称、物种和图片；
- 首页、作品、领养和委托公开端允许更明显的导航、页面切换、区块和图片动效；
- 动效不能抢夺图片注意力、阻塞交互或破坏 SSR，`prefers-reduced-motion` 必须完整保留；
- 景宸不是开发人员；管理端使用清楚中文，不展示任务号、数据库术语、Object Key、摘要或中英混杂错误；
- 公开桌面与移动导航品牌固定为“有点小狗”，完整首页标题可使用“有点小狗工作室”；
- 英文品牌名固定为 `DITE DOG`；首页当前 slogan 为 `不只做小狗毛 | 只做海绵头`。

## 3. Spec 驱动的 Git 与 PR 工作流

所有代码、文档、Review 和修复都通过任务分支与 PR 合入 `main`。

1. 写入前先 `git fetch origin`，核对远端 `main`、当前分支和 upstream SHA。
2. 更新当前任务分支使用 `git pull --rebase`；禁止裸 `git pull` 制造 merge commit。rebase 前确认工作区，不能 reset 或覆盖用户改动。
3. 从 `origin/main` 新建任务分支：功能 `feat/*`、修复 `fix/*`、纯文档 `docs/*`。禁止直接在 `main` 提交或推送。
4. 只读分析可以并行；任何写入、迁移、媒体删除和会改状态的门禁必须串行。
5. 提交前再次 fetch，确认远端任务分支没有并发推进；精确暂存本任务文件，不默认 `git add -A`。
6. 提交保持小而可审查；不 force push、不硬 reset、不重写已验收历史。
7. 推送任务分支并更新以 `main` 为目标的 PR；不创建 `v*` tag，不触发未授权的正式发布。
8. 本地通过只能记录为本地结果。必须查询最终 PR HEAD 对应的 Actions；旧 SHA 和未结束 job 不能描述为当前远端全绿。
9. 后端实现、前端实现、破坏性演练、独立 Review、用户验收和生产执行是不同门禁；不得互相代签。

角色分工以当前需求的 `implementation/EXECUTION_ROUTING.md` 为准，不在本文件固化模型版本。

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

指定 spec 时直接调用本地 Playwright：

```powershell
pnpm exec playwright test tests/e2e/public-home.spec.ts
pnpm exec playwright test tests/e2e/admin-home.spec.ts tests/e2e/public-home.spec.ts
pnpm exec playwright test tests/e2e/public-home.spec.ts --grep '减少动效'
```

不要使用：

```powershell
pnpm test:e2e -- tests/e2e/public-home.spec.ts
```

这里的 `--` 可能让文件参数不再作为 spec 过滤条件，实际意外启动全量套件。启动后先核对测试总数；数量超出预期立即停止并改用 `pnpm exec playwright test <spec...>`。

Vue 事件处理器中的网络 Promise 不会被 Playwright 点击自动等待。下一步操作前必须等待用户可观察的完成状态，例如按钮恢复、表单复位、列表更新、明确响应或 operation 状态；不要用固定 sleep 掩盖竞态。

### 按风险选测试

- 常规代码执行 lint、typecheck 和直接相关 unit；
- Nuxt 路由、运行时、迁移或生产输出改动执行 production build；
- Schema、API、迁移、匿名上传和页面路径运行直接相关 integration/E2E；
- 跨层媒体、发布、恢复、永久删除和阶段门禁运行完整相关套件；
- 集成/E2E 可能调用阿里云 OSS，产生费用并耗时；不要因命令写错意外跑全量，也不要为“变绿”删除、跳过或放宽断言；
- 首次失败记录真实命令、错误和根因；修复后先精确重跑，再决定全量回归。

### 真实浏览器

```powershell
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理端：`http://localhost:3000`；公开端：`http://127.0.0.1:3000`；两个 Host 不混用；
- 固定视口至少：`390×844`、`768×1024`、`1023×900`、`1024×900`、`1440×900`；
- 含 UI、公开投影、媒体或用户操作的改动，需要检查成功、冲突、失败、恢复、重载、图片解码、横竖请求、焦点/键盘、reduced-motion、console/network 和截图/trace；
- 委托表单还需真实手机验证动态地址栏、输入法、单图上传和成功态；
- 自动化不能替代独立 Review 或用户验收。

## 5. 需求3已锁定业务边界

### 5.1 品牌、首页和 Hero

- 英文品牌名为 `DITE DOG`；旧英文名必须从当前代码、SEO、测试和可见文案移除；
- 首页 slogan 为 `不只做小狗毛 | 只做海绵头`；
- 首页 Hero 删除“查看这套作品/浏览作品展示”按钮和 linked work；
- 桌面：中文主标题底部居中，`DITE DOG` 与 slogan 同行左右分置；
- 移动：英文、中文、slogan 整体左对齐并下移；桌面与移动不得强行统一对齐；
- 手机 Hero 至少覆盖完整 `100svh`，使用 `100dvh` 兜底，不得露出底部白块；
- 首页和委托页横版/竖版完全独立：每个 placement/orientation 1–5 张启用项，独立排序、启停和发布，不跨方向自动裁切；
- 首页自动轮播固定 10 秒、保留暂停、页面隐藏暂停和 reduced-motion 停止。

### 5.2 返图与最新动态

- `/returns`、`/returns/{slug}`、`/updates` 及对应管理端、API、导航、sitemap 和 analytics 当前入口永久移除；
- `updates`、`return_characters`、`return_photos` 及关联行永久删除；
- `return_photo`、`return-wall`、`return-display-v1`、`RETURN_PHOTO` 永久删除；
- 所有返图私有原图、preprocess、preview、公开派生、pending object、OSS versions/delete marker、ESA cache 和包含旧数据的项目备份永久删除；
- 退役路由不做重定向，直接 404；
- 不保留 CSV、归档页、隐藏后台、恢复包或长期 Key manifest。

### 5.3 作品与领养

- 通用作品只维护 ID、slug、名称、物种、内部 purpose、adoption 状态/价格、发布、精选、版本、时间和图片；
- 删除装型、主人公开值、私有联系人、属性标签、旧制作进度、领养方式、展会名称/时间和 event sale；
- `/works` 卡片只显示名称、物种和 3:4 竖版成果图；移除用途/装型筛选，名称搜索可保留；
- `/works/{slug}` 只显示名称、物种、图集、前后浏览和相关作品；
- adoption 状态只有 `available | adopted`，价格可空；
- `/adoptions` 不再区分常规/展会，不接受 method 筛选；
- 每个 published adoption 必须有一张独立横版 `adoption_cover` 和一张主 `studio_photo`；
- `design_sheet` 最多一张，仅作可选详情素材，不是领养卡或发布门禁；
- 不从其它图片自动生成 adoption cover。

### 5.4 委托投递

- `/commission` 主要行动指向 `/commission/apply`，并直接展示 QQ、QQ群二维码和关于页入口；
- `/commission/apply` 必填：一张设定图、称呼、+86 手机号、QQ、身高、体重；
- 管理端新增 `/admin/commissions`，状态为 `pending | accepted | rejected`；
- 不接 SMTP、短信、用户账号、公开查询、撤回、自动报价或自动建作品；
- FAQ、`commission_faq_json`、FAQ 版本/API/Card 和 `commission_email_action` 完整删除；
- 委托介绍、估价说明、关于、法务、邮箱和官方渠道继续维护。

## 6. 媒体、安全与生产基线

- 私有源图与公开衍生图使用不同私有 Bucket；浏览器只消费验证完成的 ESA HTTPS 公开衍生 URL；
- 正式环境服务端 OSS 使用杭州内网 Endpoint；本机、浏览器条件 PUT 和 ESA 回源使用各自公网/边缘场景，不能混用；
- 条件上传签名器使用 `OSS_UPLOAD_BASE_URL`；服务端 SDK 使用 `OSS_ENDPOINT`；
- 生产媒体校验看 `APP_ENV`，不能根据 `MEDIA_BASE_URL` 域名猜环境；
- 下架后公开查询立即移除，并对精确 ESA File URL purge，保存并追踪 TaskId；
- `.env`、`.env.example`、`.env.compose.example`、运行时 Schema、测试和部署文档必须同步；URL 含 `#` 时在 dotenv/Compose 中加引号；
- 不删除或清空 `.env`，不输出 Secret；阿里云 AK/SK 不进入仓库、日志、截图或客户端；
- 正式部署是 app-only Compose：唯一常驻容器为 Nuxt/Nitro，端口只绑定 `127.0.0.1:3000`；migrate/ops 使用同一冻结镜像的一次性容器；
- Nginx 在 ECS 宿主机由 systemd 管理；ESA 边缘终止 TLS，源站固定 HTTP/80；宿主机不监听 443，不保存证书或 ACME DNS Secret；
- 正式 Host 只允许公开/管理精确域名；readiness 使用 `PUBLIC_BASE_URL` Host；原始 loopback Host 保持 421；
- `/_nuxt/**` 可长缓存；`/api/**`、会话、管理 Host 和写操作绕过共享缓存；公开 SSR HTML 在正式实测前默认绕过缓存。

### 6.1 匿名委托上传

- 不能通过删除 `created_by` 或增加 public owner 来放宽管理员 `upload_sessions`；
- 使用独立、短时、一次性 `commission_upload_sessions`，复用底层 OSS 条件 PUT、摘要、MIME、尺寸、图片验证和清理函数；
- 委托设定图只保存在私有媒体链，不生成 PUBLIC variant、不经过 ESA、不加水印；
- 公开写入校验 Origin、Content-Type、body size、可信客户端限流、token、TTL、一次性消费和蜜罐；
- 手机号、QQ、称呼、身高、体重、内部备注和设定图不得进入公开 DTO、HTML、URL、analytics、普通日志、错误文本或真实测试 fixture；
- 管理预览必须认证、短时、`Cache-Control: no-store`。

## 7. 代码组织约定

### 前端

- 公开端图片统一使用 `--radius-image`；
- 公共导航、移动抽屉、焦点陷阱、滚动锁定和焦点归还继续复用既有组件/工具；
- 页面切换只过渡公开主内容，Header/Footer 保持稳定；
- 公开搜索复用 `PublicCatalogSearch`，移除无字段支撑的 purpose/suit/method 筛选；
- 作品卡只展示名称、物种；领养卡独立展示状态和价格；
- 委托表单使用可见 label、邻近错误、单图状态和成功回执，不把 PII 写入 URL 或 localStorage；
- 管理列表复用 `admin-base.css` 的 `.admin-list-page*`、`.admin-list-toolbar*`、`.admin-list-table`；
- `planning/prototype-v1/` 是历史原型，不复制为生产 UI；
- 无 JS/SSR 内容默认可见，动效不能依赖先隐藏再等待脚本。

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

- Hero、作品、adoption cover 继续复用现有 publication operation、lease、heartbeat、recovery、purge 和不可变媒体身份；
- 匿名委托上传可以有独立会话表，但不能复制第二套图片校验、OSS 客户端或错误体系；
- repository 不拼页面文案，service 不直接处理 Vue 状态，runner 不承载纯 DTO 映射。

### 迁移与许可证

- 不重写已执行的历史迁移，只新增前向迁移；
- 需求3明确授权最终 DROP TABLE/重建，但必须遵循 DATA-MIGRATION 的 expand、清理、contract 顺序；
- `/licenses` 是写死页面，不进入文案编辑；
- FFmpeg 为 GPL-3.0；内嵌许可证全文和源码获取途径必须与实际分发二进制同步。MIT/Apache 依赖给仓库地址。

## 8. 破坏性清理纪律

需求3的返图/动态删除是显式授权例外，但不能简化为一条无保护 SQL：

1. 清理命令默认 dry-run；
2. 先停止应用和写入；
3. 输出脱敏计数，由用户核对；
4. 需要强确认短语；
5. 先枚举并删除私有/公开对象、OSS versions/delete marker、ESA cache 和旧项目备份；
6. 验证对象不可达；
7. 再执行 contract migration 删除表、列、行和枚举；
8. 运行 foreign key、integrity、readiness、production verify；
9. 创建并恢复验证新的净化备份；
10. contract 后只允许目标 Schema 兼容的新镜像前向修复。

不得：

- 在 CI 或容器普通启动中自动执行生产永久删除；
- 先 DROP 表再猜 Object Key；
- 把真实内容、PII、完整 Key 或可恢复 manifest 写入仓库；
- 为保留回滚能力建立空兼容表、隐藏归档或旧媒体副本；
- 把本地演练描述成生产已完成。

## 9. 本地维护与运维

- 首页/委托 Hero 横版推荐至少 `1920×1080`，竖版至少 `1080×1920`；两个方向分别上传和维护；
- 较小 Hero 可在明确提示后用内嵌 FFmpeg Lanczos 生成私有适配源；放大不会恢复细节，原图保留；
- adoption cover 使用横版单头成果图，不能由竖版全装图或设定图自动裁切；
- 低分辨率设定图仍可保存；公开作品设定图按既有比例适配，委托设定图只做私有验证；
- 忘记本地管理员密码时，停止开发服务后运行：

```powershell
pnpm auth:reset-password --confirm RESET_SINGLE_ADMIN_PASSWORD
```

- 普通运维写操作默认 dry-run，必须显式确认：

```powershell
pnpm media:cleanup-expired-uploads
pnpm media:reconcile-site-display
```

- 需求3永久退役命令必须使用其实现后确定的独立脚本和强确认短语，不能借普通 cleanup 命令隐式触发；
- 正式部署、恢复和回滚以需求1生产手册、需求3 `planning/DATA-MIGRATION.md` 及当前冻结发布记录为准，不用通用模板替换实际主机架构。
