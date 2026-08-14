# T51-F9 首页与管理端动效、移动导航工程记录

> 日期：2026-08-15
>
> 实施基线：`main` / `7b5e6d2`
>
> 结论：**PASS WITH FOLLOW-UP**。工程实现与本地验证通过；远端 CI、T49-R1 独立 Review、用户验收和发布未由本记录代签。

## 范围与边界

- `/admin/site/home` 的首页、委托大图增加与精选排序一致的稳定 ID FLIP 位移动画，并为 placement Tab/面板增加轻量过渡；
- 管理端 `<1024px` 改为八入口全屏导航，1024–1279px 保留横向导航，1280px 起保留侧栏；
- 公开首页增加 Hero 首次错峰、四区块一次性入屏揭示、可点击卡片精细指针反馈和移动抽屉错峰；
- 公开/管理抽屉共用焦点陷阱、Escape、背景 `inert`、滚动锁定、路由后关闭与焦点归还；
- 不改数据库、迁移、媒体链、HTTP API、排序协议或依赖，不增加连续脉冲和视差。

## 实现与首次失败

- 新增单一 `ADMIN_NAV_ITEMS`、`AdminMobileNav`、`useFullscreenNavigation` 和 `HomeMotionReveal`；SSR/无 JavaScript 不附加隐藏态，客户端成功挂载后才启用观察器与 Hero 编排；
- 首轮 62 项相关 E2E 为 55 通过、7 失败。真实实现 finding 是 Hero 父级渐进增强选择器压过 reduced-motion 与各元素 delay；提高同级选择器权重后，错峰和减少动效均精确重跑通过；其余失败为测试未按真实可访问名称、Vue scoped keyframe 名和浏览器 `0.01ms` 归一值取证；
- 复用未重启的本地 Nuxt dev 时，新自动导入组件曾触发 hydration mismatch；改为显式导入本轮新增组件/工具后，现有服务无需重启即可恢复到 0 error / 0 warning。

## 自动化门禁

- `$env:APP_ENV='test'; pnpm lint`：通过；
- `$env:APP_ENV='test'; pnpm typecheck`：通过；
- `$env:APP_ENV='test'; pnpm test`：39 files / 196 tests 通过；
- `pnpm exec playwright test tests/e2e/admin-home.spec.ts tests/e2e/admin.spec.ts tests/e2e/public-home.spec.ts tests/e2e/public-information.spec.ts`：62/62 通过；
- `$env:APP_ENV='production'; pnpm build`：通过，production content guard 同步通过。

## 真实浏览器证据

- 公开 Host `http://127.0.0.1:3000/`：390×844、768×1024、1440×900 均无横向溢出或坏图；四个区块逐一入屏后保持 `visible`，console 为 0 error / 0 warning；
- 公开 390×844 抽屉：7 项延迟递增，打开后 HTML 锁滚动、main 为 inert、焦点进入关闭按钮，Escape 后焦点归还；
- 管理 Host `http://localhost:3000/admin/site/home`：390×844 与 1023×900 显示三横线和八入口抽屉，1024×900 恢复横向导航；各视口无横向溢出、无坏图，抽屉当前项、滚动锁和焦点均正确；
- 截图位于 [`screenshots/`](./screenshots/)；其中公开首页、公开抽屉、管理 390/1023 抽屉和 1024 横向导航为本轮批准证据。

## 保持开放

- 最新提交 SHA 的远端 Actions 结果；
- T49-R1 新上下文独立 Review；
- 用户验收、不可变镜像与正式发布；
- T17 真实平台账号、物理扫码及最终用户验收继续按需求2文档保持开放。
