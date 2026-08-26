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

## V12-D · Legal / Privacy / Licenses Static Review

日期：2026-08-25
评审方向：Editorial Document Reading System；只评审 V12-D 长文静态结构，不进入 V12-E 或字体治理。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-D/after/service-1440x900.png` | 1440×900 Desktop | 服务条款 sticky 章节导航与长文阅读轴 |
| `implementation/evidence/V12-D/after/service-390x844.png` | 390×844 Mobile | 服务条款移动目录与单列正文 |
| `implementation/evidence/V12-D/after/service-430x932.png` | 430×932 Mobile | 宽 Mobile 长文节奏 |
| `implementation/evidence/V12-D/after/privacy-1440x900.png` | 1440×900 Desktop | 隐私政策九章结构 |
| `implementation/evidence/V12-D/after/privacy-390x844.png` | 390×844 Mobile | 隐私政策移动长页 |
| `implementation/evidence/V12-D/after/privacy-430x932.png` | 430×932 Mobile | 宽 Mobile 隐私正文 |
| `implementation/evidence/V12-D/after/licenses-1440x900.png` | 1440×900 Desktop | 许可证三章导航与资产对照 |
| `implementation/evidence/V12-D/after/licenses-390x844.png` | 390×844 Mobile | 许可证移动阅读结构 |
| `implementation/evidence/V12-D/after/licenses-430x932.png` | 430×932 Mobile | 宽 Mobile 许可证结构 |
| `implementation/evidence/V12-D/after/licenses-details-open-1440x900.png` | 1440×900 Desktop | 键盘展开 GPL 全文 |
| `implementation/evidence/V12-D/after/licenses-details-open-390x844.png` | 390×844 Mobile | Mobile 键盘展开与焦点环 |

### Summary

三页已经形成同站的长文阅读系统，同时没有变成重复卡片模板。Desktop 目录承担位置感但不抢正文；Mobile 目录回到自然流并保留 44px 目标。许可证的资产对照、原生折叠和等宽全文仍保留各自信息密度。截图未发现横向溢出、粘性层级错位、图片失败或 Footer 回归。

### Must Fix

无。

### Should Fix

无。Evidence 脚本中由自动聚焦引发的 sticky Header 全页截图伪影已通过截图前恢复页首消除，未修改页面交互。

### Could Improve

- Display、Body、Metadata、UI 与 Legal/Code 的最终字体身份和混排一致性继续由 V12-E-F1 统一，不在 V12-D 提前修改。
- 390/430 当前结果只证明结构安全；最终 Mobile 独立 Art Direction 仍归 V12-G。

### What Works Well

- document 页首只显示页名和事实，不添加无意义英文或装饰。
- 章节编号、细线、固定阅读行长和返回页首形成连续阅读节奏，长页仍可快速定位。
- 原生 `details` 保留键盘、无 JavaScript 和平台语义，未为视觉样式引入额外组件或依赖。

## V12-E · Error / Empty / Media Failure Static Review

日期：2026-08-25
评审方向：Editorial State Record；只评审 V12-E 静态状态，不进入字体治理或 Mobile Final Art Direction。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-E/after/404-1440x900.png` | 1440×900 Desktop | 404 状态、品牌栏、恢复行动与淡色 Logo |
| `implementation/evidence/V12-E/after/404-390x844.png` | 390×844 Mobile | 404 Mobile 状态面 |
| `implementation/evidence/V12-E/after/404-430x932.png` | 430×932 Mobile | 404 宽 Mobile 状态面 |
| `implementation/evidence/V12-E/after/500-1440x900.png` | 1440×900 Desktop | 500 安全通用说明与品牌归属 |
| `implementation/evidence/V12-E/after/500-390x844.png` | 390×844 Mobile | 500 Mobile 状态面 |
| `implementation/evidence/V12-E/after/500-430x932.png` | 430×932 Mobile | 500 宽 Mobile 状态面 |
| `implementation/evidence/V12-E/after/empty-1440x900.png` | 1440×900 Desktop | 越界 empty 与回到第一页 |
| `implementation/evidence/V12-E/after/empty-390x844.png` | 390×844 Mobile | 越界 empty Mobile |
| `implementation/evidence/V12-E/after/empty-430x932.png` | 430×932 Mobile | 越界 empty 宽 Mobile |
| `implementation/evidence/V12-E/after/no-result-1440x900.png` | 1440×900 Desktop | 搜索无结果与清除搜索 |
| `implementation/evidence/V12-E/after/no-result-390x844.png` | 390×844 Mobile | 搜索无结果 Mobile |
| `implementation/evidence/V12-E/after/no-result-430x932.png` | 430×932 Mobile | 搜索无结果宽 Mobile |
| `implementation/evidence/V12-E/after/media-failure-1440x900.png` | 1440×900 Desktop | 全目录图片失败与比例内 Logo |
| `implementation/evidence/V12-E/after/media-failure-390x844.png` | 390×844 Mobile | 图片失败 Mobile 双列 |
| `implementation/evidence/V12-E/after/media-failure-430x932.png` | 430×932 Mobile | 图片失败宽 Mobile 双列 |
| `implementation/evidence/V12-E/after/404-keyboard-390x844.png` | 390×844 Keyboard | 恢复行动焦点环 |

