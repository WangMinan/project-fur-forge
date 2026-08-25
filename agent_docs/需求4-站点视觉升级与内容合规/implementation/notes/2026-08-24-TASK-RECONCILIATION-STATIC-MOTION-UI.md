# TASKS 第二次方向校准 · Static / Motion / UI

> 日期：2026-08-24
> 状态：文档调整完成；当前仍停在 `GATE-V08-R · 凌巽方向重置人工验收`。
> 范围：只调整 `TASKS.md` 的开放任务结构与最终 Gate；未修改生产页面代码，未开始 V09，未代签任何人工 Gate。

## 1. 历史与当前状态

- V00～V08-F3、Evidence 与 Handoff 原样保留，所有既有 `[x]` 继续表示“对应历史任务与证据已完成”。
- `[x]` 不再被解释为“凌巽已认可其为最终视觉设计”；它们是第一轮布局、视觉覆盖和 bug 修复历史。
- T46-F6 的“双图 + 右文”保留为发生过的历史实现，不再作为最终 Featured 的视觉硬条件。
- V08-F3 的三项修复视为已完成事实：品牌字体刷新闪动、测试媒体错误 padding、Hero autoplay 10s → 4s。后续只做 regression verification，发现真实回归再登记 bug。
- 当前唯一可处理项仍是 `GATE-V08-R`。凌巽未明确确认新顺序并允许继续前，V09～V16、`GATE-STATIC`、T47 与 GATE-E 均不得启动。

## 2. Conflict Resolution

| 冲突 | 原结构 | 第二次校准后的处理 |
| --- | --- | --- |
| V09 混合 Static 与 Motion | Featured 静态重构、4s autoplay、分层 Motion、reverse/interrupt 同时交付 | V09 只建立 Shared Visual Language 并完成 Featured 静态终态；carousel choreography 与 Featured autoplay 留给 V13 |
| Homepage Commission 遗漏 | V10 只明确 `/commission` | V10 同时重开 Homepage Commission 与 `/commission`，两者共享语法但不机械复制 |
| Shared Visual Language 过于抽象 | 只有摄影、Typography、黑白灰等方向词 | V09 明确定义 Editorial Scene Wayfinding Grammar：NEXT/PREVIOUS、destination、long rule、folio/count、boundary cue、media edge alignment、uppercase metadata |
| Hero wayfinding 成为一次性装饰 | `NEXT ─ SELECTED WORKS` 只在 Hero 出现 | 后续 scene 必须使用有语义的延续或变体；若没有下游语义，重新评估 Hero 元素本身，而非机械复制文字 |
| 统一语言被误解为统一模板 | 页面容易重复 eyebrow + 中文标题 + 左图右文 | 统一 typography/directional/wayfinding/media/spacing/control/motion philosophy；每个 scene 保留独立 identity |
| V12 过大 | 十余页面、控件和状态合并为一次实现/报告 | 拆为 V12-A Works/Detail、V12-B About/Contact、V12-C Apply、V12-D Legal、V12-E Error/Empty/Media Failure；每项独立截图、Evidence、Handoff |
| 静态与 Motion 之间无人工 Gate | 页面完成后直接继续动效 | 新增 `GATE-STATIC`；凌巽必须先确认静态设计满意，才能开始 V13 |
| Motion 与 UI 混合 | carousel、Header、controls、search、gallery 状态容易同步反复调整 | V13 专管 Signature Motion/Carousel/Continuity；V14 专管 Header/Nav/Controls/Interaction states |
| GATE-E Featured 旧版式冲突 | 强制“左上标题 + 双竖图 + 右文” | 改为以正式 Selected Baseline 验收 Type × Media、摄影 anchor、两件业务上限、切换和 `/works` 入口；不把具体双栏版式写死 |
| “不新增依赖”造成保守执行 | 没有依赖被当成拒绝探索的理由 | 新增 Open-source Resource Policy：允许主动评估许可清晰的小型资源，同时记录 license、来源、bundle/maintenance、SSR/A11y/Reduced 影响 |

## 3. Phase S · Static Redesign

静态阶段只判断 Composition、Typography、Media Placement、Negative Space、Scene Identity、Visual Hierarchy、Shared Visual Grammar 和 Desktop/Mobile 构图。验收问题固定为：关闭所有非必要动画后，网站是否已经像一套完整、漂亮、有差异化的设计稿？

| Task | 修改/复用边界 | 独立验收 |
| --- | --- | --- |
| V09 Shared Language + Featured Static | 修改 `FeaturedWorks.vue`；复用 V00 B+M3 和 public tokens | Shared grammar 契约、1440、390/430、静态 controls 位置、独立 Handoff |
| V10 Homepage Commission + `/commission` | 修改 `HomeBusinessEntries.vue`、`CommissionLead.vue`；复用 status/action/content/media | 两个不同 Service Scene 的 Desktop/Mobile 静态证据 |
| V11 Adoption Character Archive | 修改 `HomeCurrentAdoptions.vue`、`AdoptionCard.vue`、adoptions/详情领养变体；复用排序/搜索/路由 | contain 完整设定图、角色档案信息、三处独立静态证据 |
| V12-A Works / Detail | 修改 `WorkCard.vue`、`WorkDetailGallery.vue`、works/统一详情；保留 V11 领养变体 | mixed ratio、archive/editorial、gallery 静态证据 |
| V12-B About / Contact | 修改 About 和联系方式组件；复用后台内容投影 | QR/Email/QQ 不再是 spacing-only card grid |
| V12-C Commission Apply | 修改申请页静态组合；复用现有 form/upload/action | measurement、upload、confirmation、success/failure，功能不变 |
| V12-D Legal / Privacy / Licenses | 修改 legal components 与三个阅读页组合 | reading rhythm、长页导航、details/code/license blocks |
| V12-E Error / Empty / Media Failure | 修改 `error.vue`、`PublicEmptyState.vue` 和媒体失败呈现 | 404/500/empty/no-result/image-failure 各自独立证据 |

