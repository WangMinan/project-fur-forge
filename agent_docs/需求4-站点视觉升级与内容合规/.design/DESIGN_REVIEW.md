# Design Review：阶段 E 动效与首页领养

> **2026-08-23 覆盖审查补充**：当前 `GATE-V00` 只完成 B + M3 Art Direction 选择，不代签全站美术优化。13 个公开路由文件（含 3 个重定向）与全局错误入口已归并为 11 个独立视觉状态；统一作品/领养详情、Commission 内页、Service / Privacy / Licenses、404 / 500、目录/表单/媒体失败状态已分别补入 `V06-F1`、`V07-F1`、`V07-F2`、`V08-F1`。Footer 内容、布局、样式、响应式和交互全部冻结。完整矩阵与 33 张截图见 [`implementation/notes/2026-08-23-PUBLIC-VISUAL-COVERAGE-AUDIT.md`](../implementation/notes/2026-08-23-PUBLIC-VISUAL-COVERAGE-AUDIT.md)。

> 日期：2026-08-20
>
> Review 基线：`codex/r4-t04-t21-foundation@fb3dd44` 及同名远端分支
>
> 设计依据：`.design/README.md`、需求4 SPEC/PLAN/TASKS/STATE/REVIEW、当前首页实画面
>
> 边界：本文件记录 Review 与随后完成的文档修复，不代签阶段 E 应用实现或人工视觉验收。

## Screenshots Captured

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| `screenshots/review-home-desktop-1440.png` | 1440×900 | 首页完整滚动路径 |
| `screenshots/review-home-tablet-768.png` | 768×1024 | 首页完整滚动路径 |
| `screenshots/review-home-mobile-390.png` | 390×844 | 首页完整滚动路径 |
| `screenshots/review-adoption-viewport-desktop-1440.png` | 1440×900 | 领养幕进入视口后的可见内容 |
| `screenshots/review-adoption-viewport-tablet-768.png` | 768×1024 | 领养幕进入视口后的可见内容 |
| `screenshots/review-adoption-viewport-mobile-390.png` | 390×844 | 领养幕进入视口后的可见内容 |

## Summary

引用对话提出的阶段 E 重排总体方向成立：先做机会审计和静态四幕，再做焦点、token、场景动效和连续验收。但对话声称已推送的 `docs(r4): refine stage E motion planning` 不存在于当前本地或远端分支；现存活文档仍是重排前版本。

Review 基线还缺少两个新的可验收契约：Hero 控制器的默认静默态，以及首页单项领养在一屏内完成“标题、角色、名称/物种、状态与行动”的表达。两者都已在当前实现中产生可观察偏差，并在本轮后续文档修复中进入 design/SPEC/PLAN/TASKS/STATE/REVIEW。

## Baseline Findings（已关闭）

### 1. [已关闭] 引用对话中的阶段 E 文档变更没有落到 Review 基线

- `planning/PLAN.md` 仍把 Hero/动效/四幕称为 D、发布称为 E；`implementation/TASKS.md` 则使用 E/F。
- `implementation/TASKS.md` 仍以 T37 `Motion token` 开始，T41 才做静态四幕，没有 motion opportunity audit。
- `STATE.md` 仍把 T35/T36 写成进入 T37 前的停止点，与引用对话所述“可本地进入 T37～T47，但最终发布不能绕过 GATE-D”相反。
- 远端 `origin/codex/r4-t04-t21-foundation` 当前精确指向 `fb3dd44`，仓库所有 refs 中没有 `docs(r4): refine stage E motion planning`。

修正建议：先找回或重新形成引用对话中的 6 份文档变更，再在同一轮 Review 中统一 PLAN/TASKS/STATE 的阶段名、T37～T47 顺序和 T35/T36 的本地实施/最终发布边界。

### 2. [已关闭] Hero 控制器默认静默态没有产品契约

- `.design/README.md` 只规定“控制器是辅助层”“最后出现”“一次轻回弹”，没有规定默认显示、触发显示和再次隐藏。
- `requirements/SPEC.md` 只规定分页点/图标可以移动和控制器可低幅 overshoot。
- 需求2遗留契约仍明确要求“可见暂停按钮”，因此需求4若不显式覆盖，实施者有充分理由继续常显。
- 当前 `HomeHeroCarousel.vue` 始终渲染上一张、分页点、下一张和暂停按钮，控制器 CSS 始终 `display: flex`；1440/768/390 实画面均常驻右下角。

