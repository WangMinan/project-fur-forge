# T14–T18 后端接口 → Kimi 前端交接

> 交接日期：2026-08-01
> 接收方：Kimi `UI_PRIMARY`
> 范围：T14–T18 已锁定的后端接口、状态与复现入口。当前没有改动 `app/`，也没有勾选 T14–T18；前端接线、浏览器 E2E 与用户联合验收完成后再收口任务。

## 1. 先决条件与通用约定

- 先完成现有登录流程。所有 `/api/admin/**` 接口都要求有效的唯一管理员 Session；写请求还要求管理端同源 `Origin` 和当前内存态 `x-csrf-token`。
- 继续复用 `app/composables/useAdminAuth.ts` 中的 Session/CSRF 生命周期。请求使用 `credentials: 'same-origin'`，不要把 CSRF token 写入 URL、本地存储或日志。
- 所有 JSON 请求使用 `Content-Type: application/json`。成功响应统一为 `{ data: ... }`；错误统一为 `{ error: { code, message } }`。
- HTTP 安全错误码固定为 `400 VALIDATION_ERROR`、`401 UNAUTHORIZED`、`403 FORBIDDEN`、`404 NOT_FOUND`、`409 CONFLICT`、`500 INTERNAL_ERROR`。界面只按 HTTP 状态与 `error.code` 分支，不解析英文 `message`。
- 除创建作品外，修改现有资源均携带最新 `expectedVersion`。收到 `409` 后重新 GET，不静默覆盖、不自动套用旧表单。
- `/api/admin/**` 响应继续带 `Cache-Control: no-store` 和 `X-Robots-Tag: noindex`。
- 稳定 Zod 契约位于：
  - `shared/schemas/api.ts`
  - `shared/schemas/upload.ts`
  - `shared/schemas/media.ts`
  - `shared/schemas/work.ts`
  - `shared/schemas/publication.ts`
  - 推导类型出口：`shared/types/contracts.ts`

## 2. 推荐的首个完整 UI 流程

以下顺序覆盖登录、创建、保存、上传、删除关系、主图、排序、预览、发布和下架。

### 2.1 登录并创建非领养作品

T17 当前只开放 `commission | showcase`。领养作品由 T25 补齐，不要在前端伪造 adoption 字段。

```http
POST /api/admin/v1/works
```

```json
{
  "slug": "snow-dog",
  "characterName": "Snow",
  "species": "犬",
  "suitType": "full",
  "purpose": "commission",
  "ownerDisplay": "不公开",
  "ownerContact": "仅后台可见的联系方式",
  "featureTags": ["蓝白", "长毛"]
}
```

成功为 `201`，返回 `managedWorkDtoSchema`。保存响应中的 `data.id` 和 `data.version`。`ownerDisplay` 只能是“有点小狗工作室”或“不公开”；`ownerContact` 只在 `data.private.ownerContact` 中返回。

列表与详情：

```text
GET /api/admin/v1/works
GET /api/admin/v1/works/{workId}
```

列表不含联系人；详情含 `private.ownerContact`。

### 2.2 保存基础字段

```http
PUT /api/admin/v1/works/{workId}
```

```json
{
  "expectedVersion": 0,
  "payload": {
    "slug": "snow-dog",
    "characterName": "Snow",
    "species": "犬",
    "suitType": "full",
    "purpose": "commission",
    "ownerDisplay": "不公开",
    "ownerContact": "更新后的后台联系人",
    "featureTags": ["蓝白", "长毛"]
  }
}
```

成功返回完整作品和递增后的 `version`。已发布作品必须先下架，直接编辑会得到 `409 CONFLICT`。

### 2.3 在浏览器计算上传声明

选择文件后、创建上传会话前，前端需得到：

- `contentType`：仅 `image/jpeg | image/png | image/webp`；
- `byteSize`：1–30,000,000；
- `contentMd5`：文件 MD5 的 Base64；
- `sha256`：小写十六进制 SHA-256；
- `width` / `height`：解码后的像素尺寸，均不超过 12,000。

