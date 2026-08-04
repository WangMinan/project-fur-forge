# T26-F1 首页/委托页大图水印跟进（2026-08-04）

## 用户确认

- 不是所有公开图片都使用双水印；
- 首页和委托页横版大图复用作品横版设定图的左右双水印与视觉比例；
- 首页和委托页竖版大图复用作品卡图片的单个居中水印与视觉比例。

## 根因与实现

首页和委托页原本已经共用 `generatePublicVariants`，问题不在某个管理 Tab 漏接，而在共享 `recipe-v2` 只把 `design-sheet` 判为左右双水印，两个大图用途都落入单个居中水印分支，且水印宽度没有随大图输出尺寸等比调整。

本次只修改共享媒体配方：

- `home-hero-landscape` 使用 `g_west`、`g_east` 两枚水印，并以 960 px 设定图输出为视觉基准等比缩放；
- `home-hero-portrait` 使用一枚 `g_center` 水印，并以 480 px 作品卡输出为视觉基准等比缩放；
- `design-sheet`、`studio_photo` 的既有布局不变；
- 渲染修订进入水印配置摘要，继续复用既有不可变 profile 和原子全站重建流程。

## 当前库与真实 OSS

- 重建前备份：`.data/backups/pre-hero-double-watermark-2026-08-04.db`；
- 活动 profile：`e92fbf18-7fdc-4e5f-911f-28eca74c0135`；
- 原子重建状态：`DONE`，2 个作品、2 个大图项，60/60 个目标变体均已生成并校验；
- 首页与委托页各有 6 个横版、6 个竖版活动 profile 变体；旧 profile 变体已清理，未完成操作为 0，`PRAGMA integrity_check` 为 `ok`。

## 验证

- `pnpm lint`：通过；
- `pnpm typecheck`：通过；
- `pnpm test`：16 个文件、102 项通过；
- `pnpm test:integration`：12 个文件、96 项通过；
- `pnpm build`：通过；
- 真实公开端 `http://127.0.0.1:3000/` 与 `/commission`：桌面横图均为放大的左右双水印，手机竖图均为单个居中水印；图片正常解码，console error/warning 均为 0。

该跟进不替代 T26-F1 的新上下文独立 Review 与用户最终验收。
