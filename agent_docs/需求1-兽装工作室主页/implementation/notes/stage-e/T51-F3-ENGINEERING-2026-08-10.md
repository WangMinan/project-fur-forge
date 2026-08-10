# T51-F3 工程记录 · 低分辨率出厂照非阻断适配

> 日期：2026-08-10
> 基线：`d4deed4eaf139f07ecb7bbab202fdd11a39738c6`（写入前本地 `main` 与 `origin/main` 一致）
> 角色：实现与工程自测；不代签 T49 新上下文独立 Review

## 范围与结论

作品编辑器不再因出厂照低于 2400 px 详情图或 1200 × 1600 卡片图所需像素而阻断上传、保存或发布。低分辨率出厂照在原有作品 publication operation 的 `PREPARING_SOURCE` 阶段通过内嵌 FFmpeg Lanczos 保持比例放大；永久原图保留不覆盖，公开衍生图只消费验证完成的私有处理源。

用户在当前交互中确认浏览器上的目标行为可用，并要求不再扩展浏览器流程。该确认关闭本次反馈的页面行为，不替代 T49 独立综合 Review。

## 实现

- 删除 `STUDIO_PHOTO_SOURCE_TOO_SMALL` 发布 blocker，增加非阻断 `studioPhotoNeedsPreprocess` 检查字段；
- 抽取通用 `upscaleImageToMinimum` FFmpeg 入口，保留原设定图兼容导出；
- 新增不可变 `studio-photo-upscale-lanczos-v1` 私有 preprocess 身份，主图同时覆盖 2400 px `detail` 与 1200 × 1600 `work-card`，非主图覆盖 `detail`；
- 卡片裁切和水印处理使用实际处理源几何尺寸，并以 `source_variant_id` 绑定公开变体；
- 出厂照区和发布区明确提示放大不会恢复细节、原图保留；适配失败记录 `STUDIO_PHOTO_UPSCALE_FAILED`，作品保持未发布并可重试；
- 未改变 20 MB 上传上限、源图私有边界、公开 `recipe-v2`、水印策略或删除语义。

## 测试与证据

- `APP_ENV=test pnpm typecheck`：通过；
- `APP_ENV=test pnpm lint`：通过；
- `APP_ENV=test pnpm test`：29 个文件、162 项测试全部通过；
- `APP_ENV=test pnpm exec vitest run --config vitest.integration.config.ts tests/integration/work-publication.test.ts`：1 个文件、16 项通过；
- `APP_ENV=test pnpm exec vitest run --config vitest.integration.config.ts tests/integration/media-recipe.test.ts`：1 个文件、7 项通过；
- `APP_ENV=test pnpm exec playwright test tests/e2e/admin-publication.spec.ts --grep "低分辨率出厂照"`：1 项通过；之后按用户要求不再继续浏览器流程；
- `APP_ENV=production pnpm build`：通过，production content guard 同步通过；只有既有插件耗时提示。

集成断言覆盖：低分辨率原图可发布、私有适配源达到用途尺寸、公开变体绑定处理源、原图仍存在，以及 FFmpeg/存储失败时保留原图并可重新发布。工程结果为 PASS；T49 独立 Review 仍开放。
