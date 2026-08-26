# Shared Visual Language Contract

> Task: V09 baseline, extended through V16 consistency review
> Baseline: Editorial / Swiss-informed Type × Media
> Scope: public-site composition, runtime motion semantics, controls and state consistency. V09～V12 historical implementation notes remain below; V13+ active runtime rules supersede their earlier hard-cut/shared-media wording.

## 1. Core Principle

Photography is the first visual anchor. Typography defines the field around it; rules, folios and destination labels explain where the visitor is and where the next scene begins. Shared grammar must make scenes feel related without turning them into one repeated layout.

Every scene must pass a static test: with non-essential animation disabled, its hierarchy, reading order and identity remain complete at Desktop and Mobile.

## 2. Editorial Scene Wayfinding Grammar

Each major public scene chooses the smallest meaningful subset of this grammar:

| Element | Contract | Featured implementation |
| --- | --- | --- |
| Scene label | Small uppercase English metadata; names the current scene, never decorative filler. | `SELECTED WORKS` |
| Destination cue | User-facing direction and destination are written in concise Chinese; the cue must name a real destination. | `下一幕 / 自设委托` |
| Long rule | Connects label and destination and establishes the scene boundary. | Bottom wayfinding rail |
| Folio/count | Two-digit current/total only when more than one real item exists; never leave an isolated `01` or invent missing entries. | `01 / 02` → `02 / 02`; hidden for one item |
| Media-edge alignment | At least one primary text or rule edge aligns deliberately with a media edge or grid line. | Featured heading, image and content use the same 12-column field. |
| Section boundary cue | The final rail closes one scene and announces the next; it is not a decorative divider. | `下一幕 / 代表作品` → `下一幕 / 自设委托` → `下一幕 / 设定领养` |
| English metadata | Uppercase, concise and subordinate to Chinese content. | `FEATURED PORTRAIT / 01` only in the real two-item state; otherwise `FEATURED PORTRAIT` |

The public wayfinding sequence is Chinese so visitors can understand the next action without reading English metadata: `下一幕 / 代表作品` → `下一幕 / 自设委托` → `下一幕 / 设定领养`. The Commission page continues with `继续查看 / 制作范围与估价 ↓` and closes with `开始申请 / 填写委托表单 →`. Small uppercase English remains valid for scene labels and indexing metadata, but no longer carries a required navigation instruction. Later scenes must use semantic Chinese variants, not repeat the same words or layout mechanically.

## 3. Type × Media Rules

- Primary photography is larger and higher contrast than supporting copy.
- Primary content photography uses the shared `--radius-image` radius. New photographic scenes must reuse this token so image treatment remains consistent across Featured, Service and later public scenes.
- Background type must either clearly overlap the foreground media or clearly clear it. Near misses are not allowed.
- Background type and folios stay behind content and never carry required information.
- Chinese display type carries the identity/title; English metadata orients and indexes it.
- Text groups may use controlled offsets, but reading order and keyboard order stay linear.
- Scene headings use the left scene label/title only; redundant right-side register slogans are omitted. Their heading rule is capped at `32rem` instead of spanning the entire scene, while Mobile uses the available width.
- Do not turn editorial scenes into rounded cards or floating section containers. The shared image radius applies only to photographic media; gradients, shadows and decorative blobs remain excluded.

## 4. Scene Identity

Shared across scenes:

- monochrome editorial ink and existing public tokens;
- thin structural rules;
- concise uppercase English metadata;
- directional destination cues;
- photography-led composition;
- zero letter spacing and restrained control geometry.

Unique per scene:

- media scale and crop/contain policy;
- typographic scale and overlap;
- content grouping and negative space;
- wayfinding placement and destination;
- page-specific actions and facts.

This contract prohibits a universal `eyebrow + Chinese title + left image + right copy` template.

## 5. Responsive Contract

