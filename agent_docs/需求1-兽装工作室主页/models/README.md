# 数据模型与投影

> **角色**：描述当前已落地模型和已批准的下一步目标模型。
> **最后校准**：2026-08-10。
> **边界**：业务规则见 [`../requirements/SPEC.md`](../requirements/SPEC.md)，媒体规则见 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。所有目标模型在阶段 E 开发并迁移；阶段 F 不新增或修改数据模型。

## 1. 模型原则

- SQLite 是业务事实源；
- 私有/衍生对象都有数据库身份，不能只靠 Object Key；
- 公开 DTO 使用字段白名单；
- 可并发修改资源使用显式版本；
- OSS/ESA 副作用通过持久 operation 收敛；
- 迁移只向前，不修改已执行历史；
- 不预埋万能 JSON、CMS、重定向、回收站、统计维度或通用批任务。

## 2. 当前核心实体

### `users`

唯一管理员：用户名、密码哈希、Session 版本、失败/锁定、active、资源版本与密码时间。不引入角色表或多管理员。

### `works` 与 `work_feature_tags`

作品保存 slug、角色名、物种、装型、用途、公开主人显示/私有联系人、领养方式/状态/价格、展会名称/时间、发布状态、首页精选/排序和版本。

底层 purpose：`commission | adoption | showcase`。展会掉落仍是 `purpose=adoption` + `adoption_method=event_drop`，不增加 event 实体。

### `assets`、`work_assets`、`upload_sessions`

- `assets`：私有 Object Key、摘要、字节、MIME、尺寸、EXIF、角色、状态、焦点/fit、版本和安全失败码；
- `work_assets`：作品与 `design_sheet | studio_photo` 的关系、位置、主图、alt、焦点/裁剪；
- `upload_sessions`：声明摘要/MIME/尺寸/字节、归属/版本、不可预测会话 Key、过期、状态和完成资产。

返图不进入 `work_assets`；浏览器重试创建新会话/Key，不覆盖。

### `asset_variants`

保存输入、存储范围、相对 Object Key、用途、尺寸/格式/质量/裁剪、配方、保护模式、可选水印 profile、输出摘要/字节和状态。

- `protection_mode=none`：站点 `site-display-v1` 与返图 `return-display-v1`；
- `protection_mode=watermark`：作品/领养/展会当前使用 `recipe-v3` + 活动 `brand-centered-v2`；完整 `recipe-v2` / `recipe-v1` 只作为新配方未齐时的整体回退；
- 私有 preprocess 不能被公开投影选中；`design-sheet-upscale-lanczos-v1` 与 `studio-photo-upscale-lanczos-v1` 分别按原始资产摘要、媒体角色与目标几何保存不可变低分辨率适配源，后续公开变体只记录对应 READY 处理源的 `source_variant_id`。

数据库保存不可变对象身份；公开响应用 `MEDIA_BASE_URL` 和相对 Object Key 组装稳定的 ESA HTTPS URL。

`recipe-v3` 不增加列：配方身份哈希和新 Object Key 记录竖图水印缩放语义。3:4 `work-card` 与竖版 `studio_photo` `detail` 仍是单个 `center` 水印，但按用途最小宽度随输出档位等比放大；横版 `detail` 和设定图左右双水印保持原规则。新旧配方行可以并存，公开投影不能跨版本拼 SourceSet。

### `watermark_profiles`、`site_branding`、`site_hero_slides`

profile 不可变，`site_branding` 指向活动 profile；Hero 保存 placement、横竖资产、alt、排序、启用、关联作品和版本。无水印站点/返图不依赖活动 profile。

### `site_content`、FAQ、`business_statuses`

分区内容与稳定 FAQ ID保持；`business_statuses` 只按 `commission | adoption`。展会掉落复用 adoption 状态。

### operation 与审计

publication、watermark、reconcile、return operation 保存请求版本、状态/进度、失败、精确清理对象、attempt、lease、heartbeat、recovery reason、重试和时间。T52-E4 在现有模型上扩展 ESA purge manifest/task ID/status，不新建第二套状态机。

`audit_logs` 不保存敏感正文、凭据、私有 Key、联系人、授权备注或原始 OSS 签名 URL。

## 3. 阶段 D 最终模型（已落地）

### `return_characters`

```text
id
slug                 unique
name
nickname             nullable
work_id              nullable, FK ON DELETE SET NULL
authorization_source nullable
authorization_confirmed_at nullable
authorization_note   nullable
version
created_at
updated_at
```

- 设定是返图管理聚合；
- 作品关联可空，也可指向未发布作品；
- 授权字段仅管理 DTO；
- 删除作品只置空关联，不改变返图可见性。

### `return_photos`

```text
id
character_id
asset_id              nullable for incomplete draft
alt
is_primary
publication_status    draft | published | unpublished
version
created_at
updated_at
published_at          nullable
```

- 一个设定多张返图；每张资产最多绑定一条返图；
- 已发布返图必须有 READY `return_photo` 资产和完整 `return-wall` SourceSet；
- 返图不设人工排序；`is_primary` 指定设定页主图；
- 发布不依赖 `work_id` 是否存在或作品是否 published；
- 公开墙按请求种子随机；设定页按稳定规则展示该设定已发布返图。

### 展会字段

`works.event_name`、`works.event_time` 只对 event_drop 有效；草稿可暂缺、发布必齐。`event_time` 是展示文本，不参与调度/自动状态。

