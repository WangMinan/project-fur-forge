# 数据模型规划

> **角色**：记录本轮现状模型与目标变更；实现后回填实际迁移和字段。
> **状态**：T01～T04 已落地；公开渠道卡片、FAQ、搜索与动态方案 B 尚未落地。

## 0. 当前分支实际变更

T01 只修改 `PUBLIC_NAV_ITEMS` 与 E2E。T02 新增 `official_channels_json`、管理/公开 DTO 和 contact 保存投影。T03 新增 `contact_qr`、`contact-qr-v1`、`site/contact` 上传归属及 READY SourceSet 投影。T04 复用这些契约完成固定五行管理编辑，不新增表、字段或第二个 contact 版本。

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

T04 管理端始终按固定枚举显示五个平台槽位。二维码上传完成后只把 READY `assetId` 写入 contact 本地草稿；管理员执行 contact 局部保存后才更新 `official_channels_json`。上传会话使用 `contact_content_version` 检测并发，409 时刷新服务端最新值但保留当前账号草稿供对比。

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
