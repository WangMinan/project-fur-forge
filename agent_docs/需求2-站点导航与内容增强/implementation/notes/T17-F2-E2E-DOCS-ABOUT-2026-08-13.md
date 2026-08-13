# T17-F2 · E2E、Agent 指令与关于页第二轮修复（2026-08-13）

## 范围与结论

- 修复 `admin-updates.spec.ts` 陈旧版本冲突用例的异步竞态；不改变更新 API、CAS 规则或 409 草稿保留契约。
- 重整根目录 `CLAUDE.md` 为稳定规则入口，删除易过期的项目名、SHA、run 与阶段进度，明确 `git pull --rebase` 和 Playwright 精确筛选写法。
- 让 `/about` 的“防诈骗提示”与“工作室 / 制作范围 / 联系”成为同级 section，并直接复用相同标题与模块间距规则。
- 本记录只关闭 T17-F2 工程实施，不代签 T16-R1 独立 Review、T17 用户验收或 PR 合并。

## 根因与修复

### 动态后台陈旧版本用例

`locator.click()` 只保证点击事件完成，不保证 Vue 事件处理器中的异步保存请求已经落库。旧用例在 A 页点击保存后立即让 B 页提交，偶发由 B 抢先成功，导致预期的陈旧版本冲突落到错误一侧。

修复后，A 页点击保存必须先观察到编辑表单复位为“新增动态”，并在列表行中看到“A 已保存的内容”；只有这两个用户可见条件成立，B 页才提交陈旧版本。没有加入 sleep，也没有放宽 409、持久提示或本地草稿断言。

### Playwright 命令陷阱

`pnpm test:e2e -- tests/e2e/admin-updates.spec.ts` 中的 `--` 会被 Playwright 视为选项终止符，spec 参数可能不再作为筛选条件，曾意外启动全量 240 项。精确运行必须使用：

```powershell
pnpm exec playwright test tests/e2e/admin-updates.spec.ts
```

启动后应先核对 Playwright 汇总的测试数量；数量不符合预期时立即停止，不能把意外全量当作定向验证。

### 关于页排版

防诈骗模块从“联系”内部的三级标题和局部 margin 提升为 `.about-page__body` 下的同级 `section`。标题复用 `.about-page__section-title`，模块间距复用 `.about-page__body` 的统一 grid gap，不再维护专用字号、字重或 margin。

## 验证结果

- 修复前的精确陈旧版本用例压力基线：25/25；修复后的确定性等待版本再次 25/25。
- `admin-updates.spec.ts` + `admin-content-sections.spec.ts`：12/12。
- 完整 E2E：240/240，单 worker 串行；原失败上下文未再复现。
- unit：35 个文件、179/179。
- `APP_ENV=test pnpm lint`：通过。
- `APP_ENV=test pnpm typecheck`：通过。
- `APP_ENV=production pnpm build`：通过，production 内容守卫通过。
- Edge 真实浏览器：390×844、768×1024、1440×900 均无 console error 或失败请求。
- 标题计算样式：1440 宽为 23.04 px / 600 / 27.1872 px；390 与 768 宽为 20 px / 600 / 23.6 px；四个模块在各视口完全一致。
- 相邻 section 间距：三个视口均为 64 px。

完整 E2E 日志中的 500 为测试主动注入的媒体处理、预览与错误页失败场景，套件最终 240 项全部通过。

## 视觉证据

- [`t17-f2/screenshots/about-sections-1440x900.png`](./t17-f2/screenshots/about-sections-1440x900.png)
- [`t17-f2/screenshots/about-sections-768x1024.png`](./t17-f2/screenshots/about-sections-768x1024.png)
- [`t17-f2/screenshots/about-sections-390x844.png`](./t17-f2/screenshots/about-sections-390x844.png)

## 后续门禁

1. 推送后查询 PR 最新 SHA 的 GitHub Actions，不沿用旧 SHA 结果。
2. 由新上下文执行 T16-R1；本实现者不代签。
3. T17 真实账号、物理手机扫码和完整用户体验签署继续开放。
