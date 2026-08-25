# 2026-08-24 · Task Reconciliation Reset

> 状态：V08-F3 已完成；必须停在 `GATE-V08-R · 凌巽方向重置人工验收`。
> 范围：只重排阶段 E 的视觉任务；不改变 Footer、冻结的首页中文品牌字、业务逻辑或媒体拓扑。

## 本轮完成

- 首页品牌字刷新问题已重新收口：凌巽确认 `.home-hero__title` 的一次性 clip/位移入场属于应保留的设计，不应被当作 bug 删除。现已原样恢复 V01 的 `560ms + 180ms delay` 动画；关键字体继续 preload，并用 `font-display: block` 阻止 fallback 字形先绘制，验收改为“入场保留、终态稳定、无字体替换闪动”。
- `HERO_AUTOPLAY_INTERVAL_MS` 已由 `10_000` 改为 `4_000`；暂停/恢复、页面隐藏和 reduced-motion 仍经过同一共享逻辑。
- 图片填充异常并非 DOM/CSS：390 正确选择 `commission-hero-portrait`，1440 正确选择 `commission-hero-landscape`，图片与容器均为 `100% × 100%`、`object-fit: cover`；但本地全量测试数据的 Hero 衍生物自身已被写入纯色补边。已从六张无边原图按现有 focal 重建 44 个当前启用 Hero 本地变体并同步本地 SHA-256/字节数；两张截图对应横图的像素采样从左右各 15/192 列纯色补边变为 0。正式 OSS `m_fill` 配方、媒体拓扑和依赖 `contain` 的领养/详情消费者均未改。

## 当前判断

以下页面已有可用布局、响应式和基本可访问性，但仍主要停在“排版优化/局部收口”层级，尚未满足新的“全站统一但有独立 scene identity”的重设计目标：

- Featured Works：已吸收部分 V00 B+M3，但正式 scene 仍未完整承接 Type × Media、控制器与分层 directional motion。
- Commission：已有媒体 Hero 和内容分区，但仍接近信息栏加摄影，尚未形成完整的 Service Narrative。
- Adoption：已有 `contain` 画布和信息卡，但尚未形成角色档案/展示 scene。
- 作品目录/详情、关于/联系、委托申请、服务、隐私、许可证、空态和错误页：已有一致性清理，不应被误认为已经完成重设计。

Footer 不在上述重开范围内；首页首屏“有点小狗工作室”的最终字体、字号、位置、间距和构图同样冻结。

## 重开任务与顺序

| 顺序 | 任务 | 原因 | 完成证据 |
| --- | --- | --- | --- |
| 1 | V09 Shared Visual Language + Featured B+M3 | Featured 是 V00 原型和全站语法的锚点，先确定摄影、Typography、控制器与 4s 轮播如何在正式页面成立。 | Desktop、390/430、Keyboard/Touch/Reduced、arrival/next/previous/reverse/interrupt、handoff |
| 2 | V10 Commission Service Narrative | 在 V09 语法稳定后，把它变形成更强转化导向的委托 scene，避免复制 Featured。 | 全视口、横竖媒体、状态/行动、输入/reduced、handoff |
| 3 | V11 Adoption Character Display | 以完整设定图为硬约束，建立角色档案 scene，避免退回普通商品栏。 | 全视口、搜索/路由回归、输入/reduced、handoff |
| 4 | V12 Remaining Public Scenes & System Reconciliation | 让其余公开状态承接同一语言但保留 identity，并统一控件与可访问性。 | 11 个独立状态、重定向、Footer 邻接、输入/reduced、handoff |
| 5 | T47 / GATE-E | 只在全部 scene 完成后做连续性、性能与最终人工验收。 | 跨页面、真实设备（可用时）与人工验收 |

## 设计约束

- Shared Visual Language 不是全站套同一模板：每个 scene 可以改变媒体构图、背景层、版式和控制器位置，但都应承接明确层级、摄影 anchor、editorial framing 与克制的方向性反馈。
- Featured 必须更接近 V00 B+M3，而非只加背景字；自动轮播若启用，默认 4s 且可暂停。
- Commission、Adoption 与其余公开页面必须是 scene-level redesign，不是仅调字号、间距或颜色。
- 每个任务都必须留下 evidence 与 handoff；默认使用现有 CSS/WAAPI/组件，只有原生方案出现可复现缺口时才评估依赖。

## 唯一下一任务

在凌巽通过 `GATE-V08-R` 后，唯一允许开始的是 **V09 · Shared Visual Language Contract & Featured Works B+M3 Production Scene**。它先把全站共同语法落实到最强、最可审查的锚点，再让 Commission、Adoption 与其余页面以不同强度变体承接，避免再次出现“Hero 概念化、后续页面普通”的断层。

## 现在不要开始

- 不开始 V09–V12、T47 或 GATE-E。
- 不修改 Footer、首页冻结的中文品牌字、业务逻辑、数据库、媒体拓扑或正式部署配置。
- 不把本轮 screenshot/evidence 视为全站重设计完成或人工验收代签。
