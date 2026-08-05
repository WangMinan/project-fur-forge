# T34-F1 实施记录：站点无水印媒体契约、迁移与公开投影

> **日期**：2026-08-05。
> **角色**：实施证据。当前规则以 [`../../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../../requirements/MEDIA-PUBLICATION-POLICY.md) 为准，本文不重复策略正文。
> **提交**：`d3702ca` `feat(T34-F1): add unwatermarked site-display media contract`。
> **基线**：`4217cb7`。

## 目标

建立严格区分“站点无水印展示图”和“作品水印保护图”的统一媒体模型，让首页与委托页大图不再套用活动水印 profile，并让首页两个业务入口使用各自独立的公开派生图。

## 主要改动

### 数据库

新增前向迁移 `0017_t34_f1_site_display_protection.sql`，未修改任何已执行的历史迁移。

- `asset_variants` 增加显式 `protection_mode`，取值只允许 `none | watermark`；
- `usage` 允许集合增加 `commission-hero-landscape`、`commission-hero-portrait`、`home-entry-commission`、`home-entry-adoption`；
- 新增约束：
  - `asset_variants_protection_mode`：枚举收敛；
  - `asset_variants_unprotected_identity`：`none` 时不得携带 profile、Logo、位置、不透明度和缩放；
  - `asset_variants_site_display_recipe` 与 `asset_variants_site_display_usage`：`site-display-v1` 必须公开且无保护，新增 usage 必须使用该配方；
  - `asset_variants_public_protection`：公开对象要么是 `watermark`，要么是 `site-display-v1`；
  - `asset_variants_private_unprotected`：私有对象一律 `none`，避免私有 preprocess 被误归为公开无水印变体；
- 原 `asset_variants_public_watermark` 改为只在 `protection_mode = 'watermark'` 时生效；
- 重建表后按原样恢复 6 个触发器，`asset_variants_identity_immutable` 增加 `protection_mode` 为不可变身份字段。

### backfill

迁移内一次性回填，规则明确、不靠猜测：

| 原始行 | `protection_mode` |
| --- | --- |
| `storage_scope = 'PRIVATE'` 或 `usage = 'preprocess'` | `none` |
| 其余公开行（现有作品与旧 Hero 水印变体） | `watermark` |

### 配方与用途

新增 `server/utils/site-display-recipe.ts`：`site-display-v1`，`protectionMode = none`，身份含输入资产、输入 SHA、usage、目标宽高、格式、质量、cover 与焦点，不含任何水印身份。

| usage | 源角色 | 宽度 | 比例 |
| --- | --- | --- | --- |
| `home-hero-landscape` | `home_hero_landscape` | 768/1280/1920 | 16:9 |
| `home-hero-portrait` | `home_hero_portrait` | 480/768/1080 | 9:16 |
| `commission-hero-landscape` | `home_hero_landscape` | 768/1280/1920 | 16:9 |
| `commission-hero-portrait` | `home_hero_portrait` | 480/768/1080 | 9:16 |
| `home-entry-commission` | `home_hero_landscape` | 480/768/1080 | 3:2 |
| `home-entry-adoption` | `design_sheet` | 480/768/1080 | 3:2 |

委托 Hero 不再借用 `home-hero-*` 名称承载，逻辑名称与展示位置一致。

同时抽出 `server/utils/media-source.ts`：`readyAssetSource`、`processingSource`、摘要、格式与 Object Key 前缀等原语由 `media-recipe` 与 `site-display-recipe` 共用，避免两套输入解析实现漂移。

### 首页业务入口独立派生

`server/utils/site-entry.ts` 负责源选择与投影：

- 委托入口源 = 当前启用的委托页 Hero 横版资产，在委托 Hero 发布时生成 `home-entry-commission`；
- 领养入口源 = 已发布常规领养的设定图，在作品发布时生成 `home-entry-adoption`；
- 两个入口都是独立 usage 与独立不可变 Object Key，**不复用委托 Hero 或领养设定图的公开 URL**；
- 无可用源或变体不完整时受控隐藏，不回退到任意作品、私有原图或错误业务图片。

领养入口变体属于站点展示位，生成失败只记脱敏日志并隐藏入口，不阻塞作品发布；作品自身的水印完整性仍由原 `missingVariantCount` 把关。

### 公开投影与迁移兼容

`media-mapper` 的 Hero 投影按 placement 选择对应 usage，优先命中无水印变体；只有当无水印变体不完整时，才回退读取旧水印 Hero 变体。`validateHeroSlidesForPublication` 同步改为“站点展示完整即通过，否则回退检查旧水印变体”，因此迁移期间既有已启用 Hero 不会因为缺少新变体而失效。

### profile 切换边界

- `watermarkTargets` 移除 Hero 资产，profile 重建只处理作品保护图；
- 清理查询增加 `protection_mode = 'watermark'`，**修掉一处会误删站点无水印变体的旧条件**（原查询按 `watermark_profile_id IS NOT ?` 匹配，`NULL` 的站点变体会被纳入清理清单）；
- 影响摘要区分 `targetVariantCount`（作品保护图，会重做）与 `siteDisplayVariantCount`（站点无水印图，不受影响）；
- 水印预览 kind 由 4 项（含两个 Hero）改为 3 项 `work-card | detail | design-sheet`，`startWatermarkProfileApplication` 的已核验预览数同步由 4 改为 3。

### 管理端接线

`BrandingApplyCard` 明确告知：水印只用于作品列表、作品详情、领养列表和设定图；首页与委托页大图始终不打水印，换水印不会改变它们。未向非开发用户暴露内部 recipe ID。

## 兼容边界

1. 未修改已执行迁移；
2. 现有作品水印变体与历史 profile 全部保留；
3. 旧 Hero 水印变体只作迁移期兼容读取，不再生成；
4. 站点展示变体全部新 Key，不原位覆盖既有对象；
5. 生成失败只清理本次新建对象，旧公开引用与页面保持可用；
6. 旧 Hero 水印对象的清理留到用户验收后执行，本轮不删除。

## 首次 findings 与修复

| # | finding | 处理 |
| --- | --- | --- |
| 1 | profile 清理查询会把 `watermark_profile_id IS NULL` 的站点无水印变体纳入删除清单 | 两处清理查询增加 `protection_mode = 'watermark'` |
| 2 | 既有 preprocess 插入未声明 `protection_mode`，落到默认 `watermark` 触发 `asset_variants_preprocess_private` | `media-completion`、`media-recipe` 与测试 fixture 全部显式写 `'none'`，不依赖默认值 |
| 3 | `getAdminHome` 仍查活动 profile 计算 Hero 缺失数 | 改为按 `missingSiteDisplayVariantCount` 计算，管理端读取少一条查询 |
| 4 | `database.test.ts` 的 legacy fixture 在 0007 前的表结构上插入 `protection_mode` | 还原为迁移前列形状，改由 0017 backfill 承担该场景 |

另有一次工具返回声称编辑成功但磁盘未写入的情况，已通过 `git status` 与 `grep` 复核后重做并确认落盘；后续关键写入均补充读回验证。

## 测试与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS（18 文件 / 105 用例） |
| `pnpm test:integration` | PASS（11/12 文件；`auth-api` 并行下服务器启动失败，单独重跑 9/9 PASS） |
| `pnpm build` | PASS（含 `guard-production-content`） |
| `npx playwright test tests/e2e/public-home.spec.ts` | 17/18 PASS；失败项为 Chrome 启动崩溃，单独重跑 PASS |

迁移专项验证（临时库，不动开发库）：

- 全新库迁移 18 项，`integrity_check = ok`，外键 0 违规，6 个触发器齐全；
- 0016 → 0017 升级：公开水印行回填为 `watermark`，preprocess 回填为 `none`，完整性与外键均通过；
- 约束探针：`none` + 水印身份 → `asset_variants_unprotected_identity`；`none` + `recipe-v1` 公开行 → `asset_variants_public_protection`；`watermark` 正常写入。

两次 flaky 均为环境层（并行 worker 资源竞争、浏览器进程启动），非本次改动引入的断言回归。

## 未执行项

- 真实双 Bucket 定向验证：本轮未执行，留待 T34-F8 交付前统一执行；
- 未打印、提交或记录任何真实 OSS Secret；
- 旧 Hero 水印对象清理：按策略第 7 节留到用户验收后。

## 用户 Review 清单（F1 部分）

1. 首页横竖 Hero 与委托页横竖 Hero 均无水印；
2. 首页“自设委托”“角色领养”入口图无水印，且 URL 与委托 Hero、领养设定图不同；
3. 作品列表、作品详情、领养列表与设定图仍有水印；
4. 更换水印 profile 后作品图变化，四类站点展示图 URL 与摘要不变；
5. 管理端“应用到全站”文案正确区分作品保护图与站点无水印图。