修正建议：需求4明确覆盖旧“常显”视觉要求，但保留可访问暂停机制。默认仅保留低权重分页/进度；方向和暂停控制在键盘焦点进入、fine pointer 靠近边缘/控制区、或触控用户显式唤起时显示。暂停后恢复入口与暂停状态持续可见；reduced-motion 关闭自动轮播时不显示无意义的暂停控制。隐藏不得移除键盘可达性或造成布局位移。

### 3. [已关闭] “单幅完整展示”没有约束为一屏完整表达

- `.design/README.md` 和 `requirements/SPEC.md` 明确单项、单图与 caption，但没有要求在 1440×900 同时看到 section title、媒体、名称/物种、状态和行动。
- 当前首页复用目录 `AdoptionCard`，媒体固定按容器全宽 16:9 展开；在 1440×900 下，领养 section 实测 949px 高，图片 737px，超过 900px 视口。
- `review-adoption-viewport-desktop-1440.png` 中，进入领养幕后只能看到标题和大图，名称与状态仍在视口下方；768×1024 和 390×844 当前可以同屏看到 caption。

修正建议：在主评审视口 1440×900 以及 1024×900、768×1024、430×932、390×844 中，领养幕从章节起点进入视口后，不需要第二次滚动即可同时理解标题、角色、名称/物种、状态和唯一行动。图片不必填满内容宽度；允许通过媒体最大高度、居中留白或桌面图文编排保持角色海报感。该约束不等于把 caption 压到角色脸上。

## Baseline Follow-ups（已关闭）

### 4. [已关闭] 输入模态与拖动门槛没有进入 Review 基线任务权威

当前文档没有分别定义 autoplay、pointer/touch、keyboard 和 drag。实施者会自然沿用同一套 680ms 切换；当前代码确实如此。应把引用对话中的规则写入 T41 或等价任务：autoplay 可使用完整媒体时序，pointer/touch 先立即反馈，keyboard 即时或极短 crossfade，drag 只有真正 1:1 跟手、可反向、可中断和速度连续时才实施。

### 5. [已关闭] 普通路由和 rejected motion candidates 仍然含糊

PLAN 仍要求“页面切换使用统一 token”，SPEC 仍给出通用页面入/离场时长，容易被理解为继续全站统一位移。应明确普通公开路由默认即时或短 opacity，View Transitions 只增强三条已确认对象路径；同时把统一 section 上浮、全面 tilt、所有 CTA 回弹、Footer 入场、键盘长动画和持续循环列为 rejected candidates。

### 6. [已关闭] 通用 `HomeMotionReveal` 的退役没有被写成明确任务结果

当前首页三个 Hero 后区块仍统一包在 `HomeMotionReveal` 中。自动化全页截图在未按真实滚动触发时会出现大段空白；按顺序滚动后内容才出现。引用对话已把“所有章节统一上浮淡入”列为拒绝项，但现存 TASKS 没有要求删除或替换该通用行为。应在静态四幕任务中要求内容默认可见，再由各幕按独立语义渐进增强。

## 修复前 Reader Test

空上下文读者只看当前 6 份活文档后得到：

- Hero 控件默认显隐：含糊；
- 领养 1440×900 一屏表达：含糊；
- 阶段 E 起点：明确是 T37 motion token，不是机会审计；
- T35/T36：按当前 STATE 明确阻塞进入 T37；
- 四类输入时序：含糊；
- 全站路由位移：含糊。

这说明缺口会直接影响下一位实现者，不只是措辞偏好。

## Resolution

本轮已完成 Review 建议的 6 份活文档修复：

