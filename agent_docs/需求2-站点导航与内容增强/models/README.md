# 数据模型规划

> **角色**：记录本轮现状模型与目标变更；实现后回填实际迁移和字段。
> **状态**：规划稿；动态方案 B 已锁定，尚未落地。

## 1. 现状

- `site_content` 是 singleton，保存邮箱、QQ、抖音、FAQ JSON 与六个文案分区版本。
- `assets`、`upload_sessions`、`asset_variants` 已覆盖私有上传和公开派生，但没有 contact QR 角色。
- `works.character_name` 是作品/领养的设定名称。
- `return_characters.name` 是返图的设定名称；一项设定可以有多张 `return_photos`。
- 当前没有动态数据模型。

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

建议持久化为 `site_content.official_channels_json`：

- 数组必须恰好覆盖五个平台且 platform 不重复；
- 账号与二维码引用迁移期可空；
- 公开投影只输出完整、READY 项；
- 邮箱继续独立保存，不混进平台数组；
- 旧 `contact_qq`、`contact_douyin` 可暂时保留供前向迁移/回滚读取，但新写入口只写新结构，最终处理以实现 Review 为准。

新增媒体身份：

```text
media role       contact_qr
owner            site/contact
public usage     contact-qr
protection       none
fit              contain
format           png
```

## 3. FAQ 目标变更

`commission_faq_json` 继续保存稳定 ID、问题、回答和顺序。新迁移追加一个固定 UUID 的标准模板项，不新增表。

若迁移时当前数组已达到 8 项，优先提高 Schema 上限，不删除用户内容。

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
