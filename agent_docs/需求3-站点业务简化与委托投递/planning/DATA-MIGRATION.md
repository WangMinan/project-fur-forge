# 数据迁移与永久退役方案

> **角色**：定义需求3从当前生产 Schema 迁移到目标 Schema 的顺序、映射、停止点和验证方式。
> **状态**：方案已锁定；实际迁移文件名和运维命令在实施后回填。
> **警告**：本方案包含用户明确授权的不可恢复删除。返图媒体删除开始后无法恢复；最终 contract migration 后旧镜像不保证可运行。

## 1. 基线与目标

当前基线至少包含：

- `works` 的装型、主人、联系人、领养方式、业务状态、展会字段和属性标签；
- `site_hero_slides` 的横竖配对模型；
- `return_characters`、`return_photos` 和 `return_photo` 媒体链；
- `updates`；
- `site_content` 的 FAQ 与邮件行动文案；
- analytics 中的 returns/return_character/updates route key。

目标见 [`../models/README.md`](../models/README.md)。迁移采用 `expand → backfill → destructive cleanup → contract`，不重写历史 SQL。

## 2. 迁移发布单元

### 2.1 Expand release

Expand release 可以在旧数据仍存在时启动，负责：

- 创建 `site_hero_items`；
- 创建 `commission_upload_sessions`、`commission_submissions`；
- 增加 `adoption_status`；
- 增加 `adoption_cover`、`commission_design_reference` 角色和 recipe；
- 增加新 DTO/API/UI；
- 提供 Hero pair 拆分、领养缺图盘点和退役 dry-run 工具；
- 暂时保留旧表和旧字段供读取与数据映射。

### 2.2 Contract release

Contract release 使用同一冻结镜像，在停机窗口执行：

1. 永久删除返图媒体和旧备份；
2. 验证对象不可达；
3. 执行 SQLite contract migration；
4. 启动只依赖目标 Schema 的应用。

Contract release 不允许自动在容器启动时先跑 DROP TABLE；必须由维护流程显式执行。

## 3. Hero 数据迁移

### 3.1 映射

对每条旧 `site_hero_slides`：

```text
old.id + landscape -> new landscape item
old.id + portrait  -> new portrait item
```

字段映射：

| 旧字段 | 新 landscape | 新 portrait |
| --- | --- | --- |
| `placement` | 原值 | 原值 |
| `landscape_asset_id` | `asset_id` | — |
| `portrait_asset_id` | — | `asset_id` |
| `alt_text` | 原值 | 原值 |
| `sort_order` | 原值 | 原值 |
| `enabled` | 原值 | 原值 |
| `version` | 至少 1 | 至少 1 |
| `created_at` / `updated_at` | 原值 | 原值 |
| `linked_work_id` | 丢弃 | 丢弃 |

新 ID 必须确定性生成，迁移可重复执行而不重复插入。建议由旧 ID、placement、orientation 生成 UUIDv5/确定性 UUID。

### 3.2 顺序与启用

- 迁移后每个 `(placement, orientation)` 维持旧顺序；
- 若旧数据违反连续顺序，按旧 `sort_order, id` 归一化为 `0..n-1`；
- 旧一对记录天然保证两方向数量一致，迁移后管理员可独立增删和重排；
- contract 前验证 home 与 commission 的两个方向都至少有一条 enabled；
- 旧预览 Key 不复用，迁移后按 orientation 重新生成或清空。

### 3.3 旧表删除

只有以下条件成立才删除 `site_hero_slides`：

- 新表行数等于旧有效行数的两倍；
- 每个旧 asset ID 均在对应方向出现一次；
- 公开 DTO 已完全切换；
- 管理写 API 不再访问旧表；
- 真实浏览器横竖请求验证通过。

## 4. 作品表迁移

SQLite contract 通过新表重建完成，避免保留无效 CHECK。

### 4.1 保留字段

```text
id
slug
character_name
species
purpose
price_amount_minor
price_currency
publication_status
sort_order
featured
version
published_at
created_at
updated_at
```

### 4.2 新字段

```text
adoption_status
```

映射规则：

| 旧 `purpose` / `business_status` | 新 `adoption_status` |
| --- | --- |
| 非 adoption | `NULL` |
| adoption + `delivered` | `adopted` |
| adoption + 其它值或 NULL | `available` |

迁移必须输出以下脱敏计数供人工复核：

- adoption 总数；
- delivered → adopted 数量；
- event_drop 数量；
- preparing/scheduled/in_production/event_sale/NULL 各自数量。

计数不包含作品名称。管理员在 contract 前检查异常状态；必要时使用新后台手工修正为 adopted。

### 4.3 删除字段

```text
suit_type
adoption_method
business_status
owner_display
owner_contact
event_name
event_time
```

删除前不导出其内容。用户已经授权永久丢弃。

### 4.4 属性标签

