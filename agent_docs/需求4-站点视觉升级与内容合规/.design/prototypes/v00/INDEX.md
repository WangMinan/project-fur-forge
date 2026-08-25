# V00 Visual Lab

状态：`Homepage Featured Works Visual Baseline: B + M3`（客户于 2026-08-23 选定，GATE-V00 与 V00-F1 已通过）

V00 是开发环境视觉提案集合。所有 Featured 方案都消费同一份 `/api/public/v1/home-aggregate` 的已发布 Featured Work（最多三项）、同一套竖版摄影来源、真实角色名、同一文案、同一 CTA 和默认 Header。正式首页不 import 这些组件。

## 入口

仅当 `V00_PROTOTYPES=true` 且非 production 时注册：

当前评审导航只显示已选的 `/__prototype/v00/b-m3`。其余 V00 对照源码和直达路由暂时保留，不在界面提供选择入口。

组合预览保持同一 A/B 排版，只替换 M2 / M3 的 arrival 与切换参数，方便客户做正交比较。

## Featured Variants

| Variant | Composition | Motion | Code | Desktop | Mobile | Complexity | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A — Editorial Offset | 偏轴竖图、编辑留白、编号与 caption 对齐媒体边缘 | 低振幅 arrival / settle | `featured-a-editorial-offset/FeaturedAEditorialOffset.vue` | `featured-a/featured-a-desktop-1440.png` | `featured-a/featured-a-mobile-390.png` | Medium | Candidate |
| A + M2 | A 的偏轴构图 + Soft Settle 的斜向、轻微 overshoot 与圆角偏移底板 | M2 | `a-m2` | `featured-a-m2/a-m2-desktop-1440.png` | `featured-a-m2/a-m2-mobile-390.png` | Medium | Candidate |
| A + M3 | A 的偏轴构图 + Directional 的较强方向性入场 | M3 | `a-m3` | `featured-a-m3/a-m3-desktop-1440.png` | `featured-a-m3/a-m3-mobile-390.png` | Medium | Candidate |
| B — Typography × Media | 大型 SELECTED WORKS、编号与摄影共同平面构图 | 方向性 entrance 基线 | `featured-b-type-composition/FeaturedBTypeComposition.vue` | `featured-b/featured-b-desktop-1440.png` | `featured-b/featured-b-mobile-390.png` | Medium–High | Candidate |
| B + M2 | B 的字体平面 + Soft Settle 的圆角媒体、偏移底板和 settle | M2 | `b-m2` | `featured-b-m2/b-m2-desktop-1440.png` | `featured-b-m2/b-m2-mobile-390.png` | Medium–High | Candidate |
| B + M3 | B 的字体平面 + Directional 的分层方向动效 | M3 | `b-m3` | `featured-b-m3/b-m3-desktop-1440.png` | `featured-b-m3/b-m3-mobile-390.png`、`b-m3-mobile-430.png` | Medium–High | Selected baseline |
| C — Living Media Window | 稳定深色 frame，摄影在窗口内部重新聚焦 | media window / focal settle | `featured-c-media-window/FeaturedCMediaWindow.vue` | `featured-c/featured-c-desktop-1440.png` | `featured-c/featured-c-mobile-390.png` | High | Candidate |

### Design Cards

**A — Editorial Offset**：第一眼落在偏轴摄影，第二眼沿编号和右侧角色信息下移；留白保持画册感，CTA 紧贴内容组。移动端改为右对齐媒体后接内容，不复制桌面负空间。Reduced motion 取消媒体 arrival，仅保留静态 DOM 顺序。

**B — Typography × Media**：第一眼由摄影和超大英文标题共同形成，第二眼落到编号与角色名；B + M3 明确采用 Typography / Media overlap，摄影压入 `SELECTED WORKS` 并在桌面右移。左侧 meta、标题、说明和 CTA 轻微错轴；右下只保留有构图作用的 folio 和细线，删除 prototype manifesto。B + M3 精修后 `SELECTED WORKS` 与 folio `01` 完全静止，Mobile 独立降低 folio 权重；Reduced motion 取消其余 entrance 位移。

