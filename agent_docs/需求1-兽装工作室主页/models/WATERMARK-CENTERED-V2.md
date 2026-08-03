# 居中可配置品牌水印模型增量（2026-08-01）

> **角色**：这是 `models/README.md` 在水印数据模型范围内的当前增量。冲突时以本文件为准；其他模型约束不变。

## 新增对象

### `watermark_logo` 资产

- 复用 `assets` 的不可覆盖私有原图语义，新增角色 `watermark_logo`；
- 归属固定为站点级 `branding`，不进入 `work_assets` 或 `site_hero_slides`；
- 候选只通过受保护上传会话创建，管理端按 `assetId` 使用；
- 私有 Object Key、完整摘要和签名 URL不进入公开投影；
- 删除候选前必须确认没有 profile 引用，活动 profile 的源不得直接删除。

### `watermark_profiles`

每条记录是不可变水印配置快照，至少包含：

- `id`；
- `profile_name = brand-centered-v2`；
- `source_asset_id`；
- `logo_digest`；
- `position = center`；
- `opacity_percent`；
- `scale_percent`；
- `config_digest`；
- `status`；
- `version` 和时间戳。

约束：

- `opacity_percent BETWEEN 10 AND 90`，默认 50；
- `scale_percent BETWEEN 20 AND 90`，默认 60；
- P0 profile 不能保存 `disabled`、`none` 或四角位置；
- `logo_digest` 必须与引用资产摘要一致；
- 已进入 APPLYING/ACTIVE/RETIRED 的 profile 内容不可原位更新。

### `site_branding`

站点级单例保存：

- `active_watermark_profile_id`；
- `draft_watermark_profile_id`；
- `last_watermark_operation_id`；
- `version` 和时间戳。

空库迁移应把当前随应用提供的 Logo 导入为候选，并建立默认 50/60/center 的活动或待应用 profile；不得继续让运行时从硬编码路径直接决定活动源。

## `asset_variants` 增量

- 公开水印 variant 必须引用 `watermark_profile_id` 或等价不可变 profile identity；
- `brand-centered-v2` 的位置记录为 `center`，旧 `top-left | top-right | bottom-left | bottom-right` 只为 v1 历史记录保留；
- identity 覆盖 profile ID/config digest、Logo digest、position、opacity、scale、输入来源、用途、宽高、格式、质量、recipe 版本和角色化水印布局；
- 任一身份字段改变都生成新记录和新 Object Key；
- 当前公开 mapper、作品发布检查和首页发布检查只接受 `site_branding.active_watermark_profile_id` 对应的 `PUBLIC + READY` variant；
- 旧 profile 的 READY 记录不能因用途/宽度/格式匹配而被误计为当前完整配方。

## 配置切换与操作状态

水印应用操作至少记录：

- profile ID；
- 受影响作品数、首页项数和目标 variant 总数；
- 已生成、已验证、待切换、待清理数量；
- 当前阶段；
- 稳定失败码；
- 精确清理对象清单；
- 资源版本和时间戳。

SQLite 只在新 profile 全部目标 variant 验证完成后切换活动引用。OSS 网络调用不得位于 SQLite 事务内。切换失败时上一 profile 继续 ACTIVE；切换成功后的清理失败只进入可重试清单。

## 旧字段迁移

- `assets.watermark_anchor`、`work_assets.watermark_anchor` 及 v1 variant 的四角值作为历史兼容字段保留，不再作为 v2 管理输入；
- v2 生成器不得读取单图锚点决定位置；
- 管理 DTO 不再要求作品关系提交 `watermarkAnchor`；为兼容旧客户端可以短期接受但必须忽略并在后续版本移除；
- 迁移不得修改或覆盖既有 v1 对象，必须通过新 profile 再生成。

## 发布约束

- 发布作品和首页轮播前，必须存在活动 profile；
- 每个所需用途/宽度/格式都必须有活动 profile 对应的 READY variant；
- Logo 源资产失效、profile 非 ACTIVE、摘要不一致或配置边界非法时阻断发布；
- 公开 DTO 不暴露 profile 内部字段，只输出已选中的公开 URL；
- 管理 DTO 可以输出 profile ID、候选 assetId、参数和进度，但不输出私有 Key。
