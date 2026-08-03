# GATE-07 居中水印 UI 交接

> 交接对象：Kimi K3。只实现 `/admin/site/branding` 和移除作品编辑器的 v1 四角控件；不要启动 T19/T20，不要修改数据库、OSS process、profile identity 或原子切换规则。

## 1. 共享契约

所有请求/响应以 `shared/schemas/watermark.ts` 为唯一字段来源。成功响应统一为：

```json
{ "data": {} }
```

管理端中间件已统一处理管理员 Session、管理 Host、Origin、CSRF、`Cache-Control: no-store` 与 `X-Robots-Tag: noindex`。写请求继续沿用当前管理端 CSRF header，不新增认证状态。

## 2. 页面初始化

`GET /api/admin/v1/site/branding/watermark`

返回：

- `version`：站点 branding 资源版本；
- `activeProfile` / `draftProfile`：活动/草稿 profile，可为空；
- `lastOperationId`：最近操作，可为空；
- `candidates[]`：安全候选字段和同源 `previewUrl`；
- `impact`：已发布作品数、启用 Hero 数和目标 variant 数。

页面加载后以该响应作为唯一状态基线。遇到 409 时重新 GET，不自行递增或猜测版本。

## 3. 候选上传与预览

1. 创建上传会话：

   `POST /api/admin/v1/site/branding/watermark-assets/upload-sessions`

   ```json
   {
     "expectedVersion": 1,
     "payload": {
       "expected": {
         "contentType": "image/png",
         "byteSize": 12345,
         "contentMd5": "1B2M2Y8AsgTpgAmY7PhCfg==",
         "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
         "width": 1200,
         "height": 800
       }
     }
   }
   ```

   示例摘要仅展示格式；UI 必须从所选文件计算真实 `contentMd5` 和 `sha256`，不得复用示例值。

   `expectedVersion` 取 branding `version`。只接受不超过 20 MB 的透明 PNG。

2. 使用响应中现有签名 PUT 契约直接上传，不改 header、不持久化 URL。

3. 沿用现有完成接口：

   `POST /api/admin/v1/media/upload-sessions/{sessionId}/complete`

   传上传会话 `expectedVersion`、`focalX`、`focalY`；历史 `watermarkAnchor` 可省略。完成后重新 GET branding。

4. 候选缩略图只使用 `candidates[].previewUrl`，对应：

   `GET /api/admin/v1/site/branding/watermark-assets/{assetId}/preview`

不要从 DOM、日志或错误中提取/展示签名 URL、Bucket、Object Key 或完整摘要。

## 4. 创建 profile

`POST /api/admin/v1/site/branding/watermark-profiles`

```json
{
  "expectedVersion": 2,
  "payload": {
    "sourceAssetId": "候选 assetId",
    "opacityPercent": 50,
    "scalePercent": 60
  }
}
```

- `expectedVersion` 取最新 branding `version`。
- 位置固定为 `center`，只读展示，不提供关闭或角落选项。
- 不透明度范围 10–90，默认 50；缩放范围 20–90，默认 60。
- 返回 profile 后重新 GET branding，取得更新后的 branding 版本。
- profile identity 不可修改；参数或候选变化都创建/选择新的草稿 profile。

## 5. 真实预览

`POST /api/admin/v1/site/branding/watermark-profiles/{profileId}/preview`

```json
{
  "expectedVersion": 1,
  "payload": { "brandingVersion": 3 }
}
```

- 外层 `expectedVersion` 取 profile `version`；`brandingVersion` 取最新 branding `version`。
- 成功返回 `WATERMARK_PREVIEW` 操作和四个 `previews[]`：`work-card`、`detail`、`home-hero-landscape`、`home-hero-portrait`。
- 图片只使用 `previews[].url`：`GET /api/admin/v1/site/branding/watermark-operations/{operationId}/previews/{kind}`。
- 操作为同步完成，但 UI 仍按返回的 `status` 渲染，不猜测处理阶段。

## 6. 应用、进度与重试

应用：

`POST /api/admin/v1/site/branding/watermark-profiles/{profileId}/apply`

请求体与预览相同。服务端要求该草稿已有成功预览；先生成/核验全部目标，再原子切换。

查询：

`GET /api/admin/v1/site/branding/watermark-operations/{operationId}`

重试：

`POST /api/admin/v1/site/branding/watermark-operations/{operationId}/retry`

```json
{ "expectedVersion": 4, "payload": {} }
```

重试版本取 operation `version`。状态包括：`GENERATING_PUBLIC`、`VERIFYING_PUBLIC`、`SWITCHING_PROFILE`、`CLEANING_PUBLIC`、`FAILED`、`DONE`。展示 `generatedVariantCount / targetVariantCount`、`verifiedVariantCount / targetVariantCount` 和 `cleanupPendingCount`。

稳定安全失败码：

- `WATERMARK_PREVIEW_FAILED`
- `WATERMARK_PREVIEW_CLEANUP_FAILED`
- `WATERMARK_REBUILD_FAILED`
- `WATERMARK_CLEANUP_FAILED`

UI 只能基于 `failureCode` 给出中文动作提示；不要显示底层 OSS 错误。清理失败表示新 profile 已切换成功，只需重试清理；生成/核验失败则旧活动 profile 仍有效。

## 7. 页面与证据要求

- 三个视口：390×844、768×1024、1440×900。
- 页面必须覆盖 loading、无候选、草稿、预览中/成功/失败、应用中、版本冲突、清理待重试和完成状态。
- 清楚展示影响摘要，但不要把目标数量写死。
- 固定居中为只读事实；移除作品编辑器中的“水印安全角”控件，不继续发送该业务字段。
- 预览和候选图片使用服务端同源 URL；DOM、响应快照、控制台和错误提示不得出现私有 Key、Bucket、签名 GET URL、完整摘要或 OSS process。
- fake adapter 已在 E2E reset 时恢复初始 Logo；可使用现有 `failProcess` / `failDelete` 故障开关验证生成失败与清理重试。页面调用真实 branding API，不新增 mock DTO。
- 提交三视口截图、浏览器请求证据、键盘/焦点/无横向溢出检查和失败恢复记录。完成后仍由工程复核与用户确认决定是否勾选 GATE-07。
