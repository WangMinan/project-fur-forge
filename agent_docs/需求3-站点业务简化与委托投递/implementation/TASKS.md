# 任务清单：站点业务简化与委托投递

> **角色**：需求3唯一可勾选实施分解；任务勾选只证明该任务定义完成，不代签后续 CI、独立 Review、用户验收或生产破坏性执行。
> **状态**：需求与计划已锁定，工程尚未开始。
> **规则**：任何数据库写入、迁移、OSS 删除、发布 operation 和生产命令必须串行；返图/动态永久删除只能在对应门禁关闭后执行。

## 当前目标

完成品牌名回退、退役返图/动态、公开动效和 Hero 改造、作品/领养模型收缩、委托站内提交和后台队列，并在本地和生产永久删除退役数据与媒体。

## 决策门禁

- [x] **GATE-00 · 需求冻结**：用户确认英文名为 `DITE DOG`；返图和动态永久删除；首页 slogan、桌面/移动排版、Hero 横竖独立、作品字段、领养状态、单张设定图、委托字段和后台状态均已锁定。 _完成于 2026-08-15。_
- [x] **T00 · 文档地基**：创建需求3的 foundation、SPEC、models、design、PLAN、DATA-MIGRATION、TASKS、routing、STATE、review 和 artifacts 入口，并同步 `agent_docs/README.md` 与 `CLAUDE.md`。 _纯文档，不代表任何代码已实现。_

## A. Expand：品牌、Schema 与新基础设施

- [ ] **T01 · 品牌英文名与当前文案回退**：将项目英文名统一为 `DITE DOG`，迁移首页 slogan 为 `不只做小狗毛 | 只做海绵头`，更新 SEO、JSON-LD、静态内容守卫、测试和当前文档；全仓当前契约不得出现 `DITE DOG FURSUIT`。 _修改：共享常量、页面元数据、测试、默认内容迁移；不改历史 dated evidence。_
- [ ] **T02 · Hero orientation 数据模型与后端**：新增 orientation 独立 Hero 表、Schema、repository、service、route 和 DTO；复用现有 Hero 资产、站点展示 recipe、适配、operation、lease、恢复和 ESA purge；删除新契约中的 linked work。 _依赖：T01；暂不删除旧 pair 表。_
- [ ] **T03 · Hero pair 幂等迁移与兼容读取**：把每条旧 Hero pair 确定性拆成 landscape/portrait 两条记录，归一化顺序，完成空库/既有库/重复执行测试；提供切换前一致性报告。 _依赖：T02。_
- [ ] **T04 · 作品与领养 expand Schema**：增加 `adoption_status`、`adoption_cover`、`adoption-card` 及目标 DTO；扩展上传、资产、关系、recipe、发布检查和媒体清理；旧字段暂时保留作迁移输入。 _依赖：无；不自动生成 cover。_
- [ ] **T05 · 委托申请和匿名上传模型**：新增 `commission_upload_sessions`、`commission_submissions`、`commission_design_reference`，完成严格 Schema、repository、service、一次性消费、TTL、清理、审计和私有预览基础设施。 _依赖：无；不能放宽管理员 upload_sessions。_
- [ ] **T06 · 匿名写安全边界**：新增公开 Origin、Content-Type、body limit、独立可信客户端限流、一次性 token、蜜罐、日志脱敏和私有字段负向测试；生产配置、环境模板和观测策略同步。 _依赖：T05。_

### GATE-A · Expand 契约

- [ ] 新空库与既有库 expand migration、foreign key、integrity 全部通过；
- [ ] Hero 拆分幂等、adoption cover identity、委托上传状态机和 PII 泄漏测试通过；
- [ ] 新结构不改变旧公开页面的当前可用性；
- [ ] 形成脱敏迁移盘点，不包含作品名、私有字段或完整 Object Key。

## B. 公开动效与首页

