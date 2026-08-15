# 实施计划：站点业务简化与委托投递

> **角色**：把需求3规格转成可串行实施、可迁移、可验证的工程路线。
> **状态**：计划已锁定，代码尚未开始。
> **原则**：复用 Nuxt 4、Vue、Drizzle/SQLite、现有 OSS/ESA 媒体链、双 Host、安全中间件和持久 operation；不引入新的前端框架、数据库、队列、SMTP 或第三方验证码。

## 1. 实施总策略

本轮同时包含新增能力、模型收缩和不可恢复删除，采用三段式迁移：

1. **Expand**：先增加 Hero orientation、`adoption_cover`、委托申请与匿名上传等新结构，让新旧代码可以在受控期间共同读取既有数据库；
2. **Migrate**：拆分 Hero、迁移作品字段、补齐领养横版头图、上线新页面和新公开投影；
3. **Contract**：停机执行返图/动态永久媒体清理，再删除旧表、旧字段、旧路由和旧枚举。

不得把 OSS 删除和 SQLite DROP TABLE 颠倒。所有写入、迁移、媒体删除和状态门禁串行执行。

## 2. 分支与交付方式

- 本需求文档通过 `docs/requirement-3-spec` PR 合入；
- 工程实施从最新 `origin/main` 新建独立功能分支，不直接在 `main` 写入；
- 推荐按阶段拆成多个可独立审查的 PR，但 contract migration 与其对应代码必须在同一冻结发布批次内；
- 每个 PR 只声称自己的自动化和浏览器结果，不代签独立 Review、用户验收或生产删除；
- 生产破坏性命令只在用户明确维护窗口中执行，不由普通 CI 自动运行。

## 3. 阶段 A：契约扩展与基础模型

### A1. 品牌常量和兼容文案

- 将 `PROJECT_ENGLISH_NAME` 更新为 `DITE DOG`；
- 全仓搜索并修正当前契约中的旧英文名；
- 将首页 slogan 数据迁移为 `不只做小狗毛 | 只做海绵头`；
- 更新 SEO、JSON-LD、测试、静态内容守卫和品牌显示断言；
- dated history 不强制改写，但必须标注旧英文名是当时错误。

### A2. Hero orientation expand

- 新建 `site_hero_items` 或等价 orientation 独立表；
- 新增 `(placement, orientation)` Schema、repository、service 和管理 DTO；
- 复用现有 `home_hero_landscape`、`home_hero_portrait` 资产角色和站点展示无水印 recipe；
- 旧 `site_hero_slides` 暂时保留为迁移输入；
- 新 API 按 placement 和 orientation 读写，不再接受 linked work；
- 迁移工具把旧一条配对记录拆成两条新记录，保证幂等。

### A3. 作品与领养 expand

- 为 `works` 增加目标 `adoption_status`；
- 为 `assets`、上传 Schema、`work_assets` 和公开 recipe 增加 `adoption_cover` / `adoption-card`；
- 暂时保留旧字段供数据映射和兼容读取；
- 发布校验在兼容期允许旧卡片继续显示，但后台明确提示哪些 published adoption 缺少新横版头图；
- 新公开 DTO 和管理 DTO在独立版本/路径内完成，不在同一个 PR 中同时删除旧 DTO。

### A4. 委托申请与匿名上传

- 新建 `commission_upload_sessions`、`commission_submissions`；
- 新增 `commission_design_reference` 私有媒体角色；
- 复用 OSS 条件 PUT、HEAD、摘要、image info、私有 preprocess 和清理基础函数；
- 匿名上传不复用管理员 `upload_sessions` 行，也不移除其 `created_by`；
- 新增公开 Origin、Content-Type、body limit、可信客户端限流、一次性 token 和蜜罐逻辑；
- 新增管理 repository/service/API、版本冲突和认证私有预览。

### GATE-A

进入公开页面开发前必须通过：

