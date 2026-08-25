# 阶段 E：V00–V12 视觉任务执行说明

初始日期：2026-08-22  
最近同步：2026-08-23  
性质：`implementation/TASKS.md` 的非权威实施说明  
当前状态：`V00-F1 · Homepage Featured Works Visual Baseline` 与 `V00-F2 · Full Public Surface Coverage Audit` 已完成；下一项是 V01，尚未开始。

本文取代本文件此前的 V00 实施前建议稿。任务勾选、唯一顺序和开放状态只以 `implementation/TASKS.md` 为准；历史 Draft / Patch 仅供追溯，不再作为执行输入。

## 执行顺序

```text
V00-F1  Featured Baseline（完成）
  ↓
V00-F2  Public Surface Coverage Audit（完成）
  ↓
V01     Hero Art Direction & Opening Continuity
  ↓
V02     Homepage Commission / Adoption Scenes
  ↓
V03     Homepage Overall Scene Composition & Continuity
  ↓
V04     Homepage Mobile / Responsive Structural Pass
  ↓
V05     Shared Design Language / Tokens / Media Rules
  ↓
V06–V08 Other Public Surfaces
  ↓
V09     Motion / Scene Continuity
  ↓
V10     Controls / Icons
  ↓
V11     Full Responsive / Accessibility
  ↓
V12     Consistency Review / Evidence
  ↓
T47 → GATE-E
```

每次只执行最前面的一个 `[ ]` 任务；不得把 Hero、Commission、Adoption 或公共页面合并成一次大改。

## 组件处置矩阵

| Task | Reuse | Modify | Create / 禁止 |
| --- | --- | --- | --- |
| V00-F1 / F2 | V00 context、公开路由与共享组件、`PublicAction`、`V00FeaturedControls`、CSS / WAAPI | `FeaturedBTypeComposition.vue`、B+M3 evidence、公开覆盖矩阵 / docs | 不创建依赖；不修改正式 Homepage |
| V01 | `HomeHeroCarousel.vue`、`ResponsivePicture`、现有 carousel utils、横/竖集合与 focal | Hero 摄影构图、scrim、controls、一次性入场、换图 motion、Mobile Hero、Hero → Featured continuity | 仅有复用价值时创建小型 Hero 子组件；不改业务数据或安装 UI framework |
| V02 | `HomeBusinessEntries`、`CommissionLead`、`HomeCurrentAdoptions`、`AdoptionCard`、`PublicAction` | Commission / Adoption 各自 Scene 构图与局部 motion | 不创建新业务区块、字段、查询或路线 |
| V03 | V00-F1 baseline、V01、V02、`FeaturedWorks.vue`、现有 staged wheel | Featured 正式 Scene 与整页 Scene rhythm / continuity | 不复制原型数据层，不改变模块顺序 |
| V04 | V01～V03 同一组件和现有 breakpoint | 390/430/768/1023/1024 的独立重构与 controls density | 不创建 Desktop / Mobile 双份页面 |
| V05 | 已证明的 Homepage 规则、`public-base.css`、现有媒体 utility | 最小语义 token 与页面媒体边界 | 不创建第二套设计系统，不改上传 / Schema / 发布 |
| V06 / F1 | `WorkCard`、`AdoptionCard`、`WorkDetailGallery`、现有搜索 / 分页 / 空态 | Works / Adoption Catalog 与统一详情 Scene | 不创建第二套搜索、领养详情模板、瀑布流或数据模型 |
| V07 / F1 / F2 | `PublicPageIntro`、`ContactChannelGrid`、`ContactEmailActions`、`CommissionLead`、`PublicLegalDocument` | About / Contact、Commission、Service / Privacy / Licenses | 不扩平台、后台字段、二维码数据或法律文本 |
| V08 / F1 | 现有申请表单、上传、校验、隐私、提交状态、`error.vue`、`PublicEmptyState`、`ResponsivePicture` | 完整表单状态、404 / 500、空态与媒体失败呈现 | 不创建新字段、SMTP、校验、重试 API 或第二套状态组件 |
| V09 | V01～V08 已落地 motion、WAAPI / CSS、现有 View Transition | Directional / settle / scene / local shared continuity 收口 | 仅原生有可复现缺口时评估 `motion-v`；不做全局 motion |
| V10 | 现有 Header / Nav / Actions / Search / Pagination / Gallery / details / Hero / Featured controls / SVG | 几何、focus、44px target 和状态反馈 | Footer 完全冻结；不默认安装 icon package，不改 IA |
| V11 | V01～V10 同一文件与 breakpoint | 11 个公开视觉状态的六视口、输入模态、偏好与性能修正 | Footer 只观察回归；不代签真实手机、T47 或 GATE-E |
| V12 | TASKS、Visual Direction、V00 INDEX、V00-F2 矩阵、各任务 evidence / handoff | 11 个公开视觉状态的一致性审查与最终 evidence 索引 | 不开始新功能，不勾选 T47 / GATE-E |

## V00-F1 / F2 — 已完成 Baseline 与覆盖审计

- B + M3 已被记录为 `Homepage Featured Works Visual Baseline`，不是全站模板。
- V00-F2 已确认 13 个公开路由文件（含 3 个重定向）与全局错误入口归并为 11 个独立视觉状态；统一详情、Commission、法务/许可证、错误与媒体失败已有明确任务归属。
- `/adoptions/[slug]`、`/contact`、`/terms` 继续复用既有终点；Footer 和管理端不进入公开站重设计。
- Motion hierarchy：Media 66px > Main Title 40px > Meta 24px / Description 20px > CTA 10px。
- `SELECTED WORKS` 与 folio `01` 完全静止。
- Mobile `01` 独立降权；摄影 > 中文标题 > 内容 / CTA > folio / 背景 Typography。
- Previous / Next 保持轻量画册式呈现，target 为 44px；Next / Previous、reverse、interrupt、Touch、Keyboard、Reduced Motion 均已验证。
- Evidence：`implementation/evidence/V00/featured-b-m3/`；Handoff：`2026-08-23-V00-B-M3-REFINEMENT.md`。

