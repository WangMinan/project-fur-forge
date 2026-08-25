# 需求4阶段 E：Visual Direction v2

日期：2026-08-22  
最近同步：2026-08-23  
性质：阶段 E 当前视觉方向与后续任务约束  
权威：任务状态以 `implementation/TASKS.md` 为唯一来源；本文定义视觉决策，不代签 T47、GATE-E 或人工验收。

当前执行状态：`Homepage Featured Works Visual Baseline: B + M3`、`V00-F2 · Full Public Surface Coverage Audit` 与 V01～V07 已完成。下一项且唯一允许开始的任务是 `V07-F1 · Commission Service Page`。

## 1. 当前选择与边界

- 客户于 2026-08-23 明确选择 `B + M3（Typography × Media + Directional）`。
- V00-F1 已把该组合收成 dev-only `Homepage Featured Works Visual Baseline`；正式 Homepage 尚未采用这一版。
- A、B、C 与 M1～M3 的未选原型继续保留到 GATE-E，不把 Recommended 或历史候选误写成 Selected。
- V00-F2 已把 13 个公开路由文件（含 3 个重定向）与全局错误入口归并为 11 个独立视觉页面状态，并将此前遗漏的统一详情、委托内页、法务/许可证、错误与媒体失败状态补入 V06-F1、V07-F1、V07-F2、V08-F1。
- 本轮只完成 V00 baseline、公开覆盖审计、文档对齐和任务重排；未修改正式 Homepage、数据库、API、业务数据、媒体发布逻辑或生产依赖。

## 2. Homepage Shared Design Language

B + M3 是 Homepage 的视觉基准，不是所有页面或所有 Scene 的版式模板。后续只抽象以下共同语言：

- 彩色兽装摄影主导，黑 / 白 / 灰 UI 保持克制；
- Typography 参与空间构图，但背景 Typography 保持安静；
- Negative Space 有明确阅读和构图目的；
- 不依赖普通 Card 或无语义 Shadow 建立层级；
- Directional Motion 与分层 Motion Amplitude；
- Media Settle 克制，不做果冻或持续呼吸；
- 少数 Scene 可以大胆，其余区域安静；
- Mobile 是同一 Art Direction 下的重新构图，不是 Desktop CSS 缩小版。

各 Scene 必须有自己的角色，禁止机械复制 B + M3 的媒体位置、标题轴线、编号或 overlap。

## 3. 决策矩阵

### LOCKED：业务与 Hero 品牌终态

- 首页顺序保持 Hero → Featured Works → Commission → Adoption → Footer；业务入口不变。
- Hero 横 / 竖独立集合、focal point、CAS、autoplay 业务语义、SSR 默认可见和 1023 / 1024 滚动边界不变。
- 仅冻结“有点小狗工作室”品牌文字的最终状态：文案内容、字体资产、最终视觉尺寸、weight、letter-spacing、line-height、最终位置、对齐和最终排版关系。
- Footer 的内容、布局、样式、响应式和交互全部冻结；后续只做相邻页面覆盖/挤压回归，不修改 `PublicFooter.vue`。
- 首页领养保持单项；代表作品资格与最多两项约束不变。
- 路由、数据、接口、发布逻辑、联系方式范围和数据模型不因视觉任务改变。
- 不恢复公告板、返图墙、FAQ、动态等关闭业务；不新增数据库、隐私、安全、分发或部署范围。
- 不做全局 reveal、Hero 伪拖拽、Footer 入场、全站 tilt、CTA 回弹或持续漂浮噪声。

### REOPENED：Hero Art Direction

除“有点小狗工作室”品牌文字终态外，Hero 的视觉与动效呈现均可重新设计：

- Photography、crop、focal presentation、media composition；
- scrim / overlay、mask / clip；
- image transition 与 autoplay presentation；
- previous / next、pagination、arrows、pause / resume；
- controls grouping、appearance、summon / reveal；
- pointer、touch、keyboard 的呈现方式；
- media settle、directional motion；
- scene arrival / departure；
- Hero → Featured Works continuity；
- Mobile Hero composition。

