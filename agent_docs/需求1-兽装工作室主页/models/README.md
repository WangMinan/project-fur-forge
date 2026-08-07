# 数据模型与投影

> **角色**：描述当前已落地领域模型、跨层不变量和阶段 D 的目标模型。
> **最后校准**：2026-08-07。
> **边界**：功能规则见 [`../requirements/SPEC.md`](../requirements/SPEC.md)，媒体规则见 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。

## 1. 模型原则

- SQLite 是当前唯一业务事实源；
- 私有对象和公开对象都有数据库身份，不能只靠 Object Key 推断；
- 管理 DTO 可以包含受控私有元数据，但不返回私有 Key；
- 公开 DTO 只包含已发布、可公开字段和 READY 公开衍生图；
- 所有可并发修改的资源使用显式版本；
- 外部 OSS 副作用通过持久 operation 与数据库状态收敛；
- 迁移只向前增加或严格重建，不手工修改已执行历史迁移；
- 新功能使用明确领域实体和媒体角色，不预埋万能 JSON、通用 CMS、通用重定向或通用软删除模型。

## 2. 当前核心实体

### 2.1 `users`

唯一管理员：`id`、`username`、`password_hash`、`session_version`、失败次数、锁定时间、`active`、`version` 和密码变更时间。不引入角色表和多管理员关系。

### 2.2 `works`

保存作品事实和发布状态：

- slug、角色名、物种、装型和用途；
- 公开主人显示和私有联系人；
- 领养方式、领养状态和人民币最小单位价格；
- `draft | published | unpublished`；
- 排序、精选和版本。

底层 purpose 保持：

```text
commission
adoption
showcase
```

领养方式保持：

```text
regular
event_drop
```

管理端四个业务选项只做映射，不增加 `purpose=drop`。

`work_feature_tags` 以作品 ID、位置为复合身份，限制数量和重复值。

### 2.3 `assets`

永久媒体资产保存私有 Object Key、SHA-256、字节数、MIME、尺寸、EXIF、媒体角色、状态、默认焦点/fit、版本和安全内部失败码。

资产记录只代表永久源，不代表任一公开展示位置。私有 Key 不进入公开 DTO、HTML 或日志。

### 2.4 `work_assets`

连接作品和资产，保存：

- `design_sheet | studio_photo`；
- 位置；
- 主图；
- alt；
- 焦点和裁剪；
- 历史水印锚点。

同一资产不得同时绑定多个作品或多个角色。返图不进入该关系，不使用 `studio_photo` 冒充返图。

### 2.5 `upload_sessions`

上传会话与永久资产分离，保存归属、归属版本、媒体角色、声明 MIME/摘要/尺寸/字节数、私有会话对象、有效期、状态、失败阶段、版本和完成后的资产 ID。

会话重试创建新会话和新 Key，不原位覆盖。过期会话由主动清扫命令处理。

### 2.6 `asset_variants`

记录私有处理源和公开衍生图：

- 输入资产和可选源变体；
- 存储范围和 Object Key；
- 输入摘要；
- 媒体角色、用途、宽高、格式、质量和裁剪身份；
- 配方版本与保护模式；
- 水印 profile、Logo、位置、透明度和缩放；
- 输出摘要、字节数和状态。

当前保护模式：

#### `protection_mode = 'none'`

- 只允许明确的无水印公开用途；
- 不关联 watermark profile；
- 水印摘要、Logo、位置和参数使用无水印约定；
- 当前已落地 `site-display-v1`；阶段 D 增加 `return-display-v1`。

#### `protection_mode = 'watermark'`

- 必须关联不可变 profile；
- 配置摘要、Logo 摘要、中心位置、不透明度和缩放完整；
- 作品、常规领养与展会掉落使用当前 `recipe-v2` 和活动 `brand-centered-v2`。

私有 preprocess 由存储范围和受限 usage 隔离，不能被公开查询选中。

### 2.7 `watermark_profiles` 与 `site_branding`

`watermark_profiles` 保存不可变 Logo 和几何参数；`site_branding` 指向当前活动 profile 和管理草稿状态。profile 应用失败时活动引用保持旧值。