### Summary

五类状态现在共享规则线、放大标题、恢复行动和同一淡色工作室 Logo，但仍保留各自语义。404/500 具有明确品牌入口和真实状态码；目录空态继续处在原页面上下文中；媒体失败不改变横竖比例，也没有伪造图片或重试能力。

### Must Fix

无。全部状态在 1440、390、430 下无水平溢出；404/500 状态码正确，恢复行动不小于 44px，500 未显示底层错误信息。

### Should Fix

无。Logo 为低对比度装饰层且不进入读屏；标题、说明和行动在三档视口内保持清楚。

### Could Improve

- 390/430 当前截图证明结构安全；最终 Mobile 独立构图仍属于 V12-G。
- Display、Body、Metadata、UI 与 Legal/Code 的最终字体角色由 V12-E-F1 统一，本轮不提前修改。

### What Works Well

- 复用现有 Logo 和两个共享组件即可覆盖所有调用页，没有新增状态组件、依赖或页面级重复样式。
- 图片失败水印在媒体内部建立品牌归属；作品卡按底部身份渐变做视觉中心补偿，回落文字、Logo 和作品身份均保持可读。
- 键盘、无 JavaScript 与 Reduced Motion 审计通过；静态水印不产生动画或布局位移。

## V12-E-F1 · Sitewide Typography Audit & Governance Review

