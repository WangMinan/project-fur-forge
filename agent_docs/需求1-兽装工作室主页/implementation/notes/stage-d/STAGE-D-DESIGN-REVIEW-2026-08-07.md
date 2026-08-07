# 阶段 D 设计复核与返图墙形式确认

> **日期**：2026-08-07。
> **代码基线**：`c751b41f6d1b58a6a64a7b7693a17935da3a0f2e`（文档基线 `94e2058` 的后继）。
> **范围**：阶段 D 的 T35–T37 设计收口；不处理 T49 的既有 CI 技术债。
> **性质**：dated note，只记录本次复核事实与决策。当前权威仍以 `.design/`、
> `requirements/SPEC.md`、`planning/PLAN.md`、`implementation/TASKS.md` 为准。

## 1. 复核材料

- `materials/MATERIAL-MANIFEST.md`；
- `materials/兽装工作室主页调研_2026-07-26/兽装工作室主页调研.md` 与 `imgs/README.md`；
- 调研截图 60–64（实际打开观察，非仅读索引）：
  - 60：渔屋返图墙顶部，大号居中标题 + 按设定名搜索 + 主题横幅；
  - 61：全幅主题图叠字后进入不等高多列瀑布流（该站桌面约 5 列）；
  - 62：瀑布流中段，混合竖图/横图/方图，列间距紧凑，圆角轻微，无卡片外壳；
  - 63：瀑布流下段，单页承载大量图片并以底部分页承接后续内容；
  - 64：点击返图后的弹窗，显示返图者昵称、系列、日期与“查看 TA 的主页”。
- `materials/picture-examples/返图/虾片/`：真实返图样例
  `虾片-1.jpg` 1139×2083（比例 0.547，极端竖长）、`虾片-2.jpg` 1600×2400（比例 0.667）；
  两张源图自带摄影师签名，属于原始画面内容，不是本站水印。
- `.design/public-site/`、`.design/admin-console/` 七份活文档；
- 当前公开页面、导航、卡片、Hero、公共 CSS 与 `AdminShell.vue`。

## 2. 从截图 60–63 采纳与不采纳的内容

**采纳**：不等高原比例多列瀑布流、紧凑信息密度、轻圆角、无卡片外壳、底部编号分页、
单页承载较多图片。

**不采纳**：

- 截图 60 的大号居中标题、搜索框与主题横幅 —— 阶段 D 用紧凑 `PublicPageIntro` 替代，
  不设搜索；
- 截图 61 的全幅主题图叠字 —— 不设 Hero；
- 该站桌面 5 列 —— 本站锁定 4 列上限，避免缩略图过小；
- 截图 64 的返图详情弹窗、返图者昵称、日期与用户主页入口 —— 明确的反例边界，
  阶段 D 不建设返图详情、返图者档案或任何社交层。

## 3. 返图墙唯一默认形式

```text
公共 Header
紧凑 PublicPageIntro（“返图” + 一句短说明）
原比例无水印瀑布流 / 真实空态
底部编号分页（含上一页 / 下一页）
公共 Footer
```

- 每页 24 条；排序为人工 `sort_order` 后接稳定 ID；
- 列数：≥1280px 四列、768–1279px 三列、340–767px 两列、<340px 单列；
- 列间距：手机 12px、平板 16px、桌面 20px；圆角 10–14px；
- 图片保持原比例，不做 3:4 强裁；默认无厚边框、无强阴影、无彩色外壳、无渐变叠字；
- caption 在图片下方约 8px，只显示关联作品名称/链接；每项一个主链接到 `/works/{slug}`；
- 图片声明固有宽高，首屏之后懒加载，单图失败局部占位；
- 分页是普通链接，SSR 与无 JavaScript 时可用；不使用自动无限滚动，
  也不以“加载更多”为默认方案；
- 不采用会造成顺序错乱的 `column-count` 或 `grid-auto-flow: dense`；
  使用保持源顺序的确定性布局，DOM / Tab / 屏幕阅读顺序与视觉顺序一致。

## 4. 当前设计语言是否偏离

**结论：没有系统性偏离，只有局部信息架构与文档债。**

仍然符合原设计语言：公开站白底摄影优先、品牌蓝克制；媒体是最高视觉层级；
圆角与阴影没有演化成 SaaS 卡片墙；管理端仍是 Quiet Editorial Tool；两端未互相复制。

本次修正的有证据偏差：

| 偏差 | 证据 | 处理 |
| --- | --- | --- |
| 管理端导航把作品管理排在第 4 位 | `AdminShell.vue` 原顺序为大图/文案/水印/作品/密码 | 改为作品优先；同步更新 `admin.spec.ts`、`t09-ui.spec.ts` 的顺序断言 |
| 公开导航缺少返图且顺序需锁定 | `app/utils/public-nav.ts` | 顺序锁定为首页/作品展示/返图/自设委托/角色领养/关于我们；返图入口随 T36 前端接入，不提前显示空入口 |
| 公开 Token 仍引用 T05 与 `recipe-v1` | `.design/public-site/DESIGN_TOKENS.md` | 改写为 `recipe-v2` / `site-display-v1` / `return-display-v1` 三族身份，并补返图 gap/radius/caption/列数 |
| Hero 注释暗示带水印 | `HomeHeroCarousel.vue` 渐变注释“水印由 OSS 居中烘焙” | 改为“站点展示位使用无水印 `site-display-v1`，不叠加 Logo” |
| “分页或加载更多”二选一 | `.design`、SPEC、PLAN、TASKS、REVIEW、EXECUTION_ROUTING | 统一收敛为底部编号分页 |
| 返图“轻量水印”旧表述 | 复核未在当前活文档中发现残留；媒体策略已明确无水印 | 保持无水印，本轮不再引入该表述 |

## 5. 视觉优化边界

本轮只做上述有证据的局部收口：不重做全站，不推翻阶段 C 已验收的 Hero、作品卡、
领养卡与详情布局，不引入新 UI 框架、字体体系、全局主题或大规模组件重写。

## 6. 已同步文档

`.design/README.md`、`.design/public-site/{DESIGN_BRIEF,INFORMATION_ARCHITECTURE,DESIGN_TOKENS}.md`、
`.design/admin-console/{DESIGN_BRIEF,INFORMATION_ARCHITECTURE,DESIGN_TOKENS}.md`、
`requirements/SPEC.md`、`planning/PLAN.md`、`implementation/TASKS.md`、
`implementation/EXECUTION_ROUTING.md`、`review/REVIEW.md`。
