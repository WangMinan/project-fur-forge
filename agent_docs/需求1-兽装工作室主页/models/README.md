# 数据模型与投影

> **角色**：描述当前 P0 领域模型、阶段 C.1 目标迁移和跨层不变量。
> **边界**：本文件不重复页面文案和媒体位置矩阵；功能规则见 [`../requirements/SPEC.md`](../requirements/SPEC.md)，媒体规则见 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。

## 1. 模型原则

- SQLite 是 P0 唯一业务事实源；
- 私有对象和公开对象都必须有数据库身份，不能只靠 Object Key 推断；
- 管理 DTO 可以包含受控私有元数据，但不返回私有 Key；
- 公开 DTO 只包含已发布、可公开字段和公开衍生图；
- 所有可并发修改的资源使用显式版本；
- 外部 OSS 副作用通过持久操作记录与数据库状态收敛；
- 迁移只向前增加或严格重建，不手工修改历史迁移。

## 2. 当前核心实体

### 2.1 `users`

唯一管理员：

- `id`；
- `username`；
- `password_hash`；
- `session_version`；
- 失败次数和锁定时间；
- `active`；
- `version`；
- 密码变更时间。

不引入角色表和多管理员关系。

### 2.2 `works`

保存作品事实和发布状态：

- 基础字段：slug、角色名、物种、装型、用途；
- 公开主人显示和私有联系人；
- 常规领养或历史展会字段；
- 人民币最小单位价格；
- `draft | published | unpublished`；
- 排序、精选和版本。

`work_feature_tags` 以作品 ID、位置为复合主键，限制数量和重复值。

### 2.3 `assets`

永久媒体资产：

- 私有 Object Key；
- SHA-256、字节数、MIME、尺寸和 EXIF；
- 角色；
- 状态；
- 默认焦点、fit 和历史锚点；
- 版本和安全内部失败码。

资产记录只代表永久源，不代表任一公开展示位置。

### 2.4 `work_assets`

连接作品和资产，保存：

- `design_sheet | studio_photo`；
- 位置；
- 主图；
- alt；
- 焦点和裁剪；
- 历史水印锚点。

同一资产不得同时绑定多个作品或多个角色。

### 2.5 `upload_sessions`

上传会话与永久资产分离：

- 归属和归属版本；
- 媒体角色；
- 声明的 MIME、摘要、尺寸和字节数；
- 私有会话对象；
- 有效期、状态、失败阶段和版本；
- 完成后引用资产 ID。

会话重试创建新会话和新 Key，不原位修改身份。

### 2.6 `asset_variants`

记录私有处理源和公开衍生图：

- 输入资产和可选源变体；
- 存储范围；
- Object Key；
- 输入摘要；
- 媒体角色、用途、宽高、格式、质量和裁剪身份；
- 配方版本；
- 水印 profile、Logo、位置、透明度和缩放；
- 输出摘要、字节数和状态。

当前表把所有公开变体都绑定到某类水印身份。阶段 C.1 必须增加明确的无水印公开表达。

### 2.7 `watermark_profiles` 与 `site_branding`

`watermark_profiles` 是不可变配置：

- profile 名；
- Logo 源资产；
- Logo 和配置摘要；
- 固定中心位置；
- 不透明度、缩放；
- 状态和版本。

`site_branding` 只指向当前活动 profile 和管理草稿状态。profile 应用失败时，活动引用保持旧值。

### 2.8 `site_content`

当前保存：

- 首页口号、轮播设置和联系方式；
- 委托固定文案与 FAQ；
- 关于内容；
- 服务条款和隐私政策；
- 防诈骗提示；
- 全局版本。

当前全局版本使多个 Card 相互耦合，阶段 C.1 必须拆分分区版本和局部更新。

### 2.9 `business_statuses`

按 `commission | adoption` 独立保存：

- tone；
- label；
- detail；
- 固定公开 href；
- 版本。

