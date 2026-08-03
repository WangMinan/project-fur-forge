# S2 Review 修补收口（2026-07-31）

> **范围**：从 `main@5629943a267d763f9f5426605e1f8c5db33f999a` 创建 `fix/s2-review-closure-sol`，只修补 T11–T13 Review 问题。T01–T13 与 EXT-02 的完成状态不变，T14 未启动。

## Review 闭环

| Review 问题 | 状态 | 修改路径与结果 |
| --- | --- | --- |
| production 错误强制 SMTP | 已修复 | `server/utils/runtime-config.ts`、`tests/unit/runtime-boundaries.test.ts`、`planning/PLAN.md`：核心生产配置仍强制显式提供；SMTP 五项全部缺失合法，部分配置拒绝，完整配置通过，不生成 fallback 凭据。`config/runtime.example.json` 已复核，无需改动。 |
| 认证、管理与预览响应可被缓存/索引 | 已修复 | `server/utils/private-response.ts`、`server/middleware/01.host-boundary.ts`、`server/error.ts`、`nuxt.config.ts` 及集成测试：`/api/auth/**`、`/api/admin/**`、`/preview/**` 的成功与 401/403/404/409/500 响应统一返回 `no-store`、`no-cache`、`noindex` 和 `Vary: Cookie, Origin`；公开 SSR 不受影响。 |
| 认证命令隐式执行数据库迁移 | 已修复 | `server/utils/database.ts`、`server/utils/auth-commands.ts` 及集成测试：增加只读迁移状态检查；数据库缺失或有待执行迁移时明确提示先运行 `pnpm db:migrate`；初始化和重置均不再迁移或产生迁移前备份。 |
| CLI 密码进入参数、日志或 Shell 历史 | 已修复 | `scripts/auth-input.ts`、`scripts/auth-init.ts`、`scripts/auth-reset-password.ts`、`tests/unit/auth.test.ts`、`T13-AUTH-2026-07-31.md`：默认使用隐藏 TTY 输入；环境变量只保留给受控自动化；PowerShell/Bash 示例在 `finally`/`trap` 中清理秘密；stdout 不输出密码。 |
| role/usage 与处理来源不可验证 | 已修复 | `server/database/schema.ts`、新迁移 `0002_puzzling_malcolm_colcord.sql`、`tests/integration/domain-schema.test.ts`：数据库触发器落实 asset/variant 角色一致、角色/用途矩阵、同资产 READY PRIVATE preprocess 来源、输入/输出摘要衔接、20 MB/4096 px 处理源上限、20 MB 原图分流和 identity 不可原位改写。 |
| 首页发布校验与公开 mapper 不一致 | 已修复 | `server/utils/hero-publication.ts`、`server/utils/media-mapper.ts` 及单元/集成测试：两者复用同一套完整 recipe 条件；原图 READY、任一方向缺失、宽高比例错误、fallback 缺失、usage/水印错误均拒绝，完整配方通过后 mapper 不再静默返回 `null`。 |

## 新迁移与兼容性

- 新增 `server/database/migrations/0002_puzzling_malcolm_colcord.sql` 和对应 Drizzle snapshot；既有 `0000`、`0001` 未改写。
- `asset_variants.source_variant_id` 为可空自引用外键，保留既有记录；新写入和后续更新受 role/usage、来源谱系与 identity 触发器约束。
- variant 的 `media_role` 必须等于所属 asset 的角色；公开大图在原图超过 20,000,000 字节时必须引用同资产、`READY`、`PRIVATE`、`preprocess` 且不超过 20,000,000 字节/4096 px 的来源 variant；小图仍允许直接以永久原图摘要作为输入。
- 已存在的历史行不会被迁移脚本重写或自动补来源；若未来导入真实旧数据，需在启用对应公开投影前单独审计和回填。
- `auth:init` 与 `auth:reset-password` 不再代替运维执行迁移；部署顺序固定为先 `pnpm db:migrate`，再执行认证命令。
- 首页公开条件收紧为完整当前 recipe；草稿态不被强制满足公开 variant 条件。

