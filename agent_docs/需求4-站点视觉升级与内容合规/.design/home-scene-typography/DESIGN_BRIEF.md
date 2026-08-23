# Design Brief: 首页 2-4 幕图文协调重排

> **产出阶段**：需求4 阶段 E · `/design-flow` Phase 2
> **决策来源**：王旻安与景宸 2026-08-23 口述 + 本轮 grill-me 逐项确认
> **参考**：`https://fureststory.com/`（森绒）首页章节比例与字重层次
> **范围授权**：用户已在本轮明确授权**重开数据库范围**，用于新增首页导语文案配置（详见 §10）

## Problem

访客滚过首页第一幕后，剩下三幕给他的感觉是"三张大图轮流砸过来"，而不是"一间工作室在依次介绍自己做什么"。

具体的人类摩擦：

1. **图片吃掉了全部注意力**。第一幕已经完成"看照片"这件事；2-4 幕继续用 68svh 的巨图，访客第二次、第三次看到同样量级的图，边际信息为零，却仍要付出同样的滚动成本。
2. **文字读不出主次**。每幕右栏只有一句 `--font-size-sm` 的浅灰句子。访客扫过去时无法在 0.5 秒内判断"这一幕在说什么、我要不要点"，只能靠章节标题猜。
3. **又挤又空**。文字栏挤在一列窄区里（`max-width: 20rem`，一句话折三行），而整幕被 `min-height: 100svh` 撑开，图片和文字都靠 `align-content: center` 浮在中间 —— 上下各留出一大片无内容的空白。景宸的原话"排列有点挤 上下空余又多了点"精确描述了这两件事同时发生。

根因是一个：`.home-scene-heading` 把章节标题抽到左上独立一行后，右侧文字栏只剩一句小灰字，**撑不起一栏，也压不住旁边的巨图**。

## Solution

把每一幕从"一张大图 + 一句附注"改成**一组图文对位**：左右两栏权重接近，文字侧自成一个有内部层次的信息块（英文小标 → 中文标题 → 状态 → 导语 → 行动），图片侧退到 56svh。

访客的体验变化：滚到任一幕，视线先落在中文标题上判断"这是什么业务"，顺着字阶自然下滑到导语知道"具体是什么"，看到营业状态知道"现在能不能找他们"，最后落在两个按钮上决定去哪 —— 全程不需要先解析照片。照片从"主角"变成"证据"：证明这句话说的是真的。

## Experience Principles

1. **层次优先于尺寸** —— 让访客读懂一幕靠的是字阶对比（12px 小标 / 44px 标题 / 24px 导语）与标题下的 hairline，不是把某个元素放大。缩图不是为了"让图变小"，是为了给文字腾出足以建立层次的视觉预算。
2. **图文对位优先于图片主导** —— 文字块与图片在同一水平轴上左右对望，二者视觉重量接近（文字块高度约为图片的 74%，靠垂直居中平衡，不强求等高）。第一幕已经完成"展示照片"的任务，2-4 幕的任务是"说明业务"。
3. **信息闭环优先于视觉留白** —— 每一幕在目标视口一屏内必须独立说完：这是什么、现在什么状态、可以去哪。留白服务呼吸，不服务空洞；一屏装不下的内容删掉，不靠第二次滚动补救。

## Aesthetic Direction

- **Philosophy**：编辑式工作室页（editorial studio page）。杂志跨页的图文对位关系 —— 一侧图版、一侧文版，靠字阶和留白建立秩序，不靠卡片描边和阴影分区。
- **Tone**：克制、具体、可信。陈述"我们做什么、现在能不能接"，不做情绪营销。
- **Reference points**：
  - `fureststory.com` —— 本次比例与字重层次的直接参照：eyebrow + 大标题 + 正文 + 箭头链接聚成一块紧贴图片，图片约占章节高度的一半而非全部。
  - 需求4 已建立的"简洁底盘 + 摄影主导"底座（Hero 手写体品牌、宋体章节标题、黑体正文）。
- **Anti-references**：
  - 森绒的浅色圆角卡**只用在文字侧，不用在照片侧** —— 它的图是插画，浅底座是插画的常规处理；我们是实拍照片，照片套进色块会立刻出现"照片浮在色块里"的廉价感。照片继续 `object-fit: cover` 满框；文字块则做成与照片等高的浅色卡（`--public-bg-secondary` + 1px 描边），用来把文字撑满自己那一栏。
  - 不做带描边的业务卡包住图片、不做三幕并排的等宽宫格、不做营销落地页的巨型 CTA 区块。
  - 不因为"参考森绒"就把宋体标题换成加粗黑体 —— 宋体是需求4 视觉基线的一部分，森绒用黑体是因为它整体走可爱插画风。

## 布局统一契约（2026-08-23 第二轮修正）

