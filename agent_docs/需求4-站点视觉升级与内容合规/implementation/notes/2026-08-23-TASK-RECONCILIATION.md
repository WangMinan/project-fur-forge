# Task Reconciliation Report

日期：2026-08-23  
范围：V00-F1 baseline 收口、V00-F2 公开站覆盖审计、TASKS 重排、Visual Direction / implementation notes 同步。  
权威：任务状态与下一项只以 `implementation/TASKS.md` 为准。

## Completed

- V00、GATE-V00 已完成，客户选择 B + M3。
- V00-F1 已完成并记录为 `Homepage Featured Works Visual Baseline`。
- B + M3 已覆盖 1440×900、390×844、430×932、Next、Previous、reverse、interrupt、Keyboard、Touch、Reduced Motion、图片解码和五段 WebM 解码。
- Mobile folio 已独立降权；`SELECTED WORKS` 与 folio `01` 完全静止。
- `implementation/TASKS.md` 已按 Featured Baseline → Hero → Homepage Scenes → Mobile → Public Surfaces → Motion / Controls → Full QA → Review 重排。
- `VISUAL_DIRECTION_V2_2026-08-22.md`、`2026-08-22-VISUAL-TASKS-V2.md`、V00 `INDEX.md` 与 V00-F1 Handoff 已同步。
- `STATE.md`、`planning/PLAN.md` 与活跃 `.design/README.md` 的阶段状态、Hero 冻结边界和 Mobile 规则已同步。
- 已按运行中的公开路由、页面组件和共享状态确认 13 个公开路由文件（含 3 个重定向）与全局错误入口归并为 11 个独立视觉状态；统一详情、Commission 内页、法务/许可证、错误/媒体失败已补入 V06-F1、V07-F1、V07-F2、V08-F1。
- `/adoptions/[slug]`、`/contact`、`/terms` 保持既有重定向终点；Footer 完全冻结，管理端不纳入 Editorial Art Direction。
- 旧 Draft / Patch 已缩减为 `Superseded / Do Not Execute` 历史指针，不再包含可误用的旧任务正文。
- 正式 `HomeHeroCarousel.vue`、`FeaturedWorks.vue` 和其他 Homepage 生产组件未在本轮修改。

## Locked Decisions

- B + M3 是 Homepage Featured Works 的视觉基准，不是全站或所有 Scene 的模板。
- Homepage Scene 顺序为 Hero → Featured → Commission → Adoption → Footer。
- Scene 强度为 Hero Quiet/Cinematic、Featured Editorial Peak、Commission Media-led、Adoption Display/Character、Footer Quiet Closure。
- Hero 只冻结“有点小狗工作室”品牌文字的最终状态：内容、字体资产、最终视觉尺寸、weight、letter-spacing、line-height、最终位置、对齐和最终排版关系。
- 品牌文字可做一次性入场，但必须回到精确终态，换图不重复，Reduced Motion 直接显示终态。
- Mobile 是同一 Art Direction 下的重新构图；每个 Scene 完成时立即验证 390/430。
- Featured 的 `SELECTED WORKS` 与 folio 保持静止，Mobile folio 独立降权，Previous / Next 保持轻量画册式和至少 44px target。
- 原生 CSS + WAAPI 优先；没有可复现缺口时不安装 motion 依赖。
- T47、GATE-E 和人工视觉验收不由本轮代签。

## Open Issues

- V00-F1 尚未进入正式 `FeaturedWorks.vue`；该工作属于 V03。
- 当前开发数据库只有一项 Featured Work；正式 V03 需用真实 1 项 / 2 项数据验证。
- V01 Hero Art Direction 尚未实施或生成候选。
- 真实手机、LCP/CLS/GPU、完整六视口和客户最终视觉签字仍留给对应后续任务、T47 与 GATE-E。
- V01 完成候选后需要用户 / 客户确认 Hero 视觉方向；在该确认前不得开始依赖其结果的后续 Scene 收口。

## Regression Risks

- 把 Hero 整体视为冻结会阻止 V01 的真实 Art Direction。
- 把品牌一次性入场误绑定到 carousel slide key，会在每次换图重复播放。
- 提前抽 token 会把原型参数固化，并迫使后续 Scene 迁就错误规则。
- 把 B + M3 的轴线、编号或竖图比例复制到其他 Scene，会造成同质化或媒体裁切错误。
- 把 Mobile 留到 Desktop 全部完成后再检查，会重复当前已证实的焦点和构图问题。
- 把背景 Typography / folio 重新加入 motion layer，或把 entry `fill: both` 改回 `forwards`，会恢复晃动或文字闪帧。

## Next Task

`V01 · Hero Art Direction & Homepage Opening Continuity`。

它必须先于 Commission / Adoption、Homepage Overall Continuity 和 token 收束，因为 Hero 决定首页开场强度、主摄影尺度、品牌入场、Controls 语言与 Hero → Featured 的交接。若先做后续 Scene 或 tokens，后续必然围绕未确认的开场规则返工。

