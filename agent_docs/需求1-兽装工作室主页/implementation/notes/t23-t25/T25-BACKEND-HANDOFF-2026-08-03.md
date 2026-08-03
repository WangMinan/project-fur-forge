# T25 常规领养服务端交接

> 日期：2026-08-03
> 状态：regular adoption 发布与公开读取契约已完成；Vue 页面和独立 Review 尚未执行，`TASKS.md` 中 T25 保持未勾选。
> 依赖：复用 T23 的 `work_assets`、`assets`、角色化关系和按需 variant；没有建设第二套媒体系统。

## 1. 管理与媒体 API

| API | 用途与版本规则 |
| --- | --- |
| `POST /api/admin/v1/media/upload-sessions` | 创建 `design_sheet` 或 `studio_photo` 上传；作品 ID 和当前作品版本进入 owner 契约。 |
| `GET /api/admin/v1/media/upload-sessions/{uploadSessionId}` | 查询上传、核验、私有预处理与失败状态。 |
| `POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/complete` | 完成核验，成功后返回 READY `assetId`；DTO 不返回私有 Key。 |
| `POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/retry` | 重试可恢复的上传会话失败。 |
| `POST /api/admin/v1/media/assets/{assetId}/retry-processing` | 原图已核验但私有预处理失败时原位恢复。 |
| `PUT /api/admin/v1/works/{workId}/design-sheet` | 以 `{ expectedVersion, payload: { designSheet: { assetId, alt } | null } }` 保存、替换或删除设定图。 |
| `PUT /api/admin/v1/works/{workId}/studio-photos` | 以版本化有序数组整体保存 0–5 张出厂照。 |
| `GET /api/admin/v1/media/assets/{assetId}/preview` | 认证、同源、`no-store` 原图预览；浏览器只持有 `assetId`。 |
| `GET /api/admin/v1/works/{workId}/publication-check` | 返回 blocker、角色数量、`requiredVariantCount` 和 `missingVariantCount`。 |
| `POST /api/admin/v1/works/{workId}/publish` | 按实际角色和页面用途生成、核验并提交公开 variant；版本冲突或 blocker 返回 409。 |
| `GET /api/admin/v1/publication-operations/{operationId}` | 查询真实发布阶段、失败阶段、失败码和待清理数量。 |
| `POST /api/admin/v1/publication-operations/{operationId}/retry-cleanup` | 恢复公开对象补偿清理。 |

关系保存规则不变：设定图只属于 adoption、最多 1 张、位置固定 0、没有主图语义；出厂照最多 5 张、数组位置为稳定顺序，非空时必须且只能 1 张主图。同一 `assetId` 不能跨作品或跨角色复用。每次关系写入要求未发布作品和当前 `expectedVersion`，成功后作品版本加一；替换/删除关系不删除永久私有原图。

## 2. regular adoption 发布条件

常规领养可以发布的必要条件为：

1. 基础作品字段完整，`adoptionMethod = regular`；
2. 业务状态属于 `preparing | available | scheduled | in_production | delivered`，不允许 `event_sale`，`currentEventName` 必须为空；
3. 价格可为空；有价格时必须是正整数最小单位和 `CNY`；
4. 恰有 1 张 READY `design_sheet`，alt 非空，且能完成 `design-sheet` 公开配方；
5. `studio_photo` 可为 0 张；存在时必须满足数量、主图、READY、alt 和按需尺寸规则；
6. 所有公开 variant 匹配当前活动 `brand-centered-v2` 的 profile ID、配置摘要、Logo 摘要和 `recipe-v1` identity。

发布检查的稳定 blocker：

- `WORK_FIELDS_INVALID`
- `DESIGN_SHEET_REQUIRED`
- `DESIGN_SHEET_NOT_READY`
- `DESIGN_SHEET_SOURCE_TOO_SMALL`
- `DESIGN_SHEET_ALT_REQUIRED`
- `STUDIO_PHOTO_REQUIRED`（仅普通 commission/showcase）
- `PRIMARY_STUDIO_PHOTO_REQUIRED`
- `STUDIO_PHOTO_NOT_READY`
- `STUDIO_PHOTO_SOURCE_TOO_SMALL`
- `STUDIO_PHOTO_ALT_REQUIRED`
- `WATERMARK_PROFILE_REQUIRED`
- `EVENT_DROP_NOT_READY`

固定 recipe 不上采样。任一角色不能满足最大实际宽度时，检查返回对应 `*_SOURCE_TOO_SMALL`，发布请求在创建 `publication_operations` 或写公开对象前稳定返回 409。

## 3. 实际 variant 集合