## 4. 当前公开投影

### 作品/领养

只包含公开作品事实、READY SourceSet、导航/相关作品与 event_drop 的展会名称/时间。私有联系人省略或空。

### 返图墙/设定页

只包含：

```text
photo id
READY SourceSet + width + height + alt
character { name, nickname?, slug, href }
optional work { name, slug, href }
```

公开条件只依赖返图自身 published、完整 `return-display-v1`、`protection_mode=none`。不依赖关联作品状态。

不得包含授权记录、联系人、私有 Key、私有 OSS 签名 URL、原文件名或 EXIF。T52-E3 完成后 SourceSet URL 使用稳定的 `public-media` ESA HTTPS URL。

### 管理 DTO

管理 DTO 可以包含受控私有事实、资产 ID/尺寸/状态、短期私有预览、发布检查和 operation；不返回私有 Object Key、AK/SK 或原始 OSS 签名 URL。

## 5. T46 已落地模型

### `analytics_events`

```text
id              integer stable
occurred_at     timestamp
event_type      page_view | contact_action
route_key       whitelist enum
entity_type     work | return_character | null
entity_id       nullable public entity id
action_key      whitelist enum | null
session_hmac    fixed-length digest
```

不建立 visitor、profile、device、campaign、referrer 或 contact 表。

约束：

- `page_view` 不带 `action_key`；`contact_action` 必须带白名单 action；
- entity type/id 成组且只用于相应详情 route；
- `route_key` 不保存原始 URL 或 query；
- `session_hmac` 是客户端 sessionStorage 随机 ID 经服务端域分离 HMAC 的结果；
- 不保存原始会话 ID、IP、UA、Referer、Cookie、localStorage、联系方式或指纹；
- `(occurred_at)`、`(event_type, occurred_at)`、`(route_key, occurred_at)` 与必要实体窗口索引；
- 原始行 90 天滚动保留，每次接受写入时同事务幂等清理，不建立通用 scheduler；
- 后台只做 1/7/30 天聚合，不提供任意 SQL/导出。

前向迁移为 `0025_t46_analytics.sql`。集成测试核对列与索引，并用实际查询计划确认 30 天窗口和排行查询使用时间/组合索引；该模型不改变现有业务表或媒体状态机。

## 6. T52-E3/E4 生产媒体投影与撤销（已落地）

### URL 组装

数据库继续存相对衍生 Object Key。公开投影统一用 `MEDIA_BASE_URL` 组装稳定的 ESA HTTPS URL，不增加 signer、鉴权 Key、TTL 或边缘函数。生产 origin 下只接受 `prod/web/**`，原图、处理源、管理预览和其他环境前缀 fail closed。该 URL 组装不改变 `asset_variants` 媒体身份。

`MEDIA_BASE_URL` 是 `public-media` ESA origin；`OSS_ENDPOINT` 是服务端 SDK origin；`OSS_UPLOAD_BASE_URL` 是私有 Bucket 原始公网 origin。三者不能互换。

### ESA 撤销状态

在现有 publication/cleanup operation 中增加或明确保存：

```text
edge_purge_urls_json  exact ESA file URL manifest
edge_purge_task_id    nullable
edge_purge_status     NOT_REQUIRED | PENDING | PURGING | COMPLETE | FAILED
edge_purge_reason     nullable stable code
edge_purge_checked_at nullable
```

前向迁移为 `0026_t52_e4_edge_purge.sql`，并建立 `(edge_purge_status, updated_at)` 恢复扫描索引。事务提交后不丢 manifest；任务可重试/重启恢复；刷新完成与业务下架分别表达。

## 7. 核心不变量

### 私有/公开

- `assets.private_object_key` 永不公开；
- 两只生产 Bucket 原始域名匿名 GET 都失败；
- ESA 公开媒体 origin 只指向衍生 Bucket，衍生 Bucket 不含私有源；
- 公开响应只包含 READY 衍生物的稳定 ESA URL；
- 授权记录与统计禁采字段不进入公开/日志/artifact。

### 媒体

- 同一完整身份最多一个 READY；
- 同宽度有 WebP + fallback；
- profile 不改变无水印站点/返图；
- 公开像素变化生成新 Key；
- `x-oss-process` 不进入公开 URL/回源。

### 并发与恢复

- 资源更新使用条件版本；
- 一个 operation 只有一个有效 lease owner；
- 公开对象完整验证后才提交业务状态；
- 下架业务投影与 ESA purge 状态分开；
- 清理/刷新失败保留精确 manifest；
- 重启幂等，旧有效版本在新版本 READY 前可用。

## 8. 迁移与索引验证

每次迁移：校验历史 hash、验证备份、在副本迁移、`integrity_check=ok`、`foreign_key_check=0`、既有数量合理、旧投影可读、恢复库 production ready。

索引必须通过实际查询计划验证，不机械覆盖字段。T46 特别检查 30 天聚合不会无界扫描；T52-E4 媒体撤销复用 operation 状态/lease 索引。

## 9. 明确不建

- 邮件 token、CSV job、原图档案视图模型、高级批量任务模型；
- 页面树、通用内容 JSON、通用 slug 重定向、通用回收站；
- event 实体、返图相册/用户/社交表；
- analytics visitor/profile/fingerprint/campaign/referrer 表；
- 第二套媒体状态机；
- 多区域 Bucket/复制/灾备模型。