## Do Not Start Yet

- V02 Commission / Adoption Scenes
- V03 Homepage Overall Scene Composition & Continuity
- V04 Homepage Mobile / Responsive Structural Pass
- V05 Shared Design Language / Tokens / Media Rules
- V06–V12
- T47 / GATE-E
- 正式 Homepage Featured 生产化

## 九项 Reconciliation 回答

### 1. 当前实际完成到哪个 Task？

完成到 `V00-F2 · Full Public Surface Coverage Audit`。此前的 T37～T46-F8、V00、GATE-V00 与 V00-F1 保持已完成；V01 未开始。

### 2. 下一项是什么？

`V01 · Hero Art Direction & Homepage Opening Continuity`，是当前唯一允许开始的任务。

### 3. 为什么下一项必须先于后面的任务？

Hero 是 Homepage 的 opening scene，定义摄影尺度、品牌仪式、Controls 呈现和 Hero → Featured continuity。Commission / Adoption、Overall Continuity、Mobile 整合和 tokens 都需要这个结果作为上游输入；先做它们会制造重复调整。

### 4. Hero 的最终冻结范围是什么？

仅“有点小狗工作室”品牌文字的内容、字体资产、最终视觉尺寸、weight、letter-spacing、line-height、最终位置、对齐和最终排版关系。横/竖集合、focal/CAS、业务语义、SSR 可见性和 1023/1024 滚动边界也作为产品/技术契约保持不变，但不冻结 Hero 的视觉呈现。

### 5. Hero 哪些部分开放？

Photography、crop/focal presentation、media composition、scrim/overlay、mask/clip、image transition、autoplay presentation、previous/next、pagination、arrows、pause/resume、controls grouping/appearance/reveal、pointer/touch/keyboard presentation、media settle、directional motion、scene arrival/departure、Hero → Featured continuity 和 Mobile Hero composition。品牌文字允许一次性入场。

### 6. Mobile 已确认问题有哪些？

- Desktop 规则不能直接缩小到 Mobile；
- Featured folio `01` 在 Mobile 曾过重，现已独立降权；
- `SELECTED WORKS` 必须保持安静静态；
- 摄影必须是 Featured 第一焦点；
- 轻量 Previous / Next 仍需 44px target；
- Hero 需独立检查 focal/crop、主体冲突、scrim、controls、pagination、pause/resume、stagger 和 continuity；
- Commission 需重新安排 media/copy/CTA；
- Adoption 需完整设定优先，避免严重 cover；
- 每个 Scene 完成时立即验证 390/430，不等 V11。

### 7. Homepage 后续 Scene 顺序是什么？

Hero → Featured → Commission → Adoption → Footer。任务执行为 V01 Hero → V02 Commission/Adoption → V03 Overall Continuity（含 Featured 正式落地）→ V04 Mobile Structural Pass。

### 8. 哪些任务等待人工选择 / 确认？

当前没有阻塞 V01 启动的未答问题。V01 的候选结果需要用户 / 客户确认后，依赖其方向的 V02/V03 才能最终收口；真实手机与最终视觉签字留在 V11/T47/GATE-E。若后续原生 CSS/WAAPI 出现可复现缺口，是否引入 `motion-v` 需先记录证据与影响，再单独确认，不默认安装。

### 9. T47 / GATE-E 状态是否保持不变？

是。T47 与 GATE-E 仍为 `[ ]`，王旻安/景宸人工视觉验收仍未代签。

## 完整性审查

- **重复 Task**：当前权威 TASKS 只有一个 Hero Task（V01）、一个 Homepage Mobile Task（V04）和一个 Overall Continuity Task（V03）；历史 T41/T42 是已完成的旧实现记录，不是新的 Hero Art Direction Task。
- **LOCKED / REOPENED 冲突**：已消除。LOCKED 精确到品牌文字终态；Hero 其他视觉与交互呈现明确 REOPENED。
- **错误禁止 Hero Animation**：当前活文档不再禁止品牌入场；明确允许一次性入场并约束终态、换图不重复和 Reduced Motion。
- **Hero 整体冻结**：当前活文档没有把 Hero 整体冻结。
- **Mobile 只是 Desktop 缩放**：当前活文档明确要求同一 Art Direction 下重新构图，并把 390/430 前置到每个 Scene。
- **历史文档**：旧 Draft / Patch 仅保留 superseded 指针，不得作为执行输入。
- **停止点**：公开覆盖 Reconciliation 完成后停止；未开始 V01。

## Evidence Sources

- `.design/prototypes/v00/INDEX.md`
- `implementation/evidence/V00/featured-b-m3/`
- `implementation/notes/2026-08-23-V00-B-M3-REFINEMENT.md`
- `.design/VISUAL_DIRECTION_V2_2026-08-22.md`
- `implementation/notes/2026-08-22-VISUAL-TASKS-V2.md`
- `implementation/TASKS.md`
- `STATE.md`
- `planning/PLAN.md`
- `.design/README.md`
