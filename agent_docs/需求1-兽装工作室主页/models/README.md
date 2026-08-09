# 数据模型与投影

> **角色**：描述当前已落地模型和已批准的下一步目标模型。
> **最后校准**：2026-08-09。
> **边界**：业务规则见 [`../requirements/SPEC.md`](../requirements/SPEC.md)，媒体规则见 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。

## 1. 模型原则

- SQLite 是业务事实源；
- 私有/衍生对象都有数据库身份，不能只靠 Object Key；
- 公开 DTO 使用字段白名单；
- 可并发修改资源使用显式版本；
- OSS/CDN 副作用通过持久 operation 收敛；
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
- `protection_mode=watermark`：作品/领养/展会 `recipe-v2` + 活动 `brand-centered-v2`；
- 私有 preprocess 不能被公开投影选中。

数据库保存不可变对象身份，不保存阶段 F 的短期 CDN 签名 URL。

### `watermark_profiles`、`site_branding`、`site_hero_slides`

profile 不可变，`site_branding` 指向活动 profile；Hero 保存 placement、横竖资产、alt、排序、启用、关联作品和版本。无水印站点/返图不依赖活动 profile。

### `site_content`、FAQ、`business_statuses`

分区内容与稳定 FAQ ID保持；`business_statuses` 只按 `commission | adoption`。展会掉落复用 adoption 状态。

### operation 与审计

publication、watermark、reconcile、return operation 保存请求版本、状态/进度、失败、精确清理对象、attempt、lease、heartbeat、recovery reason、重试和时间。T52 在现有模型上扩展 CDN refresh manifest/task ID/status，不新建第二套状态机。

`audit_logs` 不保存敏感正文、凭据、私有 Key、联系人、授权备注或完整签名 URL。

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

不得包含授权记录、联系人、私有 Key、私有 OSS 签名 URL、原文件名或 EXIF。T52 完成后 SourceSet URL 是动态生成的约 24 小时 CDN 鉴权 URL。

### 管理 DTO

管理 DTO 可以包含受控私有事实、资产 ID/尺寸/状态、短期私有预览、发布检查和 operation；不返回私有 Object Key、AK/SK、鉴权 Key或长期可复用签名 URL。

## 5. T46 目标模型（未落地）

### `analytics_events`

```text
id              integer/uuid stable
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
- 原始行 90 天滚动保留，不建立通用 scheduler；
- 后台只做 1/7/30 天聚合，不提供任意 SQL/导出。

## 6. T52 生产媒体投影（未落地）

### URL 组装

数据库继续存相对衍生 Object Key。单一 CDN URL signer 接收 Key 和签发时间，按鉴权方式 A、`86400` 秒生成当前响应 URL。签名不改变 `asset_variants` 媒体身份。

`MEDIA_BASE_URL` 是 CDN origin；`OSS_ENDPOINT` 是服务端 SDK origin；`OSS_UPLOAD_BASE_URL` 是浏览器条件 PUT公网 origin。三者不能互换。

### CDN 撤销状态

在现有 publication/cleanup operation 中增加或明确保存：

```text
cdn_refresh_urls       exact unsigned CDN file URLs / manifest
cdn_refresh_task_id    nullable
cdn_refresh_status     pending | refreshing | complete | failed
cdn_refresh_reason     nullable stable code
cdn_refresh_checked_at nullable
```

具体字段可按现有 operation 表分布实现，但必须保证：事务提交后不丢 manifest、完整签名 URL 不持久化、任务可重试/重启恢复、刷新完成与业务下架分别表达。

## 7. 核心不变量

### 私有/公开

- `assets.private_object_key` 永不公开；
- 两只生产 Bucket 原始域名匿名 GET 都失败；
- CDN 只回源衍生 Bucket，衍生 Bucket 不含私有源；
- 公开响应只包含 READY 衍生物的短期 CDN URL；
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
- 下架业务投影与 CDN refresh 状态分开；
- 清理/刷新失败保留精确 manifest；
- 重启幂等，旧有效版本在新版本 READY 前可用。

## 8. 迁移与索引验证

每次迁移：校验历史 hash、验证备份、在副本迁移、`integrity_check=ok`、`foreign_key_check=0`、既有数量合理、旧投影可读、恢复库 production ready。

索引必须通过实际查询计划验证，不机械覆盖字段。T46 特别检查 30 天聚合不会无界扫描；T52 媒体撤销复用 operation 状态/lease 索引。

## 9. 明确不建

- 邮件 token、CSV job、原图档案视图模型、高级批量任务模型；
- 页面树、通用内容 JSON、通用 slug 重定向、通用回收站；
- event 实体、返图相册/用户/社交表；
- analytics visitor/profile/fingerprint/campaign/referrer 表；
- CDN URL 持久缓存表或第二套媒体状态机；
- 多区域 Bucket/复制/灾备模型。