- 控制器默认静默、显式唤起、暂停后恢复入口和键盘可达性进入 design/SPEC/TASKS/GATE-E；
- 领养一屏信息闭环进入 design/SPEC/PLAN/TASKS/STATE/GATE-E；
- PLAN/TASKS/STATE 统一 A～F 与 T37～T47 新顺序；
- T35/T36 改为不阻塞本地阶段 E、继续阻塞最终 Review/镜像/发布；
- 输入模态、普通路由范围、reduced 反馈和 rejected candidates 跨文档统一；
- 修复后空上下文 Reader Test 已通过；其发现的 300ms page token 冲突已删除，普通路由短 opacity 统一使用 `state: 180ms`；
- T37～T47 仍全部未完成，没有将文档修复代签为应用实现。

## Document Scope

已修改：

- `.design/README.md`：控件静默态、领养一屏构图、输入模态、rejected list；
- `requirements/SPEC.md`：将两项新诉求提升为可验收产品契约，收缩普通路由转场范围；
- `planning/PLAN.md`：同步阶段 E 新顺序和停止点边界；
- `implementation/TASKS.md`：重排 T37～T47，并把 Hero 静默态与领养一屏写入 T42/T45/T47；
- `STATE.md`：记录新确认和真实下一步；
- `review/REVIEW.md`：登记本轮 findings、浏览器证据和未代签边界。

本轮没有修改 COPY、models 或 DATA-MIGRATION；这两个新诉求不改变访客成文、DTO、数据库或迁移契约。

## What Works Well

- 单项 available 的服务端投影已经成立，没有回退为双项或多卡。
- 移动与平板领养幕当前已能在一屏内看到标题、图片和 caption，可作为桌面压缩后的参考。
- Hero 横竖素材、10 秒轮播、暂停、页面隐藏暂停与 reduced-motion 基线仍然清楚。
- 首页真实图片的主角感成立；需要收敛的是控制器权重和 Hero 之后各幕的编辑式构图，而不是推翻摄影优先方向。

## V06-F1 · Unified Work / Adoption Detail Scene Review

日期：2026-08-23
评审方向：Photography-led Editorial / Media-led Archive Scene。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/review-work-detail-mobile-375.png` | 375px Mobile | 统一详情的移动信息与媒体顺序 |
| `.design/screenshots/review-work-detail-tablet-768.png` | 768px Tablet | 中间断点的身份和媒体节奏 |
| `.design/screenshots/review-work-detail-desktop-1280.png` | 1280px Desktop | 媒体主列、缩略图与右侧身份列 |

### Summary

详情页已经从普通大图页面收口为清楚的 Archive Scene：桌面摄影先行、身份信息安静承接，移动端改为先确认角色再浏览媒体。混合横竖图使用稳定舞台后切换不再重排，且没有引入灯箱或第二套领养模板。

### Must Fix

无。

### Should Fix

无。缩略图与全站控制器的最终几何统一留给 V10，不在本任务重复处理。

### Could Improve

- V09 可在不改变舞台几何的前提下复核交叉淡化与整站 Media Settle 的节奏。
- V11 可在真实手机补看超长身份和横竖切换的滚动位置。

### What Works Well

- `contain` 保留横图与竖图的完整性，媒体仍是桌面第一视觉中心。
- 单图不显示无作用的缩略图，多图缩略图具备 44px 以上目标与明确选中状态。
- 作品/领养来源、301、404、无图库和无 JavaScript 状态均沿用现有单一业务路径。

## V07 · About / Contact Editorial Information Page Review

日期：2026-08-23
评审方向：Quiet Editorial Information Page。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/review-about-mobile-375.png` | 375px Mobile | 单列信息层级、双列 QR 与行动换行 |
| `.design/screenshots/review-about-tablet-768.png` | 768px Tablet | 工作室双列与联系信息带 |
| `.design/screenshots/review-about-desktop-1280.png` | 1280px Desktop | 宽版开场、编辑式两列与安静收尾 |

### Summary

About 已从窄列 CMS 文本页变成安静的编辑式信息页：桌面通过宽版开场、工作室双列、联系/防诈骗信息带形成明确节奏，移动端保持自然单列。QR 从大卡片收为 152px 固定轨道，375/390/430 都能并排两个渠道，且一项渠道不会被拉宽。

### Must Fix

无。

### Should Fix

无。Header、行动与图标的最终全站几何统一留给 V10。

### Could Improve

- V11 在真实手机复核二维码实扫、长号码和中文系统字体差异。
- 若后台只保留一个渠道，当前固定 152px 左对齐是预期，不扩成大卡。

