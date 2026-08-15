# 需求规格：站点业务简化与委托投递

> **角色**：需求3实现和评审的产品、数据、媒体、隐私与验收真理来源。
> **状态**：用户决策已锁定；代码尚未开始。
> **基线**：继承需求1安全/媒体/部署基线和需求2仍适用的官方渠道、二维码、名称搜索。
> **复查修订**：2026-08-15，修正实施顺序、Hero 并发域、领养状态迁移、公开上传 CORS 和文案删除边界。

## 1. 目标

1. 立即永久退役返图墙和最新动态，不让其数据继续存活到本轮末尾。
2. 将英文品牌名纠正为 `DITE DOG`。
3. 以图片为主重做首页 Hero、作品和领养展示。
4. 增强公开导航、页面切换、区块和卡片动效。
5. 横版/竖版 Hero 分别维护。
6. 新增私有委托申请和后台处理流程。
7. 删除不再维护的作品、领养和 FAQ 字段，同时保留未被明确授权删除的联系文案。

## 2. 非目标

- 交易、支付、定金、退款、排期、合同、自动报价或自动接单；
- SMTP、短信或第三方推送；
- 访客账号、申请查询、撤回、编辑；
- 多管理员、审批流、通用 CMS、富文本；
- 第三方验证码；
- 返图/动态只读归档或搜索引擎兼容跳转；
- 自动从其它图片裁切领养横版头图。

## 3. 品牌与固定文案

- 公开导航短品牌：`有点小狗`。
- 首页完整标题：`有点小狗工作室`。
- 英文品牌：`DITE DOG`。
- 首页 slogan：`不只做小狗毛 | 只做海绵头`。
- 首页业务区标题：`委托与领养`。
- 代码常量、SEO、JSON-LD、可见文案、测试以及带文字的 SVG/PNG/OG 资产必须审计；当前产品不得显示 `DITE DOG FURSUIT`。历史 dated note 可以保留并注明当时错误。

## 4. 路由

### 4.1 保留/新增公开路由

- `/`
- `/works`
- `/works/{slug}`
- `/adoptions`
- `/adoptions/{slug}`：继续兼容跳转到 `/works/{slug}`
- `/commission`
- `/commission/apply`
- `/about`
- `/service`
- `/privacy`
- `/licenses`
- 既有 `/contact`、`/terms` 兼容跳转

`/commission/apply` 建议 `noindex, nofollow`，但必须可由 `/commission` 正常进入。

### 4.2 保留/新增管理路由

- `/admin/login`
- `/admin/works/**`
- `/admin/commissions`
- `/admin/commissions/{id}`
- `/admin/site/home`
- `/admin/site/content`
- `/admin/site/branding`
- `/admin/analytics`
- `/admin/account`

管理导航新增“委托申请”，放在作品管理之后。

### 4.3 第一阶段永久移除

- `/returns`
- `/returns/{slug}`
- `/updates`
- `/admin/returns/**`
- `/admin/updates`

不做任何重定向，移除后返回普通 404。

## 5. 返图墙与最新动态立即永久退役

### 5.1 第一实施阶段完成定义

必须在其它 Hero、作品和委托新功能之前完成：

- 页面、导航、首页摘要、sitemap、analytics 新事件入口删除；
- 公开和管理 API 删除；
- Schema、DTO、类型、repository、service、runner、recipe、fixture、测试删除；
- `updates`、`return_characters`、`return_photos` 表与数据删除；
- `return_photo`、`return-wall`、`return-display-v1`、`RETURN_PHOTO` 从目标代码和数据库约束删除；
- 相关 assets、upload sessions、variants、publication operations、analytics 行删除；
- 私有原图、preprocess、preview、public variants、pending upload objects 删除；
- OSS 历史版本/delete marker（若启用）删除；
- ESA 精确 URL purge 并验证对象不可达。

### 5.2 备份顺序

- 不为退役内容创建新的长期导出或归档。
- 现有应用管理备份只能在维护窗口内作为受限恢复材料暂存。
- 退役数据库 contract 和服务验证成功后，先创建并恢复验证新的净化备份，再删除仍含退役数据的旧应用备份。
- 外部 ECS 快照、云盘快照或第三方备份由操作员单独确认，不由应用脚本假设其位置或权限。
- 最终证据只保留脱敏计数、总字节、状态和时间，不保留内容或完整 Object Key。

用户已授权本地和生产执行不可恢复删除；完成后不提供退役数据恢复路径。

## 6. 公开动效

### 6.1 导航

桌面精细指针环境：

- 主导航 hover/focus 出现浅色或半透明圆角底；
- 柔和阴影；
- 最多 2px 上移；
- 活跃项有稳定标识；
- 下拉菜单淡入、位移复位和 chevron 旋转。

移动端不模拟 hover，保留抽屉错峰、焦点陷阱、Escape、滚动锁定、inert 和焦点归还。

### 6.2 页面切换