- [ ] **T07 · 公开导航交互动效**：桌面主导航增加圆角底、阴影、轻微上移和等价 focus；下拉菜单保持自然过渡；移动抽屉不模拟 hover。 _依赖：GATE-A；修改：PublicHeader、设计 Token 和 E2E。_
- [ ] **T08 · 公开页面路由切换**：在公共布局中只过渡主内容，Header/Footer 保持稳定；处理前进后退、错误页、锚点、焦点、旧内容 pointer-events 和 reduced-motion。 _依赖：T07。_
- [ ] **T09 · 首页区块与卡片动效**：强化首页首次入屏揭示、作品/领养/业务入口 hover，SSR/无 JS 默认可见，静态内容不制造点击暗示。 _依赖：T08。_
- [ ] **T10 · 首页 Hero 新排版与首屏覆盖**：移除 Hero 按钮；桌面实现中文居中、英文/slogan 同行左右分置；移动实现整体左对齐下移；修复 100svh/100dvh 白块和安全区。 _依赖：T01、T02。_
- [ ] **T11 · 首页 Hero 独立序列公开轮播**：公开 DTO 返回两套 orientation 序列；SSR 第一项 `<picture>`、水合选择、方向变化、懒加载、10 秒轮播、暂停、页面隐藏和 reduced-motion 全覆盖。 _依赖：T03、T10。_
- [ ] **T12 · Hero 管理端四集合体验**：`首页/委托页 × 横版/竖版` 分层，独立新增、上传、排序、启停、适配、预览和发布；复用稳定 ID、完整顺序、409 和 FLIP。 _依赖：T02、T03。_
- [ ] **T13 · 首页业务标题与收尾**：将“委托投递”改为“委托与领养”，删除首页最新动态区块，调整当前领养至页脚的节奏和测试。 _依赖：T09；动态表此时仍可暂存，公开不再消费。_

### GATE-B · 首页与动效

- [ ] 390×844、768×1024、1023/1024、1440×900 浏览器验证通过；
- [ ] 桌面/移动 Hero 对齐明确不同，移动首屏无白块；
- [ ] 横竖数量和顺序可不同，SSR/hydration 无警告；
- [ ] 导航 hover/focus、页面切换、卡片交互和 reduced-motion 通过；
- [ ] 公开首页不再请求最新动态 API。

## C. 作品与领养

- [ ] **T14 · 作品管理表单收缩**：移除装型、主人、联系人、属性、领养方式、展会和旧进度编辑；只维护名称、物种、内部用途、adoption 状态/价格、精选和图片。 _依赖：T04。_
- [ ] **T15 · 作品公开 DTO 与列表收缩**：PublicWorkSummary 只含名称、物种、卡图；`/works` 删除用途/装型筛选，保留名称搜索、分页和发布时间排序；卡片只显示名称、物种。 _依赖：T04、T14。_
- [ ] **T16 · 作品详情图片化**：`/works/{slug}` 只保留名称、物种、图集、前后浏览和相关作品；删除 facts、tags、price、status、purpose 及对应 SEO 文案。 _依赖：T15。_
- [ ] **T17 · adoption cover 媒体垂直切片**：完成上传、私有验证、适配、公开水印派生、发布阻断、失败重试、清理和后台预览；每件 adoption 最多一张。 _依赖：T04。_
- [ ] **T18 · 既有领养补图与状态复核工具**：列出缺 cover 的 published adoption 和旧状态映射计数；景宸逐件补横版单头图或下架，人工复核 adopted 映射。 _依赖：T17；报告不得进仓库。_
- [ ] **T19 · 领养公开 API 与页面收缩**：删除 method 筛选、regular/event counts 和展会信息；`/adoptions` 与首页当前领养只使用横版 cover，显示名称、物种、available/adopted 和可选价格。 _依赖：T17、T18。_
- [ ] **T20 · 可选设定图契约**：设定图仍最多一张，可在详情图集中展示；从领养列表和发布门禁移除，补负向测试。 _依赖：T16、T19。_

### GATE-C · 作品与领养

- [ ] 公开 DTO 不可解析或输出已删除字段；
- [ ] `/works`、详情和 `/adoptions` 三视口符合设计；
- [ ] published adoption 缺 `adoption_cover` 数量为 0；
- [ ] published work 缺主 studio photo 数量为 0；
- [ ] 设定图不再充当领养卡或发布门禁；
- [ ] 当前页面不再出现展会掉落、装型、主人或属性文案。

## D. 委托投递

- [ ] **T21 · 公开委托上传 API**：创建、条件 PUT、complete、过期、失败、重试和清理；只接受一张 20 MB 内 JPEG/PNG/WebP，校验摘要、MIME、尺寸和 token。 _依赖：T05、T06。_
- [ ] **T22 · 委托申请提交 API**：校验称呼、+86 手机、QQ、身高、体重和 completed upload，在单事务中消费 asset、创建 pending submission 和随机 receipt；防重复和蜜罐路径完整。 _依赖：T21。_
- [ ] **T23 · `/commission/apply` 表单**：实现单图预览/上传、五个字段、即时错误、失败保留、过期重选、提交中和成功回执；不使用 URL/localStorage/analytics 保存 PII。 _依赖：T22。_
- [ ] **T24 · 委托后台列表与详情**：新增“委托申请”导航、三状态列表、私有详情、认证 no-store 图片预览、状态/备注保存、409 和审计。 _依赖：T05、T22。_
- [ ] **T25 · 委托页主行动与二维码**：`/commission` 优先站内提交，展示 QQ/QQ群二维码和关于页入口；邮件只保留在 about 备用渠道；更新 CommissionLead 行动。 _依赖：T23；复用需求2渠道投影。_
- [ ] **T26 · FAQ 和邮件行动完整退役**：删除 FAQ UI、Schema、版本、API、Card、测试及 `commission_email_action`；保留 intro/estimate；更新 about 和隐私政策。 _依赖：T25。_