散列可使用浏览器 `crypto.subtle`，尺寸可用浏览器图片解码。不要把文件二进制发给 Nitro。

### 2.4 创建上传会话

```http
POST /api/admin/v1/media/upload-sessions
```

```json
{
  "owner": {
    "type": "work",
    "id": "{workId}",
    "expectedVersion": 1
  },
  "mediaRole": "studio_photo",
  "expected": {
    "contentType": "image/png",
    "byteSize": 1234567,
    "contentMd5": "AAAAAAAAAAAAAAAAAAAAAA==",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "width": 2400,
    "height": 3200
  }
}
```

响应核心结构：

```json
{
  "data": {
    "session": {
      "uploadSessionId": "uuid",
      "owner": { "type": "work", "id": "uuid" },
      "ownerVersion": 1,
      "mediaRole": "studio_photo",
      "status": "AWAITING_UPLOAD",
      "version": 0,
      "failureCode": null,
      "failureStage": null,
      "assetId": null,
      "createdAt": "ISO-8601",
      "expiresAt": "ISO-8601",
      "expected": {}
    },
    "upload": {
      "method": "PUT",
      "url": "5 分钟有效的 OSS V4 签名 URL",
      "expiresAt": "ISO-8601",
      "headers": {
        "Content-Type": "image/png",
        "Content-MD5": "AAAAAAAAAAAAAAAAAAAAAA==",
        "x-oss-meta-sha256": "小写十六进制 SHA-256",
        "x-oss-forbid-overwrite": "true"
      }
    }
  }
}
```

示例中的散列只是结构占位，真实请求必须使用所选文件的真实值。

### 2.5 浏览器直传 OSS

对 `data.upload.url` 发原始二进制 `PUT`，逐字复制 `data.upload.headers`：

```ts
await fetch(upload.url, {
  method: 'PUT',
  headers: upload.headers,
  body: file,
})
```

该请求不是管理 API：不要附加 Session Cookie、CSRF 或额外业务 JSON。可使用 `XMLHttpRequest.upload.onprogress` 展示传输进度。URL 过期、网络失败或用户取消后，不要复用旧 URL。

### 2.6 完成服务端核验

OSS PUT 成功后调用：

```http
POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/complete
```

```json
{
  "expectedVersion": 0,
  "payload": {
    "focalX": 0.5,
    "focalY": 0.5,
    "watermarkAnchor": "bottom-right"
  }
}
```

响应为 `{ data: { session, asset } }`。服务端会真实核对 HEAD、MD5、SHA-256、文件签名、格式、尺寸、EXIF 和角色方向。只有核验成功才创建永久 asset。

- `session.status === 'COMPLETED'` 表示上传会话核验完结；
- `asset.status === 'READY'` 才表示可关联作品；
- 20 MB 以上原图会在服务端用内嵌 FFmpeg 生成私有处理源；原图始终保留且无水印；
- 预处理失败时会返回/留下 `asset.status === 'FAILED'`，不要求重新上传。

### 2.7 失败后的查询、取消和重试

```text
GET  /api/admin/v1/media/upload-sessions/{uploadSessionId}
POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/cancel
POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/retry
POST /api/admin/v1/media/assets/{assetId}/retry-processing
```

三个 POST 都使用：

```json
{ "expectedVersion": 1, "payload": {} }
```

- `cancel` 只适用于等待中的会话；成功后不再 PUT。
- `retry` 适用于失败/取消/过期会话，返回一个全新的会话和签名 URL；必须用新 Key 重传。
- `retry-processing` 只适用于预处理失败的永久 asset；成功返回新的 asset 状态，不重传原图。
- 所有重试都使用当前返回的资源 `version`；`409` 后先重新 GET。

### 2.8 关联照片、删除关系、设置主图与排序

