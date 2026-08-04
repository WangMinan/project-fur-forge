# 居中可配置品牌水印技术计划增量（2026-08-01）

> **角色**：这是 `PLAN.md` 的局部技术增量。仅在水印来源、profile、OSS 参数、迁移和执行顺序方面覆盖旧计划；其他架构不变。

## 1. 迁移原则

- 保留 `brand-standard-v1` 历史 variant，不修改既有 migration 或对象。
- `brand-centered-v2` 继续保存 Logo、透明度和受限缩放参数；`recipe-v2` 将水印预处理宽度计算为上一版 `P_<scale>` 结果的 1.6 倍，并在需要放大源图时显式使用 `limit_0`。
- OSS 处理顺序固定为：先把主图生成目标输出尺寸，再对水印图预处理；`studio_photo` 与首页/委托页竖版大图用 `g_center` 叠加 1 次，`design-sheet` 与首页/委托页横版大图按 `g_west`、`g_east` 连续叠加两枚等大水印，最后转换格式。横版大图按 960 px 设定图基准等比放大水印，竖版大图按 480 px 作品卡基准等比放大水印。
- 居中 profile 不发送无意义的 `x`、`y` 角落边距；需要视觉微调时只能在新 profile 版本中增加受控中线偏移，不能复用旧四角字段。
- OSS 图片水印源必须位于处理源所在的私有 Bucket。管理端上传的 Logo 候选先经过现有 V4 条件直传和服务端核验，再作为水印源。

## 2. 数据模型增量

通过新的版本化迁移增加：

### `watermark_profiles`

至少包含：

- `id`；
- `profile_name`，当前只允许 `brand-centered-v2`；
- `source_asset_id`，引用 `assets.role = watermark_logo`；
- `logo_digest`；
- `position = center`；
- `opacity_percent`，10–90，默认 50；
- `scale_percent`，20–90，默认 60；
- `config_digest`；
- `status = DRAFT | APPLYING | ACTIVE | RETIRED | FAILED`；
- `version`、创建时间、更新时间。

profile 内容一经用于生成 variant 即不可原位修改；修改配置应新建 profile。

### `site_branding`

单例至少保存：

- 当前活动 `watermark_profile_id`；
- 当前草稿 `watermark_profile_id`；
- 资源版本；
- 最近一次应用操作 ID。

### `assets` / 上传角色

- 新增站点级媒体角色 `watermark_logo`；
- 仅允许 `owner.type = site`、`owner.id = branding`；
- 只接受透明 PNG 或服务端明确支持的安全格式；
- 不生成普通公开 work-card/detail/hero variant；
- 浏览器只看到 `assetId` 和短时预览。

### `asset_variants`

- 增加 `watermark_profile_id` 或等价不可变引用；
- 当前公开投影和发布检查必须匹配活动 profile ID/config digest；
- `watermark_anchor` 的旧四角值只服务历史 v1，v2 使用 `center`；
- opacity、scale、position、Logo digest 和 profile ID 均进入 identity；
- 同一输入、用途、宽度、格式和 profile 的对象 Key 确定且幂等。

### 操作记录

扩展 `publication_operations` 或新增等价操作表，表达：

- `WATERMARK_PREVIEW`；
- `WATERMARK_REBUILD`；
- `GENERATING_PUBLIC`；
- `VERIFYING_PUBLIC`；
- `SWITCHING_PROFILE`；
- `CLEANING_PUBLIC`；
- `FAILED`；
- `DONE`。

不引入队列或自动 worker；单管理员以显式操作、进度查询和手动重试完成。

## 3. 服务端 API

在 `/api/admin/v1/site/branding/**` 下提供：

