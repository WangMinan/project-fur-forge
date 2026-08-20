# T38 静态四幕浏览器证据

> 日期：2026-08-21  
> 基线：T38 提交 `16166eb` 之后的用户反馈修正工作树
> Host：公开端 `http://127.0.0.1:3000`；本地 Nuxt dev；当前本地展示数据  
> 边界：本证据只证明静态结构与浏览器可观察结果，不代签动效节奏、真实手机或王旻安/景宸人工视觉验收。

## 结果

- 首页顺序为品牌 Hero → 代表作品（lead + 次级浏览）→ 非对称自设委托 → 单项设定领养。
- `HomeMotionReveal` 已删除，三幕不再因 IntersectionObserver 等待；390×844 与 1440×900 在禁用 JavaScript 时仍直出 H1、代表作品、委托和领养。
- 用户反馈后，三个标题消费与 `/works` 相同的字号，三个主媒体等高，桌面图片左—右—左交替，章节起始间距为 32px；六个目录/详情行动均为圆角 primary/secondary。
- 委托与领养复用 `HomeBusinessStatus`；浏览器分别读取到 `委托咨询开放 · 有限开放` 与 `领养信息以页面为准 · 有限开放`。
- `status-timeline.json` 记录委托状态从 SSR 到客户端 12 秒的水合修复：修复前 500ms 节点消失并出现组件解析警告；显式 import 后 0/0.5/2/5/12 秒两条状态均持续可见，opacity 为 1。
- 领养幕从 section 顶部对齐视口后，五个目标视口的标题、角色图、名称/物种、营业/单项状态和两个行动均在一屏内：

| 视口 | 三张主媒体高度 | 最后行动 bottom | 一屏结论 | 正向水平溢出 | console error |
| --- | ---: | ---: | --- | ---: | --- |
| 390×844 | 438.88px | 743.17px | 通过 | 0 | 0 |
| 430×932 | 484.63px | 788.42px | 通过 | 0 | 0 |
| 768×1024 | 532.47px | 836.88px | 通过 | 0 | 0 |
| 1024×900 | 612px | 516.11px | 通过 | 0 | 0 |
| 1440×900 | 612px | 538.63px | 通过 | 0 | 0 |

- 首轮 390/430/768 捕获发现次级精选轨道的 grid intrinsic width 把文档撑宽；为 `FeaturedTrack` 与其父 grid 增加 `min-width: 0`/`max-width: 100%` 后复测，全部视口不再存在正向水平溢出。
- 五个视口所需公开图片均 `complete=true` 且 `naturalWidth/naturalHeight > 0`；没有 console error 或 failed request。

## 文件

- `home-1440x900.png`、`home-390x844.png`：四幕完整滚动画面；
- `adoption-1440x900.png`、`adoption-1024x900.png`、`adoption-768x1024.png`、`adoption-430x932.png`、`adoption-390x844.png`：从领养幕起点进入后的单视口画面；
- `measurements.json`：首次静态层的 bounding box、图片 decode、溢出、console/network 与无 JavaScript 结果；
- `feedback-home-*.png`、`feedback-adoption-*.png`、`feedback-measurements.json`：用户反馈修正后的最终实画面与等高、双状态、一屏、溢出结果。
- `status-timeline.json`：委托/领养营业状态的 12 秒连续可见性与控制台事件。