所有 asset READY 后，以一次全量替换保存 0–5 张出厂照：

```http
PUT /api/admin/v1/works/{workId}/studio-photos
```

```json
{
  "expectedVersion": 1,
  "payload": {
    "photos": [
      {
        "assetId": "{assetIdA}",
        "alt": "Snow 的正面全身照",
        "primary": true,
        "focalX": 0.5,
        "focalY": 0.4,
        "crop": { "x": 0, "y": 0, "width": 1, "height": 1 },
        "watermarkAnchor": "bottom-right"
      },
      {
        "assetId": "{assetIdB}",
        "alt": "Snow 的侧面细节",
        "primary": false,
        "focalX": 0.45,
        "focalY": 0.5,
        "crop": { "x": 0.05, "y": 0, "width": 0.9, "height": 1 },
        "watermarkAnchor": "bottom-left"
      }
    ]
  }
}
```

数组顺序就是展示顺序；只要数组非空，就必须且只能有一项 `primary: true`。设置主图、排序、alt、焦点、裁切和水印角均通过提交整个数组完成。

“删除照片”在 T17 指解除作品关系：从下一次 `photos` 数组中省略该 `assetId`。它不会删除永久 asset、私有原图或上传记录。当前没有资产硬删除 API，前端不要显示“原图已永久删除”。

保存成功后必须用响应中的新 work `version` 覆盖本地版本。

### 2.9 公开安全预览

```http
GET /api/admin/v1/works/{workId}/public-preview
```

返回 `publicSafeWorkPreviewDtoSchema`：不含联系人、私有 Key、摘要、签名 URL或凭据。`mediaReady` 可用于发布按钮的粗粒度提示，但最终发布按钮旁仍应调用 publication-check。

### 2.10 发布检查

```http
GET /api/admin/v1/works/{workId}/publication-check
```

```json
{
  "data": {
    "workId": "uuid",
    "version": 2,
    "canPublish": true,
    "blockers": [],
    "studioPhotoCount": 2,
    "missingVariantCount": 24
  }
}
```

`missingVariantCount` 是还需由服务端生成的公开 variant 数量，不是错误。稳定 blocker：

- `ADOPTION_FLOW_NOT_READY`
- `WORK_FIELDS_INVALID`
- `STUDIO_PHOTO_REQUIRED`
- `PRIMARY_STUDIO_PHOTO_REQUIRED`
- `STUDIO_PHOTO_NOT_READY`
- `STUDIO_PHOTO_ALT_REQUIRED`

界面应为这些值提供中文映射；不要展示内部英文消息。adoption 在 T25 前固定阻断。

### 2.11 发布

```http
POST /api/admin/v1/works/{workId}/publish
```

```json
{ "expectedVersion": 2, "payload": {} }
```

响应为 `{ data: { operation, work } }`。服务端同步完成配方生成/核验/提交；请求可能比普通保存更久，按钮需进入不可重复提交的 loading 状态。成功条件必须同时满足：

```text
operation.status === 'DONE'
work.publicationStatus === 'published'
```

同一 `workId + expectedVersion + PUBLISH` 因响应丢失而重试时返回原 DONE operation，不重复生成。作品已发布后用新版本再次发布会返回一个 `FAILED` operation，并保持现有公开结果不变。

### 2.12 查询操作状态

```http
GET /api/admin/v1/publication-operations/{operationId}
```

`operation.status`：

```text
GENERATING_PUBLIC
APPLYING_WATERMARK
VERIFYING_PUBLIC
COMMITTING
CLEANING_PUBLIC
FAILED
DONE
```

`failureStage` 使用同一阶段集合并额外包含 `VALIDATING`。浏览器可见的稳定失败码：

```text
PUBLICATION_VALIDATION_FAILED
PUBLIC_MEDIA_GENERATION_FAILED
PUBLIC_MEDIA_VERIFICATION_FAILED
PUBLICATION_COMMIT_FAILED
UNPUBLICATION_VALIDATION_FAILED
PUBLIC_CLEANUP_FAILED
```

