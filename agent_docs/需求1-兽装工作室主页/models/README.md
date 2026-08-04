# 模型说明

> **角色**：说明当前领域模型、敏感字段边界与迁移顺序。可执行列类型、索引和约束以 Drizzle Schema 与版本化迁移为准，TASKS 只记录实施范围与验收门禁。

## 当前状态

T12 已于 2026-07-31 建立 P0 Drizzle Schema、两项初始领域迁移、SQLite 约束/触发器和显式公开/管理媒体投影；S2 Review 收口新增第三项增量迁移，补齐媒体 role/usage 矩阵与 `source_variant_id` 处理来源关系。T22 已于 2026-08-03 把预留作品列接入三用途共享联合类型、管理 service/API/UI 和公开投影；T23–T27 已于 2026-08-04 收口。第 13 项迁移补齐营业状态映射约束和受限站点内容列，第 15 项迁移写入用户确认的 OQ-120 初始化默认值；编辑入口位于独立“文案配置”。

## P0 模型

- `users`：唯一管理员、安全状态、`sessionVersion`；P0 不要求邮件找回表。
- `works`：统一作品聚合；委托、领养和展示不拆表。
- `work_feature_tags`：每件作品 0–8 条有序短属性，不是 EAV。
- `assets`：永久私有原图元数据、摘要、尺寸、处理状态和不可预测私有 Key；原图无水印且禁止覆盖。
- `asset_variants`：FFmpeg 私有处理源、草稿私有衍生图与公开衍生图的相对 Key、用途、宽度、格式、摘要、recipe 版本和水印 profile 身份；可选 `source_variant_id` 记录同一资产内的 READY PRIVATE preprocess 来源。
- `work_assets`：作品与 `design_sheet` / `studio_photo` 的关系、顺序、主图角色、焦点/裁切和水印锚点。
- `site_hero_slides`：站点级首页/委托页大图集合；`placement = home | commission` 隔离两套顺序，每项通过两个 assetId 关联一张 `assets.role = home_hero_landscape` 与一张 `assets.role = home_hero_portrait` 的资产，保存 alt、顺序、启用、版本、可选已发布作品关联，以及启用前私有预览的横竖精确 Key/到期时间；停用草稿仍须横竖 ID、alt 和排序完整，但资产可以暂未 READY。
- `publication_operations`：记录跨 SQLite 与双 Bucket 的生成、水印、验证、提交和清理进度及稳定内部失败码；管理端以发布检查的 `missingVariantCount` 展示进度，不另建队列或进度表。不保存 OSS 对象 Key/响应正文，不记录 ACL 切换。OSS requestId 与服务错误码只进入脱敏运行日志。
- 后续新增的长耗时业务操作必须复用现有操作记录，或建立同等可查询、可恢复的持久状态；至少表达阶段、真实完成量/总量（可知时）、失败码、资源版本和完成时间。不得为了页面进度伪造客户端计时，也不得仅靠一个长连接 HTTP 响应保存任务状态。
- `business_statuses`：只允许 `commission | adoption`，各自独立保存 `open | limited | closed`、短标签、短说明、固定 href 和版本；kind/href 必须匹配，不保存排期、客户或经营数据。
- `site_content`：在既有首页设置上增加明确 nullable 字段：委托短说明、人工估价说明、邮件行动、受限 FAQ、工作室事实、制作范围、基本约定纯文本、公开抖音和防诈骗文字。FAQ JSON 只接受固定 `{ question, answer }[]`；其他页面内容不是自由 JSON，首页轮播媒体和水印 profile 也不进入该表。
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
- T22 新写入只开放常规领养；金额可为空，非空时必须是正整数最小货币单位，币种由服务端固定为 `CNY`；
- 不创建任何禁用外币字段；未来多币种通过迁移放宽约束。

### T22 领养与历史展会兼容

- 新建/更新使用 `purpose` discriminated union；非领养请求不能携带领养方式、业务状态或价格；
- T22 的 adoption 写入固定为 `adoptionMethod = regular`，不接受 `event_sale` 或 `currentEventName`；
- 已有 `event_drop` / `event_sale` / `current_event_name` 继续在认证管理投影中可读；提交完整常规领养 payload 时显式转换并清空历史展会文本；
- 历史领养若方式或状态缺失，管理端可读但不进入公开投影；不按默认值猜测用途、主人或展会；
- T37 再新增 `events` 实体、正式关联和完整展会掉落写入体验。

### 私有联系人

- 联系人可保留在管理员投影中；
- 不保存 `depositNote`、`paymentNote` 或等价字段；
- 联系人不进入公开 DTO、日志、导出默认视图或 URL。
- 工作室官方邮箱 `3114559925@qq.com`、QQ `3114559925` 与抖音 `to3114559925` 是版本化 `site_content` 公开渠道，不属于 `works` 私有联系人字段；页脚或固定页面可渲染适用渠道，公开投影仍不得读取或返回作品私有联系人。

### T26–T27 营业状态与固定内容

- 委托与领养状态按 kind 独立创建/更新；不存在时以 `expectedVersion = 0` 创建，存在后按行版本更新，陈旧版本返回 409；href 由 kind 固定映射。
- 固定内容共用 `site_content.version`；字段继续允许 nullable，以支持管理员主动隐藏整区。0014 迁移只为 NULL 字段和缺失状态写入已确认的 OQ-120 默认值，不覆盖已有内容；FAQ 默认写入 5 项受限问答。
- 所有文本只按纯文本输出；服务端拒绝超长值、HTML 标签、iframe、脚本协议和 Markdown 脚本链接。基本约定使用可换行纯文本，不解析 Markdown 或富文本。
- 管理接口继续位于既有 `/api/admin/v1/site/home/**` 聚合下，前端由 `/admin/site/content`“文案配置”页面消费；路由拆分不改变数据库、Schema、并发版本或公开投影契约。
- 公开投影不含任何 version、草稿标识或内部备注，每次请求从 SQLite 读取并使用 `no-store`；它只返回固定页面字段、营业状态和工作室公开渠道。

### 角色主人公开值

OQ-119 已由用户回答：`ownerDisplay` 始终为去首尾空白后非空的公开显示值。工作室作品保存“有点小狗工作室”，隐私作品保存“不公开”；一期不增加 `ownerType`。T12 已建立非空的 `owner_display` 列，但没有设置把漏填作品静默归类为工作室作品的默认值；应用层继续执行长度和去空白校验。

### 首页与委托页大图

- 每项都必须同时拥有非空 `landscape_asset_id` 与 `portrait_asset_id`，两者不能相同；启用项还要求两侧资产 READY；
- 每项的 `alt_text` 去首尾空白后非空，排序值完整且非负；启用项在各自 `placement` 内要求排序唯一且位于 0–4，因此首页与委托页各自最多 5 项；首页发布至少保留 1 项，委托页允许 0 项；
- 提交公开状态前，横版必须有 768 / 1280 / 1920、竖版必须有 480 / 768 / 1080 的当前 `recipe-v2` PUBLIC READY WebP + fallback（完整历史 v1 集合仅兼容读取）；usage、当前活动 `brand-centered-v2` profile、配置与 Logo 摘要、居中参数、输出摘要和字节数全部进入同一发布校验，公开 mapper 复用该条件；
- READY 横竖资产方向校验仍为硬门禁。原图小于横版 `1920×1080` 或竖版 `1080×1920` 时允许保存草稿，但启用前必须经管理员确认并生成同一资产下可追溯的 READY PRIVATE `preprocess`；没有该源时返回 409。作品媒体仍不上采样；
- 可选 `linked_work_id` 只允许指向已发布作品。作品下架时不得级联删除轮播图，应显式清空关联或阻止并说明影响；
- 启用前私有预览通过 `landscape_preview_object_key`、`portrait_preview_object_key`、`preview_expires_at` 形成可审计清单；编辑、删除、启用或停用时精确清理，浏览器只接收同源管理地址；
- 管理 DTO 的横竖已保存资产只下发 `assetId` 与尺寸；编辑器用通用同源鉴权媒体接口按 `assetId` 读取私有原图，不下发 Object Key、Bucket 地址或签名 URL；该原图预览不等同于前一条活动水印烘焙预览，后者只对未启用项开放；
- 首页口号、公开业务邮箱、公开 QQ、自动轮播开关与不短于 6 秒的间隔保存在单例 `site_content`，两套大图集合变更继续共用该单例版本号；邮箱按标准地址校验，QQ 只接受 5–12 位且首位非 0 的数字；
- 首页公开投影返回该位置最多 5 个已启用项；委托页公开投影只返回委托位置顺序第一项或 `null`。两者都只含已发布横竖 variant、alt、顺序和安全作品链接，不互相回退。

### 媒体角色

- `design_sheet`：仅领养作品，最多 1 张，横版优先；公开 variant 保持完整画布，必要时使用 contain；
- `studio_photo`：每件作品最多 5 张；列表生成 3:4 卡片，详情保持原比例；
- `return_photo`：P1，每件作品最多 5 张；独立于 `work_assets` 的设定图/出厂照语义；
- `home_hero_landscape` / `home_hero_portrait`：首页与委托页共用的站点级配对资产角色，不占作品出厂照上限；前者要求宽大于高，后者要求高大于宽；
- 同一资产关系不得同时承担设定图、出厂照和返图。首页横/竖必须是两个独立 `assetId`，不能只保存同一资产的两个焦点。
- 已关联 `design_sheet` 的作品不能再把用途改成非领养；该反向更新边界由版本化迁移触发器锁定。

### 返图授权记录

`consent_source`、`consent_confirmed_at`、`consent_note` 均可为空。它们只作轻量备忘，不阻止发布，不进入公开投影。

### 媒体与水印

- 私有 Bucket 保存原图、草稿、临时与预览；公开 Bucket 只保存发布衍生图。
- 超过 OSS 20 MB 图片处理上限的合规原图保留在 `assets`；经管理员确认的低分辨率首页/委托页大图也保留永久原图，并使用内嵌固定版本 FFmpeg 生成不可公开的 `asset_variants` 私有处理源。identity 至少覆盖原图摘要、FFmpeg 版本与二进制摘要、目标尺寸、滤镜、格式和参数版本。
- `assets` 不把 Bucket 域名写入数据库；环境配置决定 Bucket 与媒体域名，非测试环境不提供硬编码 origin fallback。
- 模型层只引用配置键或解析后的配置，不保存、复制或硬编码具体配置值；测试夹具中的隔离值除外。
- role/usage 矩阵固定为：`studio_photo` 允许 preprocess/work-card/detail；`design_sheet` 允许 preprocess/design-sheet/detail/work-card fallback；首页横竖角色分别只允许 preprocess 和自身 hero usage。
- `preprocess` 不得引用另一个 preprocess，且输入摘要必须等于永久原图摘要；任何 `source_variant_id` 都必须指向同一资产下 READY 的 PRIVATE preprocess，其输出摘要等于下游输入摘要。大于 20,000,000 字节的原图或已确认适配的低分辨率大图生成 PUBLIC variant 时必须使用该来源；横版适配源为 `1920×1080`，竖版为 `1080×1920`，且不超过 20,000,000 字节。
- 管理端浏览器以 `assetId` 操作媒体；私有 Key 只在服务端和数据库中使用。
- 原图不保存水印像素。`asset_variants` 的 identity 覆盖原图摘要、媒体角色、裁切/焦点、用途、宽度、格式、质量、Logo 摘要、水印 profile 版本、锚点和 `recipe-version`，不得原位覆盖。
- P0 的 `home_hero_*`、`design_sheet`、`studio_photo` 使用当前活动 `brand-centered-v2`；P1 的 `return_photo` 使用 `brand-subtle-v1`。profile ID、配置与 Logo 摘要、居中位置、不透明度和缩放进入 identity。
- `top-left | top-right | bottom-left | bottom-right` 只保留历史 v1 身份；v2 固定 `center`，管理员可以在受限范围调整透明度和缩放，不能关闭强制水印。
- `publication_operations` 的状态应描述 `GENERATING_PUBLIC`、`APPLYING_WATERMARK`、`VERIFYING_PUBLIC`、`COMMITTING`、`CLEANING_PUBLIC`、`FAILED`、`DONE` 等实际步骤，不再出现逐对象 ACL 进度。

## 约束

- `works.slug` 首次发布后默认冻结；P1 实现 `slug_redirects` 后，显式改址再写入该表。
- 作品列表、领养列表、返图列表、首页精选、首页轮播和委托页大图排序相互独立。
- 每件作品最多 5 张出厂照和 5 张返图；领养作品另有 1 份设定图；首页与委托页各自最多 5 个启用大图项，每项占用两个站点级资产。
- 领养方式与六种业务状态分离；“展会出售中”要求展会掉落方式和当前展会。
- 原图字节数接受 `<= 30,000,000`，拒绝 `30,000,001`；最长边 12,000。
- 焦点与裁切以 EXIF 方向修正后的显示画布归一化保存。
- 自动化测试使用独立 SQLite 文件和独立 OSS `test/<run-id>/` 前缀。
