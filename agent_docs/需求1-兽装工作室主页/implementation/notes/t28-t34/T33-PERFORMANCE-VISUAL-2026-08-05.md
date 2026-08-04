# T33 P0 性能与三视口媒体回归

## 初审记录

首轮生产浏览器启动时错误地把 `MEDIA_BASE_URL` 指向应用 Host，图片请求得到 JSON 404 和 ORB。该结果属于测试环境配置错误，不能作为产品 finding 或通过证据；恢复当前 `.env` 的公开 OSS Origin 后，从头重跑以下检查。

实现方自测结论为 `PASS`，不能代替下方新上下文独立 Review。没有为本轮指标新增缓存、图片组件或视觉分支。

## 环境与方法

- 基线：`ea43425` 的 production build；其后 `2ddbb85` 只同步 T32 文档，应用代码不变。
- Node.js `v24.18.0`，pnpm `11.18.0`，Windows 11 家庭中文版 `10.0.26200`。
- Intel Core Ultra 5 228V，8 个逻辑处理器，31.5 GiB 内存。
- 开发 SQLite 只读抽样：675,840 bytes；17 条迁移、3 件作品（2 件发布）、20 个资产、61 个变体、5 条作品媒体关系、2 张启用大图、1 条站点内容、2 条营业状态、5 个水印 profile。
- SSR：production Node 单进程、并发 1；每个路由先热身 5 次，再连续记录 30 次。`cold` 是启动后该路由首次请求；稳定样本报告 P50/P95/max/状态/字节。SPEC 未给 SSR 时延阈值，因此只记录基线，不倒推通过线。
- 浏览器：真实 Chrome；公开端 `127.0.0.1`、管理端 `localhost`；固定视口 `390×844`、`768×1024`、`1440×900`。

## SSR 基线

| 路由 | cold ms | P50 ms | P95 ms | max ms | 稳定状态 | 响应 bytes |
|---|---:|---:|---:|---:|---|---:|
| `/` | 172.08 | 15.45 | 31.85 | 33.13 | 200 × 30，0 error | 64,956 |
| `/works` | 18.45 | 15.11 | 20.45 | 21.04 | 200 × 30，0 error | 27,463 |
| `/works/doggy` | 27.67 | 15.43 | 22.09 | 23.90 | 200 × 30，0 error | 46,269 |
| `/adoptions` | 21.75 | 14.99 | 18.20 | 20.15 | 200 × 30，0 error | 36,015 |
| `/commission` | 16.55 | 14.92 | 19.27 | 20.21 | 200 × 30，0 error | 46,835 |
| `/about` | 13.20 | 15.15 | 18.20 | 22.23 | 200 × 30，0 error | 31,156 |
| `/contact` | 18.57 | 15.07 | 16.44 | 18.88 | 301 × 30，0 error | 100 |

公开投影由现有批量查询和服务端 DTO 生成；本轮没有观察到按卡片发起客户端 API 或媒体转换请求，也没有为测量新增共享缓存。

## 媒体请求与解码

- 首页 Hero 只渲染当前项：首项 `loading=eager`、`fetchpriority=high`，隐藏项切换后才进入 DOM；定向 E2E 实际证明隐藏项不下载。
- 390/768 只请求竖版 Hero，1440 只请求横版；委托图片入口同样按方向选择。详情首图和领养设定图使用既有 eager/high 原语，其余卡片/入口沿用 lazy 默认。
- 统一 `ResponsivePicture` 继续输出预生成 `srcset`、页面 `sizes`、真实 `width/height`、`alt` 和 `decoding=async`；浏览器不追加转换参数，不接触私有 Key。
- 首页、作品列表、详情、领养、委托、关于、联系三视口的可见图片全部真实解码；无失败请求、无缺失 alt/width/height、无横向溢出。
- OSS 抽样为 `200 image/webp`，`Cache-Control: public, max-age=31536000, immutable`，24,768 bytes。方向与用途明细见 [`network/T33-PUBLIC-MEDIA-SUMMARY-2026-08-05.md`](./network/T33-PUBLIC-MEDIA-SUMMARY-2026-08-05.md)。

## 视觉、交互与无障碍

- 首页和 `/works/doggy` 的六张固定视口截图已逐张检查：图片仍是最高视觉层级，当前品牌水印可辨识但未遮住主体；页面保持既有深蓝、米白、圆角和克制位移动效。
- 公开首页、作品列表、作品详情与管理作品页/编辑器在三个固定视口均为 0 横向溢出；作品列表与详情 CLS 均 `< 0.1`。
- 首页箭头、圆点、方向键、触控滑动、自动轮播暂停与 reduced-motion 均通过；公开首焦点为“跳到主要内容”，详情缩略图可 Tab 到达并响应 Enter。
- 管理端大图低分辨率确认、真实任务进度/刷新恢复、水印预览、导航和编辑器键盘路径通过；公开/管理端 reduced-motion 均保持可用。
- `/contact` 正常 301 到 `/about#contact`；未知作品和页面异常分别由既有完整 HTML 404/500 路径覆盖。404 的资源 console 记录与测试触发的 500 日志为预期，不计作正常页面错误。

## 自动化结果

`pnpm exec playwright test` 定向运行 47 项，耗时 189.2 秒，全部通过；覆盖：首页横竖请求、隐藏项不下载、轮播交互/触控/自动播放/reduced-motion/CLS，作品交集筛选、详情顺序/301/404/500/纵图限高，领养三视口解码，公开信息架构，管理大图低分辨率/进度恢复/水印，以及公开/管理三视口溢出、键盘和 reduced-motion。

本基线此前已通过 `pnpm lint`、`pnpm typecheck`、production `pnpm build` 和 `pnpm verify:production`；完整全量命令留在 T34 从最新 `main` 统一重跑，不用 T33 的定向结果代签。

