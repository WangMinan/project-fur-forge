# CLAUDE.md

本文件是 `project-fur-forge` 编码 Agent 的稳定入口；`AGENTS.md` 指向本文件。临时 SHA、Actions run、一次性 finding、截图和任务进度写入对应 `agent_docs/`，不在本文件固化。

## 1. 项目与权威文档

项目为“有点小狗工作室”提供图片优先的公开站和轻量管理后台。英文品牌固定为 `DITE DOG`，不得再使用 `DITE DOG FURSUIT` 或“暂用英文名”。

需求1继续提供双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。需求3提供当前已经实现的业务基线。**当前活跃产品增量是需求4：站点视觉升级与内容合规。**

开工前至少完整阅读：

### 需求1稳定基线

- `agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md`
- `agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`
- 与任务直接相关的需求1 STATE/SPEC/PLAN/models

### 需求3当前产品基线

- `agent_docs/需求3-站点业务简化与委托投递/STATE.md`
- `foundation/README.md`
- `requirements/SPEC.md`
- `models/README.md`
- `planning/DATA-MIGRATION.md`

### 需求4活文档

1. `agent_docs/需求4-站点视觉升级与内容合规/STATE.md`
2. `foundation/README.md`
3. `requirements/SPEC.md`
4. `requirements/COPY.md`
5. `models/README.md`
6. `.design/README.md`
7. `planning/PLAN.md`
8. `planning/DATA-MIGRATION.md`
9. `implementation/TASKS.md`
10. `review/REVIEW.md`

权威顺序：SPEC 定产品契约；COPY 定目标成文；models 定字段/UI 模型；design 定视觉行为；PLAN/DATA-MIGRATION 定顺序与停止点；TASKS 定勾选；STATE 定当前事实。聊天摘要、dated notes、旧 Review、历史 commit 和自动化测试不能覆盖活文档。

## 2. 当前产品基线

### 2.1 品牌与退役边界

- 中文：`有点小狗工作室`；短品牌：`有点小狗`。
- 英文：`DITE DOG`。
- slogan：`不只做小狗毛 | 只做海绵头`。
- 返图墙、最新动态、FAQ、抖音、小红书和 Bilibili 已退役，不得恢复入口、表、DTO、媒体或占位。
- 当前官方联系面只有邮箱、QQ、QQ群。

### 2.2 Hero、作品和领养

- 首页/委托 × 横/竖四个 Hero 集合独立。
- 首页每方向 1–5 张、10 秒轮播、暂停、页面隐藏暂停、reduced-motion 停止。
- 委托每方向同时只启用一张，可以先下架再替换，不轮播。
- 横版和竖版素材分别维护；不自动拿横图裁竖图，不强迫数量/顺序配对。
- 普通作品公开只含名称、物种和媒体。
- adoption status 只有 `available | adopted`。
- published adoption 至少有合格 `adoption_cover` 或 `design_sheet`；卡片/详情按现行回落规则。
- adopted 可以进入精选，不进入首页当前领养。
- 作品详情保持名称、物种和单一查看序列；不恢复事实表、related、前后导航。
- 水印、publication operation、lease、recovery、purge 和媒体配方沿用现有实现。

### 2.3 委托

- `/commission/apply`：一张私有设定图、称呼、物种、+86 手机、QQ、身高、体重。
- 同一手机号已有 pending 时拒绝重复提交。
- `/admin/commissions`：pending/accepted/rejected。
- 不接 SMTP、短信、公开查询、自动建作品、在线合同、订单或支付。
- 私有设定图无 PUBLIC variant、无 ESA、无水印。
- PII 不进入公开 DTO、HTML、URL、localStorage、analytics、普通日志、错误或真实 fixture。

## 3. 需求4新增边界

### 3.1 首页和领养