### 2.10 `site_hero_slides`

保存首页和委托页大图集合：

- placement；
- 横版和竖版资产；
- alt；
- 排序、启用状态；
- 可选已发布作品关联；
- 管理预览对象和过期时间；
- 版本。

首页至少保留 1 项启用；委托页允许 0 项。

### 2.11 `publication_operations`

当前统一记录作品、Hero 和部分媒体操作：

- 操作类型、实体类型和实体 ID；
- 请求版本；
- 状态；
- 失败阶段、失败码和清理对象；
- 版本和时间。

当前缺少 lease、心跳和重启恢复字段。

### 2.12 `audit_logs`

记录管理员成功或失败的安全动作，只保存必要身份和结果，不保存敏感正文、凭据或 Object Key。

## 3. C.1 目标迁移

### 3.1 公开保护模式

在 `asset_variants` 增加：

```text
protection_mode TEXT NOT NULL
  CHECK protection_mode IN ('none', 'watermark')
```

目标约束：

#### `protection_mode = 'none'`

- 只允许 `storage_scope = 'PUBLIC'` 的站点展示用途，或明确允许的非保护公开用途；
- `watermark_profile_id IS NULL`；
- `watermark_config_digest = 'none'`；
- `logo_digest = 'none'`；
- `watermark_anchor = 'none'`；
- 不透明度和缩放为 NULL；
- `recipe_version = 'site-display-v1'` 或后续同类版本。

#### `protection_mode = 'watermark'`

- 必须关联不可变 profile；
- 配置摘要、Logo 摘要、中心位置、不透明度和缩放完整；
- 当前作品公开配方使用 `recipe-v2` 与 `brand-centered-v2`。

私有 preprocess 记录使用 `storage_scope = 'PRIVATE'`，保护模式可以为独立值 `internal`，或允许 `none` 但必须由存储范围与 usage 严格限制；迁移实现时选择一种无歧义表达并写数据库 CHECK。

### 3.2 新用途

目标 usage 至少包含：

```text
work-card
detail
design-sheet
home-hero-landscape
home-hero-portrait
commission-hero-landscape
commission-hero-portrait
home-entry-commission
home-entry-adoption
preprocess
```

首页两个入口的变体身份与 Hero、作品卡片、设定图完全分离。

### 3.3 站点内容分区版本

在 `site_content` 增加：

```text
commission_content_version
commission_faq_version
about_content_version
legal_content_version
contact_content_version
```

保留现有 `version` 作为首页 Hero/站点基础设置的兼容版本，逐步把联系方式从 Hero 设置接口迁移到 contact 分区。

每个分区 UPDATE 只修改对应列，并以对应版本作为 WHERE 条件。

### 3.4 FAQ 稳定身份

FAQ 从纯数组对象迁移为：

```text
id
question
answer
position
```

可以继续存 JSON，但每项必须有 UUID；更推荐独立 `commission_faqs` 表，以避免整段 JSON 覆盖和便于顺序约束。实现者应优先独立表，除非迁移复杂度显著增加且局部版本 JSON 已能满足并发边界。

### 3.5 操作恢复字段

`publication_operations` 增加：

```text
attempt INTEGER NOT NULL DEFAULT 0
lease_owner TEXT NULL
lease_expires_at INTEGER NULL
heartbeat_at INTEGER NULL
recovery_reason TEXT NULL
```

约束：

- 终止状态不得保留有效 lease；
- 运行状态必须有 lease 和过期时间；
- attempt 非负；
- heartbeat 不得早于 started_at；
- 重试递增 attempt 和版本；
- operation 类型与实体类型组合受 CHECK 约束。

必要时增加 `operation_steps`，记录每个外部副作用的幂等身份和结果；P0 可以先复用现有 variant 表与 cleanup manifest，只要重启恢复测试能证明收敛。

## 4. 投影模型

### 4.1 管理作品 DTO

允许包含：