品牌文字允许一次性 stagger、分块 reveal、轻微 translate + opacity、clip / mask 或极轻 settle。动画必须回到精确冻结终态，后续换图不重复整套品牌入场，Reduced Motion 直接显示终态。DITE DOG 与 slogan 的文案不改，但其视觉层级与一次性进入时序可在 V01 重新设计。

### SELECTED BASELINE：B + M3 Featured Works

- 摄影是第一焦点，中文作品标题第二，内容 / CTA 第三，folio / 背景 Typography 最后。
- 当前原型位移层级为 Media 66px → Main Title 40px → Meta 24px / Description 20px → CTA 10px；这是 V00 baseline，不自动成为全站 token。
- Next / Previous 真正反向，可 reverse / interrupt，最终清回静态状态。
- `SELECTED WORKS` 与 folio `01` 完全静止，不参与 arrival、翻页、reverse 或 interrupt。
- Previous / Next 使用轻量画册式箭头 + 文本 +状态细线，不恢复大型 pill；实际 target 至少 44px。
- Mobile 独立降低 folio 权重，允许 Desktop / Mobile 使用不同视觉参数。

### OUT OF SCOPE

- 任何业务功能、Schema、后台上传规则、媒体发布服务、内容结构或水印策略。
- 全站换字体、安装大而全 UI Framework、复制 Apple / Halo Sea / WW-PASS 的品牌资产或具体版式。
- 把 Featured 的 3:4 / 4:5 输入强制传播到 Hero、Commission、Works、Detail 或 Adoption。
- 在没有原生实现缺口证据时安装 Motion library。

## 4. Homepage Scene Hierarchy

```text
Hero        — Quiet / Cinematic Opening
Featured    — Editorial Visual Peak
Commission  — Media-led Service Scene
Adoption    — Display / Character Scene
Footer      — Quiet Closure
```

Hero 摄影最大、UI 最少、品牌仪式感最强；Featured 承担最强 editorial composition。Commission 与 Adoption 继承共同语言，但各自重新构图。Footer 安静收束，不做入场表演。

Homepage Overall Scene Composition & Continuity 必须检查：第一焦点、第二阅读落点、媒体尺寸节奏、Negative Space 收放、Typography / Motion 强弱、构图与转场是否重复、Hero → Featured 是否像同一网站、≥1024 staged wheel 是否成立，以及 390 / 430 是否独立成立。

## 5. Hero Motion 起点

V01 可从以下阅读顺序探索，不把建议机械写成固定数值：

1. Hero Photography 初始可见；
2. Media 小幅 settle；
3. “有点小狗工作室”一次性逐字 / 分块 stagger；
4. DITE DOG 次一级出现；
5. slogan 再次一级；
6. carousel controls 最后进入。

核心顺序是 Media → Brand → Supporting Copy → Controls。Hero 后续换图只处理媒体与必要控件状态，不重复品牌开场。

## 6. Mobile Recomposition

每完成一个 Homepage Scene，立即验证 390×844 和 430×932，不等 Desktop 全部完成后再首次检查 Mobile。

### Hero Mobile

- 独立检查 photography focal / crop、品牌文字与角色主体冲突、scrim、controls、pagination、pause / resume、44px target、品牌 stagger 时长和 Hero → Featured continuity。
- Controls 可与 Desktop 使用不同 position、grouping、density、reveal strategy，但功能与可访问性不能减少。

### Featured Mobile

- 摄影保持第一焦点；
- folio `01` 降低权重；
- `SELECTED WORKS` 保持静态背景层；
- Previous / Next 保持轻量画册式形式；
- target 至少 44px；
- Desktop / Mobile 允许不同视觉参数。

### Commission / Adoption Mobile

- Commission 不把 Desktop 非对称布局直接纵向压缩，重新安排 media / copy / CTA。
- Adoption 以设定图完整性优先，使用 contain / art-directed canvas，不为统一视觉严重 cover 裁切。

## 7. Motion Language