第一轮实现出现"三幕左右边界不等宽、第二幕右侧空旷、上下留白不对称"三个缺陷，根因是**每幕各自维护栏比、gap 和容器**。修正后确立硬约束：

1. **单一定义点**：`.home-scene` / `.home-scene__stage` 及其 `--media-start` / `--media-end` 变体在 `public-base.css` 定义**一次**，三幕共用。各幕 scoped CSS 只允许写自己的图片和特有元素，**不得**再声明 `max-width`、`padding`、`grid-template-columns` 或栏间 `gap`。
2. **等宽**：三幕共用 `--home-scene-max-width`（= `--public-content-wide` 90rem）与 `--public-page-padding`，左右边界由此在数学上恒等。
3. **栏比与 gap**：桌面统一 `1.15fr / 1fr`（图片栏略宽）+ `clamp(2.5rem, 6vw, 6rem)`。第二幕双图的差异由**图片之间的 `--space-5`** 吸收，不靠改栏比。
4. **上下留白**：`--home-scene-block-padding: var(--space-8)`（4rem，第一轮的 6rem 过大）。桌面恢复 `min-height: calc(100svh - header)` + `align-content: center`，让 snap 停靠时上下对称 —— 内容自然高配 snap start 会导致视觉上"下方偏空"。
5. **文字卡占满栏**：`.home-scene-intro` 桌面 `height: 100%`，**不设 `max-width`**。宽栏里塞窄内容再左对齐是第二幕右侧空旷的直接原因。
6. **hairline**：标题簇下方一条 `1px solid var(--public-border-secondary)`（CSS 边框，非字体衬线）收住标题与正文的分层。

## Existing Patterns

本次是**改造既有实现**，不引入新技术栈。全部沿用 `app/assets/css/public-base.css` 的 `:root` 令牌。

- **Typography**：`--font-public-display`（Songti SC 宋体衬线，章节标题）、`--font-brand-display`（Zhuohei Collage 手写，仅 Hero）、`--font-public-body`（PingFang 黑体，正文）。字阶 `--font-size-xs` 0.75rem → `--font-size-hero`。本次主要动用 `xs / xl / lg / base / sm` 五阶。
- **Colors**：`--public-text-primary / -secondary / -tertiary` 三级文本灰阶（本次层次的主要载体）、`--public-accent-primary` #324daf、`--public-status-open / -paused / -neutral`、`--image-placeholder` #f1f3f6。
- **Spacing**：`--space-1` 0.25rem → `--space-11` 12rem。本次章节块边距用 `--space-9`（6rem）。
- **Layout 令牌**：`--public-content-wide` 90rem、`--public-page-padding`（移动 1rem / 平板 1.5rem / 桌面 clamp(2rem,4vw,4.5rem)）、`--radius-image` 12px、`--public-header-height` 4.5rem。
- **媒体高度令牌**：`--home-scene-media-height`，当前移动 `clamp(19rem, 52svh, 35rem)` / 桌面 `min(68svh, 40rem)` → **本次改为桌面 `min(56svh, 36rem)`**。
- **Motion**：`--motion-duration-content` 420ms / `--motion-duration-media` 720ms / `--motion-ease-standard`；`useMotionEntrance` composable 负责入场，已处理 `prefers-reduced-motion`。
- **共享媒体过渡**：`home-commission-media`、`home-adoption-media` 两个 `view-transition-name`，本次保留不动。

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `HomeSceneIntro.vue` | **New** | 三幕共用的文字块：eyebrow / 中文标题 / hairline / 状态槽 / 导语 / meta 槽 / 行动插槽。替代当前 `.home-scene-heading` + 各幕自维护的右栏。这是本次唯一新增组件，因为三幕的文字层次结构完全一致，各自复制一遍必然漂移。 |
| `.home-scene-heading`（CSS 类） | **Remove** | `public-base.css:279-298`。职责被 `HomeSceneIntro` 接收。 |
| `FeaturedWorks.vue` | Modify | 标题并入文字块；双竖图从 `22.5rem` 上限改为跟随栏宽；移除 `.featured-works__content` 独立右栏。 |
| `HomeBusinessEntries.vue` | Modify | 同上；`min-height: 100svh` 与 `align-content: center` 移除，改内容自然高 + `--space-9` 块边距。 |
| `HomeCurrentAdoptions.vue` | Modify | 同上；**名称·物种与领养状态合并到同一行**；**移除价格显示**（`--home-adoption-poster__price` 及 `formatCnyMinorUnits` 引用）。 |
| `HomeBusinessStatus.vue` | Reuse as-is | 圆点 + label + tone small。放入 `HomeSceneIntro` 的状态槽，位置在中文标题之下、导语之上。 |
| `PublicAction.vue` | Reuse as-is | primary / secondary / text 三变体齐全，本次不改。 |
| `ResponsivePicture.vue` | Reuse as-is | 图片渲染不变。 |
| `WorkIdentityLabel.vue` | Reuse as-is | 名称·物种，进入领养幕的合并行。 |
| `SiteHomeCopyCard.vue`（admin） | **New** | `/admin/site/content` 新增"首页章节文案"卡片，三个导语共用一个 `home` section 版本与一次保存。沿用 `useSiteContentSectionCard` composable，不新建状态模式。 |

