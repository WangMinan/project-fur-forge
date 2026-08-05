# T34-F4 · 服务、组件与错误契约减债（部分完成）

> 状态：**部分完成，任务保持未勾选。** commit `5381764`。
> 已完成：稳定错误 `reason` 契约、前端英文消息匹配清零、Hero composable 部分拆分。
> **未完成：后端服务拆分（PLAN 7.1）。**

## 已完成

### 稳定业务 reason（PLAN 7.3）

契约从 `{ code, message }` 扩展为 `{ code, reason?, message }`：

- `code` 通用类别，`reason` 稳定业务原因，`message` 可自由改写的说明；
- `reason` 使用登记制枚举 `ERROR_REASON_VALUES`，未登记的值在 wire schema 层直接拒绝，防止随手新增字符串；
- `ServiceError` 与 `createApiError` 透传 reason；Nitro 错误处理器**只在 4xx 透出** reason，5xx 不泄漏内部分支；
- 服务端 63 处 throw 点（home / work / media / upload / watermark）已挂上登记 reason。

### 前端不再匹配英文消息（GOAL.md 红线）

改动前，前端有 4 处直接比较服务端英文 `error.message`：

| 位置 | 原匹配 | 现匹配 |
| --- | --- | --- |
| `useAdminHome` 停用 | `'At least one hero slide must remain enabled.'` | `HERO_LAST_ENABLED_SLIDE` |
| `useAdminHome` 启用顺位 | `'Enabled hero slides must have 1 to 5 unique positions.'` | `HERO_SLOT_LIMIT` |
| `useAdminHome` 顺位范围 | `'Enabled hero slide order must be between 0 and 4.'` | `HERO_ORDER_STALE` |
| `works/[id].vue` 版本冲突 | `'Resource version is stale.'` | `VERSION_CONFLICT` |

`work-errors.ts` 的映射表键从英文 message 换成 reason；中文提示集中在这一张表，不在各组件复制。`AdminApiError.serverMessage` 保留但只作诊断用途。

新增 `tests/unit/error-reason.test.ts`：除了验证契约本身，还会扫描 `app/` 目录，**一旦有人重新引入英文消息分支就失败**。

### 前端 composable 拆分（PLAN 7.2，部分）

- `usePublicationPolling`：长任务定时器生命周期与操作状态拉取；
- `useHeroPreview`：`previews` / `previewPending` 两份状态与预览请求；
- `useAdminHome` 组合两者，554 → 约 470 行。

**刻意没有拆 `useHeroCollection`**：Hero 集合状态与发布流程通过 `refreshHome` / `operations` / `feedback` 深度耦合，强行拆开只会得到一层转发壳，而 PLAN 7.2 明确反对"为行数而拆分"。这一层需要连同后端 runner 边界一起重新设计，留待后续。

## 未完成（后续必须补）

PLAN 7.1 的后端拆分**全部未做**：

- Hero repository / service / publication runner；
- 水印 profile service 与 apply runner；
- 作品 publication runner；
- 公开投影 repository；
- 媒体配方与生成器进一步分层。

`home-management.ts` 仍是约 1100 行的混合层（SQL + 业务规则 + 长任务状态 + OSS 副作用）。这是 T34-F4 剩余的主要范围，任务因此保持未勾选。

## 本轮发现的两个潜伏回归（均由 T34-F1 引入）

我在 F1 之后没有重跑这两个 spec，因此缺陷潜伏了三个任务：

1. **`admin-home`「无活动水印时启用被拒绝」**：F1 已正确移除启用路径的活动水印 profile 门禁（站点大图不打水印），但该用例仍在断言旧规则。已改为断言新契约：预览仍需 profile 并被拒绝，启用不再依赖 profile 且应当成功。
2. **`admin-branding` 四比例预览**：F1 把水印预览从 4 个比例（含两个 Hero）减到 3 个，但 captions、`toHaveCount(4)`、影响摘要与确认对话框文案断言都还是旧值。已全部更新。

另外修回两处我在 F3 改名却没检查引用的标签：`页面内容` 分组标题与 `新增问题` 按钮（含该按钮的上边距视觉修复）。

**教训**：改动跨任务共享的契约（水印用途集合、影响摘要文案、管理端标签）后，必须重跑覆盖该契约的全部 spec，而不只是当前任务新增的 spec。本轮结束前已执行完整 Playwright 套件。

## 验证

| 项目 | 结果 |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` | 通过 |
| `pnpm build` | 通过 |
| `pnpm test`（unit） | 19 files / 108 通过 |
| `pnpm test:integration` | 13 files / 107 通过 |
| **完整 Playwright 套件** | **210 / 210 通过** |