## 证据

- 首页：[`390×844`](./screenshots/t33-public-home-390x844.png)、[`768×1024`](./screenshots/t33-public-home-768x1024.png)、[`1440×900`](./screenshots/t33-public-home-1440x900.png)
- 作品详情：[`390×844`](./screenshots/t33-public-work-doggy-390x844.png)、[`768×1024`](./screenshots/t33-public-work-doggy-768x1024.png)、[`1440×900`](./screenshots/t33-public-work-doggy-1440x900.png)
- Chrome 操作 trace：[`t33-public-390.trace`](./trace/t33-public-390.trace)，包含首页 → 作品 → 返回 → 领养的动作记录；资源快照未入库，图片与请求结论分别由上方 PNG 和脱敏 network 摘要承载。
- trace 共 210,677 bytes，SHA-256 `7d6fa67db76caa5aa5778377a8e0c16e5a9a45dd4570007df87f73acf3ba2107`；敏感关键词扫描 0 命中。

## 新上下文独立初审

基线 `925f772` 结论为 `NOT PASS`。以下初始 findings 已在代码修复前冻结，后续不得删除：

1. **MUST-FIX · Hero 公开与管理投影存在 N+1**：公开 `publicHeroSlides()` 为每项横/竖资产各查一次变体；管理 `getAdminHome()` 还会为每项分别读取横/竖变体、最新发布/适配操作，低分辨率资产另行查询处理源。当前真实库只有 1 项，掩盖了 0–5 项规模增长；实现方“批量查询/无 N+1”结论不成立。应在共享 Hero 投影边界批量加载变体、处理源和最新操作，并留下多项查询数回归。
2. **SHOULD-FIX · 后续项仍声明 eager**：隐藏项虽不在 DOM 且未提前下载，但切换到第 2 项后仍输出 `loading=eager`；首项应为 eager/high，后续项按需进入后应为 lazy/auto。
3. **SHOULD-FIX · art direction 缺少方向固有尺寸**：竖屏实际选择 9:16 图片，但 portrait `<source>` 没有自己的 `width/height`，后备 `<img>` 仍声明横版 1920×1080。固定 Hero 容器使当前 CLS 为 0，不能代替真实 intrinsic size。应复用 HTML 原生 `<source width height>`，不新增客户端方向状态。
4. **SHOULD-FIX · 轮播圆点命中区过小**：分页 button 约 10×10 CSS px、间距 8 px，24 px 判定圆相交，不满足 WCAG 2.2 SC 2.5.8。视觉圆点可保持 10 px，按钮命中区至少扩大到 24×24 px。

独立审查其余证据：7 个公开路径 × 3 视口均为 0 requestfailed、0 console error、0 overflow、0 解码失败和 0 缺失 alt/size；390/768 只请求 portrait，1440 只请求 landscape，`/contact` 到达 `/about#contact`。管理、键盘/触控、reduced-motion、404/500、OSS header 和水印视觉未发现额外 finding。

修复后须由同一独立上下文重新验证以上四项；最终 `PASS` 前不得勾选 T33。

## 修复与实现方复测

- 复用现有 Hero 投影，在一次资产变体 `IN` 查询和一次窗口函数查询中批量读取全部项所需的变体与最新操作；2 项回归中公开投影固定 5 条 prepared SQL、管理投影固定 6 条，不再随项数逐项查询。
- 首项保持 `eager/high`，后续项进入 DOM 时为 `lazy`；`ResponsivePicture` 直接使用原生 `<source width height>` 声明横竖方向固有尺寸，没有增加客户端方向状态。
- 保持 10 px 圆点外观，将原生 button 命中区扩到 `24×24` CSS px；既有颜色、圆角和切换动效不变。
- 首次集成测试暴露共享校验函数 import 遗漏，3 项因 `ReferenceError` 失败；补回 import 后又由查询计数断言发现公开投影还包含 2 条活动 profile 查询，将准确基线由 4 改为 5。最终 6/6 通过，初次失败未作为通过证据删除。
- 最终实现方结果：6 个改动文件定向 ESLint 通过；`pnpm typecheck` 通过；`pnpm exec vitest run tests/integration/public-site-contracts.test.ts` 6/6 通过；`pnpm exec playwright test tests/e2e/public-home.spec.ts` 18/18 通过；`pnpm build` 通过。构建只有既有 plugin timing 提示。

当前状态：修复已完成，等待同一新上下文 Reviewer 复核；在独立结论前仍为 `NOT PASS`。

## 新上下文独立复核

最终结论：`PASS WITH FOLLOW-UP`。初始 1 个 MUST-FIX 与 3 个 SHOULD-FIX 全部 `CLOSED`，无新增 finding。

- Reviewer 在内存副本中构造 2/3/4/5 个启用项，公开投影始终 5 条查询、管理投影始终 6 条。
- 独立集成测试 6/6、Chrome E2E 18/18 通过；首项 `eager/high`、第二项 `lazy`、隐藏项按需进入、横竖 `<source>` 固有尺寸和分页按钮 `24×24` 均由浏览器断言覆盖。
- production 的 `390×844`、`768×1024`、`1440×900` 分别只请求 portrait、portrait、landscape；全部真实解码，`requestfailed=0`、正常页面 console error 0、横向溢出 0、CLS 0，视觉无回归。
- FOLLOW-UP 仅为证据边界：Reviewer 无当前真实库管理凭据且不得修改真实库，未重放认证后的 production 管理页；真实库只有 1 个启用项且自动轮播关闭，因此多项交互由独立 E2E 覆盖。该边界不回退四项 finding 的关闭结论。

T33 工程、自动化与独立 Review 已收口；T34 总门禁从 `6b2da66` 后的最新 `main` 启动。
