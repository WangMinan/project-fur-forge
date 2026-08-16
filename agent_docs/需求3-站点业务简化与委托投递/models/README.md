# 需求3 · 数据模型规划

> **角色**：定义 contract 完成后的目标持久模型、DTO 和媒体身份。
> **状态**：目标已锁定；T01～T06 的品牌、代码、清理工具、持久 Contract、本地演练和独立 focused Review 已回填，生产 T07 待执行。
> **修订**：增加 Hero collection 版本域、明确领养状态人工迁移、沿用既有 `detail` usage、保留 `commission_email_action`；官方渠道收缩为 `qq | qq_group`，FAQ 字段已从目标模型删除，OSS CORS 保持通配且不进入模型门禁。

## 1. 最终数据域

需求3完成后保留：

- 用户/管理员认证；
- 简化作品及图片；
- 领养状态、价格和独立横版 cover；
- 四个 Hero collection 及其 items；
- 站点内容、邮箱、QQ、QQ群和水印；
- 委托申请与私有设定图；
- 最小第一方 analytics；
- 现有 publication、lease、recovery、备份和部署基础设施。

返图、最新动态、抖音、小红书和 Bilibili 联系渠道不再有活模型或隐藏兼容投影。

R3-A 清理完成凭据复用既有 `audit_logs`：只写固定 action/entity/result 和时间，不保存账号、内容、对象 Key 或 manifest；T04 仅把它作为对象清理停止点凭据，不把它投影到产品 DTO。

## 2. `works`

```text
works
  id                   text PK
  slug                 text unique
  character_name       text
  species              text
  purpose              commission | adoption | showcase
  adoption_status      available | adopted | null
  price_amount_minor   integer positive | null
  price_currency       CNY | null
  publication_status   draft | published | unpublished
  sort_order           integer >= 0
  featured             boolean
  version              integer > 0
  published_at         integer | null
  created_at           integer
  updated_at           integer
```

约束：

- 非 adoption 的 `adoption_status`、价格必须为空；
- adoption 在 Expand 期允许 `adoption_status=NULL`，仅用于人工迁移；
- 最终 contract 后 adoption 的 `adoption_status` 必填；
- 价格为空时 amount/currency 同时为空，存在时为正数 CNY；
- `sort_order` 只服务首页精选；
- 已发布事实字段继续先下架再改。

最终删除：

```text
suit_type
adoption_method
business_status
owner_display
owner_contact
event_name
event_time
```

`work_feature_tags` 整表删除。

## 3. 作品媒体

### 3.1 `assets.role`

相关目标枚举：

```text
design_sheet
studio_photo
adoption_cover
home_hero_landscape
home_hero_portrait
commission_design_reference
watermark_logo
contact_qr
```

`return_photo` 在第一阶段永久删除。

### 3.2 `work_assets.role`

```text
design_sheet    每件作品 0..1，position=0，contain
studio_photo    每件作品 0..5，恰好一张 primary
adoption_cover  adoption 作品 0..1，position=0
```

发布资格：

- commission/showcase：至少一张 READY studio photo 且恰好一张 primary；
- adoption：上述条件 + 恰好一张 READY adoption cover；
- design sheet 永远可选。

### 3.3 公开 usage

沿用既有命名，避免无意义重命名：

```text
work-card       3:4，primary studio_photo，公开水印
detail          原比例详情图，studio_photo，公开水印
design-sheet    contain，design_sheet，公开水印
adoption-card   横版，adoption_cover，公开水印
```

不新增 `work-detail` usage。`return-wall` 与 `return-display-v1` 第一阶段删除。

## 4. Hero collection 与 item

横竖解耦需要两个表，不能只给 item 加 version 后虚构集合级并发。

### 4.1 `site_hero_collections`

固定四行：

```text
site_hero_collections
  placement      home | commission
  orientation    landscape | portrait
  version        integer > 0
  created_at     integer
  updated_at     integer
  PK (placement, orientation)
```

用途：

- 作为新增、排序、启停和上传归属的独立乐观并发域；
- 四个集合互不制造无关 409；
- 完整顺序更新先 claim collection version，再事务写 items；
- 首页 slogan/自动轮播设置继续使用 site content 自己的版本，不与 collection 混用。

### 4.2 `site_hero_items`

```text
site_hero_items
  id                  text PK
  placement           home | commission
  orientation         landscape | portrait
  asset_id             text FK assets
  alt_text             text
  sort_order           integer >= 0
  enabled              boolean
  preview_object_key   text | null
  preview_expires_at   integer | null
  version              integer > 0
  created_at           integer
  updated_at           integer
```

约束：

- `(placement, orientation)` 必须存在 collection；
- landscape 只能引用 `home_hero_landscape`；
- portrait 只能引用 `home_hero_portrait`；
- enabled 的 `(placement, orientation, sort_order)` 唯一；
- 每个 collection 最多 5 个 enabled，完整保存后顺序连续为 `0..n-1`；
- 不保存 linked work。

### 4.3 Hero 上传归属

现有管理员 `upload_sessions` 继续使用 owner 约束，但目标 owner context 必须能区分四个 collection，例如：

```text
site / hero-home-landscape
site / hero-home-portrait
site / hero-commission-landscape
site / hero-commission-portrait
```

具体字符串可实现时校准，但必须：

- 绑定 collection version；
- 媒体角色与 orientation 一致；
- 不继续使用一个共享 `site/home` expectedVersion 代表四个集合；
- branding/contact owner 不受影响。

### 4.4 DTO

```text
AdminHeroCollection
  placement
  orientation
  version
  items[]

AdminHeroItem
  id
  version
  alt
  sortOrder
  enabled
  asset { assetId, width, height }
  upscaleReady
  missingVariantCount
  publicationOperation

PublicHeroPlacement
  landscape[] PublicHeroItem
  portrait[]  PublicHeroItem
```

公开 item 不包含 collection version、linked work 或私有 Key。

## 5. 委托申请

### 5.1 `commission_submissions`

```text
commission_submissions
  id                  text PK
  receipt_code        text unique
  nickname            text
  species             text | null (仅旧申请可为 null)
  phone_country_code  +86
  phone_number        text
  qq                  text
  height_cm           integer
  weight_kg_tenths    integer
  design_asset_id     text unique FK assets
  status              pending | accepted | rejected
  internal_note       text | null
  handled_at          integer | null
  handled_by          text | null FK users
  version             integer > 0
  created_at           integer
  updated_at           integer
```

约束：

- nickname 1–50 字；
- 新申请 species 1–50 字；迁移前旧申请保持 NULL 等待人工补录，不猜测；
- phone 为 11 位大陆手机号；
- QQ 5–12 位非零开头数字；
- height 80–250；
- weight tenths 200–3000；
- design asset 必须 READY 且 role 为 `commission_design_reference`；
- 一个资产只能绑定一条申请；
- pending 时 handled 字段为空；
- accepted/rejected 时写管理员和处理时间；
- receipt collision 必须重试生成，不能返回数据库错误。
- `status='pending'` 时 `(phone_country_code, phone_number)` 唯一；accepted/rejected 不占用该唯一域。

### 5.2 管理 DTO

列表：

```text
id
receiptCode
nickname
species
status
createdAt
version
```

详情：

```text
id
receiptCode
nickname
species
phone { countryCode, number }
qq
heightCm
weightKg
status
internalNote
createdAt
updatedAt
handledAt
version
designReferencePreviewHref
```

列表不返回手机号、QQ、体型、备注或图片；species 可为 NULL 仅用于迁移前旧记录的管理端待补录标记。

## 6. 匿名上传会话

不能放宽管理员 `upload_sessions`。使用：

```text
commission_upload_sessions
  id                     text PK
  token_digest           text
  private_object_key     text unique
  expected_content_type  image/jpeg | image/png | image/webp
  expected_bytes         integer 1..20MB
  expected_content_md5   text
  expected_sha256        text
  expected_width         integer
  expected_height        integer
  status                 AWAITING_UPLOAD | VALIDATING | COMPLETED |
                         CONSUMED | FAILED | CANCELLED | EXPIRED
  asset_id               text | null FK assets
  failure_code           text | null
  failure_stage          text | null
  version                integer > 0
  created_at             integer
  expires_at             integer
  completed_at           integer | null
  consumed_at            integer | null
  updated_at             integer
```

约束：

- TTL ≤ 10 分钟；
- COMPLETED 必须有 READY asset；
- CONSUMED 只能由 submission 创建事务产生；
- CONSUMED 不能重试或再次绑定；
- 过期、失败、取消、未消费对象进入匿名专用清理；
- 不保存 IP、UA、Referer 或表单字段；
- failure code/stage 尽量复用现有上传错误集合。

OSS CORS 不进入持久模型或 Schema 门禁。当前运维目标继续为 `AllowedOrigin=*`；应用层 Origin 校验仍在公开 API 路由完成。

## 7. `site_content` 与官方渠道

### 7.1 保留字段

```text
hero_tagline
contact_email
official_channels_json
commission_intro
commission_estimate_note
commission_email_action
about_studio_facts
about_making_scope
basic_terms
privacy_policy
contact_anti_scam
hero_auto_rotate
hero_auto_rotate_interval_ms
现有保留分区版本
```

`commission_faq_json` 与 `commission_faq_version` 已由前向迁移 `0040_r3_e_commission_contract.sql` 从目标 Schema 删除；新页面、DTO、管理端、service 与测试均不再读写 FAQ。`commission_email_action` 仍是保留字段，不得与 FAQ 一并删除。

### 7.2 `official_channels_json` 目标结构

目标数组恰好两项，固定顺序：

```text
[
  { platform: 'qq',       account, qrCodeAssetId },
  { platform: 'qq_group', account, qrCodeAssetId }
]
```

约束：

- platform 只允许 `qq | qq_group`；
- 两项均必须存在且顺序固定；
- account 与二维码完整性继续使用 contact 分区版本和 READY `contact_qr` 投影；
- 邮箱不进入数组，继续使用 `contact_email`；
- 公开 DTO 只返回两项完整渠道；
- 管理端只显示两行；
- `/about` 显示邮箱、QQ、QQ群；`/commission` 显示 QQ、QQ群。

第一阶段删除/收缩：

```text
CONTACT_PLATFORMS: douyin
CONTACT_PLATFORMS: xiaohongshu
CONTACT_PLATFORMS: bilibili
contact_douyin legacy column and readers
三个平台的账号/二维码 JSON 项
三个平台失去引用的 contact_qr 资产与派生
```

`contact_qq` 兼容列不在本轮强制删除；它可以作为迁移读取源，但新写入权威仍是两项 `official_channels_json`。

## 8. 领养状态迁移

Expand migration 新增 nullable `adoption_status`。

自动映射：

```text
old available -> available
old delivered -> adopted
```

下列值保持 NULL 并进入人工复核：

```text
preparing
scheduled
in_production
event_sale
NULL
其它异常值
```

最终 contract 条件：

- adoption_status NULL 数量为 0；
- 每条由景宸明确确认；
- 非 adoption 的 status 为 NULL；
- 不把歧义行默认为 available。

## 9. 公开 DTO

### 9.1 作品摘要

```text
PublicWorkSummary
  work
    id
    slug
    characterName
    species
  href
  card
```

### 9.2 作品详情

```text
PublicWorkDetail
  work
    id
    slug
    characterName
    species
  href
  media
    primaryAssetId
    card
    gallery[]
    designSheet?
  navigation
  related[]
```

不返回内部 purpose、价格、adoption status 或旧字段。

### 9.3 领养

```text
PublicAdoptionListItem
  work
    id
    slug
    characterName
    species
    adoptionStatus
    price?
  href
  cover
```

不包含 method、event、suit、owner、tags 或 design sheet as card。

### 9.4 官方渠道

```text
PublicOfficialChannel
  platform       qq | qq_group
  account
  qrCodeSources
```

不允许 `douyin | xiaohongshu | bilibili` 出现在公开或管理 DTO。

## 10. analytics

第一阶段：

- 删除历史 `returns`、`return_character`、`updates` 行；
- 删除 route/entity 枚举；
- 不再接收对应事件。

委托：

- 可以新增 `commission_apply` page view；
- 不记录提交成功业务事件、receipt、submission ID 或任何字段值。

## 11. 第一阶段永久退役/收缩模型

第一阶段最终 Schema 中消失：

```text
updates
return_characters
return_photos
assets.role = return_photo
upload_sessions.owner_type = return
asset_variants.usage = return-wall
asset_variants.recipe_version = return-display-v1
publication_operations.entity_type = RETURN_PHOTO
analytics returns | return_character | updates
contact platform = douyin | xiaohongshu | bilibili
contact_douyin legacy column
```

后续作品 contract 再删除：

```text
work_feature_tags
suit_type
owner_display
owner_contact
adoption_method
business_status
event_name
event_time
```

这样满足立即退役和联系渠道收缩，又避免把返图清理与全部作品重构强绑成一次停机。

## 12. 实施后回填

- 实际迁移文件名和顺序：`0035_r3_a_brand.sql` 先更新旧默认 slogan；`0036_r3_a_contract.sql` 再在对象清理成功标记后删除退役关系并重建目标约束；
- collection/owner context 实际字符串；
- 实际索引和 CHECK；
- 退役脱敏计数；
- 三类取消平台账号/二维码引用和资产清理计数；
- adoption 歧义状态人工确认数量；
- 补齐 cover 数量；
- DTO 与 route 文件路径；
- 净化备份恢复结果。

2026-08-15 T05 回填：复杂旧库与测试对象演练目标计数为 private original 2、private preprocess 2、private preview 0、public derived 3、pending reference 2；历史返图模型没有独立持久 private-preview 类型，因此该项明确验证为零。Contract 后新净化备份已真实恢复到新路径，验证成功后才删除演练目录中的旧应用备份。

2026-08-16 T06 回填：清理成功标记只在最终对象/version/delete-marker 零残留盘点及 ESA URL 404/410 验证后幂等写入；应用备份域同时覆盖生产 `/app/backups` 与数据库同目录 `backups/`。独立 Reviewer 对修复后 `3e0efa7` 结论为 PASS。