日期：2026-08-25
评审方向：语义字体角色、中文/英文/数字混排、授权与加载可靠性；不重排 scene，不进入 Mobile Final Art Direction。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-E-F1/after/specimen-1440x900.png` | 1440×900 Desktop | Display、Body、Metadata、UI、Legal/Code 混排样本 |
| `implementation/evidence/V12-E-F1/after/specimen-390x844.png` | 390×844 Mobile | 五类角色的移动换行与标点样本 |
| `implementation/evidence/V12-E-F1/after/home-1440x900.png` | 1440×900 Desktop | Hero 品牌锁、四幕标题、metadata 与 UI 关系 |
| `implementation/evidence/V12-E-F1/after/licenses-1440x900.png` | 1440×900 Desktop | Legal 正文、metadata 与 Code 的可见区分 |

### Summary

正式公开页和共享 UI 已从历史 `display/body/mono` 别名收口到 Display、Body、Metadata、UI、Legal、Code 语义 token；管理端外壳同步使用 display/body/metadata/ui/code 角色。普通编号、wayfinding、状态和目录 metadata 不再使用等宽字体，Code 只保留给许可证表达、回执编号和机器文本。未新增字体、依赖、页面结构或文案。

Windows/Edge 的 platform-font 实测为：Display → STSong，Body/Metadata/UI/Legal → Microsoft YaHei，Code → Consolas；Hero 品牌字继续命中 ZhuoHeiPinTieTi。用户已明确接受现有拼贴体，不以其授权复核阻塞本任务；仓库分发的其他字体 Noto Serif SC 为 OFL-1.1，且只用于 PDF。

### Must Fix

无。11 个公开状态 × 3 视口全部 200/预期 404、无横向溢出，字体状态为 loaded，最大 CLS 0.000237。

### Should Fix

无。网页只 preload 19KB 品牌关键子集，没有请求 2.8MB 品牌完整字体或 11.6MB Noto PDF 字体。

### Could Improve

- 系统字体会随 Windows/macOS/Linux 环境略有字面差异；只有客户未来要求跨平台像素一致时，才评估一个许可证清晰的最小中文 Web Font 子集。
- 390/430 证据只证明字体结构安全；最终 Mobile composition 仍属于 V12-F/V12-G，且必须先通过 `GATE-DESKTOP`。

### What Works Well

- 宋体 Display 与无衬线 Body/UI 的分工清楚，Metadata 不再呈现不必要的“代码感”。
- 中英文、数字、价格、日期、标点和五位数扩展样本在 Desktop/Mobile 都没有裁切或不可接受换行。
- Hero 品牌选择器和 Footer 样式未改变，原有 font flash 修复、关键子集 preload 与品牌首次入场保持。

## V12-E-F2 · Desktop Acceptance Corrections Review

日期：2026-08-25
评审方向：`GATE-DESKTOP` 反馈收口；只修正失败媒体、领养公开投影、Works 水印、Commission 信息比例/分隔和共享分页，不进入 Mobile Final Art Direction。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-E-F2/after/media-failure-hero-1440x900.png` | 1440×900 Desktop | Hero 实际媒体框居中失败态 |
| `implementation/evidence/V12-E-F2/after/media-failure-detail-390x844.png` | 390×844 Mobile | 详情舞台与缩略图失败态 containment |
| `implementation/evidence/V12-E-F2/after/home-adoption-1440x900.png` | 1440×900 Desktop | Homepage Adoption 物种/价格与无状态文案 |
| `implementation/evidence/V12-E-F2/after/adoptions-grid-1440x900.png` | 1440×900 Desktop | 仅 available 的领养目录 |
| `implementation/evidence/V12-E-F2/after/works-intro-1440x900.png` | 1440×900 Desktop | Works 页首低对比度 Logo 水印 |
| `implementation/evidence/V12-E-F2/after/commission-details-1440x900.png` | 1440×900 Desktop | Commission 3:7 与淡灰竖线 |
| `implementation/evidence/V12-E-F2/after/works-pagination-390x844.png` | 390×844 Mobile | 共享 editorial 分页与 44px 目标 |

### Summary

本轮把用户在 Desktop Gate 指出的跨页面小问题收束到共享入口：媒体失败只改 `ResponsivePicture`，分页只改 `PublicPagination`，领养可见性只改公开 repository 投影。Commission 以一条响应式灰线明确 3:7 信息关系，Works 页首水印平衡右上留白；没有新增组件、依赖、字段或数据库迁移。

### Must Fix

无。三视口自动审计的 `availableOnly`、`noStatusCopy`、`noHorizontalOverflow`、`worksWatermark`、`commission`、`pagination`、`mediaCentered` 与 `noRuntimeErrors` 全部通过。

### Should Fix

无。共享分页继续保留 SSR、无 JavaScript、键盘、44px、current/disabled 语义；失败缩略图短提示被约束在媒体框内。

### Could Improve

- 390/430 Evidence 只证明本轮修正没有结构回归；最终 Mobile Art Direction 仍属于 V12-F/V12-G，且必须先通过 `GATE-DESKTOP`。
- 分页的最终 hover/focus/active/disabled 视觉统一仍属于 V14；本轮只修正用户指出的样式断层。

### What Works Well

- `adopted` 退出领养销售面但继续存在于 Works 归档，产品语义和历史作品完整性没有互相污染。
- 一处共享失败态修正覆盖全部媒体消费者，移除了页面级视觉补偿的必要性。
- Hero 品牌文字、Footer、Motion、Schema、媒体 DTO 与依赖均未改变。

## V12-E-F4 · Featured Desktop Composition Density Review

