# 数据模型与投影

> **角色**：描述当前已落地领域模型、跨层不变量和阶段 D 的模型边界。
> **最后校准**：2026-08-07。
> **边界**：本文件不重复页面文案和媒体位置矩阵；功能规则见 [`../requirements/SPEC.md`](../requirements/SPEC.md)，媒体规则见 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。

## 1. 模型原则

- SQLite 是当前唯一业务事实源；
- 私有对象和公开对象都有数据库身份，不能只靠 Object Key 推断；
- 管理 DTO 可以包含受控私有元数据，但不返回私有 Key；
- 公开 DTO 只包含已发布、可公开字段和 READY 公开衍生图；
- 所有可并发修改的资源使用显式版本；
- 外部 OSS 副作用通过持久 operation 与数据库状态收敛；
- 迁移只向前增加或严格重建，不手工修改已执行历史迁移；
- 新功能使用明确领域实体和媒体角色，不预埋万能 JSON 或通用 CMS 模型。

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

- slug、角色名、物种、装型和用途；
- 公开主人显示和私有联系人；
- 常规领养或历史展会字段；
- 人民币最小单位价格；
- `draft | published | unpublished`；
- 排序、精选和版本。

`work_feature_tags` 以作品 ID、位置为复合身份，限制数量和重复值。

### 2.3 `assets`

永久媒体资产：

- 私有 Object Key；
- SHA-256、字节数、MIME、尺寸和 EXIF；
- 媒体角色；
- 状态；
- 默认焦点、fit 和历史锚点；
- 版本和安全内部失败码。

资产记录只代表永久源，不代表任一公开展示位置。私有 Key 不进入公开 DTO、HTML 或日志。

### 2.4 `work_assets`

连接作品和资产，保存：

- `design_sheet | studio_photo`；
- 位置；
- 主图；
- alt；
- 焦点和裁剪；
- 历史水印锚点。

同一资产不得同时绑定多个作品或多个角色。阶段 D 的返图不会塞进该关系，而使用独立返图实体和媒体关系。

### 2.5 `upload_sessions`

上传会话与永久资产分离：

- 归属和归属版本；
- 媒体角色；
- 声明的 MIME、摘要、尺寸和字节数；
- 私有会话对象；
- 有效期、状态、失败阶段和版本；
- 完成后引用资产 ID。

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

迁移 0017 已落地明确保护模式：

#### `protection_mode = 'none'`

- 只允许明确的无水印公开站点用途；
- `watermark_profile_id IS NULL`；
- 水印配置、Logo 和锚点身份使用无水印约定；
- 不透明度和缩放为空；
- 当前使用 `site-display-v1` 配方族。

#### `protection_mode = 'watermark'`

- 必须关联不可变 profile；
- 配置摘要、Logo 摘要、中心位置、不透明度和缩放完整；
- 当前作品公开配方使用 `recipe-v2` 与活动 `brand-centered-v2`。

私有 preprocess 由存储范围和受限 usage 明确隔离，不能被公开查询选中。

### 2.7 `watermark_profiles` 与 `site_branding`

`watermark_profiles` 是不可变配置：

- profile 名；
- Logo 源资产；
- Logo 和配置摘要；
- 固定中心位置；
- 不透明度、缩放；
- 状态和版本。

`site_branding` 指向当前活动 profile 和管理草稿状态。profile 应用失败时活动引用保持旧值。无水印站点展示变体不依赖活动 profile。

### 2.8 `site_content` 与 FAQ

当前内容按独立分区维护：

- 首页基础设置；
- 委托基础文案；
- 委托 FAQ；
- 关于与制作范围；
- 服务条款与隐私政策；
- 官方联系方式与防诈骗提示。

迁移已经为分区建立独立版本；每个 Card 只更新自己的列并以自己的版本做条件更新。FAQ 使用稳定 ID，不以数组下标作为持久身份。

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

首页至少保留 1 项启用；委托页允许 0 项。公开 SourceSet 只接受对应 placement 的 `site-display-v1` 无水印变体。

### 2.11 `publication_operations`、水印操作与 reconcile 操作

迁移 0020、0021 已使长任务具备：

- 操作类型、实体类型和实体 ID；
- 请求版本；
- 状态、进度、失败阶段和稳定失败码；
- 精确清理对象；
- `attempt`；
- `lease_owner`、`lease_expires_at`；
- `heartbeat_at`；
- `recovery_reason`；
- 必要的下一次重试时间；
- 版本和时间。

运行态 operation 必须有有效 lease；终态不保留有效 lease。事务内抢占、OSS 前后心跳、提交 CAS、启动扫描和幂等核对保证重启后收敛。

覆盖范围包括作品发布/下架、Hero 发布/适配、水印 profile 应用和站点展示 reconcile。

### 2.12 `site_display_reconcile_operations`

迁移 0021 支持持久、幂等地扫描并补齐：

- 启用首页 Hero；
- 启用委托 Hero；
- 首页委托入口源；
- 首页领养入口源。

失败保留旧公开投影，重复运行命中既有 READY 变体，不制造重复对象。

### 2.13 `audit_logs`

记录管理员成功或失败的安全动作，只保存必要身份和结果，不保存敏感正文、凭据、私有 Object Key、联系人或授权记录正文。

## 3. 当前用途与保护模式

当前 usage 至少包括：

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

首页两个入口、Hero、作品卡片和设定图具有独立身份，不互相复用公开 URL。

