# T46-F4 用户复核证据

本目录只记录 2026-08-21 用户反馈对应的公开首页修正，不代签 T47 真实手机、连续性能、王旻安/景宸人工验收或最终独立 Review。

## 代码与静态检查

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm build`（含 production content guard）：通过。
- 未运行无关 core 或 smoke；本次改动用真实浏览器直接核验用户指出的视觉与导航问题。

## 浏览器结果

- 首页中文主标题首个可见采样起始终为最终 `100.8px`、`transform:none`、`opacity:1`、`clip-path:none`；页面 head 已预加载 `/fonts/zhuohei-collage.ttf`。
- 从首页深处进入 `/works`、`/commission?view=home-commission`、`/works/doggy?view=home-featured`、`/works/green-doggy?from=adoptions&view=home-adoption`，URL 切换第一帧均为 `scrollY=0`。
- `/about#contact` 仍保留 hash 语义：目标顶边约 87.9px，实测 Header 高 73px。
- 委托主图内部链接数为 0；caption 内孤立序号数量为 0；PC 显示“代表作品”两处，以 `SELECTED WORK · 01/02` 区分，移动端第二处标题隐藏。
- 1440×900 与 390×844 无正向水平溢出，浏览器 console error 为 0；从首页委托位置进入详情再返回，滚动位置从 2484 恢复为 2484。

## 截图

- `featured-lead-1440x900.png`：以 `SELECTED WORK · 01` 标识的代表作品主画面。
- `featured-gallery-1440x900.png`：重复“代表作品”并以 `SELECTED WORK · 02` 区分的次级精选画廊。
- `featured-lead-390x844.png`：移动端仅显示第一处章节标题的代表作品主画面。
