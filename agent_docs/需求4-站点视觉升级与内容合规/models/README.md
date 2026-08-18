# 模型说明：需求4

> **角色**：记录需求4的数据/领域模型现状、目标字段和迁移规则。
> **基线**：`main@913d257281e0b6a7ca60711cc62b78534904c6bd`。
> **边界**：SPEC 定产品契约；本文件定字段和处理细节。

## 1. 现有模型复用

### 1.1 Hero 与焦点

当前模型已经具备：

- `assets.focal_x`
- `assets.focal_y`
- `site_hero_collections`
- `site_hero_items`
- `site-display-v2` 公开变体身份
- `focal_x/focal_y → OSS gravity` 映射

需求4不新增 Hero crop/focal 表，不把焦点复制到首页配置 JSON。

目标行为：

- 九宫格 UI 写回现有 asset 焦点；
- 默认 `(0.5, 0.5)`；
- 预设值为 `0 | 0.5 | 1` 的笛卡尔组合；
- 现有任意浮点焦点继续合法；
- 只允许未启用 item 修改；
- 焦点变化后清理/重建该 item 的站点展示变体，recipe identity 继续包含焦点。

### 1.2 首页聚合

继续复用当前聚合：

```ts
interface PublicHomeAggregate {
  hero: PublicHomeDto
  featured: { available: boolean; items: PublicWorkSummaryDto[] }
  entries: {
    commission: PublicHomeEntryCardDto | null
    adoption: PublicHomeEntryCardDto | null
  }
  currentAdoptions: {
    available: boolean
    items: PublicAdoptionListItemDto[]
  }
}
```

需求4只改变投影后的前端编排：

- `featured.items[0]` 为 lead；
- `featured.items.slice(1)` 为次级精选；
- `entries.commission` 为委托幕视觉源；
- `currentAdoptions.items.slice(0, 2)` 为领养幕；
- 不增加只为版式存在的“幕”数据库表。

如实际 DTO 名称与本示意不同，以现有 shared schema 为准，不新建重复类型。

## 2. 站点内容

### 2.1 `site_content`

新增：

```text
privacy_controller_name TEXT NULL
```

规则：

- 1–200 字，trim 后非空，不允许 `<`/`>`；
- 迁移默认 NULL，不提交虚构经营主体；
- 生产开启委托投递前必须配置；
- 隐私联系邮箱复用 `contact_email`；
- `privacy_content_version` 继续作为隐私政策版本；
- 其它 section version 不因无关字段编辑一起递增。

`basic_terms`、`privacy_policy`、about/commission/contact 字段继续使用现有纯文本与分区版本，不建设富文本。

### 2.2 公开 DTO

隐私页面公开投影增加：

```ts
interface PublicPrivacyMeta {
  controllerName: string | null
  contactEmail: string | null
  policyVersion: number
  updatedAt: string
}
```

生产 readiness：

- 委托申请开放时 `controllerName` 和 `contactEmail` 必须非空；
- 未配置时 `/commission/apply` 不应接受提交，并向管理端报告明确配置缺失；
- 公开隐私页可以显示配置待补的运维错误页，但不得渲染花括号占位。

## 3. 委托申请确认

### 3.1 目标列

对 `commission_submissions` 前向 expand：

```text
intake_contract_version       INTEGER NOT NULL DEFAULT 2
adult_confirmed               INTEGER NULL
privacy_policy_version        INTEGER NULL
application_notice_version    INTEGER NULL
notice_confirmed_at           INTEGER NULL
```

语义：

- Expand 迁移先把既有行写成 `intake_contract_version=1`，其余 NULL，明确为 legacy。
- 最终目标表默认 `intake_contract_version=2`；新 repository 仍须显式写 2。
- v2 必须满足：
  - `adult_confirmed=1`
  - `privacy_policy_version > 0`
  - `application_notice_version > 0`
  - `notice_confirmed_at IS NOT NULL`
- 不回填旧行，不把旧提交时间伪装成确认时间。
- `privacy_policy_version` 保存提交时客户端已阅读、服务端已校验的 `site_content.privacy_content_version`。
- `application_notice_version` 使用代码常量，例如 `COMMISSION_APPLICATION_NOTICE_VERSION = 1`。
- 不存 IP、User-Agent、设备 ID、完整 Referer 或 checkbox 文案全文。

数据库 CHECK 建议：

```sql
CHECK (
  (
    intake_contract_version = 1
    AND adult_confirmed IS NULL
    AND privacy_policy_version IS NULL
    AND application_notice_version IS NULL
    AND notice_confirmed_at IS NULL
  )
  OR
  (
    intake_contract_version = 2
    AND adult_confirmed = 1
    AND privacy_policy_version > 0
    AND application_notice_version > 0
    AND notice_confirmed_at IS NOT NULL
  )
)
```

不得允许未来新写入 v1：repository/service 必须显式写 2，contract 迁移把列默认改为 2，并以集成测试证明缺少确认字段的插入失败。

### 3.2 公开 intake metadata

新增或等价实现：

```ts
interface PublicCommissionIntakeMetaDto {
  adultMinimumAge: 18
  applicationNoticeVersion: number
  controllerName: string
  privacyPolicyVersion: number
  privacyHref: '/privacy'
  serviceHref: '/service'
}
```

