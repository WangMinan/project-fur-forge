# 任务清单：站点业务简化与委托投递

> **角色**：需求3唯一任务与勾选权威。
> **状态**：GATE-A 已由用户确认发布完成；T08～T21 已实现，GATE-B 已验证，GATE-C 仅余真实手机人工验证。
> **规则**：任务完成不代签 CI、独立 Review、用户验收或生产执行。所有数据库写、媒体删除和 operation 串行。

## 决策与文档

- [x] **GATE-00 · 产品决策冻结**：品牌、立即退役、联系渠道、OSS CORS、动效、Hero、作品、领养和委托字段已确认。
- [x] **T00 · 文档地基**：创建需求3活文档并于 2026-08-15 完成合入后复查；随后同步用户追加决策：OSS CORS 保持 `*` 且不作门禁，官方渠道只保留邮箱/QQ/QQ群。

## A. 立即永久退役返图/动态并收缩联系渠道

- [x] **T01 · 品牌、公开入口与联系展示基线**：英文名改为 `DITE DOG`，slogan 更新；审计 SEO/JSON-LD/测试/带文字静态资产；移除返图/动态公开和管理导航；首页停止消费 latest updates；`/about`、`/commission` 和后台联系配置只显示邮箱、QQ、QQ群。证据见 `implementation/notes/R3-A-T01-T06-EXECUTION-2026-08-15.md`。
- [x] **T02 · 退役代码与联系渠道契约**：删除 returns/updates 页面、API、Schema、DTO、repository、service、runner、recipe、fixture 和测试；旧路由 404；更新 sitemap、analytics、build guard、verify；把 `CONTACT_PLATFORMS`、Schema、DTO、管理 Card 和公开 Grid 收缩为 `qq | qq_group`，删除抖音/小红书/Bilibili 分支、Logo 和测试。代码删除、全量 unit、lint/typecheck、production build 和退役路由 E2E 已通过；旧库五槽 CHECK 导致的 selected integration 失败已记录，固定由 T04 Contract 修复并原样重测。
- [x] **T03 · 退役/渠道 dry-run 与强确认工具**：精确盘点 return/update 行、asset/session/variant/operation/analytics、private/public objects、OSS versions/delete markers、ESA URLs、应用备份，以及三类取消平台账号/二维码引用和无其它引用的 QR 资产；只输出脱敏计数。`pnpm r3-a:cleanup -- --environment-prefix prod/` 默认 dry-run；正式删除必须追加 `--execute --confirm "DELETE R3-A RETIRED MEDIA"`。对象/版本/marker/ESA 任一步失败都不写 `R3_STAGE_A_OBJECT_CLEANUP` 成功标记，T04 不得继续。
- [x] **T04 · 第一发布单元数据库 contract**：前向迁移 `0036_r3_a_contract.sql` 在 DROP 前验证 T03 标记/净新库条件，删除 updates/return 表及相关行，重建 assets/upload/variants/publication/analytics 约束；`official_channels_json` 固定 QQ/QQ群，删除 `contact_douyin` 与无其它引用的退役平台 QR 资产，保留 `contact_qq`。focused integration 7 files / 57 tests、lint/typecheck 通过，fresh/re-entrant migration、FK/integrity 通过。
- [x] **T05 · 本地不可恢复演练**：复杂副本和测试对象在唯一隔离前缀上完成 dry-run、强确认、8 current objects/16 versions/8 delete markers 删除、ESA purge、渠道收缩、孤立 QR 清理、Contract、404、六个联系渠道 E2E、FK/integrity、production build/verify、clean backup 真实恢复、恢复后旧备份删除和零结果重入；未访问任何生产资源。
- [x] **T06 · 第一发布单元质量与独立复查**：lint/typecheck、unit 38 files / 192 tests、integration 21 files / 177 tests、退役路由 E2E 1/1、官方渠道 E2E 6/6、production build/content guard、verify 和 ops bundle 均通过。独立 Reviewer 对 `e3ed0c6` 首轮给出五项 P1；修复后对 `3e0efa7` 复审 PASS，未发现新的 Stage A blocker。证据见 `review/R3-A-FOCUSED-REVIEW-2026-08-16.md`。
- [x] **T07 · 生产立即退役与渠道收缩**：维护窗口停写，用户核对 dry-run 并强确认返图/动态删除；删除媒体/版本/cache，执行渠道/退役 contract，验证服务，创建并恢复 clean backup，再删除旧应用备份；操作员记录外部快照处理状态。生产执行证据见 `implementation/notes/R3-A-T07-CLI-HANDOFF-2026-08-16.md`；用户于 2026-08-16 明确确认 GATE-A 发布完成，Agent 未访问云控制台代签。

