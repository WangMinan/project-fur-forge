# 任务清单：站点业务简化与委托投递

> **角色**：需求3唯一任务与勾选权威。
> **状态**：T01～T05 已完成；T06～T07 待执行。
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
- [ ] **T06 · 第一发布单元质量与独立复查**：相关 lint/typecheck/unit/integration/E2E/build/verify 全部通过；新上下文 focused review 检查对象枚举、停止点、404、两平台约束、取消平台资产清理和证据。
- [ ] **T07 · 生产立即退役与渠道收缩**：维护窗口停写，用户核对 dry-run 并强确认返图/动态删除；删除媒体/版本/cache，执行渠道/退役 contract，验证服务，创建并恢复 clean backup，再删除旧应用备份；操作员记录外部快照处理状态。

### GATE-A · 第一发布单元完成

- [ ] 本地和生产均无返图/动态表、行、私有原图、派生、版本和应用旧备份；
- [ ] 退役路由 404，导航/首页/sitemap/管理端无入口；
- [ ] return/update 枚举不可插入；
- [ ] `official_channels_json` 固定为 `qq | qq_group`，邮箱独立保留；
- [ ] 抖音、小红书、Bilibili 无枚举、管理槽位、公开卡片、DTO、持久项或孤立二维码资产；
- [ ] foreign key、integrity、readiness、production verify 通过；
- [ ] 证据仅含脱敏计数；外部快照由操作员明确记录。

## B. Expand 新模型与安全

- [ ] **T08 · Hero collection/item Schema**：新增四个 collection 并发域和 items；collection version 独立；管理 upload owner context 区分四集合；linked work 从新契约删除。
- [ ] **T09 · Hero pair 幂等迁移**：旧 pair 确定性拆成两方向 item，保留 placement/alt/order/enabled，归一化顺序；空库/既有库/重复执行测试。
- [ ] **T10 · Works/adoption Expand**：新增 nullable `adoption_status`、`adoption_cover`、`adoption-card`；复用上传、recipe、publication、lease、recovery、purge；旧字段暂留。
- [ ] **T11 · 领养状态盘点**：只自动映射 available→available、delivered→adopted；其它状态保持 NULL，生成后台人工复核清单。
- [ ] **T12 · Commission 持久模型**：新增 `commission_upload_sessions`、`commission_submissions`、private media role、repository/service/audit/no-store preview。
- [ ] **T13 · Commission 匿名安全与 OSS 上传基线**：API Origin、body、Content-Type、独立限流、token、TTL、蜜罐、日志禁值；OSS CORS 继续保持现网 `AllowedOrigin=*`，不新增精确 Origin 收紧任务；验证签名 PUT/complete 端到端。
- [ ] **T14 · Expand 综合门禁**：空库/既有库 migration、foreign key/integrity、Hero collection 409、cover identity、upload state machine、签名 PUT、API Origin 与 PII leakage 通过。

### GATE-B · Expand 稳定

- [ ] 四个 Hero collection 各自 version/上传归属正确；
- [ ] Hero 拆分幂等；
- [ ] commission asset 无 PUBLIC variant；
- [ ] 签名 PUT 在当前通配 CORS 下可用；
- [ ] API Origin/token/TTL/限流与 PII 负向测试通过；
- [ ] 旧公开页面仍可运行；
- [ ] adoption 歧义状态清单可由景宸处理。

`AllowedOrigin=*` 是信息项，不是 GATE-B 失败条件；不得添加“只允许精确 public/admin Origin”的断言。

## C. 公开动效与 Hero

- [ ] **T15 · 导航交互动效**：桌面胶囊底、阴影、轻微上移及等价 focus；移动抽屉沿用无障碍工具。
- [ ] **T16 · 公开页面切换**：仅 main 过渡，Header/Footer 稳定；back/forward、锚点、错误页、焦点、pointer-events、reduced-motion。
- [ ] **T17 · 首页区块与卡片动效**：首次入屏揭示、可点击卡 hover；SSR/无 JS 默认可见。
- [ ] **T18 · 首页 Hero 排版与首屏**：删除 action；桌面中文居中+英文/slogan 左右；移动左对齐下移；100svh/100dvh。
- [ ] **T19 · Hero 独立序列公开端**：landscape/portrait DTO、SSR first picture、水合、orientation change、懒加载、10 秒轮播、暂停、hidden、reduced-motion。
- [ ] **T20 · Hero 四集合管理端**：首页/委托×横/竖独立 CRUD、排序、启停、适配、预览、发布；collection expectedVersion、完整顺序、409、FLIP。
- [ ] **T21 · 首页业务收尾**：“委托投递”改“委托与领养”，确认首页无 latest updates 请求，当前领养到页脚节奏正确。

### GATE-C · 首页与动效