只有在处理者名称、邮箱和隐私政策就绪时返回成功。

### 3.3 提交请求

在现有请求字段上新增：

```ts
{
  adultConfirmed: true
  privacyAcknowledged: true
  applicationNoticeAcknowledged: true
  privacyPolicyVersion: number
  applicationNoticeVersion: number
}
```

所有确认均为 `z.literal(true)`，不得用 truthy 转换。

服务端顺序：

1. 校验 Host/Origin/限流/token/蜜罐；
2. 校验处理者配置；
3. 校验当前版本；
4. 校验成年/隐私/非接单确认；
5. 校验 COMPLETED upload 与业务字段；
6. 单事务消费 upload 并创建 v2 submission。

版本不一致：

```text
HTTP 409
reason = COMMISSION_NOTICE_VERSION_STALE
```

不得消费 upload session；访客重新确认后可以继续使用尚未过期/可重试的会话。

### 3.4 管理 DTO

列表不增加确认字段。

详情可以增加只读摘要：

```ts
{
  intakeContractVersion: 1 | 2
  adultConfirmed: boolean | null
  privacyPolicyVersion: number | null
  applicationNoticeVersion: number | null
  noticeConfirmedAt: string | null
}
```

旧申请显示“历史申请 · 未记录网站确认版本”，不能显示为未成年或拒绝态。

## 4. 人工保留与删除

### 4.1 不新增自动模型

本轮明确不新增：

- `retention_until`
- scheduler job 表
- recurring task 表
- 自动状态迁移
- 通用 legal hold 引擎
- 订单完成/保修工单模型

原因：accepted 委托的业务结束发生在 QQ/线下流程，数据库无法可靠自动推导。

### 4.2 候选模型

CLI 只从现有字段推导安全候选：

- `rejected` 且 `handled_at < cutoff`；
- 显式 submission ID；
- pending 只列为“待人工复核”，不自动删除；
- accepted 只允许显式 ID，不允许仅凭创建时间批量删除。

候选输出：

```ts
interface CommissionRetentionCandidate {
  submissionId: string
  receiptCode: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  handledAt: string | null
  reason: 'REJECTED_RETENTION_ELAPSED' | 'MANUAL_REQUEST' | 'STALE_PENDING_REVIEW'
}
```

控制台默认掩码回执，只在交互式人工核对时显示完整回执；不输出手机号、QQ、体型、文件名或 Object Key。

### 4.3 删除集合

按 submission 关系枚举：

- submission；
- upload session；
- commission design-reference asset；
- 该 asset 的 PRIVATE variants；
- upload pending/temporary keys；
- 直接关联的审计/备注（根据保留边界删除或去标识）。

工作作品表、work assets、公开 variants、水印和 Hero 不在集合内。

若发现 commission asset 被异常引用到其它 owner，正式删除阻断，不能级联猜测。

### 4.4 删除审计

保留：

```ts
interface CommissionDeletionAudit {
  actorUserId: string
  deletedAt: number
  submissionIdDigest: string
  databaseRowCounts: Record<string, number>
  objectCounts: Record<string, number>
  result: 'SUCCESS' | 'FAILED'
  failureCode?: string
}
```

不保留：

- submission ID 明文（正式证据中）；
- receipt 明文；
- PII；
- 完整 Key；
- 内容摘要；
- 可恢复 manifest。

运行时为完成删除可在内存中使用精确 ID/Key，不落普通日志。

## 5. 第三方声明模型

生成两个仓库产物：

```text
app/assets/licenses/third-party-notices.json
app/assets/licenses/THIRD_PARTY_NOTICES.txt
```

或实现时选定的等价位置。JSON 供页面渲染，TXT 供完整查阅。

建议结构：

```ts
interface ThirdPartyNotice {
  name: string
  version: string
  license: string
  repository: string | null
  homepage: string | null
  copyright: string[]
  noticeText: string | null
  source: 'pnpm-prod' | 'manual-asset'
  usage: string
}
```

规则：

- `pnpm-prod` 来自 `pnpm licenses list --prod --json --long`；
- `manual-asset` 至少包含 FFmpeg、Noto Serif SC、ZhuoHei Collage；
- 排序稳定：source → name → version；
- 同名同版本同来源去重；
- 生成时间不写入内容，避免无意义 diff；
- 未知/复合许可证不猜测，生成失败并要求人工登记；
- 免费商用字体的 `license` 使用清楚的授权标签，例如 `Free commercial use (author statement)`，不伪造 SPDX。

## 6. 版本与兼容

- 新迁移只前向追加，不重写 0044 及之前历史。
- 先 expand DB（既有行为 v1），再部署兼容 legacy + v2 的读取与显式 v2 写入；验证新写稳定后执行 contract，把默认收口为 v2。
- 旧客户端缺确认字段返回 400，不创建新 legacy 行。
- 生产现有申请保持可读、可处理、可人工删除。
- 隐私/条款默认值迁移只匹配仓库精确历史全文。
- 焦点模型不迁移；既有 `(0.5,0.5)` 或任意坐标原样保留。