- 首页固定四幕：品牌 Hero → 代表作品 → 自设委托 → 设定领养。
- 首页仍是完整业务地图，但各幕面积和视觉权重不等；不得退化为同权卡片平铺。
- 首页设定领养只展示一项开放领养；无 `available` 时隐藏整幕。
- `/adoptions` 唯一排序：`available` 在前、`adopted` 在后；组内 `works.updated_at DESC`，再以 ID 稳定排序；搜索后保持顺序再分页。
- `/works` 继续使用现有公开时间顺序，不被领养 comparator 覆盖。

### 3.2 视觉与动效

- 设计定义：**简洁底盘 + 灵动角色感 + 摄影主导的编辑式工作室网站**。
- PC Web 是第一视觉基准；390/430 移动端必须同步等价重排。
- 不使用 scroll-jacking、长时间 pinned scroll、强制横向叙事、持续视差、全屏粒子或背景音效。
- 允许有因的一次性遮罩揭示、图文错峰、图片聚焦/轻 tilt、控制器/成功状态轻回弹；不允许持续摇摆或所有元素都弹。
- 一个视口最多一个主要大对象运动。
- 普通页面动效使用 CSS/WAAPI 和统一 token；Apple Design Skill 是空间纪律来源，不是压低全部情绪或安装 spring 库的命令。
- View Transitions 只做渐进增强，不支持或 reduced-motion 时自然回退。
- SSR/无 JavaScript 内容默认可见。

### 3.3 组件与长任务进度

- 新公开行动只使用统一 primary/secondary/text 组件；不在页面内继续复制胶囊按钮 CSS。
- 管理端行动使用统一 admin primitive。
- 所有管理端耗时操作必须立即展示进度：
  - OSS XHR upload：真实字节百分比；
  - publication/branding/Hero operation：服务端真实阶段和计数；
  - FFmpeg/未知工作量：阶段 + elapsed + indeterminate。
- 禁止把 operation 阶段映射成 12/35/56/91 等伪精确百分比。
- 长 operation 刷新页面后恢复状态；可重试/取消时显示真实入口。

### 3.4 Hero 管理

- 四集合的 version、item、排序、owner context 和 operation 继续独立。
- admin 信息架构改为一级“首页/委托”、二级“横/竖”；显示另一个方向摘要。
- 委托页宽屏可并排显示横/竖单槽；首页按方向编辑多项并显示 `横版 X/5 · 竖版 Y/5`。
- 提供桌面/手机画框预览和九宫格焦点；不新增 pair/crop/focal 表。
- 同一 asset 多处复用但焦点冲突时阻断，不静默覆盖。

### 3.5 轻量申请确认

- 站内表单负责结构化投递；工作室官方 QQ 私聊负责优先后续沟通、报价和逐单确认；邮箱备用；QQ群非默认订单确认渠道。
- 表单只新增两个未预勾选确认：
  - 已满 18 周岁并有权提交设定图；
  - 已阅读隐私政策，理解信息用途和提交不等于接单/报价/排期/合同。
- request Schema 使用两个 `z.literal(true)`；service 在消费 upload 前校验。
- 不新增 `privacy_controller_name`、intake metadata API、contract version、确认数据库列、客户端版本握手、stale 409 或 legacy/v2 管理 UI。
- 实际经营主体名称通过现有 `privacy_policy` 编辑能力写入；联系邮箱复用 `contact_email`。
- checkbox 是提交门槛，不是电子签名；具体委托继续在官方 QQ 逐单确认。

### 3.6 保存与删除

- 委托 PII/私有设定图只在评估、履行、1 年保修、争议及法律必要期限内保存。
- 失效上传至少每月人工清理；申请至少每半年复核；rejected 处理满 180 天进入候选。
- accepted 只有业务/保修/争议/法定期限结束后才人工确认。
- 不建设 cron、Worker、TTL 或通用生命周期引擎。
- Review 可以列 masked 候选；正式 execute 每次只允许一条申请，不提供按时间批量删除。
- 删除工具默认 dry-run、强确认、精确 Key、DB/OSS 一体、对象验证和幂等重入。
- 用户删除请求单独处理，不等待周期批次。