- 新空库/既有库 expand migration；
- `foreign_key_check`、`integrity_check`；
- Hero 拆分幂等测试；
- adoption cover 角色与 recipe identity 测试；
- 匿名上传的字段、摘要、尺寸、TTL、重复消费和清理 integration；
- 私有委托数据泄漏扫描。

## 4. 阶段 B：公开动效与首页

### B1. 全局动效基础

- 扩展公开设计 Token：导航 hover、页面 enter/leave、区块 reveal 和卡片 interaction；
- 在公开布局内给主内容增加路由切换，不让 Header/Footer 重挂载闪烁；
- 主导航增加圆角底、阴影、1–2px 上移和等价 focus；
- 继续复用公共抽屉的焦点陷阱、Escape、滚动锁定、inert 和焦点归还；
- 统一 reduced-motion 关闭路径。

### B2. 首页 Hero 公开端

- 删除 Hero action 和 linked work 行为；
- 桌面实现“中文标题居中 + 英文/slogan 左右分置”；
- 移动端实现英文、中文、slogan 的左对齐下移布局；
- 修复 100svh/100dvh 首屏覆盖；
- Public DTO 返回 landscape/portrait 两套序列；
- SSR 第一帧使用两个方向各自第一张组成 `<picture>`；
- 水合后只挂载当前方向的活动项，方向切换时安全重置索引；
- 自动轮播、暂停、页面隐藏和 reduced-motion 沿用现有契约。

### B3. Hero 管理端

管理页层级调整为：

```text
首页大图
  横版
  竖版
委托页大图
  横版
  竖版
```

每个列表独立新增、上传、排序、启停、适配、预览和发布；继续使用稳定 ID、完整顺序提交、乐观版本和 FLIP 动画。页面不再要求一次填写横竖两个槽位。

### GATE-B

- 390×844 首屏无白块；
- 1440×900 桌面布局符合设计；
- 横竖集合数量和顺序可以不同；
- orientation change、SSR、无 JS、懒加载和 reduced-motion 自动化通过；
- 导航 hover/focus、页面前后退和路由失败不破坏可用性。

## 5. 阶段 C：作品与领养

### C1. 管理作品表单收缩

- 删除装型、主人公开值、私有联系人、属性标签、领养方式、展会字段和旧进度输入；
- 业务类型只保留委托作品、领养作品、纯展示三项；
- adoption 只维护 `available | adopted` 和可选价格；
- 媒体区明确分为：竖版作品主图/图集、横版领养头图、可选设定图；
- 已发布内容仍先下架再改事实或媒体关系。

### C2. `/works` 与详情

- PublicWork DTO 收缩为名称、物种和图片；
- `/works` 删除用途/装型筛选，保留名称搜索和分页；
- 卡片只显示名称、物种；
- `/works/{slug}` 删除事实表、标签、价格和领养状态，只保留标题、图集、前后浏览和相关作品；
- SEO/JSON-LD 只使用名称、物种、图片和工作室事实。

### C3. 领养公开链

- `/adoptions` API 移除 `method`、regular/event counts 和 event 字段；
- 卡片改用 `adoption_cover` 的 `adoption-card` SourceSet；
- 页面移除领养方式筛选，保留名称搜索和分页；
- 卡片显示名称、物种、状态、可选价格；
- 首页当前领养复用同一卡片；
- 既有 published adoption 必须在切换前补齐 cover，否则先下架。

### GATE-C

- 公开 DTO grep 和 Schema strict 证明被删除字段无法返回；
- 作品卡和详情三视口不显示旧事实；
- 领养卡只请求 `adoption-card`；
- 缺横版头图的 adoption 发布被阻断；
- 设定图不再是领养列表或发布门禁。

## 6. 阶段 D：委托投递

### D1. 公开上传 API

建议流程：

1. `POST /api/public/v1/commission-upload-sessions` 创建 10 分钟内有效的条件 PUT；
2. 浏览器直传私有 OSS；
3. `POST .../{id}/complete` 验证对象并创建 READY 私有资产；
4. `POST /api/public/v1/commission-submissions` 在单事务中消费 completed upload 并创建 submission。