## 验证结果

| 命令/检查 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过 |
| `pnpm db:generate` | 通过；Schema 无漂移 |
| 独立临时库连续两次 `pnpm db:migrate` | 通过；首次应用 3 项，第二次应用 0 项 |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 通过；13 个文件、85 项测试 |
| `pnpm test:integration` | 通过；5 个文件、34 项测试 |
| `pnpm test:e2e` | 通过；78 项测试 |
| `pnpm build` | 通过；production 配置守卫通过 |
| `pnpm verify:production` | 通过；健康检查、公开 SSR、管理端 CSR 均通过 |
| production 无/部分/完整 SMTP | 通过；分别为接受、拒绝、接受 |
| auth/admin/preview no-store | 通过；成功和错误响应均覆盖，公开首页未附加私有响应头 |
| 认证命令迁移边界 | 通过；缺库/待迁移拒绝，显式迁移后恢复，不产生隐式迁移记录或备份 |
| role/usage、source lineage、Hero 完整配方 | 通过；非法与合法链路均有回归测试 |
| 当前 Markdown 相对链接 | 通过 |

T13 记录中的 112 项 E2E 是当时完整运行结果；随后基线提交 `5629943` 清理了 34 个只负责写入历史截图的采集用例，保留行为断言并避免标准 E2E 重写已验收 PNG，因此本轮当前套件为 78 项。两组数字对应不同时间点和测试集合，不是 34 项行为回归消失。

## 合并前复核

- Ponytail Review 删除了与 identity 不可变触发器重复的 role/usage 更新触发器，并把仅有一个生产调用者的迁移状态对象收缩为直接只读断言；两项复杂度收缩合计约 45 行，新增的数据库边界约束另计。
- 常规正确性复核补齐 asset/variant 角色一致、preprocess 字节/尺寸上限和 Hero 16:9/9:16 实际尺寸检查；对应回归断言已加入现有最小测试。
- Doc Reader Test 修正过时的 `review/REVIEW.md`，把认证前端交接登记为唯一任务清单中的 `GATE-06`，解释 E2E 数量变化，并澄清模型文档、历史分支和 EXT-01 依赖。
- 本分支曾重新引入的三份已吸收临时稿和 T09 交接稿没有当前引用，已再次移出工作树；历史仍由 Git 保存。

## Kimi 认证前端交接

下一批先完成 T13 的真实浏览器认证接线，不勾选或启动 T14：

1. 把现有登录/管理页面接入 `POST /api/auth/login`、`GET /api/auth/session`、`POST /api/auth/logout`、`PUT /api/admin/account/password`。
2. CSRF token 只保存在页面内存，不写入 localStorage、sessionStorage、URL 或日志；处理 401、403、409 和资源版本冲突。
3. 未认证管理界面只显示登录入口；登录后恢复 Session，退出和改密后验证旧 Session 失效。
4. 在真实浏览器验证 Host-only、Secure、SameSite=Strict Cookie，公开域/管理域隔离，以及成功和错误响应的 `no-store`/`noindex` 头。
5. 保持当前服务端 Schema、API、Host/Origin/CSRF 与资源版本语义；发现接口冲突时先回到契约处理。

## 遗留风险

- 本轮没有改动 `app/`；真实浏览器 Cookie、Session 恢复、退出/改密失效和错误态仍需 Kimi 按上节完成。
- T14 上传与 T16 媒体处理编排未启动；后续实现必须正确写入 `source_variant_id`，不能绕过新来源约束。
- 迁移对未来导入的既有媒体数据不做自动回填；出现真实旧行时需要专项审计。
- E2E 仍会输出尚未实施路由的既有 unmatched-route 警告，但 78 项测试均通过；这些页面属于后续任务。