无水印站点展示和返图变体不依赖活动 profile，profile 切换不得改变它们的 URL、摘要或内容。

### 2.8 `site_content`、FAQ 与 `business_statuses`

当前内容按首页基础设置、委托基础文案、委托 FAQ、关于与制作范围、服务条款/隐私政策、官方联系方式/防诈骗提示分区维护，并有独立版本。FAQ 使用稳定 ID。

`business_statuses` 只按 `commission | adoption` 保存 tone、label、detail、固定公开 href 和版本。展会掉落复用 adoption 营业状态，不增加 `event` 营业状态。

### 2.9 `site_hero_slides`

保存首页与委托 placement 的横竖资产、alt、排序、启用状态、可选作品关联、预览状态和版本。公开 SourceSet 使用对应的 `site-display-v1` 无水印变体。

### 2.10 operation 与审计

publication、watermark 和 reconcile operation 已具备请求版本、状态、进度、失败阶段、稳定失败码、精确清理对象、attempt、lease、heartbeat、recovery reason、必要重试时间、版本和时间。

返图发布复用同一 operation 模型，不新建第二套任务状态机。展会掉落复用作品 publication operation，不增加展会 operation。

`audit_logs` 只记录必要安全动作和结果，不保存敏感正文、凭据、私有 Key、联系人或返图授权记录正文。

## 3. 阶段 D 目标模型

### 3.1 `return_photos`

一张返图对应一行：

```text
id
work_id
asset_id
alt
sort_order
publication_status
authorization_source        nullable
authorization_confirmed_at  nullable
authorization_note          nullable
version
created_at
updated_at
published_at                nullable
```

目标约束：

- `work_id` 外键引用 `works`；
- `asset_id` 外键引用 `assets`，媒体角色必须为 `return_photo`；
- 一张资产最多属于一条返图；
- 每条返图恰好一张资产，不引入相册；
- alt 非空；
- `publication_status IN ('draft','published','unpublished')`；
- `sort_order` 有稳定默认值和索引；
- published 返图的关联作品必须为 published；
- 授权字段可以全部为空，且永不进入公开投影；
- 版本非负，更新使用条件 UPDATE。

如果 SQLite 外键无法直接表达“资产角色必须是 return_photo”或“关联作品必须已发布”，由 service 与事务内条件更新共同保证，并以集成测试证明。

不增加 `return_assets` 多图关系、`return_albums`、返图 slug、返图详情或返图者账户。

### 3.2 `works` 的轻量展会字段

阶段 D 增加或启用：

```text
event_name TEXT NULL
event_time TEXT NULL
```

目标 CHECK：

```text
adoption_method = 'event_drop'
  -> event_name 非空 AND event_time 非空
adoption_method != 'event_drop' 或 purpose != 'adoption'
  -> event_name IS NULL AND event_time IS NULL
```

`event_time` 是展示文本，不是调度时间；不用于自动状态变化、定时任务或排序。切换离开展会掉落时必须清理两项字段，不能保留僵尸值。

不增加：

- `events`；
- `event_works`；
- 展会 slug、封面、地点、摊位、主办方或归档；
- “当前展会”全局记录。

未来只有出现多作品统一编辑、独立展会页或跨届历史需求时，才从轻量字段迁移到独立模型。

## 4. 阶段 D 媒体用途

当前 usage 基线：

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

阶段 D 增加：

```text
return-wall
```

返图目标身份：

```text
media_role = return_photo
usage = return-wall
recipe_version = return-display-v1
protection_mode = none
watermark_profile_id = NULL
```

返图公开变体保持原比例、去除不需要的 EXIF，并提供 READY WebP/fallback SourceSet。它不随活动 profile 切换。

展会掉落不新增媒体角色或 usage，继续使用 `design-sheet`、`work-card` 和 `detail` 的作品水印变体。

## 5. 投影模型

### 5.1 管理作品 DTO

包含作品全部事实、私有联系人、领养方式、展会名称/时间、媒体摘要、发布检查和 operation 状态。不得包含 AK/SK、私有 Object Key、长期签名 URL、密码或 Session。

### 5.2 公开作品 DTO