**C — Living Media Window**：第一眼是浅色媒体窗口，第二眼是窗口左侧的角色信息；鼠标只改变内部焦点，不抬起整张卡。桌面窗口限制在单屏高度，移动端保持完整竖图安全位；Reduced motion 固定焦点并关闭 clip / transform。

**B 边框说明**：硬矩形媒体框是有意保留的 Swiss / Editorial 选择。内容层不再用负右边距或白底压入媒体；外层媒体窗口始终保持实色背景和 `overflow: hidden`，图片不再水平平移或裁切揭示，只做 opacity、scale 和 settle。B + M2 进一步只保留 scale settle，避免动画结束时图片位置回跳，因此中间帧不会露出背景大字或产生空带。

## 多作品切换

V00 从同一份 `home.featured.items` 真实数据读取最多三项，并为每项选择同一套竖版 webp / fallback 来源。B + M3 提供上一项、下一项显式控制和 `ArrowLeft` / `ArrowRight` 键盘操作；切换循环，按钮 target 至少 44px。当前开发数据库只有一项时，控制仍可重放 previous / next 的相反方向以验证 motion，但不伪造或写入内容；增加第二或第三项后直接切换真实数据。

## Motion Characters

三种 motion 保留独立展示，并只把用户偏好的 M2 / M3 与 A / B 组成四个评审候选；不扩展 C / M1 的组合矩阵：

| Character | 关键差异 | Evidence |
| --- | --- | --- |
| M1 — Restrained Editorial | 5px 级低振幅、260ms、无 overshoot | `motion-m1/` |
| M2 — Soft Settle | 44px 级斜向距离、轻微 9px overshoot、0.96 → 1.012 → 1 scale、偏移底板、680ms | `motion-m2/` |
| M3 — Stronger Directional | B + M3 使用 66 / 40 / 24 / 20 / 10px 的 media、标题、meta、说明、CTA 分层距离；背景字与 folio 完全静止；Next / Previous 真正反向并可中断 | `featured-b-m3/` |

Next / Previous 使用相反方向；快速重复输入先取消旧 WAAPI；Interrupt 保留当前可读 frame；`prefers-reduced-motion` 直接更新静态状态。

## Shared Continuity

`shared-continuity/V00SharedContinuity.vue` 验证 Featured → Detail 的局部 `view-transition-name: v00-shared-work`。入口提供 Native、Fallback、Reduced 和 Interrupt test；浏览器没有 `document.startViewTransition` 时直接导航。证据目录：`implementation/evidence/V00/shared-transition/`。

## Preservation / Isolation

- 代码只在 `app/components/prototypes/v00/**`。
- 页面只由 `nuxt.config.ts` 的 `pages:extend` 在显式 `V00_PROTOTYPES=true` 且非 production 时注册。
- 路由和页面 head 都声明 `noindex, nofollow, noarchive`；正式导航、首页、API、数据库和发布链不变。
- A/B/C 与未选 M1/M2/M3 不互相覆盖，全部候选至少保留到 `GATE-E`；当前评审导航仅展示 B + M3。
- 本轮默认无新增依赖：CSS + WAAPI + 原生 View Transition。

## Customer Review Matrix

| Variant | 第一印象 | 摄影表现 | 品牌辨识度 | 灵动感 | 克制度 | Mobile | 复杂度 | 客户意见 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — Editorial Offset | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | Medium | |
| A + M2 / M3 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | Medium | |
| B — Typography × Media | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | Medium–High | |
| B + M2 / M3 | B + M3 已选 | 待正式实现验证 | 待正式实现验证 | 已选 M3 | 已选 B | 待正式实现验证 | Medium–High | 客户选择 B + M3；桌面媒体右移一列。 |
| C — Living Media Window | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | High | |
| M1 / M2 / M3 | 已录屏，待评审 | 待评审 | 待评审 | 待评审 | 待评审 | 待评审 | Medium | |

## Evidence Files

### Featured screenshots

