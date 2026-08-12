# T10-B · 独立动态模型与后台

> 日期：2026-08-12
> 基线：`3bdecf5`
> 结论：**PASS**（T10-B 工程定义）；公开投影与页面由 T11 接续。

## 范围

- 新增前向迁移 `0030_requirement_2_updates.sql` 与 Drizzle `updates` 模型；
- 新增严格共享 Schema、管理 DTO、repository、service 与 `/api/admin/v1/updates` 资源路由；
- 新增 `/admin/updates`，支持逐条新增、编辑、发布、下架、删除；
- 所有修改动作使用 `expectedVersion` CAS；409 保留本地正文草稿并给出中文反馈；
- 审计只记录 actor、动作、动态 ID、结果与时间，不记录标题或正文。

首版未增加媒体、附件、slug、详情页、富文本、定时发布、外链、搜索或筛选，也未在 `site_content` 增加方案 A 字段/入口。

## 状态语义

- 新建为 `draft`，`published_at` 为空；
- 首次发布设置当前 `published_at`；
- 编辑已发布正文只增加资源版本，不改变 `published_at`；
- 下架改为 `unpublished` 并保留上次发布时间；
- 下架后再次发布把 `published_at` 更新为本次时间；
- 删除可以作用于任意状态，但必须提供当前版本，删除后公开投影自然消失。

## 数据与迁移边界

- 表字段与目标模型一致，只有 `(publication_status, published_at)` 索引；
- 数据库 CHECK 限定四种类型、三种发布状态、trim 后非空标题/正文、正版本及发布状态/时间组合；
- 空库迁移、重复迁移、从 0029 既有库升级、`foreign_key_check` 与 `integrity_check` 均由 integration 覆盖；
- Drizzle 生成器因仓库既有手写迁移多于快照而要求 TTY 交互，本次沿用 0027～0029 的明确前向 SQL + journal 方式，未改写历史文件。

## 验证

| 验证 | 结果 |
|---|---|
| `vitest ... tests/unit/update-schema.test.ts` | 3/3 PASS |
| `vitest ... tests/integration/update-management.test.ts` | 4/4 PASS |
| `database + domain-schema + update-management` | 32/32 PASS |
| 定向 ESLint | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `git diff --check` | PASS |
| Edge E2E `admin-updates.spec.ts` | 3/3 PASS |

正式 Playwright 配置首次启动在 Chrome 分发缺失处于 1ms 失败，未进入页面。随后复用同一测试构建，以临时 `channel: msedge` 配置执行完全相同的三个用例：CRUD/发布状态、双上下文 409 草稿保留、390×844 / 768×1024 / 1440×900 无横向溢出全部通过。临时配置已删除；外层命令在三个 `ok` 后因测试服务器清理未退出达到超时，不影响三个断言结果。

## 后续

T11 复用本文件已有 `publicUpdateDtoSchema`，新增只读 published repository/API、公开 `/updates`、SEO 与 sitemap；T10-B 本身不提前建立公开路由或空入口。
