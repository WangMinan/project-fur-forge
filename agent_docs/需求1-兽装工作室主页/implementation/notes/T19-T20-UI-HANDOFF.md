# T19/T20 Kimi UI 交接

> **交接对象**：Kimi K3
> **工程基线**：`feature/t19-t20-engineering-sol`
> **约束**：消费这里列出的 repository、Schema 和 API；不要自行推导媒体完整性、profile、版本或发布规则。完成 UI 前不要勾选 T19/T20。

## 1. 唯一类型来源

- 公开作品与筛选：`shared/schemas/public-content.ts`
- 首页管理与公开首页：`shared/schemas/home.ts`
- 图片 `srcset` 与安全 alt：`shared/schemas/media.ts`
- 发布操作：`shared/schemas/publication.ts`
- TypeScript 类型统一从 `shared/types/contracts.ts` 导入。

不要在 Vue 文件复制接口类型、宽度数组或枚举。服务端内部存在而公开 Schema 没有的字段，UI 不得尝试读取。

## 2. SSR 调用

服务端组件、Nitro handler 或 SSR loader 可直接调用：

```ts
import { getPublicSiteRepository } from '~/server/utils/public-site-repository'

const repository = getPublicSiteRepository()
const detail = repository.getWorkBySlug(slug) // null => 页面 404
const works = repository.listWorks({ purpose, suitType })
const featured = repository.listFeaturedWorks()
const home = repository.getHome()
```

公开页面也可消费下列 JSON API；响应统一为 `{ data: ... }`，并且不缓存共享 HTML/数据快照：

| 方法 | 路径 | 返回 |
| --- | --- | --- |
| GET | `/api/public/v1/works?purpose=commission&suitType=full` | `PublicWorkListDto` |
| GET | `/api/public/v1/works/featured` | `PublicFeaturedWorksDto` |
| GET | `/api/public/v1/works/{slug}` | `PublicWorkDetailDto`；不存在为 404 |
| GET | `/api/public/v1/home` | `PublicHomeDto` |

非法列表参数不是页面错误：显示空结果并以 `data.filter.valid === false` 决定是否复位筛选。`resultCount` 是服务端过滤后的准确数量。

## 3. 作品卡片和详情图片

每个 `sources` 都是：

```ts
{
  webp: Array<{ src: string; width: number; height: number; format: 'webp' }>
  fallback: Array<{ src: string; width: number; height: number; format: 'jpeg' | 'png' }>
}
```

数组已按 width 从小到大排列；不要重排、补宽度或从 URL 猜 profile。work-card 固定 `480, 768, 1200`，detail 固定 `960, 1600, 2400`。

`<picture>` 选择顺序固定：先声明 WebP `<source>`，最后用 fallback 最大宽度的 `src` 作为 `<img src>`，同组完整数组拼 `srcset`。3:4 作品卡片的布局比例由页面 CSS 负责，不要裁切或改写服务端 variant URL。

```vue
<picture>
  <source
    type="image/webp"
    :srcset="sources.webp.map(item => `${item.src} ${item.width}w`).join(', ')"
  >
  <img
    :src="sources.fallback.at(-1)!.src"
    :srcset="sources.fallback.map(item => `${item.src} ${item.width}w`).join(', ')"
    :alt="alt"
  >
</picture>
```

`alt` 已是公开安全值，原样绑定；不要拼联系人、ownerContact 或后台备注。作品链接只使用响应中的 `href`。

## 4. 首页公开图片

`PublicHomeDto`：

```ts
{
  tagline: string
  autoRotate: boolean
  autoRotateIntervalMs: number // >= 6000
  slides: Array<{
    alt: string
    sortOrder: 0 | 1 | 2 | 3 | 4
    landscape: PublicSourceSetDto
    portrait: PublicSourceSetDto
    linkedWorkHref: string | null
  }>
}
```

- `<picture>` 先放竖版 WebP/Fallback `<source media="(orientation: portrait)">`，再放横版 WebP `<source>`，最终 `<img>` 用横版 fallback。各 srcset 仍按服务器给出的升序拼接。
- 横版宽度为 `768, 1280, 1920`，竖版为 `480, 768, 1080`；不要复用同一资产，不要为缺图客户端降级到私有原图。
- 仅当 `linkedWorkHref !== null` 时包安全链接。
- `autoRotate === false` 时禁止定时切换；为 true 时直接使用 `autoRotateIntervalMs`，UI 不得低于 6000 ms。仍须保留暂停/手动切换和 `prefers-reduced-motion` 的可访问性处理。
- 站点口号直接使用 `tagline`，不要在前端硬编码。

## 5. 首页管理 API

所有路径位于管理面，继续发送现有 session、Origin 和 `X-CSRF-Token`。成功响应除启用/retry 外均为 `{ data: AdminHomeDto }`。