服务端严格校验 Origin、Content-Type、body、MD5、SHA-256、MIME、字节、尺寸、token、会话状态和一次性消费。上传错误使用统一安全中文，日志只记录错误码和脱敏 ID。

### D2. `/commission/apply`

- 独立路由和 SEO/noindex 策略；
- 单图上传；
- 称呼、手机号、QQ、身高、体重字段；
- 客户端预览、上传状态、过期重选、字段错误和提交中状态；
- 成功后显示回执编号和人工联系说明；
- 不把 PII 写入 URL、localStorage、analytics 或 console。

### D3. `/admin/commissions`

- 三状态列表，默认 pending；
- 详情页按需读取私有字段；
- 认证短时图片预览；
- 状态与内部备注保存；
- 409 冲突重载和对比提示；
- 审计只保存 ID、状态变化、管理员和时间。

### D4. 委托页、关于页和文案后台

- `/commission` 主要 CTA 指向 `/commission/apply`；
- 直接显示 QQ 和 QQ群二维码；
- 次级入口指向 `/about#contact`；
- 删除 FAQ 区、FAQ Card、API、Schema 和版本；
- 删除 `commission_email_action`；
- 保留委托介绍和估价说明；
- `/about` 更新为支持在线提交，不再声称站内无法提交；
- 隐私政策补充委托字段、用途和人工联系说明。

### GATE-D

- 成功、字段错误、上传失败、过期、重复消费、限流、蜜罐、刷新和重试路径通过；
- 管理列表/详情/状态/备注/冲突通过；
- 公开/管理 Host 隔离、CSRF 和 no-store 预览通过；
- PII 泄漏扫描通过；
- 真实浏览器一张图片端到端提交通过。

## 7. 阶段 E：不可恢复退役与 Contract

### E1. 清理工具

新增只读默认、显式确认执行的运维命令，职责包括：

- 枚举返图资产、上传会话、私有/公开变体、publication operation、ESA URL 和项目备份；
- 输出仅含数量、状态和摘要的 dry-run；
- 执行时按精确 Key 删除私有原图、预处理、预览、公开派生和未完成对象；
- 若 OSS versioning 开启，删除所有版本和 delete marker；
- 对公开 URL 发起精确 ESA purge 并追踪结果；
- 验证 HEAD/GET 已不可达；
- 清理项目管理的旧数据库备份；
- 不持久化内容或完整 Key manifest。

建议命令采用强确认短语，例如：

```text
PERMANENTLY_DELETE_RETURNS_AND_UPDATES
```

具体脚本名在实现时确定，默认必须 dry-run。

### E2. 本地破坏性演练

在本地副本上完整执行：

1. 停止应用；
2. dry-run 并人工核对计数；
3. 执行媒体/备份删除；
4. 验证对象消失；
5. 执行 contract migration；
6. 运行 integrity/foreign key；
7. 生成净化备份；
8. 启动新应用并跑回归。

本地演练必须证明重复执行安全：已完成清理再次 dry-run 为 0，不因缺失对象失败。

### E3. Contract migration

- 删除 `updates`、`return_characters`、`return_photos`、`work_feature_tags`；
- 重建 `works`、`assets`、`upload_sessions`、`asset_variants`、`publication_operations`、`analytics_events`、`site_content` 等受 CHECK 影响的表；
- 删除旧 Hero pair 表；
- 删除旧字段、枚举、索引和外键；
- 清理 analytics 退役 route rows；
- 保留不受本需求影响的管理员、作品图片、Hero、渠道、水印和统计数据；
- 迁移失败必须事务回滚数据库，但已经完成的 OSS 永久删除不可恢复。

### E4. 代码 Contract

- 删除所有返图、动态和旧字段代码；
- 删除旧 DTO 和兼容读取；
- 删除旧测试和 fixture，不能只跳过；
- 更新 sitemap、内容守卫、analytics 白名单、部署验证和文档；
- production artifact grep 不得包含退役入口或旧英文名。

### GATE-E

