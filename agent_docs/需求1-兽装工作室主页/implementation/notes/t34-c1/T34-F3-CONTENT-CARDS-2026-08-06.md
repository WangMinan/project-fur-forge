# T34-F3 · 文案 Card 拆分与分区并发

> 状态：实现完成。lint / typecheck / unit 105 / integration 107 / 定向 E2E 3 项全部通过。commit `4eb0315`。

## 范围

把原来"一个大表单整包保存"的文案配置，拆成六个各自独立并发的分区。

### 数据库（迁移 0018）

`site_content` 增加六个独立版本列：

| 分区 | 版本列 |
| --- | --- |
| 委托基础文案 | `commission_content_version` |
| 委托 FAQ | `commission_faq_version` |
| 关于工作室 | `about_content_version` |
| 服务条款 | `terms_content_version` |
| 隐私政策 | `privacy_content_version` |
| 官方渠道 | `contact_content_version` |

同一迁移为现有 FAQ 项 backfill UUIDv4 稳定 ID，保持原顺序与原文不变；重复执行不会改变已有 ID（已验证）。

### 契约

- `adminSiteContentDto` 增加 `sectionVersions`；
- **全局 `site_content.version` 不再随文案编辑推进**，首屏 Hero 的版本不再充当所有文案的并发基线；
- FAQ 项要求稳定 `id`（uuid），重复 ID 直接拒绝；
- 六个分区各有独立请求 Schema，且 `.strict()`——一个分区的 PUT 无法携带另一个分区的字段，从契约层面消灭"整包覆盖"。

原 `updateSiteContentRequestSchema` 与 `content.put.ts` 已删除。

### 服务与路由

- `updateSiteContentSection` 只更新本分区的列、只推进本分区的版本；版本陈旧返回 409；
- 六个 `PUT /api/admin/v1/site/home/content/<section>`，共用一个 handler 工厂，统一管理 Host、认证、Origin、CSRF、`no-store` 与 Schema 校验；
- 读取仍是同一个聚合 `GET`，不额外拆分。

### 前端

- 单体 `SiteContentCard.vue` 拆为六个 Card；
- `useSiteContentSectionCard` 承载每个 Card 的 draft / dirty / saving / saved / conflict；页面层只剩布局、初次加载和全局错误 Dialog；
- 409 行为：保留本地草稿 → 展示服务端最新分区值 → 提供显式「改用最新内容」；**不自动把旧草稿套上新版本重发**，也不禁用其它 Card；
- 官方邮箱、QQ、抖音、防诈骗提醒收进同一张「官方联系方式」Card（邮箱/QQ 在首屏设置维护，此处只读显示当前值以便一起核对），不再分散在两个入口。

## 首次 finding 与修复

`useSiteContentSectionCard` 最初把 `serverValue` 计算属性的缓存对象**直接赋值**给 draft ref，两者共享同一引用。管理员输入会同时改到"服务端值"上，导致 `isDirty` 永远为 false、保存按钮在内容首次加载后永久禁用。

这个缺陷靠单元/集成测试都发现不了——只有真实浏览器点击才会暴露。E2E 第一次运行时两个用例超时，定位后改为 `structuredClone(toRaw(...))` 隔离草稿，问题消失。

第二个 finding 属于测试假设错误而非产品缺陷：FAQ 用例原本假设初始 FAQ 为空，实际数据库自带 5 条种子 FAQ，且组件正确拒绝保存"只填了一半"的新行。测试已改为先清空再验证，不再假设初始条数。

## 验证

| 项目 | 结果 |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` | 通过 |
| `pnpm test`（unit） | 18 files / 105 通过 |
| `pnpm test:integration` | 13 files / 107 通过 |
| 新增 `tests/integration/site-content-sections.test.ts` | 5 项通过 |
| 新增 `tests/e2e/admin-content-sections.spec.ts` | 3 项通过 |
| 迁移专项 | 全新库 + 0017→0018 升级 + 重复迁移幂等，ID 稳定 |

集成测试覆盖：分区版本互不影响、不同分区并发都成功、同分区第二次保存 409 且服务端保留先写入的值、FAQ ID 在新增/删除/重排后稳定、公开 DTO 不泄漏任何版本或私有联系人字段。

E2E 覆盖：六个 Card 独立保存互不禁用、两个管理上下文同分区并发产生分区级冲突且本地草稿保留、「改用最新内容」生效、FAQ 稳定 ID 在重排与删除后仍跟随正确的行。

## 非目标

- 不改营业状态的数据模型（沿用既有 `business_statuses` 独立版本）；
- 不引入富文本或万能 CMS；
- 不动 T34-F4 的服务拆分与错误 reason。