1. **Directional Motion**：Media 振幅最大，Main Title 次之，Meta / Description 更小，CTA 最小且最后落位；Next / Previous 方向相反。
2. **Media Settle**：有方向和惯性，最后轻微落稳；overshoot 克制，不做 scale bounce 或全层 spring。
3. **Background Typography**：基本静止；最多只在后续任务有明确证据时做极轻响应，当前 B + M3 baseline 完全静止。
4. **Interrupt / Reverse**：连续输入不得留下 transform、opacity 或 animation residue，最终状态可靠。
5. **Reduced Motion**：取消大位移、自动循环和非必要 crop / clip；内容与品牌终态立即可读。
6. **Shared Continuity**：只在 Featured → Detail 有明确收益时局部验证；不支持时直接导航，不扩成全站转场。

原生 CSS + WAAPI 已满足 V00-F1。只有后续出现可复现的 interrupt、reverse、layout continuity 缺口时，才评估 `motion-v`；本轮不安装依赖。

## 8. Media Boundaries

| 区域 | 当前规则 | 不得外推 |
| --- | --- | --- |
| Homepage Featured | 当前以竖版摄影构图，生产采用方式由 V03 决定 | 不成为全站上传 / crop 规则 |
| Hero | 横 / 竖独立资产和 focal point，视觉呈现在 V01 重做 | 不受 Featured portrait 限制 |
| Commission | 尊重现有横 / 竖媒体策略 | 不强制 3:4 |
| Works / Detail | 展示真实混合比例 | 不统一裁切 |
| Adoption | 设定信息完整优先，宽幅使用 contain / art-directed canvas | 不为风格严重 cover |

## 9. V00 Preservation / Evidence

- 代码位于 `app/components/prototypes/v00/**`，只在 `V00_PROTOTYPES=true` 且非 production 时注册。
- 正式 Homepage 不 import V00 组件；原型 route 使用 noindex。
- 当前评审导航只显示 B + M3；未选候选源码与直达路由保留到 GATE-E。
- B + M3 baseline evidence：`implementation/evidence/V00/featured-b-m3/`，包含 1440、390、430 截图与 arrival / next / previous / reverse / interrupt WebM。
- V00 索引：`.design/prototypes/v00/INDEX.md`；Handoff：`implementation/notes/2026-08-23-V00-B-M3-REFINEMENT.md`。

## 10. Public Surface Coverage

- 11 个独立公开视觉状态均须进入 V01～V12：Homepage、Works Catalog、Unified Work / Adoption Detail、Adoptions Catalog、Commission、Commission Apply、About / Contact、Service、Privacy、Licenses、404 / 500。
- `/adoptions/[slug]`、`/contact`、`/terms` 分别继续复用 `/works/[slug]`、`/about#contact`、`/service`，不创建重复模板。
- Catalog 空态、无匹配、非法筛选、越界页，Apply 不可用/文件拒绝/上传/处理中/失败/成功，媒体加载/解码失败和无 JavaScript 回落都属于视觉覆盖，不是额外业务。
- 管理端不进入公开站 Editorial Art Direction；仅在共享组件或 token 改动后做回归。
- 详细矩阵与 33 张三视口截图见 `implementation/notes/2026-08-23-PUBLIC-VISUAL-COVERAGE-AUDIT.md`。

## 11. 后续唯一顺序

`V00-F1 → V00-F2 → V01 Hero → V02 Commission / Adoption → V03 Homepage Overall Continuity → V04 Homepage Mobile → V05 Shared Language / Tokens / Media Rules → V06 / V06-F1 Catalog + Detail → V07 / V07-F1 / V07-F2 Information + Legal → V08 / V08-F1 Form + Failure States → V09 Motion → V10 Controls / Icons → V11 Full Responsive / Accessibility → V12 Consistency Review → T47 → GATE-E`

每次只执行最前面的一个开放任务。每项完成后必须留下 Desktop、390/430、Keyboard/Touch、Reduced Motion（相关时）、Evidence、TASKS 状态和固定格式 Handoff；禁止顺手开始后续任务。
