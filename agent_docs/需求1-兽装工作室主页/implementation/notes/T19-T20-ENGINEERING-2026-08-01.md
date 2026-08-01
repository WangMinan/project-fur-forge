# T19/T20 服务端契约锁定

> **角色**：`ENGINEERING_PRIMARY`
> **分支**：`feature/t19-t20-engineering-sol`
> **边界**：本批只锁定公开读取、首页轮播管理与公开投影的服务端契约；未实现最终 Vue 页面，`TASKS.md` 的 T19/T20 保持未勾选。

## 1. 交付范围

- `shared/schemas/public-content.ts`、`shared/schemas/home.ts` 定义稳定的公开内容和首页管理契约，`shared/types/contracts.ts` 导出对应类型。
- `server/utils/public-site-repository.ts` 提供 SSR 可直接调用的 SQLite repository 和 fake adapter；每次调用都读取当前 SQLite，不保存共享数据快照或 HTML。
- `server/utils/home-management.ts` 复用既有 `site_content`、`site_hero_slides`、`publication_operations`、媒体处理与审计链，实现首页设置、轮播项 CRUD、停用、排序和原子启用。
- `server/api/public/v1/**` 提供公开 JSON 投影；`server/api/admin/v1/site/home/**` 提供管理接口。
- `0008_seed_site_content.sql` 只补齐站点单例和口号/轮播默认值，不新增业务表。

## 2. T19 公开作品 repository

`PublicSiteRepository` 固定提供四个同步方法：

```ts
getWorkBySlug(slug: string): PublicWorkDetailDto | null
listWorks(query?: { purpose?: unknown; suitType?: unknown }): PublicWorkListDto
listFeaturedWorks(): PublicFeaturedWorksDto
getHome(): PublicHomeDto
```

作品投影规则：

- 只查询 `publication_status = 'published'`；草稿、已下架、非法 slug 和媒体不完整作品对公开侧均表现为不存在。
- 列表按 `works.sort_order, works.id` 稳定排序；精选保持同一人工顺序。
- 筛选是用途与装型的交集：`purpose = commission | adoption | showcase`，`suitType = full | partial`。
- 非法筛选不抛内部校验细节，返回 `items: []`、`resultCount: 0`、`filter.valid: false`。
- 只使用 `studio_photo`、READY 原图，以及当前 ACTIVE `brand-centered-v2` profile 下 `recipe-v1` 的 PUBLIC READY variant。
- work-card 固定宽度 `480, 768, 1200`；detail 固定宽度 `960, 1600, 2400`。每个宽度必须同时有 WebP 和一个 JPEG/PNG fallback，且摘要与字节数有效。
- 图集按 `work_assets.position` 排序，最多五张；主图必须有完整 work-card 和 detail 集合。
- 相关浏览先取同用途，再取其余作品，均沿用人工顺序，最多三项。
- 公开 DTO 仅含角色名、物种、装型、用途、ownerDisplay、短属性、适用 CNY 价格、公开路径与图片元数据；不读取或返回联系人、原图 Key、签名 URL、上传状态、内部错误。
- alt 经过公开校验：拒绝控制字符、URL、邮箱和明显的 QQ/微信/电话联系方式；数据库 alt 不安全时使用“角色名的出厂照”。

fake adapter 为 `createFakePublicSiteRepository(seed)`。seed 只接受已经通过公开 Schema 的 `details`、`featuredSlugs` 和 `home`，不复制 SQLite 业务规则。

## 3. T20 首页管理与发布

首页以 `site_content.version` 作为聚合版本。新建、更新、删除、设置、排序、启用和停用都提交 `expectedVersion`；不匹配返回 `409 CONFLICT`。单个发布操作的 retry 改用操作自身的 `version`。

启用不是布尔字段直写，而是一次发布操作：

