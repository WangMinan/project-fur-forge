# 用户复核修正：仅横版领养封面的发布与展示（FU-11～FU-16）

> 记录日期：2026-08-17。分支 `codex/r3-phase-d-e-t22-t36`。
> 本文件只记录本轮任务与事实，不复制 SPEC/models 的权威结论。

## 1. 用户诉求

1. 领养常见场景是「只做了单头」：有 `adoption_cover`，但客户未提供 DTD 前做不出身体，
   因此没有竖版出厂照。
   1. 只有 `adoption_cover` 也要允许发布，不强制出厂照。
   2. 只有横版图时也要在 `/` 精选作品与 `/works` 作品展示中出现，布局需容纳横版；
      有竖版出厂照时仍优先展示出厂照。`/adoptions` 卡片保持横版进入。
   3. `/works/{slug}` 详情页若为领养作品，需要展示 `adoption_cover`，不能只显示出厂照。
2. 删除 `/works/{slug}` 的「上一件 / 下一件」导航（其未维护来路，切换后返回目标会退化）。

## 2. 现状与根因

复核对象 `c7e36a3b-19e1-47b0-8000-bf70fe1ab1ce`（`green-doggy`，adoption/available/unpublished）
只有 READY 的 `adoption_cover` 与 `design_sheet`，没有 `studio_photo`。

- `server/utils/runner/work-publication.ts` 的 `checkWorkPublication` 对所有 purpose 无条件
  `blockers.push('STUDIO_PHOTO_REQUIRED')`，这是无法发布的唯一根因；
- `server/utils/repository/public-site-repository.ts` 的 `snapshot()` 要求 `card`（来自 primary
  `studio_photo` 的 `work-card` 3:4 变体）存在，否则 `continue` 丢弃整条记录，因此仅横版作品
  即使发布也不会出现在首页精选与 `/works`；
- `listWorks` 另有 `.filter(entry => entry.studioPhotos.length > 0)`；
- 详情页 `media.gallery` 只装 `studio_photo`，`adoption_cover` 从未进入详情 DTO；
- `detailFor()` 计算 previous/next，`app/pages/works/[slug].vue` 渲染前后导航。

数据库侧没有「已发布必须有主出厂照」的触发器；`0039` 的第三个停止点只是一次性迁移前置校验，
不是运行时约束，所以本轮不需要新的 migration。

但由此产生一条顺序约束：`0039` 仍会因「published work 缺 READY 主出厂照」停止，所以在生产
执行 `0039` 之前不得发布只有横版封面的领养作品。已写入 DATA-MIGRATION §12.1 与 STATE §4.8，
本轮不改写历史迁移，也不顺手新增放宽迁移。

## 3. 任务

| 编号 | 任务 | 状态 |
| --- | --- | --- |
| FU-11 | 发布门禁：adoption 有合格 cover 时不再要求 studio photo；commission/showcase 不变 | 已完成 |
| FU-12 | 公开投影：允许无 primary studio photo 的 adoption 进入快照，卡片回落到 cover | 已完成 |
| FU-13 | 详情 DTO：领养作品把 cover 纳入详情媒体 | 已完成 |
| FU-14 | 卡片与详情布局容纳横版；有出厂照时仍优先竖版出厂照 | 已完成 |
| FU-15 | 删除详情页上一件/下一件导航与其 DTO 字段 | 已完成 |
| FU-16 | 更新受影响测试与文档，运行受影响门禁 | 已完成 |

## 4. 实现事实

### 4.1 发布门禁（FU-11）

`checkWorkPublication` 现在按 purpose 分流出厂照要求：

- adoption：`adoption_cover` 合格（存在、READY、有 alt）即可发布，`studio_photo` 变为
  0..5 可选；
- commission / showcase：仍必须至少一张 READY 且恰好一张 primary 的 `studio_photo`。