日期：2026-08-25
评审方向：在既有 Type × Media / B + M3 静态方向内收紧 Featured 空场；不新增内容、装饰或 Motion。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/v12-e-f4-featured-after-desktop-1280.png` | 1280×800 Desktop | 高度受限场景、完整摄影与底部 wayfinding |
| `.design/screenshots/v12-e-f4-featured-after-desktop-1440.png` | 1440×900 Desktop | 标准 Desktop 信息组与摄影平衡 |
| `.design/screenshots/v12-e-f4-featured-after-desktop-1920.png` | 1920×1080 Wide Desktop | 宽屏媒体尺度与 Typography overlap |
| `.design/screenshots/v12-e-f4-featured-after-tablet-768.png` | 768×1024 Tablet | 窄屏阅读顺序与双项切换 |
| `.design/screenshots/v12-e-f4-featured-after-mobile-390.png` | 390×844 Mobile | Mobile Structural Safety |

### Summary

空场来自 Desktop 信息组过低、摄影偏窄以及两者缺少共同视觉重心，而不是内容不足。修正将名称、物种、CTA 与切换器收成左侧单一 editorial grouping 并上移；摄影外框向中部延伸、随可用高度放大，与背景 `SELECTED WORKS` 建立明确 overlap。后续人工复核加入与 Homepage Adoption 相同的浅灰 media canvas，在不改变外框的前提下缩小照片，并补齐 `12px / 8px` 外内圆角。没有增加文案、Card、独立色值或依赖。

### Must Fix

无。1280×800 与 1920×1080 均无水平溢出，底部 wayfinding 可见；1440 实测浅灰 canvas 为 `rgb(236, 235, 242)`、外内圆角为 `12px / 8px`；768/390 的两个切换按钮和原阅读顺序保持。

### Could Improve

- 最终 Mobile composition 仍属于 V12-F/V12-G，必须先通过 `GATE-DESKTOP`；本轮不把 Desktop grouping 机械缩到窄屏。
- V13 只能在本轮静态终态上加入分层 Motion，不得让 transform 或 settle 改写最终布局。

### What Works Well

- 以一处现有组件的 CSS/DOM grouping 解决密度问题，没有用新内容掩盖空间关系。
- 1440/1920 的媒体画布承担更清楚的第一视觉 anchor；缩小后的照片不再压迫，左侧信息仍保留足够呼吸感而不显空散。
- Hero 品牌文字、Footer、业务 DTO、Schema、Motion 与其余 Homepage scene 均未改变。

## V12-F · Mobile Homepage Independent Art Direction Review

日期：2026-08-25
评审方向：390×844 / 430×932 Homepage 四幕独立静态构图；不进入 V12-G 或 V13 Motion。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-F/after/hero-default-390x844.png` | 390×844 Mobile | Hero 品牌锁、摄影、controls 与下一幕 |
| `implementation/evidence/V12-F/after/featured-default-430x932.png` | 430×932 Mobile | Featured 浅灰媒体承托、信息与双项控制 |
| `implementation/evidence/V12-F/after/commission-long-copy-390x844.png` | 390×844 Mobile | Commission 长说明换行与双行动 |
| `implementation/evidence/V12-F/after/adoption-multi-next-430x932.png` | 430×932 Mobile | Adoption 三项选择、循环切换与当前页码 |
| `implementation/evidence/V12-F/after/homepage-boundary-390x844.png` | 390×844 Full page | 四幕边界、阅读连续性与 Footer 起点 |
| `implementation/evidence/V12-F/after/homepage-boundary-430x932.png` | 430×932 Full page | 宽 Mobile 四幕边界 |

### Summary

Homepage 四幕没有机械缩小 Desktop grid。Hero 保持品牌文字终态，只加强摄影周边 scrim 和 supporting copy 的可读区域；Featured 以浅灰画布和明确的 controls → 信息间距维持摄影焦点；Commission 采用满宽媒体与轻微错轴叙事；Adoption 将三项选择、当前页码和循环切换收为稳定控制行。默认、多项、长文和整页边界在两档视口均成立。

### Must Fix