- 删除 `work_feature_tags` 全部行和表；
- 删除管理表单、公开 DTO、测试 seed 和审计 diff 中的 tag；
- 不迁移到 JSON、备注或其它隐藏字段。

### 4.5 价格

- 非 adoption 的价格列强制清空；
- adoption 原有正数 CNY 价格保留；
- 无价格继续为 NULL；
- 非法或孤立 amount/currency 在迁移前阻断并人工修复，不静默猜测。

## 5. 作品媒体迁移

### 5.1 既有关系

- `studio_photo` 原关系和 primary 标志保留；
- `design_sheet` 原关系保留，但发布门禁取消；
- 不把 `design_sheet` 自动转换为 `adoption_cover`；
- 不把 `studio_photo` 自动裁成 `adoption_cover`。

### 5.2 `adoption_cover` 补齐

Expand release 后，后台生成缺图清单，只显示作品 ID、名称和当前发布状态给管理员，不写仓库。

Contract 前：

- 每个 published adoption 必须上传一张 READY `adoption_cover`；
- 若无法补齐，先把作品下架；
- 每个 adoption 最多一张 cover；
- cover 必须生成完整 `adoption-card` SourceSet；
- 发布检查不允许兼容 fallback。

### 5.3 公开变体

新增 cover 变体后：

- `work-card` 继续来自 primary `studio_photo`；
- `adoption-card` 只来自 `adoption_cover`；
- 设定图只生成 `design-sheet`/detail 用途；
- 任何旧 design-sheet-as-adoption-card 的查询分支删除。

## 6. 委托文案迁移

### 6.1 保留

```text
commission_intro
commission_estimate_note
about_studio_facts
about_making_scope
basic_terms
privacy_policy
contact_email
official_channels_json
contact_anti_scam
```

### 6.2 更新

- `hero_tagline` 写为 `不只做小狗毛 | 只做海绵头`；
- `/about` 的默认说明迁移为支持站内申请；
- 隐私政策默认内容补充称呼、手机号、QQ、身高、体重和设定图的收集用途；
- 默认文案迁移只覆盖仍等于旧默认值的字段，不覆盖管理员已经修改的真实内容；
- 涉及的局部分区版本各递增一次。

### 6.3 删除

```text
commission_email_action
commission_faq_json
commission_faq_version
```

FAQ 内容不导出、不转入备注、不保留隐藏兼容列。

旧 `contact_qq`、`contact_douyin` 只有在所有读取和迁移已切换到 `official_channels_json` 后才物理删除。

## 7. 返图和动态永久清理

### 7.1 停机前 dry-run

清理工具必须读取旧 Schema，并计算：

- update 行数；
- return character/photo 行数；
- 返图 asset 数量；
- 私有原图、私有 preprocess、私有 preview、公开 variant、未完成 upload object 数量；
- publication operation 与 cleanup 残留数量；
- ESA 精确 URL 数量；
- 项目管理数据库备份数量；
- OSS versioning 是否开启。

输出只允许计数、状态、总字节和摘要，不打印标题、正文、名称、alt、私有字段或完整 Object Key。

### 7.2 对象枚举顺序

在内存或受控临时工作目录中，从以下关系枚举精确对象：

1. `return_photos.asset_id`；
2. `assets.private_object_key`；
3. `asset_variants` 的 source/public object key；
4. `upload_sessions` 的 pending object key；
5. publication/cleanup operation 中的 object key JSON；
6. 公开 variant 对应 ESA URL；
7. 项目数据库备份目录。

临时 manifest：

- 权限必须仅当前用户可读；
- 不写进仓库或普通日志；
- 清理完成后立即安全删除；
- 失败时只保留到维护恢复完成，不能长期归档。

### 7.3 删除顺序

1. 停止应用和后台写入；
2. 删除未完成返图上传对象；
3. 删除私有预览和私有 preprocess；
4. 删除私有永久原图；
5. 删除公开派生；
6. 删除所有 OSS 历史版本与 delete marker；
7. 对公开 URL 执行 ESA purge；
8. 逐项 HEAD/GET 验证不可达；
9. 删除包含旧数据的项目数据库备份；
10. 执行 contract migration 删除数据库行和表；
11. 生成净化备份。

若任一对象删除失败，停止在数据库 contract 之前，保留旧表以便重新枚举。已经成功删除的对象不尝试恢复。

### 7.4 动态数据

`updates` 没有媒体时只需：

- 删除数据表；
- 删除 API/页面/测试；
- 删除 analytics route rows；
- 删除旧数据库备份中的正文副本。

若实现审查发现动态后来增加了媒体或附件，必须把它们纳入同一精确清理，不得假设不存在。

## 8. Analytics 迁移

