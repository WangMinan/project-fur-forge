# 阶段 0 · 地基（Foundation）

> **角色**：固定需求4的模块边界、继承关系、数据/安全口径与不可扩散的非目标。
> **状态**：2026-08-21 仅阶段 E 开放；A～D 与原阶段 F 已关闭。任何阶段 E 偏离必须先同步本文件、SPEC、TASKS 和 STATE。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 1. 继承与覆盖

需求4是增量，不重建项目：

- 需求1继续提供双 Host、私有源图与公开派生、OSS/ESA、发布 operation、lease/recovery、认证、安全、部署与恢复基线。
- 需求2仅保留仍未被覆盖的二维码媒体链与名称搜索实现经验。
- 需求3是当前业务模型基线：返图/动态/FAQ 已退役；官方渠道为邮箱、QQ、QQ群；作品/领养已简化；四个 Hero 集合、私密委托投递和后台处理继续存在。
- 需求4覆盖公开视觉编排、动效语言、公共操作组件、管理端长任务反馈、Hero 管理体验、领养排序、访客文案、轻量申请确认、人工删除能力、服务条款和第三方声明。
- 不恢复返图墙、最新动态、FAQ、五平台联系、旧作品字段或在线交易能力。

发生冲突时，需求4仅在本文和 SPEC 明确列出的条款上覆盖需求3，其余仍以需求1～3为准。

## 2. 模块边界

### 2.1 优先收敛的 UI 地基

- `app/components/` 与 `app/assets/css/public-base.css`：统一公开 `primary / secondary / text` 行动，不继续复制胶囊按钮样式。
- `app/components/admin/`：统一管理端按钮、上传反馈和长任务进度；现有 `FfmpegProgress.vue`、局部 `<progress>` 与 operation 状态展示应收敛到通用组件。
- `app/composables/use*Upload.ts` 与 `app/utils/signed-put.ts`：复用上传阶段和真实字节进度，不要求一次性重写所有上传业务逻辑，但禁止新增第五套状态机/进度 UI。
- `app/pages/admin/site/home.vue`、`HeroCollectionItemCard.vue`、`useAdminHeroCollection.ts`：只重组管理信息架构和复用组件；四个集合及其 CAS/operation 继续独立。

### 2.2 公开站与业务投影

- `server/utils/repository/public-site-repository.ts`：领养排序、首页单项开放领养投影；不得改变 `/works` 的现有排序语义。
- `app/pages/adoptions/index.vue`、`HomeCurrentAdoptions.vue`、`AdoptionCard.vue`：消费服务端顺序；首页只完整展示一项，目录继续搜索/分页全部领养。
- `app/pages/index.vue`、`app/components/Home*`、`Featured*`、`CommissionLead.vue`：首页四幕与图片优先编排。
- `PublicHeader.vue`、`PublicFooter.vue`、公开行动组件：导航、材料、行动与动效语义。

### 2.3 内容、申请与清理

- `app/pages/commission/apply.vue`：两个未预勾选确认——成年/设定权利、隐私已读并理解提交非接单。
- `shared/schemas/commission.ts` 与提交 service：只增加两个 `z.literal(true)` 请求字段并在消费上传前校验；不持久化确认、不新增版本握手。
- `site_content` 现有 about/commission/terms/privacy/contact 字段与管理端：继续承担已确认处理者“有点小狗工作室”、隐私政策、服务条款和联系信息；不新增通用 CMS 或专用处理者字段。
- 现有 repository/service/storage：为 CLI 和 `/admin/commissions` 提供同一套单条 retention Review、dry-run 与精确删除能力；不提供自动批量删除。
- `/licenses`、生成脚本与第三方 runtime/asset registry：第三方声明事实源。当前 release workflow 把包含 FFmpeg 的镜像发布到公开 Docker Hub，因此 FFmpeg 必须按分发场景留存精确二进制、许可证、对应源码和构建信息。

以下模块只继承、不在本轮重构：管理员认证、作品/水印领域模型、OSS CORS、Nginx/Compose、支付外部流程、QQ 平台本身。

## 3. 设计事实来源

设计参考只用于抽取原则，不复制品牌、素材、文案或完整布局：

