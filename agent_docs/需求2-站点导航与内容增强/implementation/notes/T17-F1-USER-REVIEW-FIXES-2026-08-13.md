# T17-F1 首轮用户验收 findings 修复

> 日期：2026-08-13；分支基线：`26c88e4`；应用实现提交：`f3df1be`。
> 结论：PASS；只关闭 T17-F1 工程修复，不代签 T16-R1 独立复查或 T17 用户最终验收。

## 范围

- Hero 自动、箭头、圆点、键盘与触控切换使用同一组带方向平滑过渡；过渡后仍只保留当前图片，`prefers-reduced-motion` 立即切换。
- 首页入口标题改为“委托投递”；“当前领养”和“最新动态”的“查看全部”统一品牌蓝。
- 关于页防诈骗提示移除独立卡片底色、圆角和内边距，回归正文排版。
- 新增共享 `PublicUpdateCard`，首页与 `/updates` 统一为白底圆角卡片；类型同时使用文字和四种固定颜色圆点。
- `/updates` 增加“全部 / 参展资讯 / 掉落预告 / 开单通知 / 其它”普通链接筛选。
- `/works`、`/adoptions` 宽屏搜索与筛选同排；三个目录删除重复标题节点，搜索框继续用 `aria-label` 提供可访问名称。

没有修改动态表、公开 DTO、媒体链、发布状态、排序、Host 边界、迁移或依赖。

## 实现边界

- `HomeHeroCarousel` 使用 Vue `Transition`，离场与进场均为 680 ms opacity/transform；切换期间是两张，结束后收敛为一张，隐藏图片不常驻下载。
- 动态类型筛选只在已取得的 published-only 公开列表中计算，不增加第二套 API 或数据模型。
- `/returns` 没有分类筛选，只保留同尺度紧凑搜索行；窄屏工具栏允许按控件组换行，避免横向溢出。
- 回滚只需回退本轮 Vue/CSS/测试与需求2活文档，不涉及数据库或对象存储回滚。

## 自动化门禁

- `git diff --check`：通过。
- `APP_ENV=test pnpm lint`：通过。
- `APP_ENV=test pnpm typecheck`：通过。
- `APP_ENV=test pnpm test`：35 个文件、179/179 通过。
- `APP_ENV=production pnpm build`：通过，含生产内容守卫。
- 最终 `public-search.spec.ts` 独立重建：4/4 通过。
- 复用同一最终 E2E 构建合并运行 `public-home`、`public-updates`、`public-search`、`admin-content-sections`、`admin-updates`：40/40 通过。

首次误用 `pnpm test:e2e -- tests/...` 时，参数分隔方式让 Playwright 启动了全套件，并在既有后台动态陈旧版本用例出现一次瞬时失败；改用 `pnpm exec playwright test <spec>` 精确执行后，该用例与本轮相关规格在最终合并回归中全部通过。没有删除、跳过或放宽断言。

## 真实浏览器与三视口

- 本机 Edge 只读访问用户正在运行的 `http://127.0.0.1:3000`；390×844、768×1024、1440×900 均完成截图复核。
- Hero 点击下一张后 DOM 数量为 `1 → 2 → 1`，计算过渡时长为 `0.68s`；截图可见中间混合帧。
- 两个“查看全部”计算颜色均为 `rgb(50, 77, 175)`；“委托投递”标题唯一可见。
- `/updates` 真实数据由 4 条筛到 2 条，卡片为白底，类型点颜色随文字类型变化。
- `/works`、`/adoptions` 的桌面搜索与筛选 y 偏差均为 0；三个视口无横向溢出。
- 搜索标题文本节点数量为 0，按“按设定名称搜索”可访问名称定位的搜索框数量为 1。
- 防诈骗区计算样式为透明背景、0 px 内边距、0 px 圆角。
- 真实页面巡检期间 console error 为 0、HTTP 失败响应为 0。

证据位于 [`t17-f1/screenshots/`](./t17-f1/screenshots/)；其中包括 Hero 中间帧、首页动态三视口、动态页三视口、作品/领养工具栏三视口、返图搜索三视口和关于页防诈骗正文。

## 后续门禁

- `f3df1be` 已推送到 PR #10；重新查询最终 PR HEAD 的 GitHub Actions，不能沿用旧 T16 SHA 的结果。
- 由未参与本实现的新上下文执行 T16-R1，重点复查动画按需加载/reduced-motion、动态筛选、三视口工具栏和文档一致性。
- T17 仍由用户继续真实账号、实际二维码物理手机扫码和完整体验验收。