- Desktop uses a 12-column field and explicit asymmetric balance.
- Mobile is independently composed: background type clearly ends before the media, media remains the first photographic anchor, and the switch control sits directly below it before the content group. It must not inherit Desktop overlap by compression.
- At the reference scene entry, standard Featured content and its destination rail should fit within the current viewport at `375 × 812`, `390 × 844`, `430 × 932`, `768 × 1024`, `1440 × 768` and `1440 × 900`. Reduce decorative scale before hiding semantic wayfinding or collapsing control/content spacing.
- Text never scales continuously with viewport width; discrete breakpoint sizes are used.
- Primary touch targets remain at least 44px. Required information never depends on hover.

## 6. V09 Featured Classification

- Component: `FeaturedWorks.vue`.
- Responsibility: render one complete Featured Type × Media static scene from the existing public featured-work DTO.
- Props: existing `available` and `works`; no new data contract.
- State: one local active index. When the existing DTO contains two eligible works, manual previous/next uses an immediate hard cut and the truthful `01 / 02` → `02 / 02` count. With one work, both controls and all numeric folios are absent.
- Navigation: the main photo opens the active featured work detail; the CTA opens `/works`; manual previous/next is visible and keyboard/touch operable only when a second real item exists.
- Deferred to V13: Featured autoplay, transition choreography, directional motion, reverse, interrupt and media settle. The V09 manual hard cut is a static-state selector, not Motion choreography.
- Deferred to V14: final carousel-control geometry and interaction states.

## 7. V10 Commission Service Classifications

### Homepage Commission · Service Docket

- Component: `HomeBusinessEntries.vue`.
- It answers Featured's `下一幕 / 自设委托` cue and closes with `下一幕 / 设定领养`.
- The standard Homepage scene title scale remains shared with Featured; service identity is established by the large media field, background Typography and the service register rather than by inflating the Chinese title.
- Desktop uses a horizontal photograph followed by an edge-aligned three-part information ledger: status/metadata, process copy and actions. These occupy a separate grid row with a hard gap from the media; no complete white UI card overlays the photograph.
- Mobile independently composes title, background type, rounded photograph, service information, actions and destination rail within the reference viewport.

### `/commission` · Photographic Service Ledger

- Components: `CommissionLead.vue` plus the `/commission` composition surface.
- It uses a wide landscape photograph on Desktop and the existing portrait placement on portrait Mobile, followed by a three-part identity/status/action ledger.
- The content page then separates `SERVICE RANGE / 01` and `ESTIMATE & CONTACT / 02` into an editorial service record. This is intentionally different from the Homepage Docket and must not inherit its compact one-scene geometry.
- Existing business status, application, QQ/Email, QR, terms, focal and media fallback remain authoritative. The historical `home-commission-media` shared transition was later removed; the active V13+ runtime uses only short page opacity entry.
- The first viewport closes with `继续查看 / 制作范围与估价 ↓`; the page-level application rail uses `开始申请 / 填写委托表单 →`. Both are real links and keep the long-rule grammar.

### Deferred UI decisions

- CTA colors and final control geometry remain V14 UI/Controls work. V10 only establishes static composition, scene identity and readable action hierarchy.
- V10 adds no autoplay, arrival choreography or directional transition work; those remain subject to the later static Gate and V13.

## 8. V11 Adoption Classifications

### Homepage Adoption · Dynamic Character Display

- Component: `HomeCurrentAdoptions.vue`.
- The existing adoption comparator remains authoritative. The repository projects at most the newest three `available` roles; one or two real roles remain one or two, `adopted` roles are excluded, and no manual Homepage-featured field is introduced.
- The scene shows one active Character Display plus a truthful role index. Multiple roles provide the lower character selector, circular swipe/keyboard switching and a truthful folio. V13 supersedes the historical hard-cut state with 4s autoplay and layered directional switching; T47 then supersedes its dedicated previous/next/pagination-line/pause controller after explicit user review. A single role has neither a fake switcher nor an isolated numeric folio.
- The main setting image and primary action both open the active adoption detail. The destination updates with the selected role and remains keyboard/touch operable.
- Long character names use a lower display-size tier instead of truncation. Index count, status, price and business status remain subordinate to the role name and contain media.
- `ADOPTIONS / ADOPTION` is the only retained English business label. Search, status, actions and required navigation use direct Chinese; `ARCHIVE` remains an internal composition classification rather than public copy.