## Copy（新文案草案）

三幕导语为**新增可配置字段**，以下为写入迁移的默认值。遵循 `COPY.md` §1 写作原则：短句陈述实际业务，不用无法验证的模板词。

### 第二幕 代表作品 `home_featured_lead`

```text
这里挑了几件我们自己也很喜欢的作品。如果你想看更多的小狗毛，请访问作品展示。
```

### 第三幕 自设委托 `home_commission_lead`

```text
欢迎带着你的设定图来估价，请看看对应的流程。我们会负责把你的想法变成现实。
```

### 第四幕 设定领养 `home_adoption_lead`

```text
设定领养包含了我们已经部分完成的作品，你也许可以在这里找到自己想成为的角色。
```

**首页不放防御性表述**（2026-08-23 用户确认）：「不代表已经接单」「不是最终报价」这类边界属于委托页、申请页即时告知与服务条款，首页只负责引导。因此本次不设静态"细则"层，`HomeSceneIntro` 无 `note` prop。

**领养文案的业务约束**：首页只展示排序后的第一项开放领养，但 `/adoptions` 可能同时有其它开放项（SPEC OQ-002 + 领养排序契约）。文案不得写"一次只开放一位"，必须指向领养页还有其它选择。

**English eyebrow 保持现状不变**：`SELECTED WORKS` / `CUSTOM COMMISSION` / `CURRENT ADOPTION`。
**中文章节标题保持现状不变**：`代表作品` / `自设委托` / `设定领养` —— 这三个词是业务语义（与导航、`/works`、`/adoptions` 对应），写死，不开放配置。

## Key Interactions

- **进入视口**：`useMotionEntrance` 现有行为保留 —— 图片 720ms 淡入微缩放，文字块 420ms + 90ms 延迟上移淡入。文字块内部不做逐行 stagger（三幕各一次就是三次，累积成噪音）。
- **图片 hover**（`hover: hover and pointer: fine`）：`scale(1.025)` 微旋，保留现状。
- **代表作品双图**：每张图各自链接到 `/works/{slug}?view=home-featured`；右栏唯一"浏览作品展示"按钮进 `/works`。保持 SPEC 5.3 契约。
- **自设委托主图**：只做展示与共享媒体连续性，**不作为整图链接**（SPEC 119）。导航只由"了解自设委托" + "提交委托申请"两个按钮承担。
- **设定领养**：图片与"查看当前角色"进同一作品详情，共享 `home-adoption-media` view-transition。
- **逐幕 wheel 导航**：`useHomeSectionNavigation` 保留，`min-width: 1024px` 生效。章节高度改为内容自然高后，`scroll-snap-align: start` 依然工作（snap 不要求元素满视口高），相邻幕会露出一点边缘 —— 这是可滚动的正向暗示，不是缺陷。

## Responsive Behavior

| 断点 | 布局 |
| --- | --- |
| < 768px | 单列。文字块在上、图片在下（代表作品双图并排缩为两列窄图）。图片高度 `clamp(19rem, 52svh, 35rem)` 不变。 |
| 768-1023px | 单列同上，页边距 1.5rem。**不启用 wheel 导航**（保持原生滚动）。 |
| ≥ 1024px | 双栏。文字块与图片左右对望，`align-items: center`。图片 `min(56svh, 36rem)`。左右交替：代表作品图左文右 → 自设委托文左图右 → 设定领养图左文右（SPEC 117 已锁定，保留）。 |

**行为变化（非仅尺寸）**：桌面端每幕从 `min-height: 100svh + align-content: center` 改为**内容自然高 + `padding-block: var(--space-9)`**。这是本次消除"上下空余"的唯一手段 —— 1440×900 实测：可用 828px，图 504px + 文字块 ~374px + 上下 6rem 边距 ≈ 一屏饱满，剩余留白从 216px 降到约 80px。

## Accessibility Requirements