出厂照存在时的既有约束全部保留：恰好一张 primary、全部 READY、全部有 alt。
新增 blocker `ADOPTION_MEDIA_REQUIRED` 只在领养作品既没有合格 cover 也没有出厂照时出现，
避免既有 `STUDIO_PHOTO_REQUIRED` 文案在领养语境下误导。

### 4.2 公开投影（FU-12）

`snapshot()` 的卡片选择改为：primary studio photo 的 `work-card` 变体优先；领养作品在没有
它时回落到 `adoption-card` 变体，并带上 `cardOrientation`（`portrait` | `landscape`）。
`listWorks` 的 `studioPhotos.length > 0` 过滤改为「有卡片即可」，否则仅横版作品仍会被挡在
`/works` 之外。commission/showcase 没有 cover，缺卡片时行为不变（继续丢弃）。

### 4.3 详情（FU-13/FU-14）

详情 DTO 增加 `media.adoptionCover`（仅领养作品）。详情页在图集之上单独渲染
「领养封面」区块；出厂照区块只在有出厂照时渲染，因此只有横版封面的作品不再出现空的
「出厂照 / 作品图集」标题。

卡片布局：`WorkCard` 依据 `cardOrientation` 切换 frame 比例（竖版 3:4，横版 16:9），
首页精选轨道与 `/works` 网格都按 `align-items: start` 容纳混合高度。
`/adoptions` 的 `AdoptionCard` 未改动，仍固定 16:9 横版进入。

### 4.4 导航删除（FU-15）

删除 `publicWorkDetailDtoSchema.navigation`、`detailFor()` 的 previous/next 计算和详情页
导航区块与样式。`related`「继续浏览」保留，返回链接仍按 `history.state.back` 区分
`/adoptions` 与 `/works`。

## 4.5 用户复核第二轮：等高铺满与单一图集（FU-17～FU-20）

首轮把混排做成了**等宽**，导致横版卡变矮、行内高度参差、右侧大面积空白；详情页主图在
「领养封面」（限宽居中）与「出厂照」（竖图居中、横图靠左）之间跳动；「继续浏览」不需要。

- **等高铺满**：`--card-ratio` 是卡片比例唯一真值，因为容器也要读，所以定义在 `public-base.css`
  而非组件内（CSS 变量只向下继承）。`/works` 用 flex justified：`flex-grow` 与 `flex-basis` 同时
  正比于比例 → 同行放大系数相同 → 高度必然相等且行宽铺满。关键事实：卡片框比例恒等于公开变体
  比例（`work-card` 3:4、`adoption-card` 16:9），所以铺满**不产生裁切**，比原先预估的 5-10% 裁切更好。
- **末行孤卡**：上限取行高 1.25 倍。1.12 会让填满的行留下 36px 缺口，1.6 会让孤卡涨到 486px
  （对比正常行 355px）；1.25 同时满足「填满行 gap=0」与「孤卡 380px，仅高 7%」。
- **单一图集**：封面并入 `gallery` 末尾，主图位置因此只有一处。主图与缩略图成组居中，缩略图紧贴
  右侧——最初实现为「主图靠左 + 缩略图列在右」，但主图在 1207px 宽的列里只有 480px，缩略图被推到
  很远，视觉上主图显得过小；改为 flex 成组居中后解决。
- **`related` 删除**：连带 `SnapshotEntry.purpose`（其唯一消费者就是 related 计算）。

一个数据问题不属于代码缺陷：`green-doggy` 详情页出现两张相同照片，是因为同一个文件被分别作为
`design_sheet` 与 `adoption_cover` 各上传了一次（sha256 相同、object key 不同）。应由工作室在
后台删除其中一个角色的图片，Agent 不擅自改真实数据。

## 5. 门禁

见 STATE.md 阶段行 `E 仅横版领养适配`。本地执行 lint / typecheck / unit / integration /
production build / 受影响 E2E。真实设备验收、独立 Review 与生产执行未由实现者代签。