- `GET /watermark`：候选、活动/草稿 profile、参数和影响摘要；
- `POST /watermark-assets/upload-sessions`：创建 `watermark_logo` 上传会话；
- `POST /watermark-profiles`：基于候选和受限参数创建草稿；
- `POST /watermark-profiles/{id}/preview`：生成真实 OSS 私有预览；
- `POST /watermark-profiles/{id}/apply`：启动完整再生成和原子切换；
- `GET /watermark-operations/{id}`：查询进度与稳定失败码；
- `POST /watermark-operations/{id}/retry`：重试生成或清理。

所有写接口执行管理 Host、Session、Origin、CSRF、资源版本、请求体限制和 `no-store`。错误响应不得返回水印源 Key、处理字符串、签名 URL 或 OSS 正文。

## 4. OSS 处理字符串

水印源 Object 完整名称使用 URL-safe Base64 编码。`recipe-v2` 的出厂照应形成等价于以下语义的处理：

```text
image/<目标图 resize/crop>
/watermark,image_<base64url(水印源?x-oss-process=image/resize,w_<1.6倍宽度>,limit_0)>,t_50,g_center
/<最终 format/quality>
```

设定图以及首页/委托页横版大图在 resize 后连续追加两个相同 `watermark` 操作，位置分别为 `g_west` 与 `g_east`；竖版大图追加一个 `g_center` 水印。同一用途的新版本 WebP 与 fallback 未全部齐备时继续返回完整 `recipe-v1`，不得把两版拼成一个 srcset。

实现必须通过真实 OSS 契约测试确认嵌套水印预处理编码、透明度和居中位置。若 `P` 在当前 OSS 区域/链路的实际输出与预期不一致，可以由服务端根据最终输出尺寸计算等价的受控宽度，但数据库和管理端仍以统一的 `scale_percent` 表达，不能把高分辨率处理源尺寸误当成最终输出尺寸。

## 5. 预览与应用

### 真实预览

- 从当前已验证作品或确定性测试图中选择代表性的 3:4、原比例、16:9 和 9:16 样本；
- 使用草稿 profile 在私有 `preview/branding/<operation-id>/` 前缀生成；
- HEAD/图片信息验证后返回短时签名 URL；
- 预览对象到期或取消后精确清理；
- CSS 叠层不得作为最终预览证据。

### 应用和原子切换

1. 冻结草稿 profile；
2. 计算所有当前已发布作品和已启用首页轮播需要的目标 variant；
3. 在 SQLite 事务之外调用 OSS 生成；
4. 对每个对象执行 HEAD、图片信息和匿名 GET 验证；
5. 全部完成后，在短事务内切换 `site_branding.active_watermark_profile_id` 和公开引用；
6. 把旧 profile 公开对象写入精确清理清单；
7. 清理失败保留可重试记录，不把活动 profile 回退到半完成状态。

发布新作品、更新作品媒体和发布首页轮播时，都必须读取当前活动 profile。硬编码 `brand-standard-v1`、本地 Logo 路径或单图四角锚点的检查必须被替换。

## 6. 前端交接

Kimi 在接口锁定后实现 `/admin/site/branding`：

- 候选 Logo 上传与选择；
- 活动/草稿状态；
- 透明度和缩放受限控件；
- 居中位置只读说明；
- 真实 OSS 多比例预览；
- 受影响数量；
- 应用确认；
- 原生进度与失败恢复；
- 三视口截图和浏览器 E2E。

现有作品编辑器中的“四角水印安全角”控件应在 v2 下删除；旧字段不再由用户修改。

## 7. 质量门禁

至少覆盖：

- `watermark_logo` 角色、归属和格式；
- 默认 50/60/center；
- 参数边界；
- 不能关闭标准水印；
- OSS 处理字符串和 Base64URL 编码；
- 同 Bucket 水印源；
- profile identity 与确定性 Key；
- 旧 v1 variant 不满足 v2 检查；
- 多作品、多用途完整再生成；
- 失败保持旧活动 profile；
- 原子切换；
- 精确清理；
- 私有信息泄漏守卫；
- 三视口真实视觉证据。
