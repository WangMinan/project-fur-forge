# 模型说明：需求4

> **角色**：记录需求4的数据/领域/UI 模型现状、目标字段和迁移规则。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。
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

需求4不新增 Hero crop/focal/pair 表。

目标行为：

- 九宫格 UI 写回现有 asset 焦点；
- 默认 `(0.5, 0.5)`；
- 预设值为 `0 | 0.5 | 1` 的笛卡尔组合；
- 现有任意浮点焦点继续合法；
- 只允许未启用 item 修改；
- 焦点变化后清理/重建该 item 的站点展示变体，recipe identity 继续包含焦点。

四集合继续独立：

```ts
type HeroCollectionKey =
  | ['home', 'landscape']
  | ['home', 'portrait']
  | ['commission', 'landscape']
  | ['commission', 'portrait']
```

管理端可以重组为 placement + orientation 两级 UI，但不得引入共享 version、配对 ID、相同数量或相同顺序约束。

### 1.2 首页聚合

继续复用当前聚合结构，不增加“幕”表：

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

目标投影：

- `featured.items[0]` 为 lead；
- `featured.items.slice(1)` 为次级精选；
- `entries.commission` 为委托幕视觉源；
- `currentAdoptions.items` 最多一项，且只能是排序后的第一件 `available`；
- 无 available 时 `items=[]`，前端隐藏整幕。

如为了兼容暂时保留数组类型，也必须在 repository 层只投影一项，不由组件再次 `slice(0, 2)`。

## 2. 领养排序模型

### 2.1 内部快照

当前 `PublishedWorkRow`/`SnapshotEntry` 需要增加或携带：

```ts
updatedAt: number
```

它只用于领养目录排序，不一定进入公开 DTO。

### 2.2 排序函数

建立唯一纯函数或 repository helper：

```ts
function comparePublicAdoptions(left, right) {
  const bucket = { available: 0, adopted: 1 }
  return bucket[left.status] - bucket[right.status]
    || right.updatedAt - left.updatedAt
    || left.id.localeCompare(right.id)
}
```

规则：

- `available` 永远先于 `adopted`；
- 组内 `updatedAt` 越新越靠前；
- ID 提供确定性平局顺序；
- 搜索只过滤，分页后置；
- 首页单项从同一排序结果中取第一件 available；
- `/works` 继续使用原公开时间顺序，不复用该 comparator。

## 3. 轻量申请确认

### 3.1 不新增持久字段

需求4明确删除原计划中的：

- `site_content.privacy_controller_name`
- `commission_submissions.intake_contract_version`
- `commission_submissions.adult_confirmed`
- `commission_submissions.privacy_policy_version`
- `commission_submissions.application_notice_version`
- `commission_submissions.notice_confirmed_at`
- `PublicCommissionIntakeMetaDto`
- legacy/v2 管理摘要

原因：用户需要的是清楚、可执行的提交确认，不是站内电子签名/合同证据系统。现有小型工作室流程和 QQ 逐单确认不需要引入 expand/contract、版本握手和额外管理面。

### 3.2 请求模型

在现有 `createCommissionSubmissionRequestSchema` 增加：

```ts
adultConfirmed: z.literal(true)
privacyNoticeAcknowledged: z.literal(true)
```

语义：

- `adultConfirmed` 同时表示申请人声明已满 18 周岁并有权提交设定图；
- `privacyNoticeAcknowledged` 表示已阅读当前隐私政策，理解信息用途和“提交不等于接单/报价/排期/合同”；
- 两项只参与请求校验，不写入 submission 表；
- 校验必须发生在 upload session 消费之前；
- 缺失或 false 返回现有统一 400 validation error，不增加 stale 409。

### 3.3 处理者信息

不新增 DTO/字段：

- 已确认的个人信息处理者名称“有点小狗工作室”写入现有 `privacy_policy` 文本；
- 联系邮箱复用 `site_content.contact_email`；
- 发布前通过现有管理端人工 Review，页面不渲染占位符。

## 4. 人工保留与删除

### 4.1 不新增自动模型

本轮明确不新增：

- `retention_until`
- scheduler job 表
- recurring task 表
- 自动状态迁移
- legal hold 引擎
- 订单完成/保修工单模型
- 批量 delete operation 表

accepted 委托的业务结束发生在 QQ/线下流程，数据库无法可靠自动推导。

### 4.2 Review 候选

repository/service 向 CLI 和管理端返回同一只读脱敏候选：

```ts
interface CommissionRetentionCandidate {
  submissionIdDigest: string
  maskedReceiptCode: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  handledAt: string | null
  reason:
    | 'REJECTED_READY_FOR_DELETION'
    | 'STALE_PENDING_REVIEW'
    | 'MANUAL_REQUEST'
}
```

- pending 只提示复核；
- rejected 一经拒绝即可列为删除候选；
- accepted 不由时间自动列为可删，除非操作员显式查询该申请；
- 输出不含手机号、QQ、体型、文件名或 Object Key。