### What Works Well

- 工作室、制作范围、联系、防诈骗的层级清楚，但没有引入卡片墙、背景大字或装饰动画。
- 站内申请保持唯一主行动，邮件打开和复制按辅助层级排列，键盘焦点与 44px 目标完整。
- `/contact` 继续复用 `/about#contact`，目标在粘性 Header 下方可见，没有第二套模板。

## V07-F1 · Commission Service Page Review

日期：2026-08-23
评审方向：Media-led Service Narrative。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/review-commission-mobile-375.png` | 375px Mobile | 竖版 Hero、单列服务信息与双列 QR |
| `.design/screenshots/review-commission-tablet-768.png` | 768px Tablet | 竖版媒体与完整服务叙事 |
| `.design/screenshots/review-commission-desktop-1280.png` | 1280px Desktop | 横版 Hero 与 40/60 服务信息列 |

### Summary

委托页已经从摄影开场加窄文字带收口为独立服务叙事：横/竖 Hero 保持摄影第一焦点，营业状态融入媒体，制作范围与估价联系形成明确的事实/说明层级。联系渠道、条款入口与主行动均保持可发现，但不与主视觉竞争。

### Must Fix

无。

### Should Fix

无。Header、行动与图标的最终全站几何统一留给 V10。

### Could Improve

- V11 在真实手机复核二维码实扫、软键盘返回后的滚动位置与系统字体差异。
- V09 可复核首页到委托页的共享媒体节奏，但不得改变当前布局终态。

### What Works Well

- 横向状态 scrim 在亮色竖图和复杂横图上均保持清晰，同时没有形成圆角悬浮卡片。
- 390/430/768/1024/1440 均无水平溢出，横竖媒体选择与 focal 保持现有业务路径。
- 站内申请是唯一主行动，邮件、复制、条款与完整联系说明按任务优先级递减。

## V07-F2 · Legal / Privacy / Licenses Reading System Review

日期：2026-08-23
评审方向：Quiet Editorial Reading System。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/review-service-mobile-375.png` | 375px Mobile | 服务条款目录与编号章节 |
| `.design/screenshots/review-service-tablet-768.png` | 768px Tablet | 中间断点的长文节奏 |
| `.design/screenshots/review-service-desktop-1280.png` | 1280px Desktop | Sticky 目录与固定阅读列 |
| `.design/screenshots/review-privacy-mobile-375.png` | 375px Mobile | 隐私政策目录与长段落 |
| `.design/screenshots/review-privacy-tablet-768.png` | 768px Tablet | 隐私章节节奏 |
| `.design/screenshots/review-privacy-desktop-1280.png` | 1280px Desktop | 隐私双列阅读系统 |
| `.design/screenshots/review-licenses-mobile-375.png` | 375px Mobile | 许可证单列信息 |
| `.design/screenshots/review-licenses-tablet-768.png` | 768px Tablet | 许可证宽单列扫描 |
| `.design/screenshots/review-licenses-desktop-1280.png` | 1280px Desktop | 许可证三列信息与下载入口 |

### Summary

服务条款与隐私政策已经从连续普通段落变成可扫描、可链接的长文系统：目录、编号、标题、规则线和固定行长建立清楚阅读节奏。许可证移动端不再因长授权名称形成窄竖正文，原生展开与下载入口保留平台行为并融入相同结构线语言。

### Must Fix

无。

### Should Fix

无。全站 Header、controls 与 focus 几何的最后统一留给 V10。

### Could Improve

- V11 在真实手机复核系统字体下的目录密度与 GPL 内部惯性滚动。
- 未来只有在后台明确引入非编号文档格式时，才评估更广泛的内容结构；当前不需要 Markdown。

### What Works Well

- 目录完全由现有纯文本标题派生，没有复制或写死法律文字。
- 390/430/768/1024/1440 与 GPL 展开状态均无水平溢出，章节 hash 让开固定 Header。
- 许可证移动/平板以单列换取可读性，桌面三列仍保持名称、用途和许可证的快速对照。

## V08-F3 · Direction Reset Bug Acceptance Review