只包含公开作品事实、公开 SourceSet、前后导航和相关作品。event_drop 额外包含 `eventName`、`eventTime`；其他作品不返回或固定为空。

作品 SourceSet 全部来自 `protection_mode=watermark` 且匹配活动 profile 的完整集合。

### 5.3 管理返图 DTO

允许包含：

- 返图事实、版本和状态；
- 关联作品管理摘要；
- 资产 ID、尺寸、状态和受控私有预览；
- 可选授权来源、确认时间和备注；
- 公开变体摘要和 publication operation。

不返回私有 Object Key或可长期复用签名 URL。

### 5.4 公开返图 DTO

只包含：

```text
id
image SourceSet + width + height + alt
work { name, slug, href }
```

只查询：

- 返图为 published；
- 关联作品为 published；
- `return-wall` 变体完整 READY；
- `protection_mode=none`；
- `recipe_version=return-display-v1`。

不包含授权记录、返图者昵称、主页、私有联系人、原文件名、私有 Key、签名 URL 或 EXIF。

### 5.5 首页与领养投影

首页当前领养和 `/adoptions` 同时允许 regular 与 event_drop。event_drop 投影包含展会名称和时间。首页不新增独立当前展会区块。

## 6. 核心不变量

### 6.1 私有/公开

- `assets.private_object_key` 永不进入公开 DTO；
- 公开 Object Key 只来自 `asset_variants.storage_scope='PUBLIC'`；
- 私有 Bucket 匿名访问失败；
- 公开 Bucket 不包含永久原图、处理源或 Logo 源；
- 返图授权记录只进入受认证管理 DTO；
- 返图公开文件不包含敏感 EXIF。

### 6.2 媒体完整性

- 同一公开身份最多一个 READY 记录；
- READY 记录有有效摘要和正字节数；
- 同一宽度至少有 WebP 和一个 fallback；
- 站点展示、返图和作品保护具有不同 usage/配方/保护模式；
- profile 切换不改变无水印站点和返图引用；
- 新公开用途先写入媒体策略和严格枚举。

### 6.3 并发与发布

- 作品、返图、Hero、内容 Card、营业状态、profile 和 operation 使用版本；
- 更新失败不得猜测新版本；
- 一个运行 operation 只能被一个未过期 lease owner 执行；
- 业务状态只在公开对象完整验证后提交；
- 清理失败保留精确 manifest；
- 重启后通过幂等核对收敛；
- 旧公开版本在新版本完整前持续可用。

### 6.4 关联生命周期

- 返图必须关联作品；
- 作品未发布时返图不可公开；
- 作品下架不删除返图原图或记录，只使公开查询隐藏；
- 存在返图关联时阻止作品永久删除；
- 不以通用回收站解决关联生命周期。

## 7. 索引建议

阶段 D 核对：

- `return_photos(publication_status, sort_order, id)`；
- `return_photos(work_id, publication_status)`；
- `return_photos(asset_id)` 唯一；
- `asset_variants(asset_id, usage, recipe_version, protection_mode, status, width, format)`；
- `works(purpose, adoption_method, publication_status, sort_order)`；
- operation 的 `(status, lease_expires_at)`；
- `upload_sessions(status, expires_at)`。

索引必须根据实际查询计划验证，不机械覆盖每个字段。

## 8. 迁移验证

每次新迁移必须：

1. 校验历史 migration hash；
2. 对已有数据库创建验证备份；
3. 在副本执行迁移；
4. `integrity_check = ok`；
5. `foreign_key_check = 0`；
6. 既有作品、媒体、Hero、内容和活动 profile 数量符合预期；
7. 旧公开投影继续可读；
8. event_drop 历史兼容记录有明确迁移结果；
9. 恢复库能通过 production readiness。

## 9. 明确不建的模型

阶段 D 不新增：

- 通用页面树或任意内容 JSON；
- 通用 slug 重定向表；
- 所有实体统一 `deleted_at`、回收站或到期清理调度；
- 独立展会实体和关系表；
- 返图相册、返图者账户、点赞或评论表。

当前版本取消的功能不保留僵尸字段。未来候选只有在提升到 SPEC、PLAN、TASKS 后才能进入模型。