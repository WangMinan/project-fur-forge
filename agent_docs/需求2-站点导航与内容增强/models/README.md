# 数据模型规划

> **角色**：记录本轮现状模型与目标变更；实现后回填实际迁移和字段。
> **状态**：T01～T16、T15-F1～T15-F4 与 T17-F1～T17-F3 已完成。T17-F3 不增加表、列、媒体投影或公开 DTO，只增加一条条件式默认文案前向迁移。下一步仍保留 T16-R1 新 SHA 独立复查与 T17 用户验收。

## 0. 当前分支实际变更

T01 只修改 `PUBLIC_NAV_ITEMS` 与 E2E。T02 新增 `official_channels_json`、管理/公开 DTO 和 contact 保存投影。T03 新增 `contact_qr`、`contact-qr-v1`、`site/contact` 上传归属及 READY SourceSet 投影。T04 复用这些契约完成固定五行管理编辑，不新增表、字段或第二个 contact 版本。T05 只消费既有公开投影，不增加持久字段。T06 只迁移 `commission_faq_json` 内容和上限，不新增表或列。

T17-F3 的默认文案升级继续使用 singleton `site_content`：迁移逐字段比较旧默认值，只替换仍未被管理员修改的字段；每个受影响分区至多递增一次对应 `*_version`，同时递增全局 `version` 与 `updated_at`。导航、作品总数和领养排版均是视图变更，不修改查询 DTO 或持久模型。

## 1. 实施前模型基线（历史）

以下条目记录需求建立时的模型起点，不表示当前分支仍缺少 contact QR 或动态模型；当前实际变更见上一节及后续目标模型的落地说明。

- `site_content` 是 singleton，保存邮箱、QQ、抖音、FAQ JSON 与六个文案分区版本。
- `assets`、`upload_sessions`、`asset_variants` 已覆盖私有上传和公开派生，但没有 contact QR 角色。
- `works.character_name` 是作品/领养的设定名称。
- `return_characters.name` 是返图的设定名称；一项设定可以有多张 `return_photos`。
- T10-B 已由迁移 `0030_requirement_2_updates.sql` 建立独立动态数据模型。

## 2. 联系方式目标模型

contact 公开业务结构：

```text
email
officialChannels[5]
  platform        qq | douyin | qq_group | xiaohongshu | bilibili
  account
  qrCodeAssetId   private/admin only
  qrCodeSources   public DTO only, READY derivative
antiScam
```

已由迁移 `0027_requirement_2_contact_channels.sql` 持久化为 `site_content.official_channels_json`：

- 数组必须恰好覆盖五个平台且 platform 不重复；
- 账号与二维码引用迁移期可空；
- T02 公开投影只输出有账号的项；T03 接入二维码派生后收紧为完整、READY 项；
- 邮箱继续独立保存，不混进平台数组；
- 旧 `contact_qq`、`contact_douyin` 在本轮保留，供前向迁移与回滚读取；迁移完成后新写入口以 `official_channels_json` 为权威，不再双写旧列。旧列的物理删除不属于本需求，不能重写历史迁移。

新增媒体身份：

```text
media role       contact_qr
owner            site/contact
public usage     contact-qr
protection       none
fit              contain
format           png
```

迁移 `0028_requirement_2_contact_qr.sql` 已扩展 `assets`、`upload_sessions` 与 `asset_variants` 的前向约束。源图限制为至少 320×320、方形、20 MB 内 PNG；公开派生按源宽生成 320/640 PNG 阶梯，不裁切、不加水印。资产仅在整套派生验证完成后进入 READY，失败使用现有资产处理重试 API。

T15-F3 以新前向迁移 `0032_requirement_2_contact_qr_upscale.sql` 覆盖上述首版输入限制：contact QR 原图现接受 PNG、JPG/JPEG、WebP、任意长宽比、20 MB 内且任一边至少 64 px。原图继续私有且字节不变；内嵌 FFmpeg Lanczos 将完整内容等比 contain 到 640×640 白色画布，保存不可变私有 `preprocess` 变体，再由既有 `contact-qr-v1` 生成 320/640 无水印公开 PNG。公开 DTO 仍只投影 READY 的完整 PNG SourceSet，不公开原始格式、私有 Key 或预处理资源。

T04 管理端始终按固定枚举显示五个平台槽位。二维码上传完成后只把 READY `assetId` 写入 contact 本地草稿；管理员执行 contact 局部保存后才更新 `official_channels_json`。上传会话使用 `contact_content_version` 检测并发，409 时刷新服务端最新值但保留当前账号草稿供对比。

## 3. FAQ 目标变更

`commission_faq_json` 继续保存稳定 ID、问题、回答和顺序。迁移 `0029_requirement_2_commission_email_faq.sql` 追加固定 UUID `2f7c23c4-8e8a-4cc4-a8c5-3a8f3b8e9d61` 的标准模板项，不新增表。

FAQ Schema 与管理提示上限已从 8 提高到 9，因此迁移时已有 8 项会全部保留，模板追加为第 9 项。迁移只在 UUID 不存在且数组少于 9 项时写入，并递增 `commission_faq_version`。

## 4. 搜索

搜索不新增表或字段：

- works/adoptions：对公开 snapshot 的 `characterName` 在分页前包含匹配；
- returns：在生成随机列表前，以 `return_characters.name` 限定公开照片集合；
- 查询参数不持久化。

当前数据规模不使用 SQLite FTS；真实数据量或查询延迟证明需要时再单独评估。

## 5. 最新动态目标模型（方案 B）

方案 A 的 singleton JSON 已取消，不增加 `site_content.updates_json` 或相关版本字段。

### 独立 `updates` 表

```text
updates
  id               text PK
  type             event | drop | commission_open | other
  title            text
  content          text
  publication_status draft | published | unpublished
  published_at     integer nullable
  version          integer > 0
  created_at       integer
  updated_at       integer
```

索引仅需 `(publication_status, published_at)`。首版不建 tags、media、slug、schedule、author 或 revision 表。

类型映射固定为 `event=参展资讯`、`drop=掉落预告`、`commission_open=开单通知`、`other=其它`。首次发布写当前 `published_at`；下架后重新发布时更新该值，仅编辑已发布正文不改变它。

T10-B 实际实现与上述字段一致；标题上限 200 字、正文上限 20000 字，数据库 CHECK 保证 trim 后非空、枚举、正版本及 publication status/time 组合。所有管理修改以 `expectedVersion` CAS 写入，审计不保存标题或正文。

## 6. 公开投影

动态公开 DTO 只包含：

```text
id
type
title
content
publishedAt
```

不返回草稿、内部时间、管理员、版本、私有字段或任意 HTML。首页只取最近 3 条。

T11 已由 `public-update-repository` 落地完整列表投影：SQL 只读取 published 记录并按发布时间倒序，公开 API 以严格 DTO 返回；`/updates` 只做纯文本展示。T12 复用同一入口，以 `LIMIT 3` 写入 home aggregate 的可降级 `latestUpdates` 区块；查询失败时只关闭该区块。迁移 `0031_requirement_2_updates_analytics.sql` 仅扩展 analytics `route_key` CHECK 以接纳 `updates`，不改变动态表。

contact 公开卡片只消费 `platform + account + qrCodeSources`。Logo 路径和平台显示名是固定枚举元数据，不进入数据库或公开 DTO；二维码 `<img>` 只使用已验证 PNG variant URL，不使用资产 ID、私有预览或签名 URL。