- Apple 中国首页：一屏一重点、短标题、少量行动、大幅视觉主体。
- 渔屋首页：国内兽装工作室首页覆盖作品、估价和领养的完整业务地图。
- 万物通行兽装页：全屏 Hero、整幅主模块与不等面积模块的节奏关系。
- Apple Design Skill：即时响应、空间一致性、可中断直接操作、材料层级、排版与无障碍。

Apple Design Skill 提供“动作为什么发生、从哪里来、怎样返回”的纪律，不定义 DITE DOG 的全部情绪。兽装具备角色、表情和生命感，因此本轮采用：

> **简洁底盘 + 灵动角色感**。

允许一次性、可解释的轻弹性、遮罩揭示、图文错峰、媒体聚焦和成功反馈；不允许持续漂浮、无意义弹跳、粒子、全屏视差或多个大对象同时抢动。普通实现仍优先 CSS/WAAPI，不把 Motion/Framer Motion 作为默认依赖。首页桌面逐幕 wheel 是用户新确认的唯一例外，只在 `min-width: 1024px` 生效；1023px 及以下不拦截原生滚动。

## 4. 接口与排序口径

### 4.1 首页聚合

- 首页继续只消费一个聚合投影，不为了四幕拆成多组公开请求。
- 第一件精选作品作为代表作品，剩余精选作为次级浏览。
- 委托幕复用现有 commission entry source/variant。
- 当前领养只返回或消费排序后的第一件 `available`；无开放项时整幕隐藏。
- 公开 DTO 不因视觉重构暴露内部 purpose、PII、Object Key、媒体状态或管理版本。

### 4.2 `/adoptions` 排序

公开领养目录的唯一排序为：

```text
available → adopted
组内：works.updated_at DESC → id ASC
```

规则：

- 状态分组优先于修改时间，因此刚改为 adopted 的作品不会跑到开放领养之前。
- 名称搜索在完整有序集合上过滤，过滤后保持相对顺序，再分页。
- 首页单项领养从同一有序集合中取第一件 `available`，不能维护另一套“最新”口径。
- `/works` 继续按其现有公开时间口径，不被此规则覆盖。

### 4.3 轻量申请确认

不新增只读 intake metadata API，不做客户端版本握手和 stale 409。

`POST /api/public/v1/commission-submissions` 在现有字段之外只增加：

```ts
adultConfirmed: true
privacyNoticeAcknowledged: true
```

- 页面显示当前隐私政策与“提交不等于接单”说明。
- 两项均不得预勾选，服务端要求字面量 `true`，并在消费 upload session 前校验。
- 确认只用于本次提交门槛，不建设电子签名/证据系统，不新增数据库列、legacy/v2 contract 或管理详情字段。
- 真实个人信息处理者名称通过现有隐私政策文本维护；联系邮箱复用 `contact_email`。

### 4.4 删除能力

- 首版同时提供受控 CLI/容器 one-shot operation 与认证管理端的单条删除入口；不提供匿名公开删除接口。
- Review 命令可以按状态/日期列出脱敏候选；正式删除每次只接受一个 submission ID/回执。
- 默认 dry-run；正式执行要求显式 `--execute` 与固定强确认短语。
- 不建设自动调度、通用规则引擎、时间批量删除或后台“一键清空”。

## 5. 数据库口径

- `assets.focal_x/focal_y`：继续作为站点展示裁切重心；不新增 Hero crop/focal 表。
- `site_hero_collections/site_hero_items`：首页/委托 × 横/竖四集合继续独立；不新增横竖 pair、共享 version 或强制相同数量/顺序。
- `works.updated_at`：作为 `/adoptions` 状态组内排序时间；不增加重复的 adoption 排序字段。
- `site_content`：继续使用现有纯文本和分区版本；不新增 `privacy_controller_name` 或 intake metadata 表。
- `commission_submissions`：本轮不新增确认字段、contract version 或 retention timestamp。
- 不新增订单、合同、付款、退款、排期、保修工单或 QQ 聊天记录表。
- 第三方声明为构建产物/仓库文件，不进业务数据库。

## 6. 管理端长任务与进度约定

统一进度组件必须支持三种诚实模式：

1. **确定进度**：OSS XHR 上传按已发送/总字节显示百分比。
2. **阶段进度**：publication、Hero、品牌重建等持久 operation 显示服务端真实阶段、已完成计数与终态；不把阶段硬映射成伪精确百分比。
3. **未知进度**：单图 FFmpeg 等无法可靠计算百分比的任务显示当前阶段、经过时间和“仍在处理”，使用 indeterminate bar。