无。自动审计的两档视口、无水平溢出、四幕高度、44px 目标、图片解码、Hero Brand Lock、Featured `12px / 8px` 圆角、Adoption control row、4s autoplay、标题入场不重启、Reduced Motion 和 runtime error 均通过。

### Should Fix

无。用户在最终复核中指出的 `/works`、`/adoptions` 背景英文与右上 Logo 重叠已同时检查：390px 间距分别为 28px / 25px，430px 为 45px / 46px，均无横向溢出；Mobile AdoptionCard 同时压缩为 16:9 完整 `contain` 媒体、单行名称及同排物种/价格。

### Could Improve

- V12-G 仍需独立审查所有非 Homepage 公开页面；本轮两个局部页面修正不能代签该任务。
- V13 才负责最终 Motion hierarchy、reverse、interrupt 与 settle；不得以 Motion 改写本轮静态终态。

### What Works Well

- Hero 品牌字、4s autoplay、一次性首次入场和 font flash 修复均未因 Mobile 重构回退。
- 四幕各自保留不同 scene identity，同时共享圆角、背景 Typography、细线、metadata 与 wayfinding 语言。
- 1440×900 回归保持无水平溢出、Hero 品牌字体锁、Featured Desktop 信息列与 `12px / 8px` 圆角；Footer 未改。

## V12-G · Remaining Public Mobile Art Direction Review

日期：2026-08-25
评审方向：390×844 / 430×932 其余公开页面与失败/空态的最终 Mobile Art Direction；Desktop 构图冻结。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `implementation/evidence/V12-G/after/works-390x844.png` | 390×844 Mobile | Works Catalog 密度、搜索与分页 |
| `implementation/evidence/V12-G/after/work-detail-430x932.png` | 430×932 Mobile | 多图 Detail 舞台与五图缩略导航 |
| `implementation/evidence/V12-G/after/adoption-detail-390x844.png` | 390×844 Mobile | 单图设定详情完整展示 |
| `implementation/evidence/V12-G/after/commission-apply-validation-430x932.png` | 430×932 Mobile | 表单校验聚焦与纵向流程 |
| `implementation/evidence/V12-G/after/licenses-details-open-390x844.png` | 390×844 Mobile | 法务长文与原生许可证展开 |
| `implementation/evidence/V12-G/after/detail-media-failure-430x932.png` | 430×932 Mobile | Detail 媒体失败恢复 |
| `implementation/evidence/V12-G/after/work-detail-1440x900.png` | 1440×900 Desktop | Desktop 冻结回归 |

### Summary

逐页检查证明，Works、Adoptions、Detail、Commission、About、Apply、Legal 与状态页已经使用适合自身内容的 Mobile 构图，无需再套统一模板。唯一明确失衡是多图 Detail 舞台在短屏中过高；收紧后主图、五张缩略图和身份信息在 390/430 的阅读顺序更清楚，单图设定详情未受影响。

### Must Fix

无。两档 Mobile 与 1440 Desktop 自动审计的状态码、横向溢出、图片解码、Footer、主要控件、表单、法务与失败恢复均通过。

### Should Fix

无。各页面保留自己的信息密度、媒体比例和恢复语义；Footer、Hero 品牌锁与 Desktop Art Direction 未改变。

### Could Improve

- Motion hierarchy、reverse、interrupt、settle 与跨页 shared-media transition 仅属于 V13，不应回写本轮静态终态。
- V14 再统一 controls 的 hover/focus/active/disabled/loading 视觉，本轮不提前打磨控件皮肤。

### What Works Well

- 只修改一个共享 Gallery 的 Mobile 尺寸即可解决唯一证据明确的问题，没有制造页面级例外或新依赖。
- 多图与单图的比例策略保持分离：作品缩略导航更紧凑，设定图仍完整展示。
- 390/430 全量状态与 1440 Desktop 共用同一验证脚本，证明修正没有反向破坏冻结构图。

## V15 · Full Responsive / Input / Accessibility Final QA Review

日期：2026-08-26
评审方向：冻结 Desktop/Mobile Art Direction 后的跨断点、输入方式、可访问性、SSR 与状态回归；不开始新的静态方向或 V16 一致性修正。

### Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/screenshots/v15-final-review/contact-sheet-mobile-375.png` | 375×812 Mobile | 12 个关键公开页面整页缩略索引 |
| `.design/screenshots/v15-final-review/contact-sheet-tablet-768.png` | 768×1024 Tablet | Tablet 整页缩略索引 |
| `.design/screenshots/v15-final-review/contact-sheet-desktop-1280.png` | 1280×800 Desktop | Desktop 整页缩略索引 |
| `implementation/evidence/V15/matrix/1023x900/home.png` | 1023×900 Boundary | 折叠导航、原生滚动与 Homepage 四幕 |
| `implementation/evidence/V15/matrix/1024x900/home.png` | 1024×900 Boundary | Desktop 导航、staged Homepage 与布局切换 |
| `implementation/evidence/V15/work-detail-rounded-1440x900.png` | 1440×900 Desktop | Detail 实际主图层共享圆角 |
| `implementation/evidence/V15/reduced-motion-390x844.png` | 390×844 Preference | Reduced Motion 可靠终态 |
| `implementation/evidence/V15/no-js-home-390x844.png` | 390×844 No JavaScript | SSR Homepage 公开内容 |

> 全部 36 张 375/768/1280 单页截图位于 `.design/screenshots/v15-final-review/`；六档 × 15 状态及 500 页原图位于 `implementation/evidence/V15/matrix/`。

### Summary

六档响应式矩阵和三档人工联系表证明，已冻结的各页面 Art Direction 在 Mobile、Tablet、1023/1024 边界和 Desktop 之间能够重排而不是机械缩放。未发现确认的文字/Logo 重叠、横向溢出、媒体裁切或断点层级回归；详情主图补齐共享圆角后与全站媒体语言一致。

`/commission` 375px 首轮整页截图中的空二维码并非页面数据或图片加载故障，而是浏览器未滚动到原生 lazy image。SSR HTML、公开 DTO 与真实滚动后的 `naturalWidth/naturalHeight` 均正常；证据脚本现先触发懒加载并把图片解码纳入硬门禁，最终 Mobile/Tablet/Desktop 截图均显示二维码。

### Must Fix

无。90 项页面矩阵、30 项 No-JS、6 项 500 页以及全部输入/偏好检查通过；634 个可见控制的最小目标为 44×44，全部可见图片完成解码。

### Should Fix

无。1023px 保持折叠导航和原生滚动，1024px 正确切换 Desktop 导航、四列 Works、双列 Adoption 与 staged Homepage；两侧没有跳变造成的内容丢失。

### Could Improve

- 真实 iOS/Android 刘海设备和用户本人视觉验收仍应在后续人工 Gate 执行；自动化不能代签。
- 只有未来确需 edge-to-edge Mobile 构图时，才评估 `viewport-fit=cover` 与完整 safe-area inset 适配；当前浏览器约束视口更简单且已验证。

### What Works Well

- 页面保留各自 scene identity，同时共享圆角、字体、细线、背景 Typography、状态与控件语言，没有在最终 QA 中重新模板化。
- 证据层区分了真实生产缺陷和自动化懒加载限制，没有通过取消原生 lazy loading 制造性能回退。
- Keyboard、Touch、Fine Pointer、IME、Soft Keyboard、Reduced Motion/Transparency/Contrast、No-JS 与真实 500 状态共同进入同一 `audit.json`，后续可重复验证。

## V16 · Consistency & Evidence Review

日期：2026-08-26

评审方向：对照 V09 Shared Visual Language、V00-F2 公开面矩阵、V09～V15 Evidence/Handoff，确认全站同源但不模板化，并收口最终 Evidence Index。

范围边界：只修确认的一致性缺口；不开始新视觉方向，不进入 T47 或 GATE-E。

### Screenshots Captured

全部 fresh screenshot 位于 `.design/screenshots/v16-final-consistency/`：