- 只过渡公开主内容，Header/Footer 保持稳定；
- 离场 140–200ms，入场 240–360ms；
- opacity + 8–16px 位移；
- 旧内容离场后不得继续接收指针事件；
- 前进、后退、锚点、错误页和焦点必须正确。

### 6.3 区块与卡片

- 首页主要区块首次入屏可以错峰揭示；
- SSR/无 JavaScript 内容默认可见；
- 可点击图片卡可上浮、加阴影和轻微放大；
- 静态内容不制造点击暗示；
- 管理端只做功能性动效。

### 6.4 reduced-motion

必须关闭自动轮播、页面位移、错峰、平滑滚动、卡片位移/缩放等非必要动效，内容和状态仍完整可用。

## 7. 首页 Hero

### 7.1 排版

删除“查看这套作品/浏览作品展示”按钮和 Hero linked work。

桌面：

```text
                 有点小狗工作室
DITE DOG                     不只做小狗毛 | 只做海绵头
```

移动：

```text
DITE DOG
有点小狗工作室
不只做小狗毛 | 只做海绵头
```

桌面中文标题居中；英文/slogan 同行左右分置。移动整组左对齐并下移。两端对齐方式必须不同。

### 7.2 首屏

- 移动至少覆盖 `100svh`，使用 `100dvh` 处理动态地址栏；
- 只使用竖版素材，`object-fit: cover`；
- 不露底部白块；
- 文字、Header、轮播控制和 safe area 不重叠。

### 7.3 四个独立集合

```text
home / landscape
home / portrait
commission / landscape
commission / portrait
```

每个集合：

- 独立版本、排序、启停、上传和发布；
- 1–5 张 enabled 才公开就绪；
- 数量和顺序允许不同；
- 不跨方向自动裁切或静默替代；
- 管理写入使用集合级 `expectedVersion`，不能继续让四个集合共享一个全局 home version。

公开首页 DTO 分别返回 landscape/portrait 序列。SSR 第一帧可用两方向各自首项组成响应式 `<picture>`；水合后只轮播当前方向，方向变化时夹紧或重置索引。首页固定 10 秒自动轮播、显式暂停、页面隐藏暂停；reduced-motion 停止。委托页只取当前方向第一张，不自动轮播。

## 8. 作品

### 8.1 持久字段

保留：

- ID、slug、名称、物种；
- 内部 `purpose=commission|adoption|showcase`；
- adoption 专属 `adoption_status` 与可选 CNY 价格；
- `publication_status`；
- 精选标记与顺序；
- 版本、发布时间、时间戳；
- 图片关系。

删除：

- `suit_type`
- `owner_display`
- `owner_contact`
- `featureTags` / `work_feature_tags`
- `adoption_method`
- `business_status`
- `event_name`
- `event_time`
- `event_sale`

### 8.2 `/works`

- 卡片只显示名称、物种和 3:4 竖版成果图；
- 删除用途/装型筛选；
- 保留名称搜索、分页、发布时间倒序；
- 首页精选复用同一简化摘要。

### 8.3 `/works/{slug}`

- 只显示名称、物种、图集；
- 可保留前后浏览和相关作品；
- 不显示主人、装型、用途、状态、价格、属性或展会信息；
- SEO/JSON-LD 只使用名称、物种、图片和工作室事实。

## 9. 设定领养

### 9.1 状态迁移

目标状态：

- `available`
- `adopted`

Expand 阶段 `adoption_status` 允许暂时为空。自动迁移只处理语义明确的值：

- 旧 `available` → `available`
- 旧 `delivered` → `adopted`

旧 `preparing`、`scheduled`、`in_production`、`event_sale` 和 NULL 均视为歧义，必须由景宸逐条确认，不能默认映射为 available。最终 contract 前所有 adoption 均必须有明确状态。

### 9.2 媒体

每件已发布 adoption 必须具备：

- 恰好一张 READY `adoption_cover`：横版单头成果照，用于 `/adoptions` 和首页当前领养；
- 至少一张 READY `studio_photo`，且恰好一张 primary：用于 `/works` 和详情；
- 0..1 张 `design_sheet`：只作可选详情素材，不是列表图或发布门禁。

不得自动生成 cover。

### 9.3 `/adoptions`

- 不再接受 `method`；
- 删除常规/展会筛选、counts、展会标签和字段；
- 保留名称搜索、分页；
- 卡片显示横版 cover、名称、物种、状态、可选价格。

## 10. 自设委托

### 10.1 `/commission`

保留营业状态、代表图、简短介绍、制作范围、人工估价、服务条款。首要行动进入 `/commission/apply`；直接展示 QQ 与 QQ群二维码，并提供 `/about#contact`。

邮箱不再是委托页主行动，但仍可在关于页作为备用官方渠道。

### 10.2 `/commission/apply`

字段：