- 作品全部事实；
- 私有联系人；
- 媒体资产 ID、尺寸、状态和公开变体计数；
- 发布检查和操作状态。

不得包含：

- AK/SK；
- 私有 Object Key；
- 可长期复用的签名 URL；
- 密码或 Session。

私有预览通过受保护流式接口返回，不在 JSON 中给对象路径。

### 4.2 公开作品 DTO

只包含：

- 公开作品事实；
- `ownerContact = null` 或省略；
- 公开 href；
- 完整公开 SourceSet；
- 前后导航和相关作品。

SourceSet 必须全部来自 `protection_mode = 'watermark'` 且匹配活动 profile 的完整集合。

### 4.3 首页聚合 DTO

目标 DTO：

```text
hero
featuredWorks
businessEntries
currentAdoptions
```

`businessEntries` 每项包含：

```text
kind
href
title
status
summary
image
```

其中 `image` 只来自 `protection_mode = 'none'` 的独立入口 usage。

首页聚合服务在同一数据库快照内加载作品、状态和媒体，避免页面分别调用多个公开接口重复构建快照。原有独立 API 可以在兼容期保留，但页面最终只消费聚合 DTO。

### 4.4 Hero DTO

首页和委托 Hero SourceSet 只接受：

- 对应 placement 的 usage；
- `site-display-v1`；
- `protection_mode = 'none'`；
- 完整 WebP/fallback 宽度集合；
- 有效摘要和字节数。

不再依赖活动水印 profile ID。

## 5. 核心不变量

### 5.1 私有/公开

- `assets.private_object_key` 永不进入公开 DTO；
- 公开 Object Key 只能来自 `asset_variants.storage_scope = 'PUBLIC'`；
- 私有 Bucket 匿名访问失败；
- 公开 Bucket 不包含永久原图和 Logo 源。

### 5.2 媒体完整性

- 同一公开身份最多一个 READY 记录；
- READY 记录必须有有效摘要和正字节数；
- 同一宽度至少有 WebP 和一个 fallback；
- 站点展示与作品保护不可通过同一 usage 或同一保护模式混用；
- profile 切换不改变无水印变体引用。

### 5.3 并发

- 作品、Hero、内容 Card、营业状态、profile 和操作都使用版本；
- 更新失败不得猜测新版本；
- 一个内容 Card 的保存不能修改其他 Card 的列；
- 一个运行操作只能被一个未过期 lease owner 执行。

### 5.4 发布

- 业务状态只在公开对象完整验证后提交；
- 清理失败保留精确 manifest；
- 重启后通过幂等核对得出唯一终态；
- 旧公开版本在新版本完整前持续可用。

## 6. 索引建议

阶段 C.1 核对并补充：

- `asset_variants(asset_id, usage, recipe_version, protection_mode, status, width, format)`；
- `asset_variants(watermark_profile_id, status)`；
- `site_hero_slides(placement, enabled, sort_order)`；
- `publication_operations(status, lease_expires_at)`；
- `upload_sessions(status, expires_at)`；
- `works(publication_status, sort_order)`；
- FAQ 独立表时 `(position)` 和唯一 ID。

索引必须根据实际查询计划验证，不为文档中的每个字段机械建索引。

## 7. 迁移验证

每次迁移必须：

1. 校验历史 migration hash；
2. 对已有数据库在线备份；
3. 在副本执行迁移；
4. `integrity_check = ok`；
5. `foreign_key_check = 0`；
6. 旧作品、媒体、Hero、内容和活动 profile 数量一致；
7. 公开投影在兼容模式下可读；
8. 新无水印变体生成后切换；
9. 新分区版本不覆盖原文案；
10. 恢复库能通过 production readiness。

## 8. 后续模型边界

T35 以后可以新增返图、授权、展会和回收站实体。阶段 C.1 不在现有表中预埋通用 JSON 模型，也不为了未来功能削弱当前约束。