### GATE-A · 第一发布单元完成

- [x] 本地和生产均无返图/动态表、行、私有原图、派生、版本和应用旧备份；
- [x] 退役路由 404，导航/首页/sitemap/管理端无入口；
- [x] return/update 枚举不可插入；
- [x] `official_channels_json` 固定为 `qq | qq_group`，邮箱独立保留；
- [x] 抖音、小红书、Bilibili 无枚举、管理槽位、公开卡片、DTO、持久项或孤立二维码资产；
- [x] foreign key、integrity、readiness、production verify 通过；
- [x] 证据仅含脱敏计数；外部快照由操作员明确记录。

## B. Expand 新模型与安全

- [x] **T08 · Hero collection/item Schema**：新增四个 collection 并发域和 items；collection version 独立；管理 upload owner context 区分四集合；linked work 从新契约删除。
- [x] **T09 · Hero pair 幂等迁移**：旧 pair 确定性拆成两方向 item，保留 placement/alt/order/enabled，归一化顺序；空库/既有库/重复执行测试。
- [x] **T10 · Works/adoption Expand**：新增 nullable `adoption_status`、`adoption_cover`、`adoption-card`；复用上传、recipe、publication、lease、recovery、purge；旧字段暂留。
- [x] **T11 · 领养状态盘点**：只自动映射 available→available、delivered→adopted；其它状态保持 NULL，生成后台人工复核清单。
- [x] **T12 · Commission 持久模型**：新增 `commission_upload_sessions`、`commission_submissions`、private media role、repository/service/audit/no-store preview。
- [x] **T13 · Commission 匿名安全与 OSS 上传基线**：API Origin、body、Content-Type、独立限流、token、TTL、蜜罐、日志禁值；OSS CORS 继续保持现网 `AllowedOrigin=*`，不新增精确 Origin 收紧任务；验证签名 PUT/complete 端到端。
- [x] **T14 · Expand 综合门禁**：空库/既有库 migration、foreign key/integrity、Hero collection 409、cover identity、upload state machine、签名 PUT、API Origin 与 PII leakage 通过。

### GATE-B · Expand 稳定

- [x] 四个 Hero collection 各自 version/上传归属正确；
- [x] Hero 拆分幂等；
- [x] commission asset 无 PUBLIC variant；
- [x] 签名 PUT 在当前通配 CORS 下可用；
- [x] API Origin/token/TTL/限流与 PII 负向测试通过；
- [x] 旧公开页面仍可运行；
- [x] adoption 歧义状态清单可由景宸处理。

`AllowedOrigin=*` 是信息项，不是 GATE-B 失败条件；不得添加“只允许精确 public/admin Origin”的断言。

## C. 公开动效与 Hero

