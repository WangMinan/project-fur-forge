# T01 · 合并委托导航

> **日期**：2026-08-12。
> **分支**：`feat/requirement-2`。
> **实现基线**：`de2b708`。
> **结论**：PASS WITH FOLLOW-UP。

## 范围

- 把公开导航的“自设委托”和“角色领养”合并为“委托”；
- 子项固定为“自设委托” `/commission` 与“掉落领养” `/adoptions`；
- 复用既有 `PublicHeader`、`PublicMobileNav`、children 激活逻辑和 `var(--radius-lg)`；
- 不新建组件，不修改路由、页面、样式、数据库或后台内容。

## 变更

- `app/utils/public-nav.ts`：两个一级项收敛为一个带 children 的“委托”项；
- `tests/e2e/public-information.spec.ts`：覆盖桌面 hover/focus、父项激活、子路由、圆角 token 与移动入口。

## 验证

- `pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- 本地浏览器 1440×900：hover 下拉显示两个子项，`/commission` 与 `/adoptions` 的父项激活正确，面板圆角与 `--radius-lg` 均为 16px；
- 本地浏览器 390×844：移动菜单显示两个子项，`scrollWidth === clientWidth === 390`，console 无 error/warning；
- `pnpm test:e2e -- tests/e2e/public-information.spec.ts`：本机缺少配置要求的系统 Chrome，三个用例未进入测试体；PR CI 必须重跑该规格。

首次定向 ESLint 入口在当前 Windows shell 未解析，改用仓库标准 `pnpm lint` 后通过。浏览器自动化首次在受限环境等待，允许启动浏览器后确认实际阻塞为系统 Chrome 未安装；没有把取消或未执行用例记为通过。

## 后续

- PR CI 重跑 `public-information.spec.ts`；
- 独立 Review 与用户验收尚未签署；
- 下一实现任务为 T02。
