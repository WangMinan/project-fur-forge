# T09 工程核心记录

> **分支**：`fix/t09-contracts-sol`
> **日期**：2026-07-30
> **角色**：`ENGINEERING_PRIMARY`
> **状态**：工程核心候选已完成；T09 保持未勾选，等待 Kimi 界面修补与最终复核

## 1. 范围与边界

本轮只修正 T09：T03 契约、双 Bucket 运行配置、错误分流、安全日志和生产占位文案守卫。没有创建 SQLite/Drizzle Schema，没有实现认证、OSS 上传、图片处理、发布或其他 T10 以后业务能力。

## 2. 变更路径

| 路径 | 变更 |
| --- | --- |
| `shared/schemas/work.ts`、`shared/types/contracts.ts` | 删除付款类废止字段和管理 DTO 的私有 Key；增加全部可空的返图授权记录 Schema/类型；媒体只输出 `assetIds` |
| `server/utils/work-mapper.ts` | 公开 DTO 改为逐字段显式投影；服务端记录可保留私有存储身份，但公开/管理 mapper 均不输出 |
| `shared/fixtures/visual-admin.ts` | 删除废止字段，改用 `assetIds`，修正类型化 UUID |
| `.env.example`、`config/runtime.example.json`、`server/utils/runtime-config.ts` | 单 Bucket 配置拆为私有/公开 Bucket；同步环境映射、类型、Schema、成组与生产校验；显式拒绝旧变量/旧 JSON 字段 |
| `app/error.vue`、`server/error.ts`、`server/utils/host-policy.ts` | API 保持 JSON envelope；普通页面 404/500 通过 Nuxt HTML 错误页；500 写入安全日志并在响应头返回 `x-request-id` |
| `server/utils/safe-log.ts` | 同时处理敏感 key 与 message/context 字符串中的凭据、联系人、私有 Key、签名 URL 等内容 |
| `scripts/guard-production-content.mjs`、`package.json` | production 构建产物扫描占位文案和 `/fixtures/samples/`；development/test 保留诚实提示 |
| `tests/unit/`、`tests/integration/`、`tests/e2e/`、`tests/fixtures/runtime/` | 增加契约、配置漂移、泄漏、错误内容类型/标题/正文/状态码/API 结构和生产守卫回归 |
| `requirements/SPEC.md`、`planning/PLAN.md`、`models/README.md` | 登记 OQ-119，并明确 T12 前不得据 DTO 直接建列 |
| `implementation/notes/T09-UI-HANDOFF.md` | 锁定 Kimi 后续界面修补范围 |

本机 `.env` 只把已知非秘密 Bucket 配置迁移成私有/公开两个名称；没有读取、打印或提交 AccessKey、秘密或真实凭据。

## 3. 关键决策

1. 公开 mapper 逐字段构造，禁止把服务端记录对象展开到公开 DTO；`originalObjectKeys` 只保留在服务端记录层。
2. 管理 DTO 只返回 `assetIds` 与获准的后台联系人；不返回私有 Object Key、签名 URL或其他存储身份。
3. 旧 `OSS_BUCKET` / `ossBucket` 不做静默兼容。配置加载只要发现旧名字（包括空值环境变量）就直接给出弃用错误，测试锁定该行为。
4. 私有与公开 Bucket 必须成组配置且名称不同；production 必须完整提供。
5. 页面错误不复用 API JSON 输出：Nuxt `error.vue` 只显示稳定的 404/500 访问者文案。API 仍使用统一 `{ error: { code, message, requestId } }`。
6. 500 日志只保留请求 ID、方法、无查询串路径、状态码、错误代码和静态分类；内部异常不回显。
7. 生产守卫扫描最终产物而非删除源提示；因此开发/测试仍诚实，正式素材门禁未通过时生产构建会因样张路径或文案失败。
8. `ownerDisplay` 的“空值=工作室作品”没有权威依据，登记 OQ-119；保持当前非空 Schema，停止 T12 相关列设计，不猜测业务事实。
9. 按 Ponytail 原则保持最小修复：复用现有 Nuxt 错误渲染、Zod 契约和 Vitest/Playwright 工具，没有引入新依赖、通用框架或 T10 脚手架。

## 4. 验证记录

| 命令 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过；lockfile 无变化，pnpm 10.33.0 |
| `pnpm lint` | 通过，0 问题 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 9 文件、61 项单测通过 |
| `pnpm test:integration` | 1 文件、4 项通过 |
| `pnpm test:e2e` | 86 项通过，约 2.3 分钟 |
| `pnpm build` | Nuxt 4.5.1 node-server 构建通过；development 诚实提示允许保留 |
| `pnpm verify:production` | 通过：健康检查、公开 SSR、管理 CSR |
| `APP_ENV=production node scripts/guard-production-content.mjs .output` | 按预期退出 1，阻断未接入文案、演示文案和 `/fixtures/samples/` |
| `git diff --check` | 通过 |

开发期第一次完整单测发现 T07 夹具中数个非规范 UUID；修正为有效 UUID 后全部通过。错误分流的集成测试先暴露了 Nitro error handler 直接返回 `Response` 未结束事件的问题，改为通过 Nuxt `__nuxt_error` 渲染并由 `sendWebResponse` 发送后，页面 404/500 HTML 与 API JSON 均通过。

E2E 输出含既有未实施 `/commission`、`/adoptions`、`/returns`、`/about`、`/contact` 的 Vue Router warning；测试无失败，本轮没有提前创建这些路由。视觉证据用例会重采既有 PNG，最终已将自动生成差异精确恢复，分支不包含视觉基线漂移。

完成审计后另以 `pnpm exec playwright test tests/e2e/access-surfaces.spec.ts tests/e2e/public-works.spec.ts` 复核错误夹具的 production 排除条件，18 项通过；随后仍以表中八条标准命令作为最终结论。

## 5. 未收口项

- Kimi 需完成 `T09-UI-HANDOFF.md` 的 UI-01 至 UI-07。
- OQ-119 已在工程核心完成后由用户确认；结论见下方补充记录。
- Kimi 修改合入并完成工程侧最终复核前，T09 不勾选，也不进入 T10。

## 6. OQ-119 后续确认

用户于 2026-07-30 确认：`ownerDisplay` 始终非空；工作室作品显示“有点小狗工作室”，隐私作品显示“不公开”；一期不增加 `ownerType`。该结论不要求修改当前共享 Schema，但要求 Kimi 将管理端字段标为必填并删除“留空表示工作室作品”的提示；T12 按非空公开显示值建模，不设置把漏填作品静默归类为工作室作品的默认值。