- [x] **T15 · 导航交互动效**：桌面胶囊底、阴影、轻微上移及等价 focus；移动抽屉沿用无障碍工具。
- [x] **T16 · 公开页面切换**：仅 main 过渡，Header/Footer 稳定；back/forward、锚点、错误页、焦点、pointer-events、reduced-motion。
- [x] **T17 · 首页区块与卡片动效**：首次入屏揭示、可点击卡 hover；SSR/无 JS 默认可见。
- [x] **T18 · 首页 Hero 排版与首屏**：删除 action；桌面中文居中+英文/slogan 左右；移动左对齐下移；100svh/100dvh。
- [x] **T19 · Hero 独立序列公开端**：landscape/portrait DTO、SSR first picture、水合、orientation change、懒加载、10 秒轮播、暂停、hidden、reduced-motion。
- [x] **T20 · Hero 四集合管理端**：首页/委托×横/竖独立 CRUD、排序、启停、适配、预览、发布；collection expectedVersion、完整顺序、409、FLIP。
- [x] **T21 · 首页业务收尾**：“委托投递”改“委托与领养”，确认首页无 latest updates 请求，当前领养到页脚节奏正确。

### GATE-C · 首页与动效

- [ ] 390/768/1023/1024/1440 与真实手机通过；五档 Playwright 视口已通过，真实手机仍待用户人工验证，因此组合项不勾选；
- [x] 桌面/移动对齐明确不同，移动首屏无白块；
- [x] 横竖数量/顺序可不同且 hydration 无警告；
- [x] hover/focus/page transition/back-forward/reduced-motion 通过。

## D. 作品与领养

- [x] **T22 · 作品管理表单收缩**：删除 suit/owner/contact/tags/method/event/旧 progress UI；只维护目标字段和三类图片。表单、Schema、service、repository 与目标 DTO 已同步并通过 unit/integration/E2E。
- [x] **T23 · PublicWork DTO 与 `/works`**：摘要只含名称、物种、卡图；删除用途/装型筛选，保留名称搜索、分页、发布时间排序。公开 DTO 负向断言已证明旧字段消失。
- [x] **T24 · `/works/{slug}` 图片化**：只保留名称、物种、图集、前后和相关作品；SEO/JSON-LD 已收缩，图片占位尺寸修复后列表/详情 CLS 均小于 0.1。
- [x] **T25 · Adoption cover 媒体垂直切片**：复用既有上传、验证、适配、水印 publication、lease、recovery、purge 和后台预览；发布阻断、失败重试和清理已由合成媒体验证。
- [ ] **T26 · 领养人工复核与补图**：复核清单、人工补录、独立 cover、主出厂照门禁和先下架能力均已实现并用合成数据验证；真实生产记录的状态与图片仍必须由景宸逐条判断，未由 Agent 勾选完成。
- [x] **T27 · `/adoptions` 收缩**：删除 method/count/event；卡片只使用独立 cover，并展示名称、物种、状态、可选价格；首页当前领养复用同一投影。
- [x] **T28 · 可选设定图**：目标模型保持 0..1，可在详情图片区展示，不参与列表卡或发布门禁。
- [x] **T29 · Works contract**：前向迁移 `0039_r3_d_works_contract.sql` 只在三项数据门禁为 0 后重建目标表并删除旧列/`work_feature_tags`；失败停止、fresh、既有库、重入、FK/integrity 已在临时库通过。`0041_r3_d_hero_work_fk.sql` 前向修复 Hero 外键；生产未执行，`commission_email_action`、`contact_qq` 均保留。

### GATE-D · 作品与领养

- [x] PublicWork DTO 无旧字段；
- [x] 临时既有库与合成数据的 adoption status NULL=0；
- [x] 临时既有库与合成数据的 published adoption missing cover=0；
- [x] 临时既有库与合成数据的 published work missing primary studio photo=0；
- [x] works/detail/adoptions 在 390×844、768×1024、1440×900 通过；
- [x] contract migration 的前置阻断、fresh/既有库/重入、foreign key、integrity 通过；
- [ ] 生产真实记录三项计数与景宸逐条判断待 handoff，未执行生产 contract。

## E. 委托投递

