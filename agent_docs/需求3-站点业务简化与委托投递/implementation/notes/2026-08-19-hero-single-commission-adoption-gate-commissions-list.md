# 2026-08-19 · 委托页单图、领养门禁二选一、委托申请分页与水印重建修复

直接获用户授权在 main 上执行（本轮明示，不扩散到后续任务）。

## 触发

1. 管理端「委托页大图/横版、竖版」与首页集合逻辑相同（可多图轮播），但委托页只用一张大图；
   且与首页不同，委托集合需要允许下架替换。
2. 领养作品发布强制要求横版封面；用户要求 `adoption_cover` 与 `design_sheet` 上传其一即可发布。
3. `/admin/commissions` 缺少查找与分页。
4. 用户报告已发布领养作品「小绿狗」在 `/adoptions` 不可见。

## 根因（/adoptions 变空）

`WATERMARK_REBUILD` 的生成目标 `findWatermarkTargets` 只含 `studio_photo`/`design_sheet`，
但清理阶段 `findPublicKeysForOtherProfiles` 删除**全部**旧 profile 的水印公开变体——包括
`adoption_cover` 的 `adoption-card`。2026-08-18 01:40 发布（verify 通过、变体存在），
01:44 水印重建后封面公开图被删且不再生成，公开快照因 `coverSources` 为空丢弃整条领养作品。

## 改动

- `findWatermarkTargets` / `targetUsages` 纳入 `adoption_cover`（`adoption-card` 变体随重建再生成）；
  新增集成回归用例（封面变体换新 profile、旧键进清理清单）。
- `checkWorkPublication`：`ADOPTION_COVER_REQUIRED` 退役；领养无封面且无设定图时报
  `ADOPTION_MEDIA_REQUIRED`（文案同步为「横版封面或设定图」）；出厂照仍不能单独支撑领养发布。
  `mediaReady` 预览同规则。公开快照封面位回落到设定图；封面与设定图同一张时详情不重复入图集。
- 委托 Hero 集合：`assertItemCanEnable` 启用上限按 placement 区分（commission=1，home=5）；
  `assertItemCanDisable` 对 commission 跳过 `HERO_LAST_ENABLED_ITEM`。管理端委托 Tab 隐藏顺位
  与排序按钮、固定 sortOrder 0、`已启用 X / 1`，409 `HERO_SLOT_LIMIT` 给出替换指引文案。
- `/admin/commissions`：复用 `AdminPagination` 与 `admin-work-list` 分页工具，客户端按
  昵称/物种/回执编号查找；状态 Tab 语义不变。

## 既有数据修复

本地 dev 库两件已发布领养作品（小绿狗、小狗）缺封面公开变体：经管理端「下架 → 发布」
或重新应用水印重建，变体即按修复后的目标集再生。生产如出现同类记录同理；不重写历史迁移。