- 章节标题并入文字块后，`<h2>` 语义与 `aria-labelledby` 指向关系必须保留 —— `HomeSceneIntro` 通过 prop 接收 `titleId`，渲染真实 `<h2 :id>`，不降级为 `<div>`。
- 三级文本灰阶均需 ≥ 4.5:1 对比度：导语用 `--public-text-secondary`（非 tertiary）承载正文，`--public-text-tertiary` 只用于 eyebrow 等辅助层。
- 导语字号提升到 `--font-size-lg`（clamp 1.25-1.5rem）后仍需在 390px 下不溢出、不出现横向滚动。
- 键盘：图片链接、两个行动按钮的 Tab 顺序遵循 DOM 顺序；桌面端图文左右交替时，**DOM 顺序保持文字块在前**，用 grid 定位调换视觉左右，避免焦点在幕间来回跳。
- `prefers-reduced-motion: reduce`：现有降级路径（入场只淡不移、hover 不缩放）继续生效。
- 领养幕名称·物种与状态合并到一行后，二者需保持各自可被读屏独立识别（不合并为单个文本节点）。

## Out of Scope

- **第一幕 Hero 完全不动** —— 图集、手写体品牌、drag/切换、`hero_tagline` 均不改。
- **不给图片加浅色底座** —— 照片继续满框。
- **不改章节标题字体** —— 宋体衬线保留，不换黑体。
- **不改左右交替节奏** —— SPEC 117 的图左/右/左保留。
- **不取消 scroll-snap 逐幕导航** —— SPEC 206 已确认行为，`useHomeSectionNavigation` 不改。
- **不开放章节标题、eyebrow、按钮文字为配置项** —— 只开放三个导语。
- **不改 `/works`、`/adoptions`、`/commission` 等内页**，不改 `ENTRY_TITLES`、`ENTRY_LABELS` 常量。
- **不改领养排序契约**、不改 Hero 图集 version/CAS、不动媒体管线与 OSS。
- **不新增业务功能**：无交易、订单、支付、公开申请查询。
- **不在本次做真机验收与生产发布** —— 最终视觉门禁仍是王旻安/景宸人工验收。

## 10. 需要签字的契约变更

以下三项**超出"纯 UI 改动"**，实施前需用户确认：

### 10.1 SPEC 5.3 条文修改（视觉契约）

| 条 | 现文 | 改为 |
| --- | --- | --- |
| 113 | Hero 后三幕复用同一**左上标题结构**与 CSS；代表作品的标题不放入右侧说明栏。 | Hero 后三幕复用同一**文字块组件**（eyebrow / 标题 / hairline / 状态 / 导语 / 行动）与 CSS；章节标题是该文字块的一部分，与图片左右对位。 |
| 115 | 代表作品不显示名称与物种；图片本身仍可进入对应详情，右侧只保留一个进入 `/works` 的"浏览作品展示"按钮。 | 保留原意，仅将"右侧"改为"文字块中"（因左右交替时代表作品的文字块在右、委托在左）。 |
| 208 | 代表作品幕从固定 Header 下方开始，左上标题、下方左侧双图与右侧说明/唯一目录按钮在同一动态视口内完成。 | 代表作品幕从固定 Header 下方开始，文字块与双竖图在同一动态视口内完成；章节高度由内容决定，不强制满视口。 |

### 10.2 数据库范围重开（已获用户口头授权，需最终确认迁移内容）

新增 migration `0048_r4_e_home_scene_copy.sql`：

```sql
ALTER TABLE site_content ADD COLUMN home_featured_lead TEXT;
ALTER TABLE site_content ADD COLUMN home_commission_lead TEXT;
ALTER TABLE site_content ADD COLUMN home_adoption_lead TEXT;
ALTER TABLE site_content ADD COLUMN home_content_version INTEGER NOT NULL DEFAULT 0;
-- 三条默认文案 UPDATE（见 §Copy）
```

约束：每列 `NULL 或 (length(trim()) BETWEEN 1 AND 120 AND NOT GLOB '*[<>]*')`，与既有列的 CHECK 写法一致。

> **技术未知项已解决**（2026-08-23 核查 `0015_t27_f1_privacy_policy.sql`）：本仓库既有先例证明 SQLite 接受 `ALTER TABLE ... ADD COLUMN ... CONSTRAINT "name" CHECK(...)` 的**内联列级 CHECK**，无需重建表。`0048` 直接沿用 `0015` 的写法：加列带内联 CHECK，再 `UPDATE ... WHERE id = 'site' AND <col> IS NULL` 灌默认值。

`home` 成为第六个 section：`SITE_CONTENT_SECTIONS`、`siteContentSectionVersionsSchema`、`SECTION_UPDATES`、`adminSiteContentDtoSchema`、新路由 `server/api/admin/v1/site/home/content/home.put.ts`（命名待定，避免与 Hero 的 `home` 路径段混淆）。

### 10.3 homeAggregate 新增读取路径

`homeAggregate()` 目前只读 `hero_tagline` 与 `business_statuses.detail` 两处文字。需新增 `homeCopy: { featuredLead, commissionLead, adoptionLead }` 到 `publicHomeAggregateDtoSchema`，由 `public-site-repository.ts` 从 `site_content` 读出。这是首页第一次消费 `site_content` 的自由文本。
