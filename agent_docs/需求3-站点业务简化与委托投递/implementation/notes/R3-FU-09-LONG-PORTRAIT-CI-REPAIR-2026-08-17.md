# R3 FU-09/FU-10 · 长竖作品适配与 CI 修复

## 1. 首次事实

- 引用任务中的失败发生在作品发布 `PREPARING_SOURCE` 阶段，稳定错误为 `STUDIO_PHOTO_UPSCALE_FAILED`。
- 1139×2083 出厂照为满足 2400 px `detail` 宽度，FFmpeg Lanczos 保持原比例生成约 2400×4390；FFmpeg 能完成处理，但 `asset_variants_source_insert` 的历史 4096 px preprocess 上限拒绝数据库写入。
- 请求检查的 Actions run [31961750619](https://github.com/WangMinan/project-fur-forge/actions/runs/31961750619) 绑定 `d8661fe801ff68bbd9255fc5c2046724721b9a48`，结论为 failure：checks/image-build 成功，E2E 有官方邮箱可访问名称、领养物种位置和备案配置三项失败。
- 当前分支基线 `fbb67da6bf25760e7e94a14f10362962a31c48f9` 已包含领养物种位置修正；其 Actions run [31963154566](https://github.com/WangMinan/project-fur-forge/actions/runs/31963154566) 最终为 failure（236 passed / 2 failed），只剩官方邮箱可访问名称和备案配置两项。当前本地修复未提交，不能把任一旧 SHA 流水线写成修复证据。

## 2. 修复边界

- 新增前向迁移 `0044_work_upscale_long_portrait.sql`，不改写历史迁移。
- 普通 preprocess 的 4096 px 上限保持；所有 READY preprocess 的 20MB 上限保持。
- 只有角色与 `studio-photo-upscale-lanczos-v1` / `design-sheet-upscale-lanczos-v1` 精确匹配时允许超过 4096 px；通用 12000 px、PRIVATE、同资产/同角色 lineage、不可变身份和原图保留约束继续有效。
- Playwright 隔离服务器显式注入仓库测试备案值，不再依赖开发机 `.env`。
- 官方邮箱 E2E 使用当前按钮可访问名称定位，并继续精确断言 `mailto:channels@example.test`，不改变公开 UI。

## 3. 本地验证

```text
APP_ENV=test pnpm lint                                      PASS
APP_ENV=test pnpm typecheck                                 PASS
APP_ENV=test pnpm test                                      38 files / 187 tests PASS
APP_ENV=test pnpm test:integration                          29 files / 200 tests PASS
pnpm exec playwright test admin-content-sections +
  public-adoptions + t51-brand-filing                       20 tests PASS
APP_ENV=production pnpm build                               PASS, content guard PASS
APP_ENV=production pnpm run verify:production               PASS
```

精确媒体回归证明 1139×2083 → 2400×4390、READY PRIVATE preprocess、永久原图仍存在、12 个 PUBLIC 变体完成；Schema 回归同时证明普通 4097 px preprocess 仍被拒绝。测试只使用临时 SQLite、合成图和 fake media storage，未连接生产数据库、OSS 或 ESA。

## 4. 未代签

- 本地验证不等于修复 SHA 的远端 CI；提交/推送后必须绑定新 SHA 复核 checks、image-build 与 E2E。
- 未执行独立 Review、用户验收、生产数据库迁移、真实 OSS/ESA 发布或生产页面重试。
