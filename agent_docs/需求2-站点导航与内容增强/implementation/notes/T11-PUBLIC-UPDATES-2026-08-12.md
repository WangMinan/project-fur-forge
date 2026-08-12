# T11 · 最新动态公开页

> 日期：2026-08-12
> 基线：`f73bdf8`
> 结论：**PASS**。

## 实现

- 新增 `public-update-repository` 与 `GET /api/public/v1/updates`；SQL 只选择 published 且有发布时间的记录，按 `published_at DESC, id` 稳定倒序；
- 公开 DTO 仅含 `id/type/title/content/publishedAt`，不选择也不返回状态、版本、创建/更新时间、管理员或私有字段；
- 新增 `/updates` 与 `PublicUpdateList`，显示固定类型标签、标题、正文和发布时间；
- 正文只使用 Vue 文本插值，CSS `white-space: pre-wrap` 保留换行，未使用 `v-html`；
- Schema 与数据库同时拒绝 `<`/`>` 及脚本式纯文本；
- 页面包含 SSR 数据、pending/error/empty 状态、canonical/OG/description；
- `/updates` 已进入 sitemap 静态路径。

首版继续不含详情页、分页、搜索、筛选、媒体、富文本、外链按钮或定时发布。

## 验证

| 验证 | 结果 |
|---|---|
| update Schema unit | 3/3 PASS |
| update management + public updates + database/domain integration | 38/38 PASS |
| 定向 ESLint | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `git diff --check` | PASS |
| Edge E2E `public-updates.spec.ts` | 3/3 PASS |

首次临时 Edge 配置在 worker 再求值时重新分配端口，使夹具请求连接到错误的 `localhost`，三个用例均在页面测试前失败。改为固定端口并复用同一构建/临时数据库后，published-only/倒序/纯文本、空态/失败态、canonical/SEO 和 390×844 / 768×1024 / 1440×900 全部通过。临时配置已删除；测试断言三个 `ok` 后 webServer 清理未退出导致外层超时，不影响断言结果。

## 安全边界

- 草稿和下架记录在 SQL 查询层排除，不依赖前端隐藏；
- API 捕获内部异常并只返回通用 500；
- 更新正文不进入日志、analytics 或动态 HTML；
- sitemap 只新增 `/updates` 列表页，不枚举不存在的详情路由。