- 一张 JPEG/PNG/WebP 设定图，最大 20MB，边长 64–12000px；
- 称呼：1–50 字；
- +86 大陆手机号：11 位；
- QQ：5–12 位非零开头数字；
- 身高：80–250cm 整数；
- 体重：20–300kg，最多一位小数。

提交成功返回随机回执编号，只用于成功提示，不提供公开查询。工作室通过手机号或 QQ 人工联系。

### 10.3 匿名上传安全

建议接口：

- `POST /api/public/v1/commission-upload-sessions`
- 条件 PUT 到私有 OSS
- `POST /api/public/v1/commission-upload-sessions/{id}/complete`
- `POST /api/public/v1/commission-submissions`

要求：

- 独立上传会话，TTL ≤ 10 分钟，一次消费；
- 精确 Origin、Content-Type、body size、token、限流和蜜罐；
- MD5、SHA-256、MIME、字节、尺寸和图片解码验证；
- 生产 CORS 精确允许 public/admin Origin 和所需 PUT headers，不允许 `*`；
- 私有设定图不生成 PUBLIC variant、不进 ESA；
- 过期/失败/未消费对象可清理；
- PII 不进 URL、localStorage、analytics、普通日志或错误响应。

### 10.4 管理后台

`/admin/commissions` 默认 pending，支持 pending/accepted/rejected 三视图。列表只显示称呼、时间、状态和回执；详情按需显示手机号、QQ、身高、体重、备注和认证 no-store 图片预览。

状态/备注更新使用资源版本、409 冲突与审计。状态变化不发通知、不自动建作品。

首版不提供申请永久删除按钮；如需保留周期或删除能力，另立隐私需求。

## 11. 委托 FAQ 与联系文案

永久删除：

- `commission_faq_json`
- `commission_faq_version`
- FAQ Schema、DTO、管理 Card、API、公开区块和测试
- 需求2追加的邮件估价 FAQ

继续保留：

- `commission_intro`
- `commission_estimate_note`
- `commission_email_action`
- about、service、privacy、contact、官方渠道和防诈骗内容

`commission_email_action` 不在 `/commission` 作为主行动；实现可以仅在关于/联系语境保留备用邮件说明。本轮不得因清理 FAQ 顺带删除该字段或其真实内容。

## 12. 数据模型与接口

目标模型见 `../models/README.md`。关键原则：

- Hero 有四个 collection 并发域；
- 普通作品公开 DTO 不返回内部 purpose、价格、adoption 状态或旧字段；
- 领养 DTO 独立返回状态、价格和 cover；
- 委托列表 DTO 不返回手机号、QQ、体型和图片；
- 委托详情 DTO 仅管理 Host 认证可见；
- 所有管理写继续执行 Host、Session、Origin、CSRF、限流和 expectedVersion。

## 13. 迁移

迁移发布单元：

1. **立即退役 release**：删除返图/动态代码、数据、媒体和备份残留；
2. **Expand release**：Hero collections/items、adoption status/cover、commission tables/upload；
3. **Migrate**：Hero 拆分、状态人工确认、领养补图、页面切换；
4. **Works contract**：删除作品旧列和 tags；
5. **最终 release**：委托、全量质量、独立 Review、用户验收和生产部署。

详细顺序见 `../planning/DATA-MIGRATION.md`。

## 14. 开放问题

用户已确认的产品问题全部关闭。技术实现只有在改变产品行为、删除范围、安全、隐私、Hero 对齐或新增第三方服务时才重新升级。

## 15. 验收

### 15.1 立即退役

- [ ] 返图/动态路由 404，导航、首页、sitemap、管理端无入口。
- [ ] 表、行、私有原图、派生、OSS versions 和 ESA cache 已删除。
- [ ] 净化备份完成恢复验证，旧应用管理备份随后删除。
- [ ] 代码和最终数据库不能再创建 return/update 资源。

### 15.2 公开体验

- [ ] 390×844 Hero 完整首屏、移动左对齐、无白块。
- [ ] 1440×900 中文居中，英文/slogan 同行左右分置。
- [ ] 四个 Hero 集合独立管理，409 并发域互不干扰。
- [ ] 导航 hover/focus、页面切换、区块和卡片动效符合设计。
- [ ] reduced-motion 完整。

### 15.3 作品与领养

- [ ] PublicWork DTO 不含已删除字段。
- [ ] `/works`、详情只显示名称、物种和图片。
- [ ] adoption 歧义状态均已人工确认。
- [ ] published adoption 缺 cover 数量为 0。
- [ ] `/adoptions` 不含 method/展会信息。

### 15.4 委托与隐私

- [ ] 一张图端到端上传、完成、消费、提交成功。
- [ ] CORS、Origin、限流、蜜罐、过期、重复消费和清理有覆盖。
- [ ] 管理列表、详情、状态、备注和 409 有覆盖。
- [ ] PII 不进入公开面、URL、analytics、普通日志和错误。
- [ ] FAQ 已删除，`commission_email_action` 未被误删。