日期：2026-08-24
评审范围：品牌标题刷新稳定性、Hero 媒体填充、4s 自动轮播；不评审或提前实现 V09 视觉重构。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V08-F3/after/review-home-desktop-1280.png` | 1280×800 Desktop | 首页全页与横版 Hero |
| `implementation/evidence/V08-F3/after/review-home-tablet-768.png` | 768×1024 Tablet | 首页全页响应式重排 |
| `implementation/evidence/V08-F3/after/review-home-mobile-375.png` | 375×812 Mobile | 首页竖版 Hero 与完整四幕 |
| `implementation/evidence/V08-F3/after/review-commission-desktop-1280.png` | 1280×800 Desktop | 委托横版 Hero 与完整内容 |
| `implementation/evidence/V08-F3/after/review-commission-tablet-768.png` | 768×1024 Tablet | 委托竖版媒体和单列内容 |
| `implementation/evidence/V08-F3/after/review-commission-mobile-375.png` | 375×812 Mobile | 委托移动端与双列二维码 |

### Summary

三项 bug 范围内未发现阻断项。品牌标题使用已预载的最终字体完成一次性 clip/位移入场，结束后稳定在冻结终态；首页与委托的横竖 Hero 均不再出现衍生图内部补边，且全页截图无水平溢出；轮播在暂停、恢复和 reduced-motion 分支下保持原有能力。

### Must Fix

无。

### Should Fix

无。本轮不把已登记的 V09～V12 scene redesign 提前混入 bug 修复。

### What Works Well

- 像素审计能区分“DOM 已填满”和“图片内部仍有纯色补边”，避免再次误判。
- 1280/768/375 全页截图中的媒体均已实际解码，移动端使用竖图而非缩小横图。
- 标题入场与 4s 暂停/恢复均有独立录屏；标题验收同时检查关键字体已加载和动画终态稳定，自动化证据不代签 `GATE-V08-R`。

## V09 · Featured / Hero Responsive Wayfinding Review

日期：2026-08-24
评审方向：Editorial / Swiss-informed Type × Media；只复核 V09 响应式收口，不进入 V10。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/v09-responsive-fix/after/featured-desktop-short-1440x768.png` | 1440×768 Desktop | 宽屏短视口完整 Featured 与 destination rail |
| `.design/screenshots/v09-responsive-fix/after/featured-desktop-1440x900.png` | 1440×900 Desktop | 标准 Desktop Type × Media 构图 |
| `.design/screenshots/v09-responsive-fix/after/featured-tablet-768x1024.png` | 768×1024 Tablet | Tablet 场景高度与双项控制 |
| `.design/screenshots/v09-responsive-fix/after/featured-mobile-375x812.png` | 375×812 Mobile | 最小参考视口完整 Featured scene |
| `.design/screenshots/v09-responsive-fix/after/featured-mobile-390x844.png` | 390×844 Mobile | 标准 Mobile 首项与下一幕起点 |
| `.design/screenshots/v09-responsive-fix/after/featured-mobile-430x932.png` | 430×932 Mobile | 宽 Mobile 首项与下一幕起点 |
| `.design/screenshots/v09-responsive-fix/after/hero-mobile-390x844.png` | 390×844 Mobile | Hero `NEXT ─ SELECTED WORKS` 完整可见 |

### Summary

原实现的语义内容完整，但固定 `39rem` Desktop 舞台会在宽屏短视口把 Featured destination rail 推到屏外；Mobile 的完整 Featured scene 高于参考视口，同时 Hero CSS 直接隐藏了 `NEXT`。修正后六个参考视口均在当前屏内显示完整 Featured 与 destination rail，Hero Mobile 恢复完整 wayfinding；没有删除内容或引入 V13 Motion。

### Must Fix

无。截图与几何审计中的 Featured section、wayfinding、Hero continuation 均位于视口内，无水平溢出。

### Should Fix

无。用户指出的 CTA / switch 拥挤已通过 Desktop 36px 与 Mobile 16px 的明确间隔收口；44px 命中区不变。

### Could Improve

- V13 只在静态构图 Gate 通过后加入切换 Motion，不得以动画重新挤占当前高度预算。
- V14 可继续统一 Hero/Featured controls 的 hover/focus geometry，但不得缩小 Mobile 命中区。