未知失败码统一显示“操作失败，请刷新状态后重试”，不要直接显示服务端内部信息。

### 2.13 下架与清理重试

```http
POST /api/admin/v1/works/{workId}/unpublish
```

```json
{ "expectedVersion": 3, "payload": {} }
```

服务端先在数据库中把作品从公开投影移除，再删除公开 Bucket 对象。因此响应中 `work.publicationStatus === 'unpublished'` 时，作品已经下架，即使后续清理失败。

若 `operation.status === 'FAILED'`、`failureStage === 'CLEANING_PUBLIC'` 且 `cleanupPendingCount > 0`，显示“公开文件清理待重试”，调用：

```http
POST /api/admin/v1/publication-operations/{operationId}/retry-cleanup
```

```json
{ "expectedVersion": 5, "payload": {} }
```

这里的 `expectedVersion` 是 operation 的版本，不是 work 的版本。响应直接返回 `{ data: operation }`。每次只按服务端保存的剩余清单继续，前端不传对象 Key。

## 3. 前端状态清单

### 3.1 上传会话

| 状态 | 前端含义 | 可用动作 |
| --- | --- | --- |
| `AWAITING_UPLOAD` | 等待 PUT 或 complete | 上传、取消；过期后刷新 |
| `VALIDATING` | 服务端核验中 | 禁止重复 complete，稍后 GET |
| `COMPLETED` | 会话完成 | 读取 `assetId` 与 asset 状态 |
| `FAILED` | 核验/存储失败 | 展示安全失败码；按场景新会话 retry |
| `CANCELLED` | 已取消 | 新会话 retry |
| `EXPIRED` | 签名已过期 | 新会话 retry |

上传安全失败码与阶段来自 `UPLOAD_FAILURE_CODE_VALUES` / `UPLOAD_FAILURE_STAGE_VALUES`：

```text
UPLOAD_OBJECT_MISSING
UPLOAD_METADATA_MISMATCH
UPLOAD_IMAGE_INVALID
UPLOAD_DIMENSIONS_INVALID
UPLOAD_STORAGE_FAILURE
UPLOAD_PREPROCESS_FAILURE
UPLOAD_CLEANUP_FAILED

HEAD
DIGEST
IMAGE_INFO
PREPROCESS
DATABASE
CLEANUP
```

### 3.2 永久 asset

| 状态 | 前端含义 |
| --- | --- |
| `PENDING` | 服务端处理中，禁止关联/发布 |
| `READY` | 可以写入 `studio-photos` 关系 |
| `FAILED` | 若 `processingFailureStage === 'PREPROCESS'`，可调用 retry-processing |

### 3.3 loading / empty / failed / conflict

- 首次列表 loading：保留管理壳，不显示“没有作品”。
- 列表成功且数组为空：显示创建第一件作品入口。
- 作品保存 loading：禁用重复保存，但保留未提交表单。
- 上传中：展示浏览器 PUT 进度；服务端验证中单独显示，不把 100% PUT 当成 READY。
- 媒体为空：允许保存空数组，但发布检查会给 `STUDIO_PHOTO_REQUIRED`。
- asset failed：保留卡片、失败阶段和对应重试入口；不要自动解除关系或伪装 READY。
- 发布 loading：显示当前阶段；失败后保留 operationId，允许重新 GET。
- 下架清理失败：界面明确“已下架，公开文件待清理”，不要误报作品仍公开。
- `409 CONFLICT`：提示数据已变化，重新 GET 后让用户确认再覆盖本地编辑。
- `401`：复用现有认证失效流程；`403`：区分权限/请求边界错误，不自动重放写请求；`500`：保留用户输入并允许显式重试。

## 4. 浏览器绝不能看到或记录的字段

后端 DTO 已排除以下内容，前端也不得从签名 URL中解析、缓存或上报：