| 方法 | 路径 | payload | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/v1/site/home` | 无 | 首页聚合、全部轮播项和当前版本 |
| PUT | `/api/admin/v1/site/home/settings` | 设置 | 口号、自动轮播、间隔 |
| POST | `/api/admin/v1/site/home/slides` | 轮播项 | 新建为停用态，201 |
| PUT | `/api/admin/v1/site/home/slides/{id}` | 轮播项 | 仅停用项可编辑 |
| DELETE | `/api/admin/v1/site/home/slides/{id}` | `{}` | 仅停用项可删除 |
| PUT | `/api/admin/v1/site/home/slides/order` | `{ slideIds }` | 必须提交全部启用项 |
| POST | `/api/admin/v1/site/home/slides/{id}/enable` | `{}` | 启动异步发布，返回操作 |
| POST | `/api/admin/v1/site/home/slides/{id}/disable` | `{}` | 至少保留一个启用项 |
| POST | `/api/admin/v1/site/home/publication-operations/{id}/retry` | `{}` | 重试失败操作 |

版本请求外壳固定：

```json
{
  "expectedVersion": 3,
  "payload": {}
}
```

设置 payload：

```json
{
  "tagline": "不只做小狗毛",
  "autoRotate": true,
  "autoRotateIntervalMs": 8000
}
```

新建/更新轮播项 payload：

```json
{
  "alt": "角色名的首页展示照",
  "sortOrder": 0,
  "landscapeAssetId": "横版资产 UUID",
  "portraitAssetId": "竖版资产 UUID",
  "linkedWorkId": "已发布作品 UUID 或 null"
}
```

排序 payload：`{ "slideIds": ["按目标顺序排列的全部启用项 UUID"] }`。

## 6. 版本与发布状态

- 页面首次 GET 保存 `AdminHomeDto.version`；每次成功 mutation 都用响应中的新 version 覆盖本地值。
- `409 CONFLICT` 表示聚合版本过期或业务条件变化：重新 GET，不要自动覆盖服务端。
- 停用项关联的作品后来下架时，`linkedWork.publicationStatus` 会显示 `unpublished`；先清除/更换关联，不能把它当作可启用项。
- 启用返回 `PublicationOperationDto`，HTTP 响应只代表任务已受理，不代表已启用。
- 用已有 `GET /api/admin/v1/publication-operations/{operationId}` 轮询，直到 `DONE` 或 `FAILED`；`DONE` 后重新 GET 首页。
- `AdminHeroSlideDto.missingVariantCount` 范围 0–12，可用于发布前/后的进度提示；不要从 OSS 列表自行计算。
- retry 的 `expectedVersion` 是失败操作的 `version`，不是首页 version。retry 返回非 FAILED 后继续轮询同一 operation id。

## 7. 错误处理

API 错误固定为：

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Resource version is stale."
  }
}
```

- `400 VALIDATION_ERROR`：请求结构、alt、间隔或 id 非法。
- `401 UNAUTHORIZED`：登录失效，进入现有登录恢复流程。
- `403 FORBIDDEN`：Host/Origin/CSRF 或权限拒绝，不重试 mutation。
- `404 NOT_FOUND`：作品、轮播项、资产或操作不存在。
- `409 CONFLICT`：版本过期、资源被占用、关联作品非 published、资产角色/方向/READY 不满足、1–5 项约束或正在发布。
- `500 INTERNAL_ERROR`：只显示稳定提示与 request id；不要把错误正文当作可诊断 SQL/OSS 信息。

管理 API 已统一 `no-store/noindex`。公开作品与首页 API 也是 `no-store`，下次 SSR/请求会读最新 SQLite；不要增加会在发布后保留旧 HTML 的共享缓存。

## 8. fixture 与不可推导规则

公开页面测试可用 `createFakePublicSiteRepository({ details, featuredSlugs, home })`，seed 必须先满足共享 Schema。浏览器 fixture 应走真实管理 API/数据库种子后再读公开投影，不要伪造内部 variant 字段。

以下规则不可由 Kimi 自行推导或改写：

- active profile 只能由服务端选择，当前必须是 `brand-centered-v2`；
- WebP/fallback 是否完整、SHA-256/byte size 是否有效，只信服务端；
- 启用等于发布，不能直接切换 `enabled`；
- 横竖资产必须独立、角色和方向必须对应；
- 可选作品链接只信 `linkedWorkHref`，不从 `linkedWorkId` 拼 URL；
- 列表、精选、相关浏览和轮播顺序只信响应顺序；
- 公开侧不得调用私有预览/上传接口作为降级；
- 不得增加共享 HTML 缓存；
- 最终 Vue 页面完成并有浏览器证据前，不勾选 T19/T20。
