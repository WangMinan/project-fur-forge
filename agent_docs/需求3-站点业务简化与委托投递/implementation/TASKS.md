# 任务清单：站点业务简化与委托投递

> **角色**：需求3唯一任务与勾选权威。
> **状态**：GATE-00/T00 已完成；工程尚未开始。
> **规则**：任务完成不代签 CI、独立 Review、用户验收或生产执行。所有数据库写、媒体删除和 operation 串行。

## 决策与文档

- [x] **GATE-00 · 产品决策冻结**：品牌、立即退役、动效、Hero、作品、领养和委托字段已确认。
- [x] **T00 · 文档地基**：创建需求3活文档并于 2026-08-15 完成合入后复查；修正退役顺序、Hero 并发域、状态迁移、CORS 和 email action 边界。

## A. 立即永久退役返图与动态

- [ ] **T01 · 品牌与公开入口基线**：英文名改为 `DITE DOG`，slogan 更新；审计 SEO/JSON-LD/测试/带文字静态资产；移除返图/动态公开和管理导航；首页停止消费 latest updates。
- [ ] **T02 · 退役代码垂直切片**：删除 returns/updates 页面、API、Schema、DTO、repository、service、runner、recipe、fixture 和测试；旧路由 404；更新 sitemap、analytics、build guard、verify。
- [ ] **T03 · 退役 dry-run 与强确认工具**：精确盘点 return/update 行、asset/session/variant/operation/analytics、private/public objects、OSS versions、ESA URLs 和应用备份；只输出脱敏计数。
- [ ] **T04 · 退役数据库 contract**：删除 updates/return 表及相关行，重建 assets/upload/variants/publication/analytics 约束，移除 `return_photo`、`return-wall`、`return-display-v1`、`RETURN_PHOTO` 和旧 route/entity enum。
- [ ] **T05 · 本地不可恢复演练**：复杂副本完成 dry-run、对象/版本删除、ESA purge、contract、404、重复执行、integrity 和 clean backup restore；旧应用备份在 clean backup 验证后删除。
- [ ] **T06 · 第一发布单元质量与独立复查**：相关 lint/typecheck/unit/integration/E2E/build/verify 全部通过；新上下文 focused review 检查对象枚举、停止点、404、约束和证据。
- [ ] **T07 · 生产立即退役**：维护窗口停写，用户核对 dry-run并强确认；删除媒体/版本/cache，执行 contract，验证服务，创建并恢复 clean backup，再删除旧应用备份；操作员记录外部快照处理状态。

### GATE-A · 退役完成

- [ ] 本地和生产均无返图/动态表、行、私有原图、派生、版本和应用旧备份；
- [ ] 退役路由 404，导航/首页/sitemap/管理端无入口；
- [ ] return/update 枚举不可插入；
- [ ] foreign key、integrity、readiness、production verify 通过；
- [ ] 证据仅含脱敏计数；外部快照由操作员明确记录。

## B. Expand 新模型与安全

- [ ] **T08 · Hero collection/item Schema**：新增四个 collection 并发域和 items；collection version 独立；管理 upload owner context 区分四集合；linked work 从新契约删除。
- [ ] **T09 · Hero pair 幂等迁移**：旧 pair 确定性拆成两方向 item，保留 placement/alt/order/enabled，归一化顺序；空库/既有库/重复执行测试。
- [ ] **T10 · Works/adoption Expand**：新增 nullable `adoption_status`、`adoption_cover`、`adoption-card`；复用上传、recipe、publication、lease、recovery、purge；旧字段暂留。
- [ ] **T11 · 领养状态盘点**：只自动映射 available→available、delivered→adopted；其它状态保持 NULL，生成后台人工复核清单。
- [ ] **T12 · Commission 持久模型**：新增 `commission_upload_sessions`、`commission_submissions`、private media role、repository/service/audit/no-store preview。
- [ ] **T13 · Commission 匿名安全与 CORS**：Origin、body、Content-Type、独立限流、token、TTL、蜜罐、日志禁值；私有 Bucket CORS 精确加入 public Origin并保留 admin Origin；preflight/live probe。
- [ ] **T14 · Expand 综合门禁**：空库/既有库 migration、foreign key/integrity、Hero collection 409、cover identity、upload state machine、CORS、PII leakage 通过。