Phase S 全部完成后必须停在 `GATE-STATIC`。Agent、自动测试、Design Review 或其他成员不能以“页面可用”代替凌巽对静态美术方向的签字。

## 4. Phase M / Phase UI / Final

- **V13 · Signature Motion / Carousel / Scene Continuity**：静态 Gate 后统一处理 Hero/Featured carousel、4s、pause/resume、direction、reverse/interrupt、Media Settle、分层 motion 和 scene continuity。
- **V14 · Controls / Header / Navigation / Interaction Final Integration**：Motion 定型后统一处理 Header、Mobile Nav、Hero/Featured/gallery/search/pagination/actions/icons 及 hover/focus/active/disabled/loading。
- **V15 · Full Responsive / Input / Accessibility**：统一收口六类视口、键盘、触控、输入法、safe area、prefers-*、SSR/no-JS 与语义。
- **V16 · Consistency & Evidence Review**：对照 Shared Language、公开面矩阵、license/source 和各任务 Evidence，修复一致性缺口并生成最终索引。
- **T47 → GATE-E**：完成实机、性能、最终人工验收；不再恢复旧 Featured 双图硬条件。

## 5. New Ordered Task List

```text
GATE-V08-R · 凌巽确认第二次任务校准并明确放行
  ↓
V09 · Shared Visual Language Contract & Featured Works Static Redesign
  ↓
V10 · Homepage Commission + /commission Static Redesign
  ↓
V11 · Adoption Character Archive Static Redesign
  ↓
V12-A · Works Catalog & Work Detail Static Redesign
  ↓
V12-B · About / Contact Static Redesign
  ↓
V12-C · Commission Apply Static Redesign
  ↓
V12-D · Legal / Privacy / Licenses Reading Design
  ↓
V12-E · Error / Empty / Media Failure Static States
  ↓
GATE-STATIC · 凌巽 Full Public Static Visual Approval
  ↓
V13 · Signature Motion / Carousel / Scene Continuity
  ↓
V14 · Controls / Header / Navigation / Interaction Final Integration
  ↓
V15 · Full Responsive / Input / Accessibility
  ↓
V16 · Consistency & Evidence Review
  ↓
T47 · 连续移动 / Reduced / 性能 / 真实设备验收
  ↓
GATE-E · 最终人工视觉验收
```

## 6. Locked Boundaries

- Footer 的内容、布局、样式、响应式和交互全部冻结；只验证相邻 scene 不覆盖或挤压。
- V11 已明确 supersede T21 的 Homepage Adoption 单项投影：当前首页按既有排序有意展示最多三项 `available` 以提高可见性，这是用户明确授权的产品调整；不得修回单项，`/adoptions` 的排序、搜索与分页规则不变。
- V04“单幕双图且不恢复 folio/翻页”的 Featured 约束仅为历史实现/Evidence；当前 Active Featured Visual Contract 以 V09+、Type × Media Scene、Featured switching 与 GATE-E criteria 为准。
- Homepage“有点小狗工作室”的文案、字体身份/资产、font-weight、letter-spacing、line-height、品牌整体视觉身份和已确认的一次性首次入场继续锁定。Mobile Hero 应先独立重构 Photography、media composition、controls、wayfinding、supporting copy 与周边空间；品牌字号、核心位置和对齐不得因 Mobile Art Direction 自动改变。仅当真实 390×844 / 430×932 构图记录明确冲突、Mobile-specific alternative、before/after 以及周边构图无法解决的理由后，才可请求用户显式 exception approval；批准前不得修改。V12-F 只定义 Mobile 静态终态和 controls/wayfinding 布局；换图不重复整套品牌入场、Reduced Motion 直达终态、font flash 不回退、Hero autoplay 当前默认 4s，最终 Motion choreography 仍由 V13 负责。
- 功能逻辑、业务数据、申请字段/校验/上传、QQ/Email、营业状态、排序、搜索、路由、focal、媒体拓扑和代表作品最多两件规则不因视觉重构改变。
- 每次只能执行最前面的一个 `[ ]` Task；每项必须提供独立 Evidence 与包含 `Completed / Locked Decisions / Open Issues / Regression Risks / Next Task / Do Not Start Yet` 的 Handoff。

## 7. Stop

本轮到此停止。下一步不是 V09，而是凌巽审核新版 `TASKS.md` 并明确确认：“新的 TASKS 顺序正确，可以通过 GATE-V08-R。”