- OSS AccessKey/Secret、Session 密钥、Cookie 内容；
- 私有 Bucket Object Key、公开 Bucket 清理 Key；
- 原图/处理源 SHA-256、内部 ETag、内部错误消息；
- 联系人出现在列表、公开预览或公开投影；
- 审计以外的请求体、图片正文、签名 URL；
- CSS 假水印或无水印公开原图 URL。

签名 PUT URL只在当前上传动作的内存中短暂存在，过期即丢弃。安全日志和前端遥测不得记录完整 URL。

## 5. T16 对前端的边界

T16 没有独立 HTTP API。`recipe-v1`、OSS 裁切/转码、水印、跨 Bucket 保存和公开对象验证全部由 T18 调用。前端只维护 T17 的 crop/focal/watermarkAnchor，并消费 T18 的 check/operation 状态；不要在浏览器生成公开衍生图，也不要增加 Sharp/Nuxt Image 动态处理链。

当前 `brand-standard-v1` 仍是基础参数，T51/EXT-01 会校准正式 Logo 与视觉参数。identity 会自动换 Key，不需要前端预留配方编辑器。

## 6. 可复现 fixture 与测试入口

服务端测试不访问真实 Bucket：

- 临时 SQLite：`tests/helpers/test-database.ts`；
- 内存 OSS fake：`tests/helpers/fake-media-storage.ts`；
- 上传/真实图片字节：`tests/integration/upload-session.test.ts`、`tests/integration/media-completion.test.ts`；
- recipe/watermark：`tests/integration/media-recipe.test.ts`；
- 作品 CRUD/关系：`tests/integration/work-management.test.ts`；
- 发布、竞态、下架、清理重试：`tests/integration/work-publication.test.ts`。

复现后端 fixture：

```bash
pnpm test:integration
```

本地真实 UI 联调使用正常开发库，不把 fake 注入浏览器：

```bash
pnpm db:migrate
pnpm auth:init
pnpm dev
```

`auth:init` 需要交互输入且不会隐式迁移。联调时创建一件 `commission` 或 `showcase` 草稿，再按本文顺序上传 1 张合法 `studio_photo` 即可形成最小发布 fixture。若使用真实 OSS，测试对象遵循 `test/<run-id>/` 精确前缀清理，不枚举或清理业务前缀。

## 7. Kimi 完成定义

Kimi 交付时至少补齐：

1. 现有管理作品样张接入真实列表、创建、详情和保存；
2. 选择文件、计算声明、创建会话、直传 PUT、complete、查询、取消和两类重试；
3. 0–5 张出厂照的关系删除、唯一主图、排序、alt、焦点、裁切与水印角保存；
4. 公开安全预览、发布检查、发布/下架确认、operation 状态与清理重试；
5. 本文列出的 loading、empty、failed、conflict、401/403/409/500 状态；
6. 真实浏览器 E2E 覆盖 Cookie/CSRF、OSS PUT 请求头、响应丢失幂等、版本冲突和敏感字段泄漏；
7. 三视口截图与实施记录。

完成前保持 `TASKS.md` 的 T14–T18 未勾选；若接口不能满足界面，先提交冲突与期望契约，不在 Kimi 分支自行改写 Schema、数据库或错误语义。

## 8. 工程交付验证基线

- `pnpm lint`：通过；
- `pnpm typecheck`：通过；
- `pnpm test`：13 个文件、86 项通过；
- `pnpm test:integration`：10 个文件、56 项通过；
- `pnpm test:e2e`：100 项既有 Chrome 用例通过；
- `pnpm build`：通过，FFmpeg 运行模块已内联进 Nitro 产物；
- `pnpm verify:production`：health、公开 SSR、管理端 CSR 通过；
- 真实 OSS：`test/t10-20260731T174230Z-858b6bdd/` 的 27 项预检通过并精确清理，未记录秘密。