### GATE-B · Expand 稳定

- [ ] 四个 Hero collection 各自 version/上传归属正确；
- [ ] Hero 拆分幂等；
- [ ] commission asset 无 PUBLIC variant；
- [ ] public/admin CORS 只允许精确 Origin；
- [ ] 旧公开页面仍可运行；
- [ ] adoption 歧义状态清单可由景宸处理。

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
- [ ] **T29 · Works contract**：在 NULL/缺图均为 0 后重建 works/work_assets，删除旧列和 `work_feature_tags`；`commission_email_action`、contact 兼容列不删除。

### GATE-D · 作品与领养

- [ ] PublicWork DTO 无旧字段；
- [ ] adoption status NULL=0；
- [ ] published adoption missing cover=0；
- [ ] published work missing primary studio photo=0；
- [ ] works/detail/adoptions 三视口通过；
- [ ] contract migration、foreign key、integrity 通过。

## E. 委托投递

- [ ] **T30 · 公开上传 API**：create、conditional PUT、complete、cancel/expire/retry/cleanup；一张 20MB 内图片；token/TTL/摘要/MIME/尺寸/CORS。
- [ ] **T31 · Submission API**：校验五项字段与 COMPLETED upload，单事务消费 asset、创建 pending、重试 receipt collision；重复/蜜罐/限流完整。
- [ ] **T32 · `/commission/apply`**：单图预览与上传、可见 label、邻近错误、失败保留内存草稿、过期重选、提交中、成功回执；不写 URL/localStorage/analytics/console。
- [ ] **T33 · `/admin/commissions`**：三状态列表、私有详情、no-store 图片、状态/备注、version/409/audit。
- [ ] **T34 · `/commission` 与联系入口**：站内提交主 CTA、QQ/QQ群二维码、about 入口；邮箱仅备用。
- [ ] **T35 · FAQ 完整退役**：删除 FAQ JSON/version/UI/Schema/API/Card/test；保留 intro、estimate、`commission_email_action` 和官方渠道；about/privacy 同步。
- [ ] **T36 · 委托综合门禁**：成功/错误/过期/重复/限流/蜜罐/cleanup/CORS/PII/admin 409；真实浏览器单图端到端。

### GATE-E · 委托完成

- [ ] private image 仅认证 no-store 可见；
- [ ] PII 不进公开面、URL、analytics、普通日志、错误；
- [ ] CORS live probe 通过；
- [ ] FAQ 删除且 email action 未误删；
- [ ] 管理与公开流程通过。

## F. 最终评审与发布

- [ ] **T37 · 全量质量门禁**：lint、typecheck、unit、integration、E2E、production build、verify、content guard。
- [ ] **T38 · 新上下文独立 Review**：SPEC→models→PLAN→TASKS→代码→迁移→媒体→PII→部署；记录首次 findings 和重测。
- [ ] **T39 · 用户验收**：Hero、动效、works、adoption、commission、后台、二维码、真实手机、reduced-motion。
- [ ] **T40 · 剩余功能生产发布**：部署 B–E 冻结镜像，迁移、readiness、verify、页面/提交验收。
- [ ] **T41 · 文档收口**：回填迁移名、脱敏计数、生产时间、模型差异、Review、用户签署和最终 STATE。

## 最终门禁

- [ ] **GATE-R3 · 需求3关闭**：T01–T41、GATE-A～E 完成；两个生产发布单元、最新 SHA CI、独立 Review、用户验收和证据齐全。
