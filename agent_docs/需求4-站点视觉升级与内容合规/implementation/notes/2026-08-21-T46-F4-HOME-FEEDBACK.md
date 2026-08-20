# T46-F4 · 首页刷新、导航与代表作品用户复核

## 用户反馈

1. 首页刷新时中文主标题出现一次异常尺寸/位置变化；
2. 从首页进入作品目录、委托与两条作品详情时，新页面没有从顶部开始呈现；
3. 首页自设委托大图不应点击跳转；
4. 代表作品第一屏孤立 `01` 不清楚，第二屏“继续浏览”又不像同一章节；用户进一步确认无标题画廊同样缺少上下文；
5. 不增加无关自动测试，完成后同步需求4文档。

## 实现结论

- 中文主标题不再参与首载 clip/位移动画，拼贴字体作为首屏关键字体预加载；英文品牌与 slogan 保留错峰。
- 新增 Nuxt router 级 scroll behavior：非 hash push 导航同步到顶；back/forward 恢复 saved position；hash 使用统一 Header offset。删除 layout 中只处理同路径 query 的局部 watcher。
- 委托主图删除整图链接；共享对象名保留在展示容器上，明确按钮继续承载 `/commission` 与 `/commission/apply`。
- 代表作品 caption 删除孤立 `01`；PC 两个停靠点重复“代表作品”标题并用 `SELECTED WORK · 01/02` 眉题区分，移动端第二标题隐藏；轨道按钮放到媒体下方。

## 验证边界

- 通过：lint、typecheck、production build/content guard、1440×900/390×844 Chrome 视觉截图、四条首页离站路径首帧到顶、返回位置恢复、hash offset、零 console error。
- 未执行：无关 core/smoke、真实手机、连续 wheel 性能、最终独立 Review、王旻安/景宸人工验收、发布与生产。