- [ ] 390/768/1023/1024/1440 与真实手机通过；
- [ ] 桌面/移动对齐明确不同，移动首屏无白块；
- [ ] 横竖数量/顺序可不同且 hydration 无警告；
- [ ] hover/focus/page transition/back-forward/reduced-motion 通过。

## D. 作品与领养

- [ ] **T22 · 作品管理表单收缩**：删除 suit/owner/contact/tags/method/event/旧 progress UI；只维护目标字段和三类图片。
- [ ] **T23 · PublicWork DTO 与 `/works`**：摘要只含名称、物种、卡图；删除用途/装型筛选，保留名称搜索、分页、发布时间排序。
- [ ] **T24 · `/works/{slug}` 图片化**：只保留名称、物种、图集、前后和相关作品；SEO/JSON-LD 收缩。
- [ ] **T25 · Adoption cover 媒体垂直切片**：上传、验证、适配、watermark variant、发布阻断、失败重试、清理和后台预览。
- [ ] **T26 · 领养人工复核与补图**：所有 NULL 状态由景宸确认；published adoption 补 cover 或下架；缺主 studio photo 修复。
- [ ] **T27 · `/adoptions` 收缩**：删除 method/count/event；cover only；名称、物种、状态、可选价格；首页当前领养复用。
- [ ] **T28 · 可选设定图**：0..1，可在详情图集展示；不作列表卡或发布门禁。
- [ ] **T29 · Works contract**：在 NULL/缺图均为 0 后重建 works/work_assets，删除旧列和 `work_feature_tags`；`commission_email_action`、`contact_qq` 不删除，`contact_douyin` 已在 T04 删除。

### GATE-D · 作品与领养

- [ ] PublicWork DTO 无旧字段；
- [ ] adoption status NULL=0；
- [ ] published adoption missing cover=0；
- [ ] published work missing primary studio photo=0；
- [ ] works/detail/adoptions 三视口通过；
- [ ] contract migration、foreign key、integrity 通过。

## E. 委托投递

- [ ] **T30 · 公开上传 API**：create、conditional PUT、complete、cancel/expire/retry/cleanup；一张 20MB 内图片；token/TTL/摘要/MIME/尺寸/API Origin；OSS CORS 不收紧。
- [ ] **T31 · Submission API**：校验五项字段与 COMPLETED upload，单事务消费 asset、创建 pending、重试 receipt collision；重复/蜜罐/限流完整。
- [ ] **T32 · `/commission/apply`**：单图预览与上传、可见 label、邻近错误、失败保留内存草稿、过期重选、提交中、成功回执；不写 URL/localStorage/analytics/console。
- [ ] **T33 · `/admin/commissions`**：三状态列表、私有详情、no-store 图片、状态/备注、version/409/audit。
- [ ] **T34 · `/commission` 与联系入口**：站内提交主 CTA、QQ/QQ群二维码、about 入口；邮箱仅备用；确认抖音、小红书、Bilibili 不再出现在当前页面或关于页。
- [ ] **T35 · FAQ 完整退役**：删除 FAQ JSON/version/UI/Schema/API/Card/test；保留 intro、estimate、`commission_email_action`、邮箱、QQ、QQ群；about/privacy 同步。
- [ ] **T36 · 委托综合门禁**：成功/错误/过期/重复/限流/蜜罐/cleanup/API Origin/PII/admin 409；真实浏览器单图端到端；不要求 OSS 精确 Origin CORS。

### GATE-E · 委托完成

- [ ] private image 仅认证 no-store 可见；
- [ ] PII 不进公开面、URL、analytics、普通日志、错误；
- [ ] 签名 PUT 在 `AllowedOrigin=*` 下端到端通过；
- [ ] FAQ 删除且 email action 未误删；
- [ ] 公开与管理联系面只包含邮箱、QQ、QQ群；
- [ ] 管理与公开流程通过。

## F. 最终评审与发布

- [ ] **T37 · 全量质量门禁**：lint、typecheck、unit、integration、E2E、production build、verify、content guard。
- [ ] **T38 · 新上下文独立 Review**：SPEC→models→PLAN→TASKS→代码→迁移→媒体→PII→部署；记录首次 findings 和重测。
- [ ] **T39 · 用户验收**：Hero、动效、works、adoption、commission、后台、QQ/QQ群二维码、真实手机、reduced-motion。
- [ ] **T40 · 剩余功能生产发布**：部署 B–E 冻结镜像，迁移、readiness、verify、页面/提交验收。
- [ ] **T41 · 文档收口**：回填迁移名、脱敏计数、生产时间、模型差异、Review、用户签署和最终 STATE。

## 最终门禁

- [ ] **GATE-R3 · 需求3关闭**：T01–T41、GATE-A～E 完成；两个生产发布单元、最新 SHA CI、独立 Review、用户验收和证据齐全。
