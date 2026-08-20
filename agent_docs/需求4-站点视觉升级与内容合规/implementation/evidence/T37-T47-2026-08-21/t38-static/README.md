# T38 静态四幕浏览器证据

> 日期：2026-08-21  
> 基线：T37 提交 `2db39fe` 之后的本地 T38 工作树  
> Host：公开端 `http://127.0.0.1:3000`；本地 Nuxt dev；当前本地展示数据  
> 边界：本证据只证明静态结构与浏览器可观察结果，不代签动效节奏、真实手机或王旻安/景宸人工视觉验收。

## 结果

- 首页顺序为品牌 Hero → 代表作品（lead + 次级浏览）→ 非对称自设委托 → 单项设定领养。
- `HomeMotionReveal` 已删除，三幕不再因 IntersectionObserver 等待；390×844 与 1440×900 在禁用 JavaScript 时仍直出 H1、代表作品、委托、领养和唯一领养行动。
- 领养幕从 section 顶部对齐视口后，五个目标视口的标题、角色图、名称/物种、状态和唯一行动均在一屏内：

| 视口 | section 高度 | 唯一行动 bottom | 一屏结论 | 正向水平溢出 | console / request failure |
| --- | ---: | ---: | --- | ---: | --- |
| 390×844 | 711.48px | 711.33px | 通过 | 0 | 0 / 0 |
| 430×932 | 749.33px | 748.84px | 通过 | 0 | 0 / 0 |
| 768×1024 | 795.45px | 795.33px | 通过 | 0 | 0 / 0 |
| 1024×900 | 746.84px | 573.02px | 通过 | 0 | 0 / 0 |
| 1440×900 | 807.09px | 629.78px | 通过 | 0 | 0 / 0 |

- 首轮 390/430/768 捕获发现次级精选轨道的 grid intrinsic width 把文档撑宽；为 `FeaturedTrack` 与其父 grid 增加 `min-width: 0`/`max-width: 100%` 后复测，全部视口不再存在正向水平溢出。
- 五个视口所需公开图片均 `complete=true` 且 `naturalWidth/naturalHeight > 0`；没有 console error 或 failed request。

## 文件

- `home-1440x900.png`、`home-390x844.png`：四幕完整滚动画面；
- `adoption-1440x900.png`、`adoption-1024x900.png`、`adoption-768x1024.png`、`adoption-430x932.png`、`adoption-390x844.png`：从领养幕起点进入后的单视口画面；
- `measurements.json`：各元素 bounding box、图片 decode、溢出、console/network 与无 JavaScript 结果。