| Screenshot group | Breakpoints | Description |
| --- | --- | --- |
| `review-home-{mobile-375,tablet-768,desktop-1280}.png` | 375×812 / 768×1024 / 1280×800 | Homepage 四幕与 Footer 邻接 |
| `review-works-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Works catalog |
| `review-adoptions-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Adoption catalog |
| `review-work-detail-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Work detail |
| `review-adoption-detail-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Adoption detail |
| `review-commission-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Commission content |
| `review-commission-apply-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Commission form |
| `review-about-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | About / Contact |
| `review-service-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Service document |
| `review-privacy-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Privacy document |
| `review-licenses-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Licenses document |
| `review-not-found-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | 404 state |
| `review-works-empty-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Empty catalog |
| `review-works-no-result-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Works no result |
| `review-adoptions-no-result-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Adoptions no result |
| `review-media-failure-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Forced media failure |
| `review-server-error-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | Real 500 fixture |
| `contact-sheet-{mobile-375,tablet-768,desktop-1280}.png` | 三档 | 15 个主要状态总览索引 |

合计 51 张单页证据和 3 张联系表，共 54 张。项目没有独立 Dark Mode 设计契约，本轮不伪造 Dark Mode 变体。

### Summary

V16 fresh 静态矩阵未确认生产 UI 缺陷。Homepage 四幕、两个 Catalog、统一 Detail、Commission、Apply、About/Contact、Document 与 State surfaces 通过不同 Composition 保持各自身份，同时共享字体、中文 wayfinding、摄影圆角、细线、行动和状态语言；375、768、1280 三档没有横向溢出、图片解码失败、运行时错误或关键层级回退。

交接确认前的真实连续操作随后暴露一项静态矩阵无法捕捉的单帧缺陷：Homepage 非 Hero scene 跳转 `/works` 时，persistent Header 先按 incoming route 从 fixed 切成 sticky，把仍在离场的旧 scene 下推 77px并露出 Hero 尾部。修复将 Header visual path 的提交延后到页面交换边界；Edge 逐帧复核中旧 Featured top 从原先 72→149px 改为始终 72px。该修正不改变页面静态构图、Header 最终状态或正式路由的短 opacity 入场。

本轮唯一 Must Fix 是文档漂移：旧 SPEC/PLAN/Design/CLAUDE 仍把 Homepage Adoption 写成单项、把 `/adoptions` 写成 available + adopted、把 Featured 写成旧双图，并保留已删除的 shared-media 运行时口径。现已统一为 V11 最多三项 available、`/adoptions` available-only、V09+ Type × Media、4s 页面内 carousel，以及正式路由短 opacity/无跨页 media morph；未修改生产页面代码。

### Must Fix

已解决：产品、设计、仓库规范与当前实现的四项契约漂移，以及 Homepage 非 Hero scene 离场时的 Header 定位单帧错位。文档修正位置为 `CLAUDE.md`、`requirements/SPEC.md`、`planning/PLAN.md`、`.design/README.md` 与 `.design/SHARED_VISUAL_LANGUAGE.md`；运行时修正与回归位于 `PublicHeader.vue`、`tests/smoke/main-journeys.spec.ts` 和 `implementation/evidence/V16/transition-regression/`。

### Should Fix

无。V16 `audit.json` 的 expected status、selector、overflow、semantics、image decode、runtime error、Footer continuity、Hero brand lock、media failure 和 server error 共 10 项 checks 全部为 `true`。

### Could Improve

- T47 仍需按任务契约执行真实手机、连续交互与性能验收；V16 自动化和截图不能代签。
- GATE-E 仍需凌巽及指定人工验收者完成最终观感判断；本轮只证明一致性与证据闭环。

### What Works Well

- Homepage 的 Hero / Type × Media / Service Docket / Character Display 共享站点语法但没有变成四张同构卡片。
- Catalog、Detail、Document、Form 与 Error/Empty/Media Failure 状态各自按内容任务重排，Mobile 不只是 Desktop 缩小版。
- Footer 与 Hero 品牌锁保持；当前短 opacity 路由入场没有恢复已删除的跨页平滑媒体位移。
- OSS 与字体来源可从 `config/third-party-assets.json`、`third-party-summary.json` 和 `public/THIRD_PARTY_NOTICES.txt` 追溯。