站点展示用途必须使用 `protection_mode = 'none'`；作品、领养和详情用途必须使用 `protection_mode = 'watermark'` 且匹配活动 profile。

## 4. 当前投影模型

### 4.1 管理作品 DTO

允许包含：

- 作品全部事实；
- 私有联系人；
- 媒体资产 ID、尺寸、状态和公开变体摘要；
- 发布检查和 operation 状态。

不得包含：

- AK/SK；
- 私有 Object Key；
- 可长期复用的签名 URL；
- 密码或 Session。

私有预览通过受保护流式接口返回，不在 JSON 中提供对象路径。

### 4.2 公开作品 DTO

只包含：

- 公开作品事实；
- `ownerContact = null` 或省略；
- 公开 href；
- 完整公开 SourceSet；
- 前后导航和相关作品。

作品 SourceSet 全部来自 `protection_mode = 'watermark'` 且匹配活动 profile 的完整集合。

### 4.3 首页聚合 DTO

当前聚合结构：

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

其中 `image` 只来自 `protection_mode = 'none'` 的独立入口 usage。聚合服务在同一数据库快照内加载作品、状态和媒体，非关键区块失败可以受控降级。

### 4.4 Hero DTO

首页和委托 Hero SourceSet 只接受：

- 对应 placement 的 usage；
- `site-display-v1`；
- `protection_mode = 'none'`；
- 完整 WebP/fallback 宽度集合；
- 有效摘要和正字节数。

不依赖活动水印 profile ID。

## 5. 核心不变量

### 5.1 私有/公开

- `assets.private_object_key` 永不进入公开 DTO；
- 公开 Object Key 只能来自 `asset_variants.storage_scope = 'PUBLIC'`；
- 私有 Bucket 匿名访问失败；
- 公开 Bucket 不包含永久原图、处理源或 Logo 源；
- 后续返图授权记录只能进入受认证管理 DTO。

### 5.2 媒体完整性

- 同一公开身份最多一个 READY 记录；
- READY 记录有有效摘要和正字节数；
- 同一宽度至少有 WebP 和一个 fallback；
- 站点展示与作品保护不可通过同一 usage 或保护模式混用；
- profile 切换不改变无水印变体引用；
- 新公开用途必须先写入媒体策略和严格枚举。

### 5.3 并发

- 作品、Hero、内容 Card、营业状态、profile 和 operation 都使用版本；
- 更新失败不得猜测新版本；
- 一个内容 Card 的保存不能修改其他 Card 的列；
- 一个运行 operation 只能被一个未过期 lease owner 执行。

### 5.4 发布

- 业务状态只在公开对象完整验证后提交；
- 清理失败保留精确 manifest；
- 重启后通过幂等核对得出唯一终态；
- 旧公开版本在新版本完整前持续可用。

## 6. 当前索引与迁移验证要求

当前重点索引覆盖：

- `asset_variants(asset_id, usage, recipe_version, protection_mode, status, width, format)`；
- `asset_variants(watermark_profile_id, status)`；
- `site_hero_slides(placement, enabled, sort_order)`；
- operation 的 `(status, lease_expires_at)`；
- `upload_sessions(status, expires_at)`；
- `works(publication_status, sort_order)`；
- FAQ 稳定 ID 和顺序。

索引按实际查询计划验证，不为每个字段机械建索引。

每次新迁移必须：

1. 校验历史 migration hash；
2. 对已有数据库创建验证备份；
3. 在副本执行迁移；
4. `integrity_check = ok`；
5. `foreign_key_check = 0`；
6. 既有作品、媒体、Hero、内容和活动 profile 数量符合预期；
7. 兼容公开投影可读；
8. 恢复库能通过 production readiness。

## 7. 阶段 D · T35 目标边界

T35 可以新增返图实体，但当前尚未实施。推荐模型如下，最终以 SPEC 确认为准。

### 7.1 `returns`

一条返图记录建议包含：

- 稳定 UUID；
- 必填 `work_id`；
- 公开标题或短说明；
- 可选公开来源显示名；
- 排序；
- `draft | published | unpublished`；
- 版本和时间。

返图不改变作品自身发布状态。

### 7.2 `return_assets`

独立关联 `return_photo` 资产，保存：

- 返图 ID、资产 ID；
- 位置；
- alt；
- 焦点或裁剪；
- 公开衍生状态。

不得复用 `work_assets.studio_photo` 来冒充返图。

### 7.3 可选授权记录

推荐只在返图管理模型中保存：

- 授权来源或确认渠道，可空；
- 确认时间，可空；
- 内部备注，可空；
- 版本信息。

授权记录不进入公开 DTO、日志或图片元数据。没有填写时是否阻止发布必须由用户明确，不由实现者自行升级为硬门禁。

### 7.4 返图媒体与 operation

- 上传会话新增严格 `return_photo` 角色和返图归属；
- 公开变体使用独立配方和 usage；
- 轻量水印参数写入不可变身份；
- publication operation 复用现有 attempt、lease、heartbeat、恢复和清理模型；
- T40 未确认前不预建全站通用软删除字段。

## 8. 尚未确认的模型

T37 展会、T38 文字扩展、T39 slug 历史、T40 回收站尚未授权。不得提前在当前表中加入：

- 通用页面树或任意内容 JSON；
- 通用重定向规则引擎；
- 所有实体统一 `deleted_at`；
- 未使用的展会关系和状态枚举。

用户取消的候选任务应从后续模型计划中移除，而不是保留僵尸字段。
