# 数据模型规划

> **角色**：记录需求3的目标持久模型、公开/管理投影和退役对象；实现后回填实际迁移、表名和约束。
> **状态**：目标模型已锁定，代码尚未实施。
> **基线**：当前实现以 `server/database/schema.ts`、`shared/schemas/*` 和 `server/utils/repository/*` 为准；本文件描述 contract migration 完成后的目标状态。

## 1. 模型总览

需求3完成后，核心数据域只有：

- 唯一管理员与认证；
- 简化作品及其图片；
- 首页/委托页独立横竖 Hero；
- 站点内容、官方渠道与水印；
- 委托申请及其私有设定图；
- 最小第一方访问统计；
- 现有部署、备份和持久 operation 基础设施。

返图和最新动态不再是任何形式的活模型或归档模型。

## 2. `works` 目标模型

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

- `purpose != adoption` 时 `adoption_status`、价格两列必须为空；
- `purpose = adoption` 时 `adoption_status` 必填；
- 价格为空时 amount/currency 必须同时为空；存在时必须为正数 CNY；
- `sort_order` 只服务首页精选，不作为 `/works` 或 `/adoptions` 默认排序；
- 已发布事实字段继续要求先下架再编辑。

从目标模型物理删除：

```text
suit_type
adoption_method
business_status
owner_display
owner_contact
event_name
event_time
```

`work_feature_tags` 整表删除，公开/管理 DTO 也不再出现 `featureTags`。

## 3. 作品媒体

### 3.1 `assets.role`

需求3完成后的相关角色：

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

`return_photo` 永久删除。

### 3.2 `work_assets.role`

```text
design_sheet    每件作品 0..1，position=0，contain
studio_photo    每件作品 0..5，恰好一张 primary，作品主图与图集
adoption_cover  adoption 作品 0..1，position=0，横版单头成果图
```

发布资格：

- commission/showcase：至少一张 READY 主 `studio_photo`；
- adoption：至少一张 READY 主 `studio_photo`，同时恰好一张 READY `adoption_cover`；
- `design_sheet` 永远可选，不参与发布门禁。

### 3.3 公开 usage

```text
work-card          3:4，studio_photo primary，公开水印
work-detail        原比例或既有详情规则，studio_photo，公开水印
design-sheet       contain，design_sheet，公开水印
adoption-card      横版，adoption_cover，公开水印
```

`return-wall` 和 `return-display-v1` 永久删除。

## 4. Hero 目标模型

旧 `site_hero_slides` 的“横竖一对”心智被替换为 orientation 独立记录：

```text
site_hero_items
  id                 text PK
  placement          home | commission
  orientation        landscape | portrait
  asset_id            text FK assets
  alt_text            text
  sort_order          integer >= 0
  enabled             boolean
  preview_object_key  text | null
  preview_expires_at  integer | null
  version              integer > 0
  created_at           integer
  updated_at           integer
```

约束：

- `orientation=landscape` 只能引用 `home_hero_landscape`；
- `orientation=portrait` 只能引用 `home_hero_portrait`；
- 每个 `(placement, orientation)` 最多 5 条 enabled；
- enabled 项的 `(placement, orientation, sort_order)` 唯一且连续为 `0..n-1`；
- `home` 和 `commission` 分别维护；
- 不再保存 `linked_work_id`；
- 首页公开就绪要求 home/landscape 与 home/portrait 各至少一条 enabled；
- 委托页公开 Hero 要求 commission/landscape 与 commission/portrait 各至少一条 enabled。

### 4.1 管理 DTO

```text
AdminHeroCollection
  placement
  orientation
  version
  items[]
    id
    version
    alt
    sortOrder
    enabled
    asset { assetId, width, height }
    upscaleReady
    missingVariantCount
    publicationOperation
```

### 4.2 公开 DTO

```text
PublicHeroPlacement
  landscape[] PublicHeroItem
  portrait[]  PublicHeroItem

PublicHeroItem
  id
  alt
  sources
```

首页 DTO 额外包含 slogan、固定自动轮播契约和业务入口；不再包含 linked work href 或 Hero action。

## 5. 委托申请模型

### 5.1 `commission_submissions`

```text
commission_submissions
  id                  text PK
  receipt_code        text unique
  nickname            text
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

- nickname 去空白后 1–50 字；
- phone 固定 `+86`，号码符合中国大陆 11 位手机号；
- QQ 为 5–12 位非零开头数字；
- `height_cm` 在 80–250；
- `weight_kg_tenths` 在 200–3000，对外 DTO 转为一位小数公斤；
- `design_asset_id` 必须引用 READY `commission_design_reference`；
- 一个私有设定图只能绑定一条申请；
- `pending` 时 handled 字段必须为空；accepted/rejected 时写处理时间和管理员；
- 状态回到 pending 时清空 handled 字段；
- `receipt_code` 只用于提交成功提示，不提供公开查询能力。

### 5.2 管理列表 DTO

列表只返回：

```text
id
receiptCode
nickname
status
createdAt
version
```

手机号、QQ、身高、体重、内部备注和图片只进入详情 DTO。

### 5.3 管理详情 DTO

```text
id
receiptCode
nickname
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

预览 href 是认证、短时、`no-store` 路由，不是 OSS 永久签名 URL。

## 6. 匿名上传会话

现有 `upload_sessions` 继续只服务管理员归属，不能移除 `created_by` 或放宽 owner 类型。匿名委托使用独立表和路由，但复用已有摘要、MIME、尺寸、OSS 条件 PUT、图片校验和清理函数。

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
  status                 awaiting_upload | validating | completed | consumed | failed | expired
  asset_id               text | null FK assets
  failure_code           text | null
  created_at             integer
  expires_at             integer
  completed_at           integer | null
  consumed_at            integer | null
  updated_at             integer
```

约束：

- TTL 不超过 10 分钟；
- completed 时必须有 READY asset；
- consumed 只能由一次事务性 submission 创建产生；
- consumed 后不能重试或再次绑定；
- 过期、失败和未消费对象进入匿名专用清理分支；
- 表不保存 IP、UA、Referer、手机号、QQ 或表单草稿。

## 7. `site_content` 目标收缩

继续保留：

```text
hero_tagline
contact_email
official_channels_json
commission_intro
commission_estimate_note
about_studio_facts
about_making_scope
basic_terms
privacy_policy
contact_anti_scam
hero_auto_rotate
hero_auto_rotate_interval_ms
各保留分区的 version
```

永久删除：

```text
commission_email_action
commission_faq_json
commission_faq_version
旧 contact_qq/contact_douyin 兼容列（若迁移确认已无读取者）
```

contact 官方渠道继续使用需求2的五平台数组；`/commission` 只选取 QQ 和 QQ群公开卡，`/about` 显示全部完整渠道。

## 8. 领养公开投影

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
    assetId
    alt
    sources
```

不再包含：

```text
suitType
ownerDisplay
featureTags
adoptionMethod
businessStatus
eventName
eventTime
designSheet as card
```

列表响应不再包含 `method` filter 或 regular/event_drop counts，只保留名称搜索、分页和结果计数。

## 9. 作品公开投影

### 9.1 列表摘要

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

### 9.2 详情

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
  related[] PublicWorkSummary
```

普通作品公开投影不返回内部 purpose、价格、adoption 状态或任何已删除字段。

## 10. 永久退役模型

以下表、字段、枚举和媒体身份必须从最终 Schema 中消失：

```text
updates
return_characters
return_photos
work_feature_tags
assets.role = return_photo
upload_sessions.owner_type = return
asset_variants.usage = return-wall
asset_variants.recipe_version = return-display-v1
publication_operations.entity_type = RETURN_PHOTO
analytics route keys returns | return_character | updates
adoption_method
business_status 旧集合
event_name
event_time
suit_type
owner_display
owner_contact
commission_faq_json
commission_faq_version
commission_email_action
```

与它们有关的行必须先清理，再通过 SQLite 表重建收紧 CHECK 约束。

## 11. 迁移后回填要求

实现完成后本文件必须补充：

- 实际迁移文件名和顺序；
- 实际新表名、索引名和 CHECK；
- 旧数据映射数量；
- 补齐 adoption cover 的作品数量；
- 本地与生产永久删除的脱敏计数；
- 最终 DTO 文件路径；
- 任何与本规划不同但经用户批准的变更。
