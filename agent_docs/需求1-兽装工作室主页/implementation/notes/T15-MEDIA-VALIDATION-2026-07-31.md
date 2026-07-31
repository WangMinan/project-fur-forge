# T15 服务端媒体核验与大原图预处理 · 工程记录

> 日期：2026-08-01（按批次约定保留文件名日期）  
> 范围：仅工程侧数据库、OSS 核验、固定预处理、API 契约与测试；未改写 Kimi 页面，未勾选 T15。

## 实现

- 新增上传完成接口 `POST /api/admin/v1/media/upload-sessions/{uploadSessionId}/complete`；入参携带会话 `expectedVersion`、焦点和水印锚点，不接收或返回私有 Object Key。
- 服务端按 `HEAD → DIGEST → IMAGE_INFO` 核验真实对象：字节数、MIME、ETag/MD5、OSS SHA-256 元数据、实包 MD5/SHA-256、文件签名、格式、尺寸、EXIF 方向、最长边与 Hero 横竖方向均须匹配。
- 上传会话记录安全失败码与失败阶段；校验失败只删除该会话的精确原件，清理失败单独固化为 `UPLOAD_CLEANUP_FAILED/CLEANUP`。
- 仅在核验成功后创建永久 `assets`。asset ID 与 upload-session ID 相同，完成接口幂等；原始身份字段由 SQLite 触发器锁定。
- 小于等于 20,000,000 字节的原件直接进入 `READY`。更大的原件使用仓库已有 `ffmpeg-static` 固定二进制生成最长边不超过 4096、大小不超过 20,000,000 字节的私有 PNG 预处理源；不使用系统 PATH，不改写原件，不加水印。
- 预处理对象采用确定性 Key，条件写入并再次校验 HEAD；`asset_variants` 记录 PRIVATE/preprocess 谱系、输入/输出 SHA-256、尺寸、字节数和 `preprocess-v1` 配方。
- 预处理失败时保留已经核验的原件，将 asset 标记为 `FAILED/UPLOAD_PREPROCESS_FAILURE/PREPROCESS`；新增 `POST /api/admin/v1/media/assets/{assetId}/retry-processing` 原位重试处理，不要求用户重新上传。
- DTO 返回按角色计算的预览语义：工作室照片为 3:4 cover + 原比例 contain，设定图为原比例/3:4 contain，首页横图为 16:9 cover，竖图为 9:16 cover。

## 数据迁移

- `0004_shocking_franklin_richards.sql` 增加 asset 的 EXIF、焦点、适配模式和水印锚点，以及 upload-session 的失败阶段。
- 迁移保留旧数据默认值，并在 SQLite 重建表后恢复归属、角色、来源谱系、Hero 就绪性和原始身份不可变触发器。

## 验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：13 个文件、86 项通过。
- `pnpm test:integration`：7 个文件、42 项通过。
- 新增真实二进制覆盖：小图完成和幂等、HEAD 元数据篡改与精确清理、20–30 MB 合成 PNG 的内嵌 FFmpeg 预处理、原件不变、PRIVATE 谱系、处理失败保留及重试恢复。

## 交接边界

T15 工程接口已锁定；上传进度、完成调用、失败阶段展示、焦点/锚点控件与重试按钮仍由 Kimi 接线，因此 `TASKS.md` 的 T15 保持未勾选。完整调用顺序将在 `T14-T18-UI-HANDOFF.md` 汇总。