- `implementation/evidence/V00/featured-a/featured-a-desktop-1440.png`
- `implementation/evidence/V00/featured-a/featured-a-mobile-390.png`
- `implementation/evidence/V00/featured-b/featured-b-desktop-1440.png`
- `implementation/evidence/V00/featured-b/featured-b-mobile-390.png`
- `implementation/evidence/V00/featured-c/featured-c-desktop-1440.png`
- `implementation/evidence/V00/featured-c/featured-c-mobile-390.png`
- `implementation/evidence/V00/featured-a-m2/a-m2-desktop-1440.png`
- `implementation/evidence/V00/featured-a-m2/a-m2-mobile-390.png`
- `implementation/evidence/V00/featured-a-m3/a-m3-desktop-1440.png`
- `implementation/evidence/V00/featured-a-m3/a-m3-mobile-390.png`
- `implementation/evidence/V00/featured-b-m2/b-m2-desktop-1440.png`
- `implementation/evidence/V00/featured-b-m2/b-m2-mobile-390.png`
- `implementation/evidence/V00/featured-b-m3/b-m3-desktop-1440.png`
- `implementation/evidence/V00/featured-b-m3/b-m3-mobile-390.png`
- `implementation/evidence/V00/featured-b-m3/b-m3-mobile-430.png`

### Combined arrival / boundary evidence

- `implementation/evidence/V00/featured-a-m2/a-m2-arrival.webm`
- `implementation/evidence/V00/featured-a-m3/a-m3-arrival.webm`
- `implementation/evidence/V00/featured-b-m2/b-m2-arrival.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-arrival.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-next.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-previous.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-reverse.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-interrupt.webm`
- `implementation/evidence/V00/featured-b-m2/b-m2-boundary-mid-1440.png`（320ms 中间帧；图片 `clip-path: none`，媒体窗口保持不透明）

### Motion evidence

- Static comparison: `implementation/evidence/V00/motion-m1/m1-desktop-1440.png`, `implementation/evidence/V00/motion-m2/m2-desktop-1440.png`
- `implementation/evidence/V00/motion-m1/m1-arrival.webm`
- `implementation/evidence/V00/motion-m1/m1-settle.webm`
- `implementation/evidence/V00/motion-m1/m1-next.webm`
- `implementation/evidence/V00/motion-m1/m1-previous.webm`
- `implementation/evidence/V00/motion-m1/m1-reverse.webm`
- `implementation/evidence/V00/motion-m1/m1-interrupt.webm`
- `implementation/evidence/V00/motion-m2/m2-arrival.webm`
- `implementation/evidence/V00/motion-m2/m2-settle.webm`
- `implementation/evidence/V00/motion-m2/m2-next.webm`
- `implementation/evidence/V00/motion-m2/m2-previous.webm`
- `implementation/evidence/V00/motion-m2/m2-reverse.webm`
- `implementation/evidence/V00/motion-m2/m2-interrupt.webm`
- `implementation/evidence/V00/motion-m3/m3-arrival.webm`
- `implementation/evidence/V00/motion-m3/m3-settle.webm`
- `implementation/evidence/V00/motion-m3/m3-next.webm`
- `implementation/evidence/V00/motion-m3/m3-previous.webm`
- `implementation/evidence/V00/motion-m3/m3-reverse.webm`
- `implementation/evidence/V00/motion-m3/m3-interrupt.webm`

### Shared continuity evidence

- `implementation/evidence/V00/shared-transition/shared-native-forward.webm`
- `implementation/evidence/V00/shared-transition/shared-fallback.webm`
- `implementation/evidence/V00/shared-transition/shared-browser-fallback.webm`
- `implementation/evidence/V00/shared-transition/shared-reduced.webm`
- `implementation/evidence/V00/shared-transition/shared-reduced-preference.webm`
- `implementation/evidence/V00/shared-transition/shared-interrupt.webm`

当前评审只展示已选的 B + M3；V00-F1 baseline 已完成，本轮止于任务文档收口与 Reconciliation，不开始 V01。
