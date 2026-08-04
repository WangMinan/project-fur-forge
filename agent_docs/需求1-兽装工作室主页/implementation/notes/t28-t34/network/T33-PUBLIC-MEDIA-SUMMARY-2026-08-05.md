# T33 公开媒体请求摘要

环境：`ea43425` 的 production build；开发 SQLite 只读浏览；媒体从已配置的公开 OSS Origin 读取。

| 视口 | 首页首项 | 委托入口 | 结果 |
|---|---|---|---|
| 390×844 | `home-hero-portrait/480` | `home-hero-portrait/480` | 未请求对应横版 |
| 768×1024 | `home-hero-portrait/768` | `home-hero-portrait/480` | 未请求对应横版 |
| 1440×900 | `home-hero-landscape/1920` | `home-hero-landscape/1920` | 未请求对应竖版 |

- 首页、作品列表、`/works/doggy`、领养、委托、关于与联系三视口均无失败请求；可见图片全部真实解码，`alt`、`width`、`height` 无缺失。
- 首页还按页面内容请求 `work-card/480` 与 `design-sheet/960`；详情请求 `detail/960`，没有客户端二次转换或私有路径。
- 抽样 OSS `HEAD`：`200 image/webp`，`Cache-Control: public, max-age=31536000, immutable`，24,768 bytes。
- `/contact` 正常到达 `/about#contact`；404 只产生浏览器预期的页面 404 console 记录，没有网络失败。
- 首轮错误地把 `MEDIA_BASE_URL` 指到应用 Host，得到 JSON 404/ORB；修正为实际媒体 Origin 后以上结果通过，错误配置下的结果未作通过证据。
