# Design Tokens：公开站

> **性质**：阶段 3 的视觉实现契约，不是最终 CSS。阶段 4 将其翻译为 Tailwind/CSS 自定义属性；当前蓝色阶来自景宸例图的可复现聚类，正式 Logo 与授权作品图到位后只做受控校准。
> **设计哲学**：白底编辑型摄影作品集。

## Skill Deviation

design-tokens skill 默认同时生成明暗主题。本项目一期已锁定白色主底，且没有主题切换需求；为避免扩大范围，本文件只定义一期亮色主题和图片覆盖所需的 inverse token，不实现暗色模式。未来增加暗色主题必须重新评估作品摄影、Logo 与可读性。

## Color

以下蓝色阶来自 `../../materials/景宸品牌例图_2026-07-29/blue-palette.json`：深蓝 `#293C84`、主行动蓝 `#324DAF`、中蓝 `#6274BB`、浅蓝 `#CED3E5`、海军蓝 `#1D2D5A`。它们是一期生产基础色，不再使用“雾蓝/淡粉/鼠尾草绿”这类无数值描述；正式 Logo 到位后如需改值，必须保留语义、对比和使用比例并重新视觉审查。

```text
--public-bg-primary:          #FFFFFF
--public-bg-secondary:        #F7F8FA
--public-bg-tertiary:         #F1F3F6
--public-bg-inverse:          #1D2D5A

--public-text-primary:        #20242B
--public-text-secondary:      #626A75
--public-text-tertiary:       #8B929C
--public-text-inverse:        #FFFFFF
--public-text-link:           #324DAF

--public-border-primary:      #DDE1E7
--public-border-secondary:    #ECEEF2
--public-border-focus:        #324DAF

--public-accent-primary:      #324DAF
--public-accent-hover:        #293C84
--public-accent-active:       #1D2D5A
--public-accent-mid:          #6274BB
--public-accent-soft:         #CED3E5

--public-status-open:         #2F7B5C
--public-status-paused:       #8A5A2B
--public-status-neutral:      #626A75
--public-status-error:        #A63D40

--public-overlay-soft:        rgba(17, 20, 25, 0.18)
--public-overlay-strong:      rgba(17, 20, 25, 0.62)
--public-focus-ring:          rgba(50, 77, 175, 0.32)
```

使用规则：

- 页面大面积区域只能使用白色或极浅中性色；中蓝与浅蓝合计不超过单页视觉面积的约 15%。
- 品牌强调色主要用于当前导航、可见焦点、少量状态和主行动，不铺满大区块。
- `#6274BB` 和 `#CED3E5` 不承担白底小字号正文；深色文字与背景组合必须逐项通过对比检查。
- 状态不得只靠颜色；必须有中文文字。
- 图片上的白字只在受控遮罩和逐图对比复核后使用。

## Typography

```text
--font-public-display:
  "Songti SC", "STSong", "Noto Serif CJK SC", serif
--font-public-body:
  "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif
--font-public-mono:
  ui-monospace, "SFMono-Regular", Consolas, monospace

--font-size-xs:   0.75rem
--font-size-sm:   0.875rem
--font-size-base: 1rem
--font-size-md:   1.125rem
--font-size-lg:   clamp(1.25rem, 1.6vw, 1.5rem)
--font-size-xl:   clamp(1.75rem, 3vw, 2.75rem)
--font-size-2xl:  clamp(2.5rem, 6vw, 5.5rem)
--font-size-hero: clamp(2.5rem, 7vw, 6.75rem)

--line-height-tight:   1.08
--line-height-heading: 1.18
--line-height-normal:  1.55
--line-height-relaxed: 1.72

--letter-spacing-tight: -0.025em
--letter-spacing-normal: 0
--letter-spacing-label:  0.08em
```

- 展示衬线只用于品牌名、角色名和少数一级标题；筛选、状态、正文和按钮使用无衬线。
- 不从中国大陆访问不稳定的远程字体服务加载字体；若选定品牌字体，必须自托管并确认许可与子集体积。
- 英文小标签只能辅助中文信息，不成为主要导航含义。

## Spacing

8px 为主要节奏，4px 只用于紧密控件内部。

```text
--space-0:  0
--space-1:  0.25rem
--space-2:  0.5rem
--space-3:  0.75rem
--space-4:  1rem
--space-5:  1.5rem
--space-6:  2rem
--space-7:  3rem
--space-8:  4rem
--space-9:  6rem
--space-10: 8rem
--space-11: 12rem
```

- 桌面图片区块可使用较大垂直节奏，内页标题区必须保持紧凑。
- 规整作品网格的间距统一；返图墙可使用更小间距形成连续摄影感。

## Layout

```text
--public-content-reading: 44rem
--public-content-wide:    90rem
--public-page-padding-mobile: 1rem
--public-page-padding-tablet: 1.5rem
--public-page-padding-desktop: clamp(2rem, 4vw, 4.5rem)

--radius-xs:  0.25rem
--radius-sm:  0.5rem
--radius-md:  0.75rem
--radius-lg:  1rem
--radius-full: 999px

--shadow-raised: 0 0.75rem 2.5rem rgba(25, 31, 42, 0.10)
--shadow-overlay: 0 1.5rem 4rem rgba(25, 31, 42, 0.18)
```

- 作品图不强制统一大圆角；圆角用于保护图片边界而不是制造通用卡片感。
- `radius-full` 仅用于状态、筛选和圆形控制，不用于所有按钮和容器。
- 默认无阴影；只对覆盖层、悬浮导航或需要明确层级的控件使用。

## Image Tokens

```text
--ratio-work-card:    3 / 4
--ratio-work-hero:    16 / 9
--ratio-design-sheet: auto
--ratio-avatar:       1 / 1

--image-hover-scale:  1.02
--hero-min-height:    100svh
--image-placeholder:  #F1F3F6
```

- 主体焦点和裁切来自 EXIF 修正后的归一化坐标。
- 首页、作品详情和委托宽图分别校准桌面/手机安全区；不共用一个居中裁切假设。
- 图片容器预留宽高/比例，避免 CLS。

## Motion

```text
--duration-instant:  50ms
--duration-fast:     150ms
--duration-normal:   250ms
--duration-section:  400ms
--duration-hero:     750ms

--easing-standard: cubic-bezier(0.22, 1, 0.36, 1)
--easing-exit:     cubic-bezier(0.4, 0, 1, 1)
--distance-subtle: 0.75rem
```

- 一般反馈 150–300ms，区块进入 250–450ms，首屏 600–900ms。
- 同一视口只保留一个主要运动焦点；优先 `transform` 与 `opacity`。
- 减少动效时将位移、缩放和自动过渡归零，保留必要状态反馈。

## Breakpoints and Test Viewports

```text
--breakpoint-sm:  390px
--breakpoint-md:  768px
--breakpoint-lg:  1024px
--breakpoint-xl:  1280px
--breakpoint-2xl: 1536px
```

视觉回归固定使用 `390 × 844`、`768 × 1024`、`1440 × 900`；Windows 1080p/2K/4K 另记录实际 CSS viewport。