- [x] **T30 · 公开上传 API**：create、conditional PUT、complete、cancel/expire/retry/cleanup 已完成；一张 20MB 内图片，token/TTL/摘要/MIME/尺寸/API Origin 完整保留，OSS CORS 继续 `AllowedOrigin=*`。
- [x] **T31 · Submission API**：六项字段与 COMPLETED upload 校验、单事务消费/创建 pending、receipt collision 重试、重复/蜜罐/限流已完成。
- [x] **T32 · `/commission/apply`**：单图预览上传、可见 label、邻近错误、内存草稿、过期重选、提交态和成功回执已完成；浏览器断言 URL/localStorage/analytics/console 无 PII。
- [x] **T33 · `/admin/commissions`**：三状态列表、认证私有详情、`no-store` 图片、状态/备注、version/409/audit 已完成。
- [x] **T34 · `/commission` 与联系入口**：站内提交为主 CTA，QQ/QQ群与 about 入口已同步；邮箱为备用；当前委托页/关于页不再包含抖音、小红书、Bilibili。
- [x] **T35 · FAQ 完整退役**：`0040_r3_e_commission_contract.sql` 删除 FAQ JSON/version，UI/Schema/API/Card/test 均删除；intro、estimate、`commission_email_action`、邮箱、QQ、QQ群保留。
- [x] **T36 · 委托综合门禁**：成功/错误/过期/重复/限流/蜜罐/cleanup/API Origin/PII/admin 409 已通过；本地真实 Chrome 单图端到端通过；不要求 OSS 精确 Origin CORS。

### GATE-E · 委托完成

- [x] private image 仅认证 `no-store` 可见，未生成 PUBLIC variant 或 ESA 地址；
- [x] 合成数据验证 PII 不进公开面、URL、localStorage、analytics、console、普通日志和错误正文；
- [x] 条件签名 PUT 在测试对象存储 `AllowedOrigin=*` 下端到端通过，应用 API 仍拒绝错误 Origin；
- [x] FAQ 删除且 `commission_email_action`/`contact_qq` 未误删；
- [x] 公开与管理联系面只包含邮箱、QQ、QQ群；
- [x] 管理与公开流程在本地真实 Chrome 通过，包括真实 409 对话框停止点；
- [ ] 真实手机动态地址栏、输入法、图片方向、单图提交和用户验收待用户执行；生产 OSS/ESA/数据库未连接。

## E.1 2026-08-16 用户复核修正（同一任务分支）

- [x] **FU-01 · 委托申请输入与单图交互**：新增必填物种和大陆手机号校验；单图改为可点击/拖拽的卡片预览，409 重复 pending 申请保留当前表单与私有预览。
- [x] **FU-02 · 委托队列与处理反馈**：旧库列表读取兼容、白底行、“昵称 · 物种”、详情物种和保存成功反馈均已实现；真实 409 仍停止并要求重新载入。
- [x] **FU-03 · 首页大图管理复核**：沿用作品管理的“选择 → 上传 → 预览”流程；上传完成及既有 enabled/disabled 项默认显示认证 `w=640` 缩略图，不显示原图或 blob；发布显示进度与终态。
- [x] **FU-04 · 首页入口与领养过滤（历史实现，后由 FU-07 纠正）**：标题切为“自设委托”/“设定领养”，委托卡新增直达申请按钮；当时误将 adopted 同时从首页精选和领养区排除，FU-07 按用户复核纠正。
- [x] **FU-05 · 品牌与备案展示**：指定透明 Logo 与拼贴字体已入库并用于页头、首页、移动导航和页脚；公安备案图标保持在编号前并位于 ICP 右侧。
- [x] **FU-06 · 委托迁移与官方默认联系**：`0042_r3_e_commission_follow_up.sql` 增加 legacy-nullable species、pending 手机号部分唯一索引和受控默认联系方式更新；重复 pending 真实记录保持生产 handoff，不自动处理。
- [x] **GATE-E-FU · 用户复核修正门禁**：全量 lint/typecheck、unit 186/186、integration 199/199、production build、verify、content guard 与相关 Chromium 38/38 均通过；只使用临时库、合成图和测试对象存储。真实手机、真实数据、独立 Review、用户验收与生产执行未代签。

### E.2 · 2026-08-17 目录展示复核

