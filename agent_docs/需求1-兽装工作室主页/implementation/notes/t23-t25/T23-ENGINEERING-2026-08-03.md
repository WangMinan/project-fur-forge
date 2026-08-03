# T23 多图关系与媒体工程记录

> 日期：2026-08-03
> 状态：服务端工程与定向验证完成；等待独立 Review，`TASKS.md` 中 T23 保持未勾选。
> 边界：未实现 T24 Vue 管理界面；未在本记录中宣布 T25 完成。

## 1. 管理契约

- `PUT /api/admin/v1/works/{workId}/studio-photos`：以有序数组整体替换 0–5 张出厂照；数组位置就是稳定 `position`，非空时必须且只能有一张 `primary=true`。
- `PUT /api/admin/v1/works/{workId}/design-sheet`：`payload.designSheet` 为 `{ assetId, alt } | null`；同一路由完成首次保存、替换和删除，使用作品 `expectedVersion` 做乐观并发控制。
- `GET /api/admin/v1/works/{workId}`：领养作品返回 `designSheet`（无关系时为 `null`）和 `studioPhotos`；管理 DTO 只含 `assetId`、角色所需展示字段、READY/失败状态、尺寸、版本与当前活动 profile 的公开 variant 数量，不返回私有 Object Key。
- 原图预览继续复用认证、同源、`no-store` 的 `GET /api/admin/v1/media/assets/{assetId}/preview`，没有新增签名 URL 或私有 Key DTO。

上传角色继续使用既有 `POST /api/admin/v1/media/upload-sessions`：作品归属只接受 `design_sheet | studio_photo`；`design_sheet` 只允许 adoption 作品。完成上传后得到 READY `assetId`，再通过上述关系 API 保存。

## 2. 关系与版本规则

- 每件作品最多 5 张 `studio_photo`；数据库位置范围为 `0..4`，同一作品同一角色的位置唯一。
- adoption 作品最多 1 张 `design_sheet`；位置固定为 `0`。
- `assets.role` 原始身份不可变；`work_assets.role` 也禁止原地改名。角色变化必须删除旧关系并通过服务端按目标角色重新保存。
- 同一 `assetId` 在 `work_assets` 全局唯一，不能跨作品或跨角色重复冒充。
- `design_sheet.is_primary` 固定为 false；主图语义只属于 `studio_photo`。
- 关系编辑要求作品未发布且 `expectedVersion` 等于当前作品版本；成功后作品版本加一，陈旧版本返回 409。
- 替换或删除只改关系，不删除 `assets`，永久私有原图保持不变。

## 3. 按需 recipe

- 主出厂照：`work-card` 3:4 + `detail` 原比例。
- 非主出厂照：只生成 `detail`，不生成未被页面使用的卡片组合。
- 设定图：生成 `design-sheet` 完整画布；没有出厂照主图时，额外生成 `/works` 所需的 `work-card` 3:4 fallback。
- `design-sheet` 使用 `m_lfit` 保持完整内容；3:4 fallback 使用 `m_pad` 和 `F7F7F7` 安全背景，不做破坏性中心裁切。
- 固定宽度仍为 `work-card: 480/768/1200`、`design-sheet/detail: 960/1600/2400`，每个宽度只生成 WebP + 与原图透明度相符的 JPEG/PNG fallback；源尺寸不够最大固定配方时拒绝上采样。
- 所有公开 variant 继续要求活动 `brand-centered-v2` 的 profile ID、配置摘要、Logo 摘要、`center`、不透明度和缩放身份；没有恢复四角水印选择。

水印 profile 全站应用现在按同一实际用途矩阵纳入新增 `design_sheet`，先完整生成并验证新 profile 的目标集合，再原子切换并清理旧 profile；失败保持旧活动 profile。

## 4. 迁移与兼容

- 新迁移 `0011_t23_media_role_constraints.sql` 只增加关系触发器，没有重建 `assets` 或 `work_assets`，也不覆盖任何永久私有原图。
- 迁移测试从 T21 形态的已发布作品、单张主出厂照和既有私有 Key 升级，发布状态、顺序、主图、关系和私有 Key 均保持不变，外键检查为空。

## 5. 定向验证

```text
pnpm exec vitest run --config vitest.integration.config.ts \
  tests/integration/database.test.ts \
  tests/integration/domain-schema.test.ts \
  tests/integration/work-management.test.ts \
  tests/integration/media-recipe.test.ts \
  tests/integration/watermark-branding.test.ts

结果：5 files / 48 tests passed
```

覆盖 0/1 份设定图、第二份设定图、0–5 张出厂照、第 6 张、重复 `assetId`、跨角色冒充、主图唯一、稳定排序、非 adoption 设定图、版本冲突、contain/安全背景、活动 profile identity、原图保留和 T21 迁移兼容。

## 6. 后续边界

- T24 才实现按“设定图/出厂照”分区的 Vue 快速编辑、真实预览、保存 dirty 基线和视觉交互。
- T25 服务端在本轮后续步骤解锁 regular adoption 发布、`/adoptions` 公开投影和统一详情媒体分区；T25 不在 T23 记录中勾选。
- `event_drop`、`event_sale`、展会实体与完整状态矩阵仍属于 T37。