所有耗时操作要求：

- 用户触发后立即出现反馈；
- 进行中禁用重复提交，但不阻止页面其它安全操作；
- 可重试/可取消时显示真实入口；
- operation 刷新页面后可从服务端恢复状态；
- 成功、失败、清理中和重试状态使用同一视觉语义。

## 7. 安全与隐私约定

- 真实手机号、QQ、身高、体重、私有设定图、经营主体证件和聊天记录不得进入 Git、真实 fixture、公开 DTO、HTML、URL、analytics、普通日志或错误响应。
- 委托设定图继续 PRIVATE、无 PUBLIC variant、无 ESA、无水印。
- 申请列表继续不铺开手机号、QQ、体型和图片；详情只在管理 Host 认证后按需读取，`no-store`。
- 删除盘点和执行证据只保留脱敏计数、时间、状态和不可逆标识摘要，不保留完整 Object Key 或原始内容。
- 用户查询、更正或删除请求由隐私政策公布的邮箱受理；存在合法保留理由时限制其它使用。
- 仅允许年满 18 周岁的申请人提交；不通过多收集身份证件来证明年龄。
- OSS CORS 继续为用户确认的 `AllowedOrigin=*`；需求4不得把 CORS 收紧重新设为门禁。

## 8. 测试、Git 与发布约定

### 8.1 测试权威

- 自动化测试是回归辅助，不是产品规格的来源。
- 安全、隐私、数据完整性、迁移、精确删除、上传凭证、私有/公开媒体隔离和发布状态机属于稳定不变量，必须有少量明确测试。
- 视觉层级、真实图片裁切、动效节奏、文案语气和移动端观感由王旻安/景宸人工验收，Playwright 不代签。
- 不为每个历史 bug 永久增加一条测试；不同时在 unit/integration/E2E 三层重复证明同一事实。
- 不写精确动画毫秒、临时文案、局部 class/DOM 层级或截图像素作为普通门禁。

### 8.2 执行层级

- 默认反馈环：lint、typecheck、受影响核心测试；涉及 Nuxt/runtime 时再 build。
- `core`：稳定不变量的小集合，作为日常自动验证。
- `smoke`：少量真实用户主流程，作为发布前浏览器辅助。
- `release`：生产构建、verify、镜像/Compose/恢复和必要 destructive drill，显式手动执行。
- 旧全量套件先降级为 non-gating legacy，逐项决定保留为 core/smoke 或删除；不得为了“全绿”机械改写旧语义。

### 8.3 Git

- 当前 main 保护和 required check 保持现状，不新增 required status check。
- 默认任务分支和 PR；用户对某次直接 main 写入的授权不扩散。
- 文档/Schema/迁移/写操作串行，不重写历史迁移。
- 最终发布分别完成核心自动验证、独立 Review、真实浏览器/手机、工作室人工验收和生产 smoke。

## 9. 编码与命名约定

- 动效 token 使用 `motion-*` 语义命名；组件不得继续散落 620ms、680ms 等局部常量。
- 首页桌面逐幕滚动只允许一个 composable 管理 Hero、代表作品 01/02、自设委托、设定领养与 Footer 的顺序；普通路由和其它页面不得复用 wheel 拦截。
- 公开非 hash 导航由统一 router scroll behavior 在新路由第一帧定位页面顶部；点击当前路由的品牌/导航入口也回到该页页头；浏览器返回/前进只在目标页加载完成后恢复 saved position，真实 hash 继续使用统一 Header offset。不得在每个首页按钮上分别补 `scrollTo`。
- 纵向运动表示阅读进程；横向运动表示媒体关系；轻微旋转/弹性只用于角色感强调和直接反馈。
- 一个视口最多一个主要大对象运动；移动端减少幅度并移除 hover-only 行为。
- 公开行动统一为 primary / secondary / text；管理端行动使用独立但统一的 admin primitive。
- 统一进度组件建议命名 `AdminTaskProgress` 或等价清楚名称；禁止按业务复制 `FooProgress`。
- 访客文案短、直接、陈述真实流程；避免反复以“本站不提供……”堆叠防御性语气。
- 破坏性 CLI 使用 `commission-retention` 或同等清楚名称；禁止模糊的 `cleanup-all`。
