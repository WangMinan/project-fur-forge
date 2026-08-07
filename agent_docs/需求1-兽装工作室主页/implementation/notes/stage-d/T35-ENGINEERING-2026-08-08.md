# T35 实施记录：返图领域模型与契约

> **日期**：2026-08-08。
> **起始 commit**：`c751b41`（阶段 D 起点）。
> **本任务 commit**：`5f6c279 T35: add return photo domain model`。
> **性质**：dated note，只记录当时事实。当前权威见 `requirements/SPEC.md`、
> `models/README.md` 与 `implementation/TASKS.md`。

## 1. 交付范围

一图一记录返图模型、作品关联、状态与版本、可选私有授权记录，以及管理 API 闭环。
不含媒体生成与发布（属 T36）。

## 2. 数据库（前向迁移 0022）

历史迁移未修改。SQLite 无法直接 ALTER CHECK，因此
`assets` / `asset_variants` / `upload_sessions` / `publication_operations`
按迁移 0017 的既有流程重建。

新增 `return_photos`：

```text
id / work_id / asset_id / alt / sort_order / publication_status
authorization_source / authorization_confirmed_at / authorization_note
version / published_at / created_at / updated_at
```

关键约束：

- `asset_id` 是**单列 + 唯一索引**，因此“一条返图最多一张资产”由数据库保证，
  永远不可能长成相册；
- `asset_id` 可空：返图上传会话的归属是返图记录及其版本，记录必须先存在，
  所以草稿允许暂时无图。`return_photos_published_asset` CHECK 保证
  **已发布**返图必有图片；
- `work_id` 与 `asset_id` 外键均为 `ON DELETE restrict`：存在返图关联时
  数据库直接阻止作品永久删除；
- CHECK：alt 去空白后 1–500、状态三值、sort_order ≥ 0、version > 0、
  已发布必有 `published_at`、授权来源枚举、授权备注长度；
- 索引：`(publication_status, sort_order, id)`、`(work_id, publication_status)`、
  `asset_id` 唯一。

新增触发器（5 个）：

- `return_photos_asset_role_insert` / `_update`：资产必须是 READY 的 `return_photo`；
- `return_photos_published_work_insert` / `_update`：已发布返图要求关联作品已发布，
  且只在状态转为 published 或 work_id 变化时触发，因此作品下架后
  对已发布返图做无关字段编辑不会被误拦；
- `return_photos_published_identity_update`：已发布返图不能改关联作品或图片。

其他表放开：`assets.role` 与 `asset_variants.media_role` 增加 `return_photo`；
`asset_variants.usage` 增加 `return-wall`；新增三条 `return-display-v1` /
`return-wall` 身份 CHECK；`upload_sessions` 增加 `return` 归属；
`publication_operations.entity_type` 增加 `RETURN_PHOTO`。

## 3. 迁移过程中的两次真实失败与修复

1. **`ALTER TABLE ... RENAME` 失败**：`no such table: main.assets`。
   SQLite 在 RENAME 时重新解析整个 schema，任何仍引用已被 DROP 的表的触发器
   都会让改名失败。修复：把迁移改成「先删除全部相关触发器 → 重建所有表 →
   最后统一恢复触发器」，并把 `return_photos` 放在 `upload_sessions` 之前建立
   （`upload_sessions_owner_insert` 需要引用它）。
2. **`work_assets` 报错顺序变化**：`domain-schema` 集成测试原本期望
   `role changes require relation replacement`，重建后先命中
   `work asset role is invalid`。原因是两个触发器监听同一个 `UPDATE OF role`，
   SQLite 按创建顺序触发。修复：把 `work_assets_role_immutable` 也纳入
   删除/重建集合，并恢复在 `work_assets_role_update` 之后创建。

## 4. 迁移验证

对真实 `.data/dev.db` 副本执行：

- `integrity_check = ok`；
- `foreign_key_check` 0 行；
- 行数保持：works 3、assets 24、asset_variants 91、work_assets 5、
  upload_sessions 27、publication_operations 47、site_hero_slides 2、
  watermark_profiles 5；
- 触发器 34 个（原 29 + 新 5）；
- 迁移记录 22 → 23；
- 手工验证：草稿可无图；无图发布被 `return_photos_published_asset` 拒绝。

正式应用到 dev.db 时由 `db:migrate` 自动创建 `pre-migrate-*` 备份。

## 5. 契约与分层

- `shared/schemas/return-photo.ts`：管理 DTO、发布检查、状态、编号分页（每页 24）
  与公开 DTO。**公开 DTO 结构上不含授权记录、私有 Key、签名 URL、EXIF
  或返图者信息**，因此不可能因映射疏漏泄漏；
- `repository/return-photo-repository.ts`：SQL、行映射、条件更新（CAS）；
  选择列里没有 `private_object_key`；
- `service/return-photo.ts`：业务规则、DTO 组合、发布前检查；
- `api/admin/v1/returns/*`：列表（作品/状态筛选 + 分页）、新建、读取、
  更新、草稿删除、发布检查。Host/Origin/Session/CSRF/限流由既有中间件统一处理；
- 稳定 reason：`RETURN_PHOTO_*` 与 `WORK_HAS_RETURN_PHOTOS`；
- 审计日志只写动作与结果，不写 alt、授权正文或私有 Key。

## 6. 测试

新增 `tests/integration/return-photo-management.test.ts`（10 项）：
一图一记录与资产独占、非法作品/资产关联、版本冲突不静默覆盖、
授权记录隐私与「缺失不阻断发布」、发布阻断（作品未发布/无图）、
源图过窄阻断、宽度阶梯随源宽收敛、管理分页与筛选、
作品删除被返图阻断、数据库层一图一记录约束。

`domain-schema` 的授权表清单加入 `return_photos`；
原本断言「`return_photo` 不是合法角色」的用例改为断言
「`return_photo` 是合法角色，但不得进入 `work_assets` 冒充设定图/出厂照」。

## 7. 未完成

新上下文独立后端 Review 尚未进行。实施者不得为自己代签。