### `/adoptions` · Two-column Adoption Directory

- `AdoptionCard.vue` is an editorial directory entry, not a one-card-per-screen hero or a boxed product card. The page uses a two-column comparison field on Desktop and one column on Mobile; inside each entry, Desktop places media left and the identity panel right, while Mobile stacks them.
- Desktop exposes two complete role summaries in the same 1440×900 opening viewport; Mobile completes one entry and reveals the next boundary. The public projection prefers the already-managed complete design sheet and falls back to the adoption cover only when no sheet exists.
- Each entry is a Character Record rather than an image with a caption: a complete `contain` media canvas remains the first anchor, and a separate information panel carries the horizontal Chinese role name and one detail action without covering the art. Media retains `--radius-image`, no hover scale and no container shadow.
- The information panel shows species, price and availability as three real values without the redundant labels “物种 / 领养价格 / 当前状态”. The values use a small `·` marker and vertical whitespace rather than mini rules, making future three-character species and five-digit prices safe. A large rounded-sans folio is derived from the public list position, sits behind the panel at bottom-right, remains recognisable and is lightly clipped by the record edge; UUID and Featured `sortOrder` are never exposed or repurposed. The whole entry remains a focusable detail link. Rows are separated by spacing and canvas contrast, not horizontal card dividers.
- The directory header pairs the enlarged `ADOPTIONS / 设定领养` identity with a large, rotated, low-opacity studio mark entering from the upper-right edge; the mark balances negative space and carries no content. The repository still calculates `availableCount`, but the page no longer displays a count or business-status prompt. Search and the primary contact action form one borderless, right-aligned operation group on Desktop; the search-result summary only appears after an active search and disappears again when cleared.
- Search, pagination, status-first ordering, price, detail routes and focus semantics remain unchanged.
- `联系我们申请领养` is the directory's primary conversion action and uses the shared primary-action treatment; search submit remains an operational control, not the business destination.

### Adoption Detail Variant

- The unified `/works/[slug]` base remains shared for future V12-A. V11 only adds the adoption-specific label, identity ledger, direct `联系咨询领养` action and return to all adoption roles.
- The detail does not infer status or price absent from its DTO. V11 changes only which existing public media record is preferred by the list projection; it introduces no endpoint, schema, database, migration or media-topology change.
- V11 was static at delivery; V13 now supplies the active adoption autoplay and transition choreography contract.

## 9. V12-D Document Reading System

- `/service`, `/privacy` and `/licenses` share a document-specific page intro, factual metadata, numbered chapter navigation, a restrained reading width and a clear return-to-top action. This is a long-form reading grammar, not a card system.
- Desktop uses a narrow sticky chapter index beside a maximum 46rem reading column. Mobile returns to normal document flow; navigation targets remain at least 44px and may use two columns when labels fit without truncation.
- Rules separate chapters and code/license blocks without shadows, floating containers or decorative motion. Native `details` is retained for long license text so keyboard and no-JavaScript behavior remain reliable.

## 10. V12-E Error / Empty / Media Failure States