### What Works Well

- Desktop 通过视口高度约束摄影而不是隐藏 destination rail，`1440×768` 仍保留 Type × Media 的尺度关系。
- Mobile 缩小的是装饰性背景字和摄影，不删除标题、说明、CTA、双项选择或章节去向。
- `01 / 02` 与 `02 / 02` 两个真实状态均有截图，较长的第二项标题仍在当前 scene 内完成阅读。

## V10 · Commission Service Scenes Static Review

日期：2026-08-24
评审方向：Editorial / Swiss-informed Media-led Service Scenes；只评审 V10 静态构图，不进入 V11、V13 Motion 或 V14 UI polish。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V10/after/home-commission-1440x900.png` | 1440×900 Desktop | Homepage Service Docket、媒体下缘信息栏与 Adoption wayfinding |
| `implementation/evidence/V10/after/home-commission-390x844.png` | 390×844 Mobile | 完整标题、背景字、摄影、服务信息、双行动与 destination rail |
| `implementation/evidence/V10/after/home-commission-430x932.png` | 430×932 Mobile | 宽 Mobile 完整 Service Docket 与下一幕起点 |
| `.design/screenshots/v10/after/review-home-commission-2048x1080.png` | 2048×1080 Wide Desktop | 超宽/短高媒体与信息栏硬间距回归 |
| `implementation/evidence/V10/after/commission-1440x900.png` | 1440×900 Desktop | `/commission` 横版 Hero、三段 Service Ledger 与双列详情 |
| `implementation/evidence/V10/after/commission-390x844.png` | 390×844 Mobile | 竖版 Hero、单列台账、估价联系与双二维码 |
| `implementation/evidence/V10/after/commission-430x932.png` | 430×932 Mobile | 宽 Mobile 独立内页构图 |
| `.design/screenshots/v10/after/review-commission-768x1024.png` | 768×1024 Tablet | Tablet 横竖媒体与内容重排 |

### Summary

Homepage Commission 保留大横图与 editorial wayfinding，但已去掉右下完整白色 UI Card。中文标题恢复为与 Featured 相同的 scene title 尺度；背景 Typography 建立空间场，摄影承担第一媒体焦点，状态、流程和 CTA 沿媒体下缘形成三段 Service Docket。摄影和信息栏现在使用独立网格行：Mobile 最小间距为 12px，Desktop 自动审计下不低于 16px，2048×1080 超宽场景不再出现图片或顶线侵入信息区。

`/commission` 没有复制 Homepage Docket，而是采用 Photographic Service Ledger：宽屏横版摄影、移动竖版摄影之后，身份、营业状态、说明和行动横向/纵向重组；制作范围与估价联系继续使用同一编辑网格，但保持独立长页阅读节奏。已有申请、QQ/Email、QR、服务条款与共享媒体切换均保留。

### Must Fix

无。正式与 Review 视口均为 200，图片完成解码，无水平溢出；媒体/信息不相交，摄影统一为 12px 圆角，内页横竖媒体选择和二维码可读性通过。

### Should Fix

无。用户指出的超宽信息栏重叠和标题尺度不一致已分别通过硬网格间距与共享 scene title 尺度修正。

### Could Improve

- CTA 颜色和全站 controls 几何按用户指示留给 V14；V10 不提前改变 UI token。
- 真实 Edge 与手机上的最终观感仍由凌巽在 V10 Handoff 后人工验收；自动证据不代签。
- V13 只有在整个 Static Gate 通过后才可为现有共享媒体切换与 Scene 连续性增加 Motion，不得反向改变本轮静态终态。

### What Works Well

- Homepage 和内页共享摄影圆角、等宽 metadata、细线与 wayfinding，但媒体尺度和信息组织明显不同，没有退回统一模板。
- 390×844 的 Homepage Commission 能在当前屏内看到标题、摄影、完整服务信息、两个行动和下一幕去向；430px 自然露出 Adoption 开头。
- 2048×1080、1280×800、768×1024、375×812 与正式三视口均通过 media/body gap、scene fit、wayfinding、decode、overflow 和静态动画审计。
- `home-commission-media` 的既有平滑共享切换被原样保留；V10 没有把它误记为新业务或新 Motion 功能。
