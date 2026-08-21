# Design Review：阶段 E 动效与首页领养

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