- 404、500、普通 empty 与搜索 no result 复用 `PublicEmptyState` 的单一状态面：上下规则线、清楚的标题/原因/恢复行动，以及低对比度工作室 Logo。它是页面中的状态记录，不是浮动 Card。
- 状态 Logo 复用 `/brand/logo-mark.png`，使用灰度、约 5% 不透明度和轻微旋转；必须绝对定位、裁切在状态面内、`aria-hidden`，不得改变内容尺寸或遮挡恢复行动。
- 404/500 保留真实状态码并显示 brand-only Header。500 只使用安全通用说明，不投影 `statusMessage`、邮箱、内部路径、私有媒体信息或异常详情。
- `ResponsivePicture` 仍是图片失败的唯一入口。失败时保留当前横/竖比例，在原媒体面内显示同款淡色 Logo 与回落文字；无 JavaScript 时继续输出原始 `<picture>`，不伪造图片、不自动重试、不新增占位资源。
- V12-E-F1 已统一跨站字体角色；Legal text、license data、redirects 与 Footer 仍是内容契约，不因字体治理改变。

## 11. V12-E-F1 Typography Governance

- `Display`：中文页面/章节/角色标题使用宋体系统栈；Windows/Edge 实测命中 STSong。装饰性无衬线背景字使用 `Display Sans`，领养 folio 使用系统 rounded 栈。
- `Body`：连续正文使用无衬线中文系统栈；Windows/Edge 实测命中 Microsoft YaHei。
- `Metadata`：编号、状态、eyebrow、wayfinding 使用同一无衬线栈、tabular numerals 和零字距，不再把普通元数据伪装成 code。
- `UI`：按钮、输入、导航、折叠控件使用无衬线 UI 栈；保持继承式表单字体和既有 44px 目标。
- `Legal`：法务正文使用 Body 同源的无衬线阅读栈和独立行高；`Code` 只用于许可证表达、回执编号和机器文本，Windows/Edge 实测命中 Consolas。
- Hero 的 `有点小狗工作室` 继续使用现有 ZhuoHeiPinTieTi 品牌字体、关键子集 preload、冻结终态与首次入场；Footer 完全冻结。
- Noto Serif SC 继续只用于委托制作单 PDF，采用 SIL OFL 1.1 并在 PDF 中按字形子集嵌入；网页不得请求或 preload 该 11.6MB 文件。
- PingFang SC、Microsoft YaHei、Songti/STSong、Arial Rounded、Consolas 只作为访问者操作系统字体引用，不作为仓库资产分发。没有跨平台一致性硬需求时，不新增 Web Font。

## 12. V12-E-F2 Desktop Acceptance Corrections

- 图片失败层必须覆盖并居中于实际媒体框；大媒体、目录卡片、详情舞台和小缩略图复用同一 `ResponsivePicture` 规则，不使用页面级偏移补丁。
- 公开领养界面只展示 `available`；`adopted` 退出首页和 `/adoptions`，但后台状态模型与 `/works` 作品归档保持不变。前台身份信息保留物种与价格，不重复展示领养状态。
- Works 与 Adoptions 继续共用 editorial pagination；箭头、中文标签、规则线和当前页下划线不改变 SSR、无 JavaScript、键盘、44px、current 或 disabled 语义。
- `/commission` 的制作范围与估价联系使用 3:7 内容权重；Desktop 以淡灰竖线、Mobile 以淡灰横线建立结构分隔，不恢复重复 kicker 或卡片容器。
- Works masthead 的工作室 Logo 与既有 Adoptions 水印属于低对比度构图平衡层，绝对定位、`aria-hidden` 且不改变页面布局。

## 13. V12-E-F3 / F4 Homepage Acceptance Corrections

