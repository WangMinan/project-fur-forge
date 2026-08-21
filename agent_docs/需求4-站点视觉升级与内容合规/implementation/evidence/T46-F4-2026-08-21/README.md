# T46-F4 用户复核证据

本目录只记录 2026-08-21 用户反馈对应的公开首页修正，不代签 T47 真实手机、连续性能、王旻安/景宸人工验收或最终独立 Review。

## 代码与静态检查

- `pnpm check:fast`：通过，53 个 core 文件、320 项测试；同时包含 lint 与 typecheck。
- `pnpm build`（含 production content guard）：通过。
- `tests/unit/router-scroll-behavior.test.ts`：3/3，通过，覆盖新导航/同路由到顶、page-ready saved position 与 hash offset。
- 未运行无关 smoke；本次改动用真实浏览器逐项核验首页全部可见内部导航。

## 浏览器结果

- 首页中文主标题首个可见采样起始终为最终 `100.8px`、`transform:none`、`opacity:1`、`clip-path:none`；页面 head 已预加载 `/fonts/zhuohei-collage.ttf`。
- 从首页深处进入 `/works`、`/commission?view=home-commission`、`/works/doggy?view=home-featured`、`/works/green-doggy?from=adoptions&view=home-adoption`，URL 切换第一帧均为 `scrollY=0`。
- 桌面首页主体 8 个、Header 6 个、Footer 8 个可见内部入口逐项点击，22/22 的实际 URL 与 `href` 一致，目标页 `scrollY=0..1`；其中两张次级精选卡片图片均进入各自作品详情。
- 390×844 移动导航 7/7 入口到目标页 `scrollY=0`，导航后抽屉均关闭；当前页 Header 品牌 Logo/“首页”、移动“首页”和 Footer“首页”都回到 `scrollY=0`。
- 首页委托主图内部链接数为 0；点击图片后 URL 保持 `/`，只有“了解自设委托”“提交委托申请”可以导航。
- 从首页委托幕 `scrollY=2484` 进入委托页为 `scrollY=0`；back 恢复 2484、forward 恢复 0，再次 back 仍恢复 2484。
- `/adoptions` 的“联系我们申请领养”进入 `/about#contact` 后，目标顶边约 87.9px，高于实测 73px Header。
- 代表作品 caption 内孤立序号数量为 0；PC 显示“代表作品”两处，以 `SELECTED WORK · 01/02` 区分，移动端第二处标题隐藏。
- 1440×900 与 390×844 无正向水平溢出，浏览器 console error 为 0；从首页委托位置进入详情再返回，滚动位置从 2484 恢复为 2484。

## 截图

- `featured-lead-1440x900.png`：以 `SELECTED WORK · 01` 标识的代表作品主画面。
- `featured-gallery-1440x900.png`：重复“代表作品”并以 `SELECTED WORK · 02` 区分的次级精选画廊。
- `featured-lead-390x844.png`：移动端仅显示第一处章节标题的代表作品主画面。