- [x] **FU-07 · 首页精选与领养边界**：adopted 只从首页“设定领养”排除，仍可按 featured 出现在“精选作品”；repository/fake repository 与 integration/E2E 同步。
- [x] **FU-08 · 公开卡片与大图后台展示**：首页、`/works`、`/adoptions` 统一“名称 · 物种”的字体、字号和空格；已领养使用非绿色中性色；大图后台隐藏 collection version，新增按钮复用后台主按钮样式。
- [x] **GATE-E-FU2 · 目录展示复核门禁**：lint/typecheck、unit 186/186、相关 integration 3/3、四个相关 Chromium spec 63/63、production build/content guard、verify 与实际本地数据五视口浏览器检查通过；独立 Review、用户验收与生产执行不由实现者代签。

### E.3 · 2026-08-17 长竖作品适配与 CI 修复

- [x] **FU-09 · 长竖出厂照适配契约**：`0044_work_upscale_long_portrait.sql` 只为固定作品 Lanczos 角色/配方放行超过旧 4096 px 的私有处理源；普通 preprocess 的 4096 px、全部 READY preprocess 的 20MB、通用 12000 px、lineage 和永久原图保留边界不变。1139×2083 出厂照已验证生成 2400×4390 处理源并完成 12 个公开变体。
- [x] **FU-10 · CI 确定性修复**：Playwright webServer 显式提供备案测试配置；官方邮箱公开投影断言改为当前“打开邮件客户端”可访问名称并继续校验真实 `mailto:`；目录物种断言沿用 FU-08 当前结构。
- [x] **GATE-E-FU3 · 长竖作品与 CI 修复本地门禁**：lint/typecheck、unit 187/187、integration 200/200、失败相关 Chromium 20/20、production build/content guard 与 verify 通过；远端修复 SHA 尚未产生，旧失败流水线和当前基线失败流水线均不代签本地改动 CI。

### E.4 · 2026-08-17 仅横版领养封面的发布与展示

见 [`notes/2026-08-17-adoption-cover-only-follow-up.md`](./notes/2026-08-17-adoption-cover-only-follow-up.md)。

- [x] **FU-11 · 领养发布门禁放宽**：adoption 只要求合格 `adoption_cover`，`studio_photo` 变为 0..5 可选；有出厂照时仍必须恰好一张 primary、全部 READY、全部有 alt；commission/showcase 不变。新增 `ADOPTION_MEDIA_REQUIRED` 覆盖既无 cover 又无出厂照的情况，`mediaReady` 预览同步同一规则。
- [x] **FU-12 · 公开投影允许仅横版领养**：快照卡片优先 primary 出厂照的 `work-card`，领养作品缺失时回落到 `adoption-card` 并带 `cardOrientation`；`listWorks` 的出厂照数量过滤改为「有卡片即可」；commission/showcase 缺卡片仍整条丢弃。
- [x] **FU-13 · 详情展示领养封面**：详情 DTO 增加 `media.adoptionCover`（仅领养），详情页在图集之上单独渲染「领养封面」区块，只有横版封面时不再出现空的出厂照分区。
- [x] **FU-14 · 混排卡片布局**：`WorkCard` 按 `cardOrientation` 在 3:4 与 16:9 之间切换，首页精选轨道、`/works` 网格与详情相关网格顶端对齐容纳混排；`/adoptions` 仍固定横版进入。
- [x] **FU-15 · 删除详情前后导航**：移除 `publicWorkDetailDtoSchema.navigation`、`detailFor()` 的 previous/next 与详情页导航区块和样式；保留「继续浏览」与按 `history.state.back` 区分的返回链接。
- [x] **FU-16 · 测试与文档**：新增 cover-only 发布/投影/契约用例与 E2E 混排用例，更新 SPEC §8.2/8.3/9.2、models §3.2/§9.2、DATA-MIGRATION §12.1 与 STATE。
- [x] **GATE-E-FU4 · 仅横版领养本地门禁**：lint/typecheck、unit 192/192、integration 204/204、production build（含 content guard）、Chromium public-works 21/21、public-home/adoptions/search/seo 44/44、admin-publication/r3-stage-d/admin-home 18/18 通过；真实本地数据在 390/768/1023/1024/1440 五视口验证混排比例、顶端对齐、零横向溢出、封面解码与返回来路，console 无错误。独立 Review、用户验收与生产执行不由实现者代签。

