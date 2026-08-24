# Design Brief: 联系面按钮化与身份行收敛

> **产出阶段**：需求4 阶段 E
> **决策来源**：王旻安 2026-08-24 逐项指出 + 本轮候选方案确认（联系清单 hairline 行 / 主行动只留大图 / CSS 浮层 hover 触发）
> **范围**：`/adoptions` 卡片、`/works/{slug}` 详情头与图集切换、`/commission` 与 `/about` 联系区、管理端领养封面提示条

## Problem

四处独立的人类摩擦，根因各不相同：

1. **管理端提示条贴着图片**。`/admin/works/{id}` 的「作品已发布，横版封面为只读」蓝条与下方预览图零间距。同页另两个同类提示（设定图、出厂照）都有 `margin: 0 0 var(--admin-space-4)`，只有领养封面这一条漏了 —— `public-base.css` 的全局 `p { margin: 0 }` 也作用于管理端，因此漏写就是贴边。
2. **领养卡价格单独换行**。价格被放进独立的 `.adoption-card__details` 行，靠 `margin-inline-start: auto` 推到右侧，于是「名称·物种 + 状态」在第一行、价格孤零零占第二行。访客要读两行才能拿到一条商品信息。
3. **详情页没有领养事实**。`publicWorkDetailDtoSchema.work` 只有 id/slug/名称/物种，价格与状态从未投影到详情，尽管同一份数据早就在 `/adoptions` 卡片里。访客从领养目录点进详情，反而看不到刚才看到的价格和状态。
4. **联系区是三张二维码卡**。二维码方块吃掉整段版面，而访客真正需要的是号码和一个能点的入口；`/commission` 全页因此堆到 9 个可点元素，主次不分。

## Solution

| 问题 | 处置 |
| --- | --- |
| 提示条贴边 | 补上与同类提示相同的 `margin-bottom`。不新增样式类：三处提示已经是同一套写法，这里只是把漏掉的一处补齐。 |
| 价格换行 | 价格与状态合成 `.adoption-card__meta` 一组贴右端，与名称·物种同一行；价格在状态之前。窄屏由整行折行，价格不再单独占行。 |
| 详情缺事实 | 新增 `publicWorkDetailWorkDtoSchema`：在公开作品事实上追加**可选**的 `adoptionStatus` 与 `price`，仅领养作品带这两个字段。服务端复用 snapshot 里已算好的 `match.adoption`，不新增查询、不触碰数据库。 |
| 联系区 | 邮箱 + QQ + QQ群 收进同一张 `ContactChannelList`，每行 `标签 / 号码 / 行动`，靠 hairline 分隔。二维码退出常驻版面，桌面 fine pointer 用纯 CSS 浮层在 hover/focus 时给出。 |

## Experience Principles

1. **一条事实一行读完** —— 名称、物种、价格、状态属于同一个判断（"这个角色是什么、多少钱、还能不能要"），所以在同一视觉层里表达；详情页因为标题是 h1，拆成"名称"与"物种 价格 状态"两行，第二行同字号、只用颜色分层。
2. **号码优先于二维码** —— 访客要的是可复制的号码和一个能点的入口。二维码是补充路径，不是主体，因此退到 hover 浮层；但**解不出跳转链接的渠道保留常驻二维码**，那是它唯一的添加路径。
3. **反馈不推开布局** —— 复制成功的提示做成绝对定位浮层。插在按钮下方的一段文字会把整行推开、把同行按钮挤走，用户点一次按钮就看到页面跳一下。

## 关键实现约束

1. **浮层只作用于有链接的行**：`.contact-list__row[data-linked='true']`。解不出链接的行没有可 hover 的按钮，浮层化会让它的二维码永远无法出现。
2. **浮层要显式给宽**：绝对定位元素收缩到锚点宽度，不给 `width: max-content` 就被压成按钮宽（实测 54px）。靠右而非居中，否则探出卡片右边界。
3. **reduced-motion 规则要同权重**：`.contact-list__qr` 单类选择器会被 `.contact-list__row[data-linked='true'] .contact-list__qr` 盖掉，`transition: none` 不生效（实测仍为 0.18s）。
4. **图集高度必须由比例驱动**：舞台高度原本由内容算（`auto`），`auto → auto` 不是计算值变化，`interpolate-size` 也无法过渡它（实测高度仍瞬间从 660 跳到 345）。改为舞台自带 `aspect-ratio: var(--stage-aspect-ratio)`，与图片共用同一个 `--gallery-max-height`，比例可过渡因而高度可过渡。
5. **离场图不能写 `inset: 0`**：那会同时约束上下边，把离场竖图压扁到新的舞台高度。只约束 `inset-inline` + `inset-block-start` 做水平居中。
6. **号码不用宋体**：宋体的阿拉伯数字字面窄、字重轻，与相邻中文标签和按钮文字对不齐。改用正文黑体 + `tabular-nums`，三行号码位宽一致。

## Existing Patterns

全部沿用既有令牌与组件，不引入新技术栈。`PublicAction`（primary/secondary/text 三种角色）、`ContactEmailActions`、`--motion-duration-state/-content` + `--motion-ease-standard`、`--public-status-open/-paused/-neutral`、`--shadow-card-hover`、`--radius-sm/-xs`。

`ContactChannelGrid` 被 `ContactChannelList` 完全取代，无残留调用方，已删除。