- 没有出厂照的 regular adoption：设定图生成 `design-sheet` 960/1600/2400 和卡片 fallback `work-card` 480/768/1200，共 12 个 WebP/fallback variant。
- 有出厂照主图：设定图只生成 `design-sheet`；主出厂照生成 3:4 `work-card` 和原比例 `detail`；非主出厂照只生成 `detail`。
- `design-sheet` 保持完整横版画布；作为 3:4 卡片 fallback 时使用 contain/pad 和 `F7F7F7` 安全背景，不做破坏性中心裁切。
- profile 调整的原子全站应用复用同一用途矩阵，先完整生成并验证设定图/出厂照目标，再切换活动 profile；没有恢复四角水印选择。

## 4. 公开读取契约

### `GET /api/public/v1/adoptions`

只输出 `publicationStatus = published`、`purpose = adoption`、`adoptionMethod = regular` 的作品。每项包含：

- 公开作品事实：`id / slug / characterName / species / suitType / purpose`；
- `adoptionMethod / businessStatus / featureTags`；
- 适用时的 `{ currency: "CNY", minorUnits }`；
- canonical `href = /works/{slug}`；
- 作为主视觉的 `designSheet: { assetId, alt, sources }`。

不返回 `ownerContact`、私有 Object Key、签名 URL、`currentEventName` 或内部 variant/profile 记录。

### `GET /api/public/v1/works/{slug}`

统一详情 `media` 保留已有 `card / gallery / primaryAssetId` 兼容字段，并新增明确的 `primaryStudioPhotoAssetId`；两者都只表达出厂照主图，没有出厂照时为 `null`，设定图主视觉不会冒充出厂照主图。此外：

- adoption：`designSheet`；
- 所有用途：`studioPhotos`，按关系位置稳定排序；
- 普通 commission/showcase 没有设定图时不输出 `designSheet`，不会出现空设定图区契约。

T25 交付的是服务端投影；公开 `/adoptions` Vue 页面和详情分区呈现仍需前端任务接线。

## 5. 前端必须呈现的进度与恢复状态

后续前端不得用客户端计时伪造进度，应直接呈现：

1. 上传阶段：创建会话、直传、`complete` 核验、READY/FAILED、可重试或取消；私有预处理失败提供 `retry-processing`；
2. 关系阶段：未保存、保存中、成功、409 陈旧版本；冲突后重新读取最新作品并让用户确认是否重做；
3. 发布前：blocker 文案、`designSheetCount / studioPhotoCount`、`requiredVariantCount / missingVariantCount`；
4. 发布中：`GENERATING_PUBLIC / APPLYING_WATERMARK / VERIFYING_PUBLIC / COMMITTING / CLEANING_PUBLIC`；
5. 失败恢复：显示 `failureStage / failureCode / cleanupPendingCount`，轮询 operation；需要时调用 `retry-cleanup`，完成后重新读取作品和发布检查；
6. 页面恢复：重载后从服务端作品版本、上传会话和 publication operation 恢复，不把未确认的本地状态当成已保存事实。

## 6. 边界

- 未实现 T24 的 Vue 管理快速编辑或角色分区 UI。
- 未实现公开 `/adoptions` Vue 页面；本记录只交接其读取 DTO。
- 未实现 `/adoptions/{slug}` 301；该基础重定向仍属于 T29。
- `event_drop / event_sale` 发布被 `EVENT_DROP_NOT_READY` 阻断；没有开放完整管理体验、展会实体或当前展会关系，这些仍属于 T37。
- T25 未勾选；需要后续前端接线、独立浏览器/视觉 Review 和用户验收。

## 7. 工程验证

```text
pnpm lint                         PASS
pnpm typecheck                    PASS
pnpm test                         13 files / 85 tests passed
pnpm test:integration             12 files / 91 tests passed
pnpm build                        PASS
pnpm verify:production            PASS
Playwright failed-case rerun      30 tests passed
```

定向用例覆盖缺设定图、成功 design-only 发布、尺寸不足 409、活动 profile identity、event-drop 阻断、T21 单主出厂照发布回归、三用途公开投影、设定图主视觉、详情媒体分区及私有联系人/私有 Key 泄漏守卫。

完整 181 项 E2E 首轮暴露 20 项失败：历史截图目录在文档重组后仍指向旧路径，以及历史已发布 `event_drop` 被错误地从统一 `/works` 投影过滤。修复后重跑全部失败位置并覆盖整个 `public-works.spec.ts`，30/30 通过；旧 `event_drop` 继续兼容统一作品投影，但不会进入 regular `/adoptions`，也不能由本轮发布。