- 删除 `route_key IN ('returns', 'return_character', 'updates')` 的历史行；
- 重建 CHECK，移除这三个枚举；
- 删除 `return_character` entity type；
- 委托申请的页面浏览可以记录 `commission_apply` route key，但不得记录提交字段、receipt、手机号、QQ 或 submission ID；
- 首版不记录“提交成功”业务事件，避免将敏感流程变成用户级追踪。

## 9. `assets` 与上传约束重建

最终重建时：

- 删除 `return_photo` role；
- 增加 `adoption_cover`、`commission_design_reference`；
- 管理 `upload_sessions.owner_type` 删除 return 分支；
- 匿名上传只进入 `commission_upload_sessions`；
- `asset_variants` 删除 `return-wall` 和 `return-display-v1`；
- `commission_design_reference` 只允许 private preprocess/原图，不允许 PUBLIC；
- `adoption_cover` 只允许 `adoption-card` 和必要 preprocess/detail（若最终详情使用）用途；
- 重建后执行负向 SQL 测试，证明旧枚举不能插入。

## 10. 数据库表重建顺序

建议 contract transaction 内按外键依赖执行：

1. 删除/归档退役 operation 行；
2. 删除退役 analytics 行；
3. 创建目标临时表；
4. 复制并转换 `works`；
5. 复制保留 `assets`；
6. 复制保留 `work_assets` 并加入 cover 关系；
7. 复制保留 `asset_variants`；
8. 复制管理 `upload_sessions`；
9. 复制保留 publication operation；
10. 复制收缩 `site_content`；
11. 确认 `site_hero_items` 完整后删除旧 Hero 表；
12. DROP `updates`、`return_characters`、`return_photos`、`work_feature_tags` 和旧表；
13. rename 目标表并重建索引；
14. `PRAGMA foreign_key_check`；
15. `PRAGMA integrity_check`；
16. commit。

具体顺序可按 SQLite 外键实现调整，但必须保持单事务和失败回滚。

## 11. 本地演练

至少覆盖：

- 空库直接迁移；
- 当前 fixture 既有库；
- 含 published return、pending return upload、failed variant、active/failed publication operation 的复杂库；
- 含 event_drop、旧各 business status、完整/缺失价格的作品库；
- 含已修改和仍为默认值的 site content；
- 含旧数据库备份；
- OSS versioning 关闭和测试模拟开启两种路径。

每次演练记录脱敏计数、命令退出码、integrity/foreign key 和最终页面结果。不得把真实内容或 Key 写入仓库证据。

## 12. 生产停止点

生产维护窗口有三个不可越过的停止点：

### STOP-1：dry-run 数量不符

若数据库行数、对象数、备份数与预期不符，停止；不得输入确认短语。

### STOP-2：对象删除不完整

若任何私有原图、历史版本、公开派生或 ESA purge 未完成，停止；不得执行 contract migration。

### STOP-3：数据库验证失败

若 contract migration 的 foreign key、integrity、readiness 或 production verify 失败，应用保持停止，使用新镜像前向修复；不得启动旧镜像。

## 13. 净化备份

- 清理完成前不创建包含返图/动态的新备份；
- contract 成功后立即创建新的 SQLite 净化备份；
- 删除项目脚本管理的所有旧数据库备份副本；
- 若基础设施提供磁盘/快照备份，用户需要同步删除或重建不含退役数据的快照；
- 净化备份验证恢复后，才结束维护窗口。

## 14. 验证查询与证据

实现时至少提供自动化断言：

```text
表不存在：updates, return_characters, return_photos, work_feature_tags
旧列不存在：suit_type, owner_display, owner_contact, adoption_method, event_name, event_time
旧枚举不可插入：return_photo, return-wall, return-display-v1, RETURN_PHOTO
退役 analytics 行数：0
published adoption 缺 adoption_cover：0
published work 缺 primary studio_photo：0
Hero 每个 placement/orientation enabled 数：1..5
commission private asset PUBLIC variant 数：0
foreign_key_check：0 rows
integrity_check：ok
```

证据文件只允许保存：

- 迁移版本；
- 计数；
- 总字节；
- 退出码；
- 时间；
- 脱敏错误码；
- integrity/foreign key 结果。

## 15. 回滚与前向修复

- Expand release 可以按普通方式回滚，因为旧表仍存在；
- 返图对象永久删除后，返图数据没有回滚路径；
- Contract transaction 失败时数据库会回滚，但已删除媒体不会恢复；
- Contract 成功后旧镜像不保证兼容目标 Schema；
- 生产故障只允许使用目标 Schema 兼容的新镜像前向修复；
- 不为了制造回滚路径而保留空表、兼容视图、旧媒体或隐藏归档。

## 16. 实施后回填

完成后补充：

- expand 和 contract 迁移文件名；
- 清理命令与强确认短语；
- 本地演练日期和脱敏计数；
- 生产执行日期和脱敏计数；
- 净化备份校验结果；
- 任何与本方案不同的用户批准决定。
