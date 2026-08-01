# 模型说明

> **角色**：说明当前领域模型、敏感字段边界与迁移顺序。可执行列类型、索引和约束以 Drizzle Schema 与版本化迁移为准，TASKS 只记录实施范围与验收门禁。

## 当前状态

T12 已于 2026-07-31 建立 P0 Drizzle Schema、两项初始领域迁移、SQLite 约束/触发器和显式公开/管理媒体投影；S2 Review 收口新增第三项增量迁移，补齐媒体 role/usage 矩阵与 `source_variant_id` 处理来源关系。表结构依据本文件与上游契约建模，没有照搬既有 DTO 或视觉夹具；正式媒体上传、处理和发布编排仍未实现。

## P0 模型

- `users`：唯一管理员、安全状态、`sessionVersion`；P0 不要求邮件找回表。
- `works`：统一作品聚合；委托、领养和展示不拆表。
- `work_feature_tags`：每件作品 0–8 条有序短属性，不是 EAV。
- `assets`：永久私有原图元数据、摘要、尺寸、处理状态和不可预测私有 Key；原图无水印且禁止覆盖。
- `asset_variants`：FFmpeg 私有处理源、草稿私有衍生图与公开衍生图的相对 Key、用途、宽度、格式、摘要、recipe 版本和水印 profile 身份；可选 `source_variant_id` 记录同一资产内的 READY PRIVATE preprocess 来源。
- `work_assets`：作品与 `design_sheet` / `studio_photo` 的关系、顺序、主图角色、焦点/裁切和水印锚点。
- `site_hero_slides`：站点级首页轮播；每项通过两个 assetId 关联一张 `assets.role = home_hero_landscape` 与一张 `assets.role = home_hero_portrait` 的资产，保存 alt、顺序、启用、版本和可选已发布作品关联；停用草稿仍须横竖 ID、alt 和排序完整，但资产可以暂未 READY。
- `publication_operations`：记录跨 SQLite 与双 Bucket 的生成、水印、验证、提交和清理进度；不记录 ACL 切换，不充当队列。
- `business_statuses`、`site_content`：受限的营业状态与必要文字内容；首页轮播媒体不塞进通用 `site_content` JSON。
- `audit_logs`：最小操作人、时间、对象和结果，不保存请求正文或敏感字段。

P0 删除未发布作品时，`work_feature_tags` / `work_assets` 随作品聚合移除，关联 `assets` 继续作为永久私有原图档案保留；作品已有的公开 `asset_variants` 必须先完成对象与记录清理。已发布作品必须先下架，T40 再引入 `trash_entries` 恢复语义。

## P1 模型

- `return_photos`：返图公开元数据、独立资产关联、轻量水印 profile 及可选私有授权记录。
- `events`：当前展会与作品关联。
- `slug_redirects`：P1 才实现的显式改址永久重定向。
- `trash_entries`：30 天回收站。
- 更完整的站点文字内容、FAQ 与排序记录。

## P2 模型

- `password_reset_tokens`；
- 导出任务/记录（仅在确有异步需要时）；
- 最小化汇总统计；
- 原图档案 UI 所需检索字段。

P2 不得提前污染 P0 表或导航。

## 字段规则

### 作品价格

- `price_amount_minor INTEGER NULL`；
- `price_currency TEXT NULL`，一期非空时只允许 `CNY`；
- 仅领养/掉落作品允许填写；
- 不创建任何禁用外币字段；未来多币种通过迁移放宽约束。

### 私有联系人

- 联系人可保留在管理员投影中；
- 不保存 `depositNote`、`paymentNote` 或等价字段；
- 联系人不进入公开 DTO、日志、导出默认视图或 URL。

### 角色主人公开值

OQ-119 已由用户回答：`ownerDisplay` 始终为去首尾空白后非空的公开显示值。工作室作品保存“有点小狗工作室”，隐私作品保存“不公开”；一期不增加 `ownerType`。T12 已建立非空的 `owner_display` 列，但没有设置把漏填作品静默归类为工作室作品的默认值；应用层继续执行长度和去空白校验。

### 首页轮播

- 每项都必须同时拥有非空 `landscape_asset_id` 与 `portrait_asset_id`，两者不能相同；启用项还要求两侧资产 READY；
- 每项的 `alt_text` 去首尾空白后非空，排序值完整且非负；仅启用项要求排序唯一且位于 0–4，数据库因此持续约束最多 5 个启用项，发布函数另要求至少 1 个启用项，空库和仅含停用草稿的库合法；
- 提交公开状态前，横版必须有 768 / 1280 / 1920、竖版必须有 480 / 768 / 1080 的 `recipe-v1` PUBLIC READY WebP + fallback；usage、`brand-standard-v1`、非空 Logo 摘要、有效水印锚点、输出摘要和字节数全部进入同一发布校验，公开 mapper 复用该条件；
- 可选 `linked_work_id` 只允许指向已发布作品。作品下架时不得级联删除轮播图，应显式清空关联或阻止并说明影响；
- 自动轮播开关与不短于 6 秒的间隔保存在单例 `site_content`，默认关闭；不为每个 slide 保存任意脚本、HTML 或独立动画配置；
- 公开投影只返回已发布横竖 variant、alt、顺序和安全作品链接。