### 3.7 服务条款和第三方声明

- 网站服务条款是一般规则；具体范围、价格、付款、排期、修改、交付和特殊约定在官方 QQ 中逐单书面确认。
- 条款不得以“所有解释权归工作室”或不合理单方免责兜底。
- npm 生产依赖声明从实际 lockfile/安装结果确定性生成。
- FFmpeg 当前只在自有服务器容器内使用，不对外分发。
- Noto Serif SC 按 SIL OFL 1.1。
- `zhuohei-collage.ttf` 来源为 Lemi Font 免费商用声明，作为第三方授权资产，不称为开源软件。
- 当前 main 不增加 required check。

## 4. Git 与写入

默认所有代码、文档、Review 和修复通过任务分支与 PR 合入 main。只有用户对当前操作给出明确直接 main 授权时，才可按该次授权执行。

- 写前 fetch，核对 main/upstream SHA；
- 不 force push、不 hard reset、不覆盖用户改动；
- 写操作、迁移、媒体删除和门禁串行；
- 提交小而可审查；用户要求一个 commit 时使用原子 tree/commit；
- 最新 PR/commit CI 只代表对应 SHA；
- 实现、focused review、最终 independent review、用户验收和生产执行互不代签；
- 当前 main 不配置 required checks，不擅自改变。

## 5. 验证与测试纪律

### 5.1 权威和目的

- **用户人工验收是公开视觉、真实图片、动效节奏和访客文案的最终门禁。** 自动化不能代签“好看、自然、适合角色”。
- 自动化测试只保护稳定不变量和基础可运行性，不是业务规格来源。
- 测试失败后先分类：
  1. 稳定不变量回归：修代码，或在产品契约确已改变时调整测试；
  2. 旧文案/DOM/class/毫秒/历史截图语义：删除、合并或降级该测试，不机械改成新数值。
- 不为每个历史 bug 默认增加永久用例；只有高影响、易复发、可稳定断言的问题进入 core。
- 同一事实不在 unit/integration/E2E 三层重复证明；选择最低成本、最接近风险的一层。

### 5.2 禁止的测试耦合

普通测试不得依赖：

- 精确动画时长、easing 字符串或中间帧数量；
- 完整营销/法务文案全文（除 content guard/禁词等稳定约束）；
- scoped class、非语义 DOM 层级或组件内部实现；
- 为某次历史视觉修正专门固定的 test-id/像素；
- 只为让旧套件全绿而存在的 fixture 和分支。

Playwright 不负责评判审美；不要用截图像素比较取代人工 Review。

### 5.3 目标测试层级

实现 T14 后使用：

```powershell
pnpm check:fast
pnpm test:core
pnpm test:smoke
pnpm test:release   # 仅发布/人工显式启动
pnpm test:legacy    # 迁移期可选，non-gating，最终可删除
```

脚本落地前：

- 文档：链接/占位/交叉口径 Review，不跑应用套件；
- 普通代码：`pnpm lint`、`pnpm typecheck`、直接受影响的少量 vitest；
- Nuxt/runtime/config：再运行 `pnpm build`；
- UI：启动真实浏览器人工核验，按需要运行一两个相关 Playwright smoke；
- 迁移/安全/媒体/删除：运行对应稳定 integration/core，不跑无关历史套件。

### 5.4 Core 必须保护的范围

- Host、session、CSRF、Origin、限流；
- 匿名上传 token/TTL/摘要/MIME/尺寸/一次消费；
- PII 和私有媒体不进入公开投影、HTML、普通日志；
- migration、foreign key、integrity、前向重入；
- publication/lease/recovery/deletion 的关键状态和精确对象；
- `/adoptions` 排序等明确业务不变量；
- production build/readiness 的基础可用性。

### 5.5 Smoke 范围

Playwright 只保留少量主旅程：

- 首页加载和主要入口；
- works/adoptions 列表与详情；
- 委托申请成功/主要失败；
- admin 登录；
- 一条上传与长任务进度；
- 一条作品发布/下架；
- privacy/service/licenses 可读。

