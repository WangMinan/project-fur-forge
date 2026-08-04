# T25 高分辨率设定图水印比例跟进

> 日期：2026-08-05
>
> 结论：用户反馈的 `/adoptions` 设定图水印偏小已完成根因修复、当前开发库原子重建和实现方浏览器复核；不改写 T25 的既有独立 Review 与用户验收历史。

## 根因与修复

- `design-sheet` 的 960 / 1600 / 2400 px 输出原先复用同一个固定像素水印；浏览器选择较大 `srcset` 候选时，水印相对画布比例随之缩小。
- 共享 `watermarkSizingReferenceWidth()` 现在让 `design-sheet` 与横版大图统一按 960 px 设定图基准等比缩放，仍保留左右两个等大水印、当前活动 profile 的透明度和管理员缩放值。
- 水印渲染修订号变更为 `responsive-design-sheet-v2`，配置摘要与公开对象 Key 随之更新；没有覆盖私有原图或旧 Key。
- 集成回归直接断言两个水印在 960 / 1600 / 2400 各宽度的 Logo 处理参数均按 `outputWidth / 960` 缩放。

## 当前开发库与真实 OSS

- 重建前备份：`.data/backups/dev-before-responsive-design-watermark-20260805-0120.db`。
- 沿既有“草稿 → 四用途预览 → 全站重建 → 原子切换 → 精确清理”链执行；活动配置仍为 50% 不透明度、50% 缩放。
- 活动 profile 从 `e92fbf18-7fdc-4e5f-911f-28eca74c0135` 切换为 `2d0c0522-70db-4a7d-b5fe-e811df9bc3d6`；操作 `1fa04d8b-8011-437a-9523-6b0a38eb68a7` 为 `DONE`，生成 60 / 核验 60。
- 当前领养设定图仅保留新活动 profile 的 960 / 1600 / 2400 WebP + JPEG 各一份，公开投影没有混用旧 profile。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/media-recipe.test.ts tests/integration/watermark-branding.test.ts` | 2 files / 16 tests PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| 真实 Chrome，`127.0.0.1:3000/adoptions`，390 / 768 / 1440 | 图片解码、布局与新活动对象 PASS |
| 2400 px WebP 原图视觉检查 | 左右水印保持与 960 px 版本相同相对尺寸 |
| 浏览器 console | 0 error / 0 warning；仅开发态 Nuxt info |

截图：

- `screenshots/t25-design-watermark-2026-08-05/adoptions-390x844.png`
- `screenshots/t25-design-watermark-2026-08-05/adoptions-768x1024.png`
- `screenshots/t25-design-watermark-2026-08-05/adoptions-1440x900.png`

本记录是收口后缺陷修复证据，不替代后续 T33 的全站三视口媒体回归。