### 媒体角色

- `design_sheet`：仅领养作品，最多 1 张，横版优先；公开 variant 保持完整画布，必要时使用 contain；
- `studio_photo`：每件作品最多 5 张；列表生成 3:4 卡片，详情保持原比例；
- `return_photo`：P1，每件作品最多 5 张；独立于 `work_assets` 的设定图/出厂照语义；
- `home_hero_landscape` / `home_hero_portrait`：站点级配对资产，不占作品出厂照上限；前者要求宽大于高，后者要求高大于宽；
- 同一资产关系不得同时承担设定图、出厂照和返图。首页横/竖必须是两个独立 `assetId`，不能只保存同一资产的两个焦点。
- 已关联 `design_sheet` 的作品不能再把用途改成非领养；该反向更新边界由版本化迁移触发器锁定。

### 返图授权记录

`consent_source`、`consent_confirmed_at`、`consent_note` 均可为空。它们只作轻量备忘，不阻止发布，不进入公开投影。

### 媒体与水印

- 私有 Bucket 保存原图、草稿、临时与预览；公开 Bucket 只保存发布衍生图。
- 超过 OSS 20 MB 图片处理上限的合规原图保留在 `assets`；内嵌固定版本 FFmpeg 生成的私有处理源记录为不可公开的 `asset_variants`，identity 至少覆盖原图摘要、FFmpeg 版本、最长边、格式与参数版本。
- `assets` 不把 Bucket 域名写入数据库；环境配置决定 Bucket 与媒体域名，非测试环境不提供硬编码 origin fallback。
- 模型层只引用配置键或解析后的配置，不保存、复制或硬编码具体配置值；测试夹具中的隔离值除外。
- role/usage 矩阵固定为：`studio_photo` 允许 preprocess/work-card/detail；`design_sheet` 允许 preprocess/design-sheet/detail/work-card fallback；首页横竖角色分别只允许 preprocess 和自身 hero usage。
- `preprocess` 不得引用另一个 preprocess，且输入摘要必须等于永久原图摘要；任何 `source_variant_id` 都必须指向同一资产下 READY 的 PRIVATE preprocess，其输出摘要等于下游输入摘要。大于 20,000,000 字节的原图生成 PUBLIC variant 时必须使用该来源。
- 管理端浏览器以 `assetId` 操作媒体；私有 Key 只在服务端和数据库中使用。
- 原图不保存水印像素。`asset_variants` 的 identity 覆盖原图摘要、媒体角色、裁切/焦点、用途、宽度、格式、质量、Logo 摘要、水印 profile 版本、锚点和 `recipe-version`，不得原位覆盖。
- P0 的 `home_hero_*`、`design_sheet`、`studio_photo` 使用 `brand-standard-v1`；P1 的 `return_photo` 使用 `brand-subtle-v1`。具体比例、透明度与边距由 T51 校准，但 profile 名和摘要从首次实现起进入 identity。
- 水印锚点允许 `top-left | top-right | bottom-left | bottom-right`；默认 `top-left`。管理员可以改安全角，不能关闭强制水印。
- `publication_operations` 的状态应描述 `GENERATING_PUBLIC`、`APPLYING_WATERMARK`、`VERIFYING_PUBLIC`、`COMMITTING`、`CLEANING_PUBLIC`、`FAILED`、`DONE` 等实际步骤，不再出现逐对象 ACL 进度。

## 约束

- `works.slug` 首次发布后默认冻结；P1 实现 `slug_redirects` 后，显式改址再写入该表。
- 作品列表、领养列表、返图列表、首页精选和首页轮播排序相互独立。
- 每件作品最多 5 张出厂照和 5 张返图；领养作品另有 1 份设定图；首页轮播最多 5 项且每项占用两个站点级资产。
- 领养方式与六种业务状态分离；“展会出售中”要求展会掉落方式和当前展会。
- 原图字节数接受 `<= 30,000,000`，拒绝 `30,000,001`；最长边 12,000。
- 焦点与裁切以 EXIF 方向修正后的显示画布归一化保存。
- 自动化测试使用独立 SQLite 文件和独立 OSS `test/<run-id>/` 前缀。
