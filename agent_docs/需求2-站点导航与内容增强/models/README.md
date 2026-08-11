# 数据模型规划

> **角色**：记录本轮现状模型与目标变更；实现后回填实际迁移和字段。
> **状态**：T01 已落地且不涉及数据模型；T02 及后续模型仍为规划稿，动态方案 B 已锁定。

## 0. 当前分支实际变更

T01 只修改 `PUBLIC_NAV_ITEMS` 与 E2E，没有新增或修改表、列、迁移、DTO、媒体角色、运行时配置或云端对象。下文从“联系方式目标模型”起均是 T02 之后的目标设计，不能当作当前数据库事实。

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

类型映射固定为 `event=参展资讯`、`drop=掉落预告`、`commission_open=开单通知`、`other=其它`。首次发布写当前 `published_at`；下架后重新发布时更新该值，仅编辑已发布正文不改变它。

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