每条 smoke 只断言用户可观察结果，不断言内部实现。

### 5.6 Workflow 与发布

- 默认 `quality` 应在需求4 T18 中减重为 lint/typecheck/core/必要 build；docs-only 跳过应用重型任务。
- image-build、Compose/restore/Nginx、destructive drill 和 release smoke 改为 `workflow_dispatch` 或发布路径显式执行。
- 旧 `pnpm test`、`pnpm test:integration`、`pnpm test:e2e` 在迁移期属于 legacy 事实，不因存在就自动成为每次改动门禁。
- 不新增 required check。
- 即使自动 smoke 全绿，未通过王旻安/景宸人工验收也不得宣称视觉完成。

## 6. 浏览器与 Host

```powershell
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理：`http://localhost:3000`
- 公开：`http://127.0.0.1:3000`
- 不混用 Host。
- 视觉至少人工验证：390×844、430×932、768×1024、1023×900、1024×900、1440×900。
- 至少一台真实手机验证动态地址栏、safe area、输入法、触控、图片、确认和提交。
- 检查键盘、焦点、reduced-motion/transparency/contrast、console/network、decode、404、LCP/CLS 和水平溢出。
- 保存关键截图/短视频与人工结论，但不把像素比较变成新门禁。

## 7. 媒体、安全与生产

- 私有源图与公开派生分离；公开只消费 ESA HTTPS READY variants。
- 服务端 OSS Endpoint、浏览器上传地址和 ESA 回源配置不能混用。
- 条件 PUT 使用 `OSS_UPLOAD_BASE_URL`；服务端 SDK 使用 `OSS_ENDPOINT`。
- OSS CORS 保持 `AllowedOrigin=*`；应用匿名 API 仍严格校验 Origin、token、TTL、限流、蜜罐、摘要、MIME、尺寸和图片解码。
- production 环境由 `APP_ENV` 判定。
- 下架立即移除公开查询并对精确 URL purge。
- `.env*`、runtime schema、tests 和部署文档同步；不输出 Secret。
- app-only Compose，Nuxt/Nitro 绑定 `127.0.0.1:3000`；Nginx 在宿主机，ESA 终止 TLS。
- 正式 Host 精确隔离；原始 loopback Host 421 不得放宽。
- `/_nuxt/**` 可长缓存；API、管理、会话和写操作绕过共享缓存。
- 不重写历史 migration，只新增前向 migration。
- 长 operation 保持 lease/heartbeat/recovery；不在请求中假装同步完成。
- 删除默认 dry-run、强确认、精确 Key、对象验证、数据库完整性和 clean backup 边界。
- 外部 ECS/云盘快照由操作员确认，Agent 不代签。

## 8. 代码组织

`server/utils/`：

| 目录 | 职责 |
| --- | --- |
| `repository/` | SQL、行映射、CAS、lease |
| `service/` | 同步规则、校验、DTO、事务入口 |
| `runner/` | 持久 operation、OSS 副作用、恢复、清理 |
| `recipe/` | 纯媒体身份、处理串、Key、尺寸 |
| `route/` | Host、Session、Origin、CSRF、body、错误 |

- 首页继续消费单个聚合 DTO，不为四幕复制请求或新增版式表。
- `/adoptions` 排序在 repository/service 唯一实现，页面不二次排序。
- Hero/works/adoption 复用现有 publication/lease/recovery/purge。
- Hero admin 统一 UI，不合并四集合数据。
- retention/deletion CLI 复用 repository/service/storage，不复制 OSS 客户端。
- 公开内容 SSR 默认可见；动效不能先隐藏后等 JS。
- 管理列表、对话框、行动、上传、进度和分页优先复用现有组件。
- 新 upload flow 必须接入统一 progress；不得新增业务专属进度条 CSS。
- `/licenses` 不进入 CMS；生成声明与人工资产 registry 是事实来源。