- Homepage Featured 与 Commission 的同语义 primary action 统一使用共享蓝色 token；局部 scene 不再覆盖主按钮颜色。
- Featured Desktop 的名称、物种、CTA 和切换器组成单一信息组；内容先读、切换器随后，整体位于左侧中部，不再坠到场景底部。
- Desktop 主摄影向 12-column field 中部延伸并使用视口高度上限；更大的媒体与背景 `SELECTED WORKS` 建立明确 overlap，同时给底部 wayfinding 保留稳定空间。
- Featured 复用 Homepage Adoption 的 `--public-media-canvas` 作为浅灰媒体承托：外框保持场景尺度，照片通过响应式 padding 在内部缩小；画布使用共享 `12px` 图片圆角，内层照片使用 `8px` 圆角并真实裁切。该处理不把摄影改成 `contain`，也不新增颜色 token。
- Tablet/Mobile 不继承 Desktop 的视觉顺序，继续保持图片 → 切换器 → 信息；本轮截图只证明 Structural Safety，不代签 Mobile Final Art Direction。

## 14. V12-F Mobile Homepage Art Direction

- Mobile Homepage 继续使用 Hero → Featured → Commission → Adoption 的内容顺序，但每幕在 390×844 / 430×932 下独立组织媒体、信息和 controls，不复制 Desktop 12-column grid。
- Hero 品牌文字继续遵守 Brand Lock。V12-F 只调整移动端 scrim、supporting copy 与周边留白；未修改“有点小狗工作室”的内容、字体、字号、字重、行高、字距、核心位置、对齐或一次性首次入场。
- Featured 的浅灰媒体画布与 `12px / 8px` 外内圆角继续作为摄影承托；Mobile 保留显式上一项/下一项、真实双项编号、角色名、物种与 `/works` 行动，且 controls 与信息之间有明确间距。
- Commission 在 Mobile 使用满宽媒体和轻微错轴的信息组，收紧纵向节奏但不删除状态、说明、申请与详情行动。
- Adoption 在 Mobile 保留最多三个真实 `available` 角色、显式三项选择、循环上一项/下一项、当前 `01 / 03`、完整 `contain` 设定图、物种/价格与两个行动；页码与切换器合并为同一稳定控制行。
- Hero 4s autoplay、换图不重启品牌标题入场、Reduced Motion 直接终态、font flash 修复和 Desktop 冻结构图继续有效。V12-F 不新增 Motion choreography、依赖、数据字段、路由或业务投影。
- 收口时按用户直接反馈修正 `/works` 与 `/adoptions` 的 Mobile masthead 装饰冲突，并压缩 `AdoptionCard`；这属于已完成的局部回归修正，不能替代 V12-G 对其余公开页面的完整 Mobile Art Direction。

## 15. V13–V16 Active Runtime and Consistency Contract

- Hero、Featured 与 Homepage Adoption 默认 4s autoplay；Hero/Featured 具备 pause/resume，Homepage Adoption 依 T47 最终用户决定只保留下方角色选择、swipe 与键盘方向。三者均具备页面隐藏暂停、Next/Previous 方向语义、interrupt 与 Reduced Motion 可靠终态。背景 Typography、CTA、保留的 controls 和稳定媒体外框不参与无意义的大幅位移。
- Featured 只让摄影与角色名/物种承担方向切换；Homepage Adoption 使用 Media → Name → Facts → Action 的递减运动层级。Hero/Featured 轮播控制与 Homepage Adoption 下方角色选择的焦点、触控目标和语义状态统一遵守 V14 的 44px 规则。
- 正式公开路由统一使用短 opacity 入场，不启用命名 View Transition、跨页媒体 morph 或共享对象飞行。V10/V13 中相关 shared-media 文字和 Evidence 仅保留为历史实现记录。
- V11 明确 supersede T21 首页单项投影：Homepage Adoption 最多展示三项当前 `available`；`/adoptions` 只公开 `available`，`adopted` 继续保留在 `/works`。
- Footer 内容、布局、样式、响应式与交互保持冻结；Hero `有点小狗工作室` 的品牌文字身份、确认终态和一次性首次入场保持锁定。
- 公开页共享 Display/Body/Metadata/UI/Legal/Code 字体角色、摄影圆角、中文 wayfinding、错误/空态/媒体失败语言和可访问性状态；各 scene 必须保持独立 Composition，不能因为共享 token 而模板化。