- 本地永久清理、contract migration、全量回归通过；
- 最新 PR SHA CI 全绿；
- 独立 Review 确认没有孤儿 Key、旧路由、旧字段或隐私泄漏；
- 形成生产维护窗口步骤和停止点。

## 8. 阶段 F：生产维护窗口

生产执行必须使用同一冻结镜像：

1. 获取数据库和 OSS 当前状态，只做不含退役内容导出的业务可用性检查；
2. 停止应用，阻断管理写和匿名提交；
3. 执行退役 dry-run，用户核对数量；
4. 用户输入强确认短语；
5. 删除返图媒体、动态/返图相关备份并完成 ESA purge；
6. 验证删除；
7. 执行数据库 contract migration；
8. 执行 integrity、foreign key、readiness 和 production verify；
9. 生成新的净化备份；
10. 启动应用，检查公开/管理 Host、委托提交、作品、领养、Hero；
11. 用户签署不可恢复删除和页面验收。

生产步骤 5 完成后没有数据回滚路径。步骤 7 完成后不允许启动旧镜像；故障采用新镜像的前向修复。

## 9. 测试策略

### 9.1 Unit

- 品牌常量与禁止词；
- Hero orientation index/rotation/reduced-motion；
- work/adoption Schema；
-手机号、QQ、身高、体重和图片输入；
- 上传 token、TTL、状态机、一次性消费；
- status 映射和迁移纯函数；
- public DTO 负向字段断言。

### 9.2 Integration

- 空库、既有库 expand/migrate/contract；
- Hero 拆分幂等；
- adoption cover 生成、发布和缺失阻断；
- 委托条件 PUT、完成、提交、限流、蜜罐、重复和清理；
- 管理委托 API、审计和版本冲突；
- 私有预览和 Host/Origin/CSRF；
- 返图/动态清理 dry-run、执行、重复执行和对象验证；
- SQLite integrity/foreign key。

### 9.3 E2E 与真实浏览器

- 首页 390/768/1440、1023/1024 导航断点；
- 桌面 hover、页面切换、区块 reveal、reduced-motion；
- Hero 横竖独立后台维护和公开展示；
- `/works`、详情、`/adoptions`；
- `/commission`、`/commission/apply`、成功/失败；
- `/admin/commissions` 三状态和详情；
- 退役路由 404、导航缺失、sitemap 缺失；
- console/network、图片方向、私有 URL 泄漏和布局偏移。

## 10. 风险与控制

| 风险 | 控制 |
| --- | --- |
| 删除 OSS 后失去数据库 Key | 必须先 dry-run 枚举并完成对象删除，再 DROP 表；执行过程使用内存/短时受控状态，不长期保存 manifest。 |
| 旧镜像与新 Schema 不兼容 | contract 前冻结新镜像并完成本地演练；contract 后只允许前向修复。 |
| 领养头图未补齐 | expand 期后台列出缺图 published adoption；contract 前必须补齐或下架。 |
| 匿名上传被滥用 | 独立限流、Origin、一次性 token、蜜罐、大小/摘要/尺寸校验和过期清理。 |
| PII 泄漏 | DTO 分层、日志禁止字段、analytics 禁止字段、认证 no-store 预览和负向测试。 |
| 页面动效影响可用性 | Header 稳定、短时动效、无 JS 默认可见、reduced-motion、键盘与前后退测试。 |
| Hero 独立序列 SSR 不一致 | 首项响应式 `<picture>` + 水合后选择方向，方向变化重置索引并测试 hydration。 |

## 11. 完成定义

只有以下条件全部满足，需求3才可关闭：

- TASKS 的工程任务和门禁全部勾选；
- 最新 PR HEAD 的 Actions 全绿；
- 新上下文独立 Review PASS；
- 用户完成三视口、真实手机、委托流程和后台验收；
- 本地与生产返图/动态永久删除均完成；
- 生产数据库净化备份和服务恢复完成；
- STATE、SPEC、PLAN、models、CLAUDE、部署手册和证据同步到最终事实。
