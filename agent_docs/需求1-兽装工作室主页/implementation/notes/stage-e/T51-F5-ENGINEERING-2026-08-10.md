# T51-F5 工程记录 · 竖版详情水印与卡片/预览对齐

> 日期：2026-08-10
> 基线：`076e137f519fe7efb7b72efa52ba23bc6137bf32`（写入前本地 `main` 与 `origin/main` 一致）
> 角色：实现、工程自测与用户视觉确认；不代签 T49-R1 新上下文独立 Review，也不关闭 T50、GATE-E 或正式上线门禁

## 范围与结论

用户在真实作品“虾片”中确认：`/works` 的 3:4 作品卡已经显示预期的大水印，但同一张竖版出厂照在作品详情和管理端“公开水印预览”中仍显示小水印。

根因是 `recipe-v3` 对 3:4 `work-card` 使用 480 px 水印参考宽度，对竖版 `detail` 使用 960 px 参考宽度。虽然两者都随输出宽度等比放大，但详情的相对水印尺寸因此恰好只有卡片的一半；后台预览复用 `detail`，所以同时偏小。

本轮把竖版 `studio_photo` 的 `detail` 与 3:4 `work-card` 统一为 480 px 水印参考宽度。真实 OSS 后台预览已显示与卡片一致的大水印，用户明确确认修复正常，并授权在检查完成后发布新镜像。工程结果 PASS；T49-R1 独立 Review 仍保持开放。

## 实现与边界

- `buildWatermarkProcess()` 继续是发布与后台预览的唯一处理串入口；未增加 CSS 叠层、第二套预览器或单独水印参数；
- 竖版 `detail` 与 `work-card` 共用 480 px 参考宽度，仍各自只烘焙一个 `center` 水印；
- 横版 `detail` 仍使用活动 profile 的固定尺寸，`design-sheet` 仍使用 960 px 参考宽度的左右双水印；
- `watermarkSizingReferenceWidth` 已进入现有配方身份，960 → 480 的像素变化会产生新的 `recipe-v3` 身份哈希和不可变 Object Key，不会错误复用旧小水印对象；
- 没有数据库迁移、运行时配置或环境变量变化；回滚使用旧镜像/旧代码即可，不能覆盖已发布不可变对象；
- 本轮没有对已发布“虾片”执行下架/重新发布。旧详情对象保持原样；部署新镜像后，下一次受控重新发布或全局水印重建会按新身份生成完整详情 SourceSet。

## 测试与真实浏览器证据

- `APP_ENV=test pnpm exec vitest run --config vitest.integration.config.ts tests/integration/media-recipe.test.ts`：1 个文件、8 项全部通过；新增断言证明卡片、竖版详情和后台详情预览使用同一相对尺寸，960 px 详情/预览水印宽度均为 984 px；
- `APP_ENV=test pnpm lint`：通过；
- `APP_ENV=test pnpm typecheck`：通过；
- `APP_ENV=test pnpm test`：31 个文件、168 项全部通过；
- `APP_ENV=test pnpm test:integration`：20 个文件、172 项全部通过；
- `APP_ENV=production pnpm build`：通过，production content guard 同步通过；只有已知插件耗时警告；
- `APP_ENV=production pnpm run verify:production`：通过，health、公开 SSR 与管理 CSR 基线正常；
- 真实本地数据：主出厂照为 1600×2400，发布处理源为 2400×3600；现有公开 SourceSet 含 `recipe-v3` 的 960/1600/2400 详情档与 480/768/1200 卡片档；
- 在已登录管理页重新生成真实 OSS 960×1440 WebP 预览，解码完成且显示大水印；用户根据后台预览、`/works` 卡片和作品详情三张截图确认修复正常。

本轮浏览器验证只生成并自动清理临时私有预览，没有修改作品字段、上下架状态或公开对象。新 SHA 的 GitHub Actions、独立 Review 和发布镜像证据必须分别记录，不能由本地通过或用户视觉确认代签。
