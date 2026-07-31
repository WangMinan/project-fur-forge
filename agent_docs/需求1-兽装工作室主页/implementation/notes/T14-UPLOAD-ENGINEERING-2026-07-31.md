# T14 角色化私有原图条件直传 · 工程记录

> 日期：2026-08-01（按批次约定保留文件名日期）
> 范围：仅工程侧数据库、权限、OSS 签名、API 契约与测试；未实现或改写 Kimi 页面，未勾选 T14。

## 实现

- 新增独立 `upload_sessions` 表；上传会话不复用 `assets.status`，永久 asset 只在 T15 完成服务端校验后创建。
- 会话持久化归属类型/ID/版本、媒体角色、不可预测私有 Key、预期 MIME/字节数/MD5/SHA-256/尺寸、创建者、5 分钟期限、状态、资源版本、安全失败码和完成后的 `assetId`。
- 数据库约束和触发器锁定归属、角色、Key 与 expected 声明；作品设定图只允许领养作品，站点归属固定为 `site/home`。
- API：
  - `POST /api/admin/v1/media/upload-sessions`
  - `GET /api/admin/v1/media/upload-sessions/{uploadSessionId}`
  - `POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/cancel`
  - `POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/retry`
- 所有写接口复用 T13 的后台 Host、Session、Origin 与 CSRF 中间件；JSON 请求体限制为 64 KiB。
- PUT 信息固定 `Content-Type`、`Content-MD5`、`x-oss-meta-sha256` 和 `x-oss-forbid-overwrite=true`，有效期 5 分钟。图片二进制只由浏览器直传 OSS，不经过 Nitro。
- 取消、过期与重试只清理该会话的精确对象；重试创建新会话和新 Key。浏览器 DTO 不单列私有 Object Key，也不包含 AK/SK。
- `test` 环境 Key 固定进入 `test/<run-id>/original/**`；单元/集成使用 `FakeMediaStorage`，不访问真实 Bucket。

## 状态机

`AWAITING_UPLOAD → VALIDATING → COMPLETED | FAILED`；等待态还可进入 `CANCELLED | EXPIRED`。取消、过期或失败后重传必须新建会话，不允许原位修改归属、角色、expected 或 Key。

## 验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：13 个文件、86 项通过。
- `pnpm test:integration`：6 个文件、38 项通过。
- 新增覆盖：持久化与 assets 分离、固定 PUT 请求头、过期、精确清理、清理失败安全码、旧会话重试新 Key、归属版本与角色冲突。

## 交接边界

T14 工程接口已锁定；联合任务仍需 Kimi 接入上传 UI、进度与浏览器直传，因此 `TASKS.md` 的 T14 保持未勾选。完整前端调用顺序将在 `T14-T18-UI-HANDOFF.md` 汇总。
