# T01 · 合并委托导航

> **日期**：2026-08-12。
> **分支**：`feat/requirement-2`。
> **规划基线**：`de2b708`。
> **实现提交**：`e573760`；E2E 修复：`a38c295`。
> **结论**：ENGINEERING PASS；独立 Review、用户验收与 PR 合并仍开放。

## 范围

- 把公开导航的“自设委托”和“角色领养”合并为“委托”；
- 子项固定为“自设委托” `/commission` 与“掉落领养” `/adoptions`；
- 复用既有 `PublicHeader`、`PublicMobileNav`、children 激活逻辑和 `var(--radius-lg)`；
- 不新建组件，不修改路由、页面、样式、数据库或后台内容。

## 变更

- `app/utils/public-nav.ts`：两个一级项收敛为一个带 children 的“委托”项；
- `tests/e2e/public-information.spec.ts`：覆盖桌面 hover/focus、父项激活、子路由、圆角 token 与移动入口；在 focus 验证前把指针移出下拉触发区，区分 hover 与 focus 状态；
- `tests/e2e/public-works.spec.ts`：把“委托”用途筛选定位收窄到“按用途筛选”分组，避免导航、筛选和页脚三个同名链接触发 strict mode。

## 验证

- `pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- 本地浏览器 1440×900：hover 下拉显示两个子项，`/commission` 与 `/adoptions` 的父项激活正确，面板圆角与 `--radius-lg` 均为 16px；
- 本地浏览器 390×844：移动菜单显示两个子项，`scrollWidth === clientWidth === 390`，console 无 error/warning；
- 初版提交 `e573760` 的 Actions run `31513108282`：`checks`、`image-build` 成功，E2E 为 220 passed / 2 failed；失败分别是 hover 指针仍停留在“委托”上导致面板未隐藏，以及作品筛选用全页“委托”链接定位命中 3 个元素；
- 修复提交 `a38c295` 的 Actions run [`31515689322`](https://github.com/WangMinan/project-fur-forge/actions/runs/31515689322)：169 unit、172 integration、222 E2E 全部通过，`checks`、`image-build`、`e2e` 三个 job 均成功；
- 2026-08-12 文档同步前复跑 `APP_ENV=test pnpm lint` 与 `APP_ENV=test pnpm typecheck`：PASS。

首次定向 ESLint 入口在当前 Windows shell 未解析，改用仓库标准 `pnpm lint` 后通过。浏览器自动化首次在受限环境等待，允许启动浏览器后确认实际阻塞为系统 Chrome 未安装；没有把取消或未执行用例记为通过。远端首次失败记录继续保留，后续成功不能抹去其根因与修复范围。

## 后续

- PR [#10](https://github.com/WangMinan/project-fur-forge/pull/10) 仍为 open，尚未合入 `main`；
- T16 独立 Review 与 T17 用户验收尚未签署；
- 下一实现任务为 T02。