### GATE-D · 委托流程

- [ ] 成功、字段错误、图片错误、过期、重复、限流、蜜罐、刷新和清理 integration/E2E 通过；
- [ ] 管理列表、详情、状态、备注、冲突和审计通过；
- [ ] 私有图片只在认证 no-store 预览中可见；
- [ ] PII 不进入公开 DTO、HTML、URL、analytics、普通日志和错误；
- [ ] 真实浏览器完成一张设定图端到端提交。

## E. 返图/动态永久退役与 Contract

- [ ] **T27 · 退役清理工具与 dry-run**：实现默认只读的精确盘点，覆盖数据库行、返图私有原图、preprocess、preview、public variant、pending upload、publication operation、ESA URL、OSS versions 和项目备份；输出仅脱敏计数。 _依赖：GATE-B、GATE-C、GATE-D。_
- [ ] **T28 · 强确认永久删除执行器**：显式确认后串行删除全部返图媒体、版本、delete marker、ESA 缓存和旧项目备份；失败时停在 DROP TABLE 前；重复执行安全。 _依赖：T27。_
- [ ] **T29 · 本地永久删除演练**：在复杂本地副本完成 dry-run、永久删除、对象不可达验证、旧备份删除、重复执行和证据记录。 _依赖：T28。_
- [ ] **T30 · Contract 前向迁移**：重建 works/assets/upload/variant/publication/site_content/analytics 等表，删除 updates、return 表、feature tag、旧 Hero pair、旧列和旧枚举；迁移事务和 integrity/foreign key 通过。 _依赖：T03、T18、T26、T29。_
- [ ] **T31 · 退役代码和兼容链删除**：删除返图/动态页面、API、组件、repository、service、runner、recipe、fixture、测试、导航、sitemap、analytics 和旧 DTO；不得只隐藏或 skip。 _依赖：T30。_
- [ ] **T32 · 生产内容与产物守卫**：更新 production build guard、verify、部署检查和 grep，阻止旧英文名、返图/动态入口、旧字段和 commission 私有数据进入产物。 _依赖：T31。_

### GATE-E · Contract 就绪

- [ ] 本地永久清理和最终 Schema 全量回归通过；
- [ ] 退役路由 404，导航、sitemap、首页和管理端均无入口；
- [ ] 表/列/枚举不存在断言通过；
- [ ] 生产冻结镜像、清理命令、强确认短语、停止点和净化备份步骤已演练；
- [ ] 最新 PR HEAD CI 全绿。

## F. 评审、验收与生产

- [ ] **T33 · 全量质量门禁**：串行运行 lint、typecheck、unit、integration、相关 E2E、production build、verify 和内容守卫；不得删除或放宽既有有效断言。 _依赖：GATE-E。_
- [ ] **T34 · 新上下文独立 Review**：按 SPEC → PLAN → TASKS → 代码 → 迁移 → OSS 清理 → DTO/隐私 → 部署逐项复查，记录首次 findings、修复和重测；实现者不得代签。 _依赖：T33。_
- [ ] **T35 · 用户公开端与后台验收**：用户验收 Hero、动效、作品、领养、委托表单、后台处理、二维码、真实手机和 reduced-motion；只由用户签署。 _依赖：T34。_
- [ ] **T36 · 生产永久退役执行**：在维护窗口使用冻结镜像完成 dry-run、用户强确认、媒体/备份永久删除、contract migration、integrity/readiness/verify、净化备份和服务恢复。 _依赖：T35；步骤开始后无退役数据回滚。_
- [ ] **T37 · 生产验收与文档收口**：确认公开/管理 Host、首页横竖、作品、领养、委托提交和后台处理；回填脱敏计数、迁移名、生产时间、净化备份结果与最终 STATE。 _依赖：T36。_

## 最终门禁

- [ ] **GATE-R3 · 需求3关闭**：T01–T37、GATE-A～E 全部完成；最新 SHA CI、独立 Review、用户验收、本地和生产不可恢复清理、净化备份与文档收口全部有证据。只有此时才能声明需求3完成。
