# T12 · 首页动态摘要与导航入口

> 日期：2026-08-12
> 基线：`856fd4a`
> 结论：**PASS**。

## 实现

- home aggregate 新增严格的 `latestUpdates` 区块，最多返回 3 条；复用 T11 的 published-only repository，按发布时间倒序读取；
- 动态查询单独捕获失败并返回 `{ available: false, items: [] }`，不影响 Hero、作品、业务入口与领养区块；
- 新增 `HomeLatestUpdates`，在业务入口之后展示类型、时间、标题和三行纯文本摘要，并链接 `/updates`；无已发布动态或查询失败时不渲染；
- 在桌面/移动共用的 `PUBLIC_NAV_ITEMS` 中把“最新动态”放在“关于我们”之前；页脚同步复用同一数据源；
- analytics route key、标签、客户端静态路由映射与 SQLite CHECK 同步增加 `updates`；
- 新增前向迁移 `0031_requirement_2_updates_analytics.sql`，以复制表方式扩展 SQLite CHECK，保留既有事件和索引。

本任务未增加动态详情页、媒体、搜索、筛选、分页或第二套写入口。

## 验证

| 验证 | 结果 |
|---|---|
| analytics / public nav unit | 6/6 PASS |
| home updates / analytics / database integration | 21/21 PASS |
| 定向 ESLint | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `git diff --check` | PASS |
| Edge E2E `public-home.spec.ts --grep T12` | 2/2 PASS |

浏览器覆盖了最新三条、草稿隔离、空态隐藏、桌面/移动导航、`updates` 统计事件以及 390×844、768×1024、1440×900 无横向溢出。首次 E2E 的两个失败来自测试选择器与夹具命名空间：选择器误用了不存在的 `public-header__nav-list`，且标题未使用夹具清理前缀，造成跨用例残留；修正后 2/2 通过。临时 Edge 配置已删除。现有 E2E webServer 在断言全部 `ok` 后仍不退出，外层命令因此超时；断言结果不受影响，该进程清理问题留给 T14/T15 总门禁统一记录。

## 边界

- 草稿和下架动态仍在 SQL 层排除；首页不会收到管理状态、版本、内部时间或私有字段；
- 动态正文只通过 Vue 文本插值展示，不进入 analytics；
- analytics 请求仍受既有 Host/Origin、严格 Schema、HMAC session 与限流约束；
- `0031` 是前向迁移，不修改已经存在的 `0025` analytics 历史迁移。
