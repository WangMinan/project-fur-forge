# T51-F7 管理私有预览与 Hero 4K 媒体升级工程记录

> 日期：2026-08-14
> 基线：`origin/main` `c722157ffb7dca624614d0cbafc30d3e2dedc30b`
> 分支：`fix/hero-media-v2-admin-previews`
> 结论：**PASS WITH FOLLOW-UP**（工程自测通过；T49-R1 独立 Review、最终提交 SHA 对应 CI、镜像发布与远端一次性升级未执行）

## 范围与边界

- 管理列表/卡片固定请求认证同源 `w=320`，较大编辑预览固定 `w=640`；永久原图只由明确“查看原图”入口请求 `original=1`。
- 预览与原图继续经过管理 Host/Session 并保持既有 `no-store`；缺参、非法宽度、参数混用或缩略失败均不得回传永久原图。
- 首页横版 Hero 的当前配方为不可变 `site-display-v2`：768/1280/1920/2880/3840，WebP q90；其它站点宽度不借机扩大。
- 每个 Hero 横竖 SourceSet 只选择一代完整配方：完整 v2 优先，否则完整 v1；不能混用两代宽度。旧 v1 对象不覆盖、不删除。
- 本任务未执行云侧 OSS/ESA 写操作、正式升级、发布、提交或推送。

## 实现与迁移

- 新增 `0034_t51_f7_site_display_v2.sql` 前向迁移，保留 v1 行并允许 v2 复用原有公开无水印安全约束。
- 低分辨率横版 Hero 的私有适配目标升级为 3840×2160、`hero-upscale-lanczos-v2`；永久原图仍保留在 private Bucket。
- 新增 `pnpm media:upgrade-site-display-v2`，默认 dry-run、可重入；发布镜像提供同参数 `upgrade-site-display-v2` 子命令。两端共用同一 parser，支持 `all/home-hero/commission-hero/home-entry` 与显式 `--no-dry-run`。
- 远端文档要求先 dry-run，再由同一冻结镜像执行一次性容器写入；每个资产全套验证完成后才切换公开 DTO。

## 首次失败与修复

1. `pnpm db:generate` 在非 TTY 中因历史手写迁移之后的列映射确认提示停止，未生成文件。按仓库既有前向迁移方式新增 0034，只重建 SQLite 无法原地修改 CHECK 的 `asset_variants`；迁移集成测试验证旧 v1/新 v2 共存。
2. 真实 4K Lanczos unit 首次超过旧 30 秒上限；只把两个 4K FFmpeg 用例超时提高到 120 秒，尺寸、字节上限、滤镜和事件循环断言未放宽，精确重跑 40/40 通过。
3. 集成首次暴露管理 Hero DTO `missingVariantCount` 仍上限 12；同步为 16，并把首页进度从硬编码 12 改为首页 16/委托 12，失败文件重跑通过。
4. 浏览器首次 29/34 通过；5 个失败来自旧 E2E seed 默认 3200×1800 与 4K 合同冲突，以及新增分辨率状态造成 locator 二义。种子改为 4000×2250、定位器按状态文案收窄后，失败 5 项精确重跑 5/5 通过。

## 本地证据

- `APP_ENV=test pnpm lint`：通过。
- `APP_ENV=test pnpm typecheck`：通过。
- 相关 unit：6 文件、40 项通过，覆盖 320/640/original 参数、q90/4K、v1/v2 投影、CLI 参数透传、部署命令与 FFmpeg。
- `domain-schema + site-display-reconcile`：2 文件、25 项通过；其它相关 integration 4 文件、40 项最终通过（其中 `public-site-contracts` 修复后 8/8）。
- `admin-home` 最终状态完整重跑 17/17 通过；`admin-media` 17/17 通过，共 34 项。
- `pnpm ops:build`：通过，生成发布镜像使用的 bundled `ops.mjs`。
- `APP_ENV=production pnpm build`：通过，包含生产内容守卫。
- `pnpm run verify:production`：通过（health、公开 SSR、管理 CSR）。
- `git diff --check`：通过。

## 未签署门禁

- 本记录是实现者工程自测，不是 T49-R1 独立 Review，也不是用户验收。
- 未取得最终提交 SHA 对应的远端 Actions、冻结镜像摘要或 `image-release-evidence`。
- 未在正式数据库/OSS/ESA 执行 v2 dry-run 或写入升级；远端执行必须先备份、迁移并使用 Handbook 中的冻结镜像命令。