1. 检查候选项未启用、启用后总数为 1–5、位置为 0–4 且不冲突。
2. 横版、竖版必须是两个独立资产，分别属于 `home_hero_landscape` 与 `home_hero_portrait`，由 `site/home` 上传会话产生，原图 READY 且方向正确。
3. 可选关联作品必须仍为 `published`。
4. 使用当前 ACTIVE `brand-centered-v2` 生成完整 `recipe-v1`：横版 `768, 1280, 1920`，竖版 `480, 768, 1080`；每档都必须有 WebP 与 JPEG/PNG fallback、有效 SHA-256 和正字节数。
5. 完整核验通过后，在短事务中增加首页版本、启用项目、校验全部启用项并写审计。失败时公开投影保持旧状态，并清理本次新生成对象；残余清理任务可重试。

管理查询用 `missingVariantCount` 表示横竖两组共十二个必需输出中尚缺的数量。发布操作沿用已有状态：`GENERATING_PUBLIC → APPLYING_WATERMARK → VERIFYING_PUBLIC → COMMITTING → DONE`；失败为 `FAILED`，并给出稳定的 `failureStage`、`failureCode` 和 `cleanupPendingCount`。

已启用项必须先停用再编辑或删除；至少保留一个启用项。排序请求必须一次提交全部已启用 id，服务端按数组下标写入 0 起顺序。

## 4. 公开首页投影

`PublicHomeDto` 只返回：

- `tagline`；
- `autoRotate` 和不少于 6000 ms 的 `autoRotateIntervalMs`；
- 启用项的安全 `alt`、`sortOrder`、横竖 `webp/fallback` srcset；
- 可选且仍安全的 `/works/{slug}` 链接。

公开投影不含启用字段、聚合/轮播项版本、profile id/内部参数、私有素材、对象 Key、签名 URL、发布操作或内部错误。所有 URL 都来自当前 ACTIVE profile 的内容寻址 PUBLIC variant。

## 5. 错误、缓存与安全

- 页面错误继续由全局 error handler 输出 HTML；API 错误输出 `{ "error": { "code", "message" } }` JSON。
- 管理 API 继续由管理面中间件统一设置 `Cache-Control: no-store` 与 `X-Robots-Tag: noindex, nofollow, noarchive`，并执行 Host、session、Origin 与 CSRF 门禁。
- 公开内容 JSON 明确 `Cache-Control: no-store`；repository 不持有跨请求缓存，所以下一次 SSR/JSON 请求读取最新 SQLite，发布后不需要人工清 HTML 缓存。
- PUBLIC 媒体对象以 recipe/input/profile 摘要组成内容寻址 Key；上传完成后写入 `Cache-Control: public, max-age=31536000, immutable`。
- 对外异常统一收敛为稳定 400/404/409 或安全 500，不透传 SQL、OSS、Key、签名 URL和内部错误文本。

## 6. 实现期根因修复

集成夹具用相同图片内容创建多个资产时暴露了 `asset_variants.id` 冲突。根因是 variant 记录 UUID 只由 recipe/input/profile digest 决定，缺少所属资产；共享生成器现用 `assetId + recipe digest` 计算记录 UUID，一次修复作品与首页两条调用链。recipe digest 与既有内容寻址 URL 保持不变，避免升级后重复生成同一资产的旧公开输出。

## 7. 验证边界

新增集成检查覆盖公开作品/精选/筛选/相关浏览、草稿隔离、active profile 选择、私有信息不泄漏、fake adapter，以及首页发布失败清理、retry、原子启用、设置、排序、停用、删除和版本冲突。最终 Vue 页面、浏览器视觉验收与 T19/T20 勾选留给 Kimi 接线和联合收口。

完整门禁结果：

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 12 个文件、77 个用例通过 |
| `pnpm test:integration` | 12 个文件、74 个用例通过 |
| `pnpm test:e2e` | 144 个用例通过；最终冷构建轮耗时约 4.9 分钟 |
| `pnpm build` | Nuxt/Nitro 生产构建与内容守卫通过 |
| `pnpm verify:production` | health、公开 SSR、管理 CSR 通过 |

第一次完整 E2E 被 5 分钟外层命令上限中止，未产生通过/失败结论；诊断确认冷构建产物完整且无残留测试服务后，复用该产物、由 global setup 重置临时 SQLite，并在新动态端口完成 144/144。最终结果以第二次完整退出码 0 为准。