### 4.3 正式删除输入

正式 execute 只支持一条：

```ts
interface DeleteCommissionSubmissionCommand {
  submissionId: string
  execute: boolean
  confirmation: 'DELETE COMMISSION APPLICATION DATA'
}
```

不提供 `status + before + execute` 批量接口。人工可以逐条运行同一命令。

### 4.4 删除集合

按 submission 关系枚举：

- submission；
- upload session；
- commission design-reference asset；
- 该 asset 的 PRIVATE variants；
- upload pending/temporary keys；
- current object、version/delete marker（若启用）；
- 非必要内部备注和直接关联临时数据。

作品、work assets、公开 variants、水印和 Hero 不在集合内。发现异常引用时正式删除阻断，不级联猜测。

### 4.5 删除审计

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

不保留 PII、完整 Key、内容摘要或可恢复 manifest。

## 5. 统一行动与进度 UI 模型

### 5.1 公开行动

```ts
type PublicActionVariant = 'primary' | 'secondary' | 'text'
type PublicActionState = 'idle' | 'loading' | 'disabled'
```

组件应支持 link/button，但不需要数据库或 DTO。

### 5.2 管理端进度

建议通用视图模型：

```ts
type AdminTaskProgressMode = 'determinate' | 'stage' | 'indeterminate'
type AdminTaskProgressTone = 'neutral' | 'info' | 'success' | 'error'

interface AdminTaskProgressModel {
  mode: AdminTaskProgressMode
  label: string
  detail?: string | null
  tone: AdminTaskProgressTone
  value?: number | null
  max?: number | null
  stage?: string | null
  completedCount?: number | null
  totalCount?: number | null
  elapsedSeconds?: number | null
  canCancel?: boolean
  canRetry?: boolean
}
```

映射规则：

- XHR upload → determinate，`value/max` 来自真实字节；
- publication/branding/Hero operation → stage，使用服务端状态和计数；
- FFmpeg/未知服务端处理 → indeterminate + elapsed；
- 不在模型中加入人为“阶段百分比”。

### 5.3 上传状态

各业务可以保留 owner/role/校验差异，但共享基本状态：

```ts
type AdminUploadStage =
  | 'idle'
  | 'digesting'
  | 'creating-session'
  | 'uploading'
  | 'validating'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'cancelled'
```

共享展示层必须能消费 `progress: number | null`、错误、elapsed、retry/cancel；不得继续新增不同的进度 DOM/CSS。

## 6. Hero 管理 UI 模型

UI 层采用：

```ts
type HeroAdminPlacement = 'home' | 'commission'
type HeroAdminOrientation = 'landscape' | 'portrait'

interface HeroOrientationSummary {
  orientation: HeroAdminOrientation
  enabledCount: number
  limit: number
  hasOperation: boolean
  ready: boolean
}
```

- 一级 selection 是 placement；二级是 orientation。
- 首页 summary 为横/竖 `X/5`；委托为横/竖 `X/1`。
- 两种 placement 都只渲染当前 orientation 对应的 editor；切换 Tab 不合并或重建另一集合。
- 预览画框可选 desktop/mobile，但只改变管理预览，不改变数据契约。
- 底层继续调用现有独立 collection API/composable。

## 7. 第三方声明模型

生成两个产物：

```text
app/assets/licenses/third-party-notices.json
app/assets/licenses/THIRD_PARTY_NOTICES.txt
```

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
  source: 'pnpm-prod' | 'manual-runtime' | 'manual-asset'
  usage: string
  artifactSha256: string | null
  correspondingSourceUrl: string | null
  sourceRevision: string | null
  buildConfiguration: string | null
  patches: string[]
}
```

规则：

- `pnpm-prod` 来自生产依赖；`ffmpeg-static` 包记录与实际 FFmpeg 二进制记录分开；
- `manual-runtime` 最终至少包含发布镜像内实际 FFmpeg 二进制的版本、SHA-256、许可证、接收者可访问的对应源码、源码 revision、补丁和构建配置；该记录在 Linux 发布镜像部署阶段提取，本轮未生成 registry 时不创建占位事实或猜测值；
- `manual-asset` 至少包含 Noto Serif SC 与 ZhuoHei Collage；
- 排序稳定，不写生成时间；
- 未知许可证不猜测；
- 免费商用字体不伪造 SPDX。

## 8. 版本与兼容

- 领养排序、首页单项、UI 组件和 Hero 管理不需要数据库迁移。
- 申请确认只扩展请求 Schema；既有 submission 表和历史行不变。
- 默认文案继续使用前向迁移和现有 section version，不新增处理者字段。
- 焦点模型不迁移；既有 `(0.5,0.5)` 或任意坐标原样保留。
- 旧全量测试先降级为 legacy non-gating，不要求一次性改写全部；逐项提升或删除。
