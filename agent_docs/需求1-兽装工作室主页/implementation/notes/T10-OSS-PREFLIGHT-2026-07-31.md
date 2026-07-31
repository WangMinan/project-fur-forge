# T10 OSS 预检记录

## 1. 结论与版本

- 日期：2026-07-31（Asia/Shanghai）。
- 分支：`feature/t10-oss-preflight-sol`。
- 基线：`main` commit `c3d6c3b298d19578065fb17f5c7b9f45d2998615`。
- 交付提交：本文件所在的 `feat: complete T10 OSS capability preflight` 提交；最终哈希见 Git 与交付回复。
- T10：通过。
- EXT-02：通过。
- 范围：没有开始 T11；没有实现 SQLite/Drizzle、认证、作品 CRUD、正式上传页面、正式媒体编排或最终品牌水印参数。

阿里云 OSS [图片处理原图存在 20 MB 硬上限](https://help.aliyun.com/zh/oss/user-guide/resize-images-4)，但[普通 PutObject 单次上传上限为 5 GB](https://help.aliyun.com/zh/oss/developer-reference/putobject)，并不存在项目所称的 30 MB 通用上限。最终链路保留 29,360,568 字节永久私有原图，使用随应用安装的固定版本 FFmpeg 生成 4,791,024 字节私有处理源，再由 OSS 完成图片信息、缩放、水印、WebP 和跨 Bucket `sys/saveas`。

## 2. 变更路径

- `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`：加入固定版本 `ali-oss@6.23.0`、`ffmpeg-static@5.3.0`、构建许可和 `pnpm preflight:oss`。
- `scripts/embedded-ffmpeg.mjs`、`scripts/embedded-ffmpeg.d.mts`：使用依赖返回的绝对路径执行 FFmpeg，移除子进程 `PATH`/`Path`，生成 OSS 可处理的私有 PNG 处理源。
- `scripts/oss-preflight-core.mjs`、`scripts/oss-preflight-core.d.mts`：确定性合成图片、摘要、CORS、图片信息和精确对象范围工具。
- `scripts/oss-preflight.mjs`：只读配置门禁、V4 条件 PUT、FFmpeg 预处理、OSS 图片处理、水印、跨 Bucket 保存、匿名边界和精确清理。
- `tests/unit/oss-preflight.test.ts`：唯一测试入口覆盖确定性媒体、内嵌 FFmpeg、前缀边界和 CORS。
- `implementation/OSS-PREFLIGHT.md`：最小权限、秘密放置、运行、FFmpeg 与控制台边界。
- foundation、SPEC、PLAN、模型、TASKS、STATE、执行路由和产物索引：同步 20 MB OSS 输入上限与私有预处理契约。

## 3. 最小权限与秘密

完整策略见 [`../OSS-PREFLIGHT.md`](../OSS-PREFLIGHT.md)。正式应用身份只需要：

- 两个固定 Bucket 的 `GetBucketInfo`（覆盖身份、地域、Endpoint、ACL 与 BPA）和私有 Bucket 的 `GetBucketCors`；
- 私有 Bucket 的必要 `PostProcessTask`；该动作按阿里云权限模型只能授予源 Bucket；
- 私有 `<env>/original/*` 的条件 `PutObject` 与 `GetObject`；
- 私有 `<env>/processing/*` 的 `PutObject`、`GetObject` 与精确 `DeleteObject`；
- 公开 `<env>/web/*` 的 `PutObject`、`GetObject` 与精确 `DeleteObject`；
- 单次 `test/<run-id>/*` 的等价对象权限，验证后撤销。

不需要 `ListObjects`、Bucket/ACL/BPA/CORS 写权限、`oss:*`、`AdministratorAccess` 或 `AliyunOSSFullAccess`。

AK/SK 只存在本机 Git 忽略的 `.env` 或 `config/runtime.local.json`，不进入提交、镜像、前端 runtime config、快照、日志、Markdown、issue 或聊天。本次终端和证据只记录“凭据存在”布尔值，没有回显 AK/SK、签名 URL、Authorization Header 或完整异常请求。

## 4. 最终外部预检

- 运行 ID：`t10-20260731T021438Z-e4473d54`
- 独立前缀：`test/t10-20260731T021438Z-e4473d54/`
- 本机完整证据：`test-results/oss-preflight/t10-20260731T021438Z-e4473d54.json`（Git 忽略）
- 结果：27/27 检查通过；`consoleActions = []`；`failure = null`；秘密未记录。

| 检查 | 结果 | 脱敏摘要 |
| --- | --- | --- |
| Region / Endpoint / Bucket 名 | 通过 | `oss-cn-hangzhou`；HTTPS 杭州 Endpoint；两个固定 Bucket |
| 同账号、同地域 | 通过 | Owner ID 只比较、不记录；两端 Location 一致 |
| 私有边界 | 通过 | ACL `private`；BPA 开启；匿名 GET 失败 |
| 公开边界 | 通过 | ACL `public-read`；衍生对象匿名 GET 200 |
| CORS / OPTIONS | 通过 | `PUT` 与四个签名 Header 可用；当前 Origin/Header 为通配 |
| 内嵌 FFmpeg | 通过 | `ffmpeg-static`；FFmpeg 6.1.1；绝对路径；未使用 PATH |
| FFmpeg 二进制摘要 | 通过 | SHA-256 `04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00` |
| 大原图边界 | 通过 | 29,360,568 字节、9500×1030 PNG，小于等于 30,000,000 字节 |
| 私有处理源 | 通过 | 4,791,024 字节、4096×444 PNG，小于 20,000,000 字节 |
| V4 条件 PUT | 通过 | Content-Type、Content-MD5、SHA-256 元数据、禁止覆盖全部签入 |
| 禁止覆盖 | 通过 | 同 Key 第二次 PUT 返回 `FileAlreadyExists` |
| 图片信息 | 通过 | 永久原图和私有处理源均由 OSS `image/info` 验证 |
| Logo 水印源 | 通过 | 160×64 合成 PNG，41,092 字节 |
| 水印组合 | 通过 | resize + Logo watermark + WebP + cross-Bucket `sys/saveas` |
| 公开验证 | 通过 | 1600×173 WebP，57,544 字节；HEAD、图片信息、匿名 GET 均通过 |
| 水印效果 | 通过 | 输出摘要与无水印同配方转换不同 |
| 私有源保持原样 | 通过 | 原图与处理源签名 GET 后长度、SHA-256 均不变 |
| 精确清理 | 通过 | 四个对象按已知 Key 删除并确认；没有枚举 Bucket |

代表性请求 ID：

- 大原图 V4 PUT：`6A6C0510924FBD3438D09DAA`；
- 私有处理源 V4 PUT：`6A6C051A924FBD3438B9C3AA`；
- 水印与跨 Bucket `sys/saveas`：`6A6C051FF3B62D37303834B3`；
- 公开匿名 GET：`6A6C05203D88A23638A1EA91`；
- 永久原图不变：`6A6C05201F68273237E14374`。

## 5. 对象清单

| Bucket | 精确 Key | 字节数 | 生成 / 验证 / 清理 |
| --- | --- | ---: | --- |
| private | `test/t10-20260731T021438Z-e4473d54/private/limit-29360568.png` | 29,360,568 | 是 / 是 / 精确删除 |
| private | `test/t10-20260731T021438Z-e4473d54/private/processing-source.png` | 4,791,024 | 是 / 是 / 精确删除 |
| private | `test/t10-20260731T021438Z-e4473d54/private/watermark-logo.png` | 41,092 | 是 / 是 / 精确删除 |
| public | `test/t10-20260731T021438Z-e4473d54/web/processed-watermarked.webp` | 57,544 | 是 / 是 / 精确删除 |

清理前重新核对了环境、两个 Bucket 名和完整前缀。`usedObjectListing = false`，没有全桶枚举或模糊删除。

## 6. 失败项与解决过程

- 直接对 29,360,568 字节原图执行 OSS 图片处理曾返回 `ImageTooLarge`。这与阿里云 20 MB 图片处理输入上限一致，不是 CORS、ACL 或 PutObject 失败。
- 第一版 FFmpeg WebP 私有处理源通过 PUT/HEAD，但 OSS `image/info` 返回 `BadRequest`。改为由 FFmpeg 生成最长边 4096 px 的 PNG 私有处理源后，图片信息和完整处理链通过。
- 没有通过放宽私有匿名访问、修改 BPA、修改 Bucket Policy 或提升 RAM 权限来规避限制。
- 开发期 FFmpeg 缩放/PNG 参数和 OSS 水印大小、透明度、边距、锚点只证明能力，不是最终品牌参数。

## 7. 质量门禁

| 命令 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 11 文件、78/78 通过 |
| `pnpm test:integration` | 4/4 通过 |
| `pnpm test:e2e` | 112/112 通过 |
| `pnpm build` | 通过 |
| `pnpm verify:production` | 通过 |
| `pnpm preflight:oss` | 27/27 外部检查通过 |

E2E 有既有的未实现后续页面路由警告，但 112 项均通过；T10 没有实现这些页面。

合并前使用无上下文 `ponytail-review` 独立复核并完成多轮“审查—修复—复审”。最终结论为 `Lean already. Ship.` 和 `Docs/code consistent.`；代码与测试修复净减少 69 行，并将 `PostProcessTask`、Bucket 只读权限、杭州 Region/Endpoint 门禁与当前代码对齐。

修复后再次运行外部预检：运行 ID `t10-20260731T034911Z-abbdcd83`，前缀 `test/t10-20260731T034911Z-abbdcd83/`，27/27 通过，`consoleActions = []`，秘密未记录。四个确定性对象仍使用 `private/limit-29360568.png`、`private/processing-source.png`、`private/watermark-logo.png` 和 `web/processed-watermarked.webp`；全部生成、验证并按精确 Key 清理，未枚举 Bucket。脱敏证据保存在 Git 忽略的 `test-results/oss-preflight/t10-20260731T034911Z-abbdcd83.json`。

## 8. 用户控制台动作与遗留风险

当前没有阻塞 T10/EXT-02 的控制台动作。正式上线前仍建议：

1. 把私有 Bucket CORS 从 `Origin: *`、`Headers: *` 和五种方法收敛为实际后台 Origin、`PUT`、四个签名 Header，以及必要的 `ETag`/`x-oss-request-id` 暴露；变更可通过恢复当前规则回滚。
2. 若没有跨源 JavaScript 读取公开图片的需求，删除或收敛公开 Bucket 的通配 CORS；普通 `<img>` 匿名读取不依赖它。
3. 保持私有 Bucket ACL `private` 和 BPA 开启；公开 Bucket 只允许应用身份写 `<env>/web/*`，不得写原图。
4. T52 打包时保留 `ffmpeg-static`/FFmpeg 的 GPL 许可证与来源说明，并验证目标 Linux 镜像内的依赖二进制可执行；不要改为调用宿主机 FFmpeg。

正式媒体预处理编排属于 T16，不在 T10 中提前实现。`ffmpeg-static` 二进制会增加安装/镜像体积，且 FFmpeg 同步处理 30 MB 图片会占用 CPU、内存和临时空间；T16/T52 必须在目标容器测量资源与超时。最终水印参数仍由 EXT-01/T51 校准。
