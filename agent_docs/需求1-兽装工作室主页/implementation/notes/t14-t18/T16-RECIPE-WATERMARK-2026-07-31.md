# T16 recipe-v1 与基础水印 · 工程记录

> 日期：2026-08-01（按批次约定保留文件名日期）  
> 范围：仅工程侧 OSS 配方、来源谱系、公开对象校验、数据库写入与测试；未改写 Kimi 页面，未勾选 T16。

## 实现

- 新增确定性 `recipe-v1` 服务，按媒体角色只生成实际用途：
  - `work-card`：3:4，480 / 768 / 1200；
  - `home-hero-landscape`：16:9，768 / 1280 / 1920；
  - `home-hero-portrait`：9:16，480 / 768 / 1080；
  - `design-sheet`：完整画布 contain，960 / 1600 / 2400；
  - `detail`：原比例 contain，960 / 1600 / 2400。
- 每个宽度生成 WebP 和一种 fallback；当前 PNG 来源保留 PNG fallback，其他来源使用 JPEG。出厂照/首页使用 cover，焦点映射为 OSS gravity；设定图的 3:4 卡片使用安全背景 pad，其余保持完整画布。
- OSS IMG 是公开 resize/crop/format/watermark 的唯一执行者；应用未引入 Sharp、动态 Nuxt Image provider 或第二套公开编码器。
- `brand-standard-v1` 使用 OSS 水印并通过跨 Bucket `sys/saveas` 写公开 Bucket。当前基础参数为 Logo 占比 15%、透明度 70、边距 24 px；T51 校准参数或 EXT-01 最终 Logo 后会因 identity 变化自然生成新 Key，不原位覆盖。
- identity 覆盖来源摘要/来源 variant、role、usage、宽高/比例、fit、焦点、背景、格式、质量、recipe、Logo 摘要、profile、比例、透明度、边距和锚点；公开 Key 使用 identity SHA-256，variant ID 为该摘要导出的确定性 UUID。
- 小原图直接作为处理源；超过 20,000,000 字节时只接受同一 asset 下 READY PRIVATE preprocess，其 `source_variant_id` 与 `input_sha256` 写入公开 variant 谱系。原图与 preprocess 均不加水印。
- 每个公开结果在数据库写入前完成 HEAD、image/info、匿名 GET、MIME、尺寸、MD5 和 SHA-256 核验；生成网络调用全部在 SQLite 写入之外。失败只清理该确定性公开 Key；重复请求复用既有 READY variant。
- 水印源从现有 `logo-full-light.png` 计算摘要并条件写入私有 Bucket；数据库和 DTO 不保存签名 URL或凭据。

## 验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：13 个文件、86 项通过（T15 后无单元测试变化）。
- `pnpm test:integration`：8 个文件、46 项通过。
- `pnpm build`：通过，生产内容守卫通过。
- 新增覆盖：角色用途/宽度/格式矩阵、OSS 水印参数、确定性 Key、幂等重试、参数变化新 Key、大原图 preprocess 强制来源、input SHA-256/source lineage、公开处理失败精确清理。

## 交接边界

T16 是 T18 发布服务调用的内部工程能力，不新增独立页面 API。Kimi 只需消费 T17/T18 返回的处理/发布状态；完整端点和状态说明将在 `T14-T18-UI-HANDOFF.md` 汇总。