### E.5 · 2026-08-17 混排排版复核（等高铺满与单一图集）

用户复核 FU-11～FU-16 的展示结果：等宽混排「很难看、大面积空白」，详情主图「忽左忽居中」，
且「继续浏览」不需要。

- [x] **FU-17 · 卡片等高铺满**：`--card-ratio`（3:4 / 16:9）成为卡片比例唯一真值，定义在
  `public-base.css` 以便容器同读。`/works` 由固定列数 grid 改为 flex justified：`flex-grow` 与
  `flex-basis` 同时正比于比例，同行放大系数相同 → 高度一致且行宽铺满、右边缘对齐；末行孤卡
  上限为行高 1.25 倍，不拉成巨图。首页轨道改为按比例 × 固定行高，只统一高度。
- [x] **FU-18 · 详情单一图集**：领养封面追加到 `gallery` 末尾，删除独立「领养封面」分区与
  `.work-detail__cover`；主图与缩略图成组居中、缩略图紧贴右侧竖排（<768px 回落单列横排）；
  主图尺寸由 `clamp(20rem, 100vh - 15rem, 46rem)` 高度上限 × 自身比例决定。
- [x] **FU-19 · 删除「继续浏览」**：移除详情页 related 区块与样式、`publicWorkDetailDtoSchema.related`、
  `detailFor()` 的 same/other purpose 计算与 `SnapshotEntry.purpose`。原经 related 跳转的两个
  E2E 用例改为经 `/works` 列表卡片进入，保留「同组件实例内 slug 变化后内容/图集/SEO 更新」原意。
- [x] **FU-20 · 测试与文档**：新增等高铺满 E2E（同行等高、比例、右边缘 gap ≤ 2、轨道等高）与
  单一图集断言；更新 SPEC §8.2/8.3、models §9.2、STATE §2。
- [x] **GATE-E-FU5 · 混排排版本地门禁**：lint/typecheck、unit 193/193、integration 204/204、
  production build（含 content guard）、verify、Chromium public-works/adoptions/t09-ui 43/43 与
  public-home/search/seo/r3-stage-d 38/38 通过。真实本地数据以 CDP 在 390/768/1023/1024/1440
  五视口实测：`/works` 同行等高且 rightGap=0、首页轨道三卡同高 352px、详情主图 468×702 且缩略图
  间距 16px、零横向溢出。独立 Review、用户验收与生产执行不由实现者代签。

  说明：一次 `pnpm test:integration` 曾因 dev server 抢占 CPU 使 FFmpeg Lanczos 用例 30s 超时；
  停掉 dev server 后单文件 18/18、全量 204/204 通过，非本轮改动导致。

## F. 最终评审与发布

- [ ] **T37 · 全量质量门禁**：lint、typecheck、unit、integration、E2E、production build、verify、content guard。
- [ ] **T38 · 新上下文独立 Review**：SPEC→models→PLAN→TASKS→代码→迁移→媒体→PII→部署；记录首次 findings 和重测。
- [ ] **T39 · 用户验收**：Hero、动效、works、adoption、commission、后台、QQ/QQ群二维码、真实手机、reduced-motion。
- [ ] **T40 · 剩余功能生产发布**：部署 B–E 冻结镜像，迁移、readiness、verify、页面/提交验收。
- [ ] **T41 · 文档收口**：回填迁移名、脱敏计数、生产时间、模型差异、Review、用户签署和最终 STATE。

## 最终门禁

- [ ] **GATE-R3 · 需求3关闭**：T01–T41、GATE-A～E 完成；两个生产发布单元、最新 SHA CI、独立 Review、用户验收和证据齐全。