## V01 — Hero Art Direction & Opening Continuity

### 目标

让 Hero 成为安静、电影感、摄影最大、UI 最少的 Homepage Opening，并与 Featured 的 editorial peak 建立连续性。

### 冻结范围

仅冻结“有点小狗工作室”品牌文字的内容、字体资产、最终视觉尺寸、weight、letter-spacing、line-height、最终位置、对齐与最终排版关系。

### 开放范围

Photography / crop / focal presentation / media composition、scrim / mask / clip、image transition / autoplay presentation、arrows / pagination / pause-resume、controls grouping / appearance / reveal、pointer / touch / keyboard 呈现、media settle / directional motion、scene arrival / departure、Hero → Featured continuity、Mobile Hero composition。

品牌文字允许一次性 stagger / reveal / 小幅 translate + opacity / clip / mask / 极轻 settle，但必须回到冻结终态；换图时不重复；Reduced Motion 直接显示终态。DITE DOG 与 slogan 文案保持，视觉层级和入场时序可调整。

### 验收

- 阅读顺序以 Media → Brand → Supporting Copy → Controls 为探索起点。
- 1440 Desktop 形成清楚的 Quiet / Cinematic Opening；完成后立即检查 390×844、430×932。
- Mobile 单独检查 focal/crop、品牌与主体冲突、scrim、pagination、pause/resume、44px target 与 Hero → Featured。
- Keyboard、Touch、autoplay、pause/resume、页面隐藏、Reduced Motion 均可靠。
- 保存截图、arrival / slide change / interrupt / reduced 短录屏并写固定格式 Handoff。

## V02 — Commission / Adoption Scenes

- Commission 是 Media-led Service Scene；Mobile 重新安排 media / copy / CTA，不把 Desktop 非对称布局纵向压缩。
- Adoption 是 Display / Character Scene；设定图完整性优先，使用 contain / art-directed canvas，不严重 cover。
- 两幕继承共同语言，不复制 B + M3 的具体轴线、编号或 overlap。
- 每完成一幕立即检查 Desktop、390、430、Keyboard、Touch、Reduced Motion并保存 evidence。

## V03 — Homepage Overall Continuity

- 将 V00-F1 视觉基准落入正式 `FeaturedWorks.vue`。
- 整体验收 Hero → Featured → Commission → Adoption → Footer 的第一焦点、第二落点、媒体尺寸、Negative Space、Typography / Motion 强弱和转场重复。
- Scene 强度：Hero Quiet/Cinematic → Featured Editorial Peak → Commission Media-led → Adoption Display/Character → Footer Quiet Closure。
- 1024+ staged wheel 和 390/430 原生阅读顺序必须各自成立。

## V04 — Mobile / Responsive Structural Pass

V04 不是首次检查 Mobile，而是对 V01～V03 已做过的 390/430 结果进行跨 Scene 整合。允许 Desktop / Mobile 使用不同 position、grouping、density、reveal strategy 和视觉参数，但功能、内容、44px target、Keyboard/Touch 与 Reduced Motion 不得减少。

## V05–V12 — 后续边界

- **V05**：只在 Homepage 证据稳定后提取最小 token 和媒体边界。
- **V06 / F1**：处理 Works / Adoptions Catalog 与共用详情，不复制搜索或详情模板。
- **V07 / F1 / F2**：处理 About / Contact、Commission 与 Service / Privacy / Licenses，不改内容结构或数据。
- **V08 / F1**：处理 Apply 全状态、404 / 500、空态与媒体失败，不新增重试或业务能力。
- **V09**：收口而非重新发明 motion；背景 Typography 安静，所有动画可 interrupt / reverse。
- **V10**：最后统一 Header / Nav / Controls / Icons；Footer 完全冻结。
- **V11**：对 11 个公开视觉状态做完整六视口、输入、偏好、性能与真实设备边界。
- **V12**：对照 V00-F2 矩阵做一致性和证据审查，不代签 T47 / GATE-E。

## Mobile 共通规则

- Mobile 是同一 Art Direction 下的重新构图，不是 Desktop 缩小版。
- 每个 Scene 在实现当下检查 390×844、430×932，不留到 V11 才第一次检查。
- Featured：摄影第一、`01` 降权、`SELECTED WORKS` 静止、轻量翻页与 44px target。
- Hero：独立验证 focal / crop / scrim / controls / pagination / pause-resume / stagger / continuity。
- Commission：重新安排 media / copy / CTA。
- Adoption：完整设定优先，避免严重 cover。

## 每项任务的完成协议

每个 Vxx 完成时必须同时具备：

1. 实现；
2. Desktop 验证；
3. 390 / 430 验证；
4. Keyboard / Touch；
5. Reduced Motion（相关时）；
6. 截图 / 短录屏；
7. Evidence 更新；
8. TASKS 状态更新；
9. 固定格式 Handoff。

Handoff 固定包含：

- `Completed`
- `Locked Decisions`
- `Open Issues`
- `Regression Risks`
- `Next Task`
- `Do Not Start Yet`

当前唯一 Next Task 是 V01。本轮在文档对齐和 Task Reconciliation 后停止，不开始 Hero。
