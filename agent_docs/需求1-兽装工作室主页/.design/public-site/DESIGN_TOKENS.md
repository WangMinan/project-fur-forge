# Design Tokens：公开站

> **设计哲学**：白底、摄影优先、品牌蓝克制使用。OSS 预生成图片是唯一媒体来源。
> **状态**：阶段 E/F 延续的公开端 Token。媒体身份为 `recipe-v2`（作品保护）、`site-display-v1`
> （站点展示无水印）与 `return-display-v1`（返图无水印）。
> **最后校准**：2026-08-07。

## Color

```text
--public-bg-primary:       #FFFFFF
--public-bg-secondary:     #F7F8FA
--public-bg-tertiary:      #F1F3F6
--public-bg-inverse:       #1D2D5A

--public-text-primary:     #20242B
--public-text-secondary:   #626A75
--public-text-tertiary:    #8B929C
--public-text-inverse:     #FFFFFF
--public-text-link:        #324DAF

--public-border-primary:   #DDE1E7
--public-border-secondary: #ECEEF2
--public-border-focus:     #324DAF

--public-accent-primary:   #324DAF
--public-accent-hover:     #293C84
--public-accent-active:    #1D2D5A
--public-accent-decorative: #6274BB
--public-accent-tint:      #CED3E5

--public-status-open:      #2F7B5C
--public-status-paused:    #8A5A2B
--public-status-neutral:   #626A75
--public-status-error:     #A63D40

--public-overlay-soft:     rgba(17, 20, 25, 0.18)
--public-overlay-strong:   rgba(17, 20, 25, 0.62)
--public-focus-ring:       rgba(50, 77, 175, 0.32)
```

使用比例：

- 白色、极浅中性色和作品图承担至少约 85% 的页面面积；
- 明显蓝色常态 5%–10%，硬上限 15%；
- `#6274BB` 与 `#CED3E5` 不承担白底小字号正文；
- 不使用蓝色渐变，不连续堆叠蓝底区块，不给每张卡片铺浅蓝底；
- 图片上的白字只在受控遮罩和逐图对比检查后使用。

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

展示衬线只用于少数标题。当前字体方案已在阶段 C 的真实素材与三视口人工验收中确认，
阶段 E/F 不重开字体体系讨论。

## Spacing

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

8px 为主要节奏，4px 只用于紧密控件内部。图片网格间距统一；返图墙可更紧密。

## Layout

```text
--public-content-reading: 44rem
--public-content-wide:    90rem
--public-page-padding-mobile: 1rem
--public-page-padding-tablet: 1.5rem
--public-page-padding-desktop: clamp(2rem, 4vw, 4.5rem)

--radius-xs: 0.25rem
--radius-sm: 0.5rem
--radius-md: 0.75rem
--radius-lg: 1rem
--radius-full: 999px

--shadow-raised: 0 0.75rem 2.5rem rgba(25, 31, 42, 0.10)
--shadow-overlay: 0 1.5rem 4rem rgba(25, 31, 42, 0.18)
```

- 作品图不强制统一大圆角；
- `radius-full` 只用于状态、筛选和圆形控制；
- 默认无阴影，覆盖层或悬浮控件才使用。

## Image Presentation

```text
--ratio-work-card: 3 / 4
--ratio-work-hero: 16 / 9
--ratio-design-sheet: auto
--ratio-return-item: auto
--hero-min-height: 100svh
--image-placeholder: #F1F3F6
--image-hover-scale: 1.02
```

### 返图墙（`return-display-v1`，无水印）

```text
--return-columns-desktop: 4      /* >=1280px */
--return-columns-tablet:  3      /* 768-1279px */
--return-columns-mobile:  2      /* 340-767px */
--return-columns-narrow:  1      /* <340px */

--return-gap-mobile:  12px
--return-gap-tablet:  16px
--return-gap-desktop: 20px

--return-radius:          12px   /* 允许区间 10-14px */
--return-caption-gap:     8px
--return-caption-size:    var(--font-size-sm)
--return-caption-color:   var(--public-text-secondary)
--return-page-size:       24
```

- 返图保持原始宽高比，不使用 `--ratio-work-card` 强裁；
- 返图项默认无边框、无阴影、无彩色外壳、无渐变叠字；
- `/returns` 墙面不显示 caption；`--return-caption-gap` 仅作为历史兼容 Token，不得据此恢复墙面文字；
- 每项只有一个主链接指向 `/works/{slug}`，避免嵌套链接。

当前公开媒体身份分三族，互不混用（唯一事实源见
[`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)）：

```text
作品保护  recipe-v2         protection_mode=watermark  活动 brand-centered-v2
  card:   3:4,            480 / 768 / 1200
  detail: original ratio, 960 / 1600 / 2400
  design-sheet: original ratio, 960 / 1600 / 2400

站点展示  site-display-v1   protection_mode=none       无水印
  home-hero-landscape / commission-hero-landscape: 16:9, 768 / 1280 / 1920
  home-hero-portrait  / commission-hero-portrait:  9:16, 480 / 768 / 1080
  home-entry-commission / home-entry-adoption:     3:2,  480 / 768 / 1080

返图展示  return-display-v1 protection_mode=none       无水印
  return-wall: original ratio（不强裁），480 / 768 / 1080
```

```text
format: WebP + one source-compatible fallback
```

- 组件只选择已有 variant；不得添加转换查询参数；
- 默认使用原生 `<picture>`；`@nuxt/image` 只有在测试证明 URL 与像素均不被改写时才可使用，否则不引入；
- 只生成实际用途，不默认生成所有比例；
- 容器预留比例，避免 CLS；
- 焦点/安全区分别保存桌面与手机数据。

## Motion

```text
--duration-instant: 50ms
--duration-fast: 150ms
--duration-normal: 250ms
--duration-section: 400ms
--duration-hero: 750ms
--easing-standard: cubic-bezier(0.22, 1, 0.36, 1)
--easing-exit: cubic-bezier(0.4, 0, 1, 1)
--distance-subtle: 0.75rem
```

同一视口只保留一个主要运动焦点；减少动效时归零非必要位移、缩放和自动过渡。

## Breakpoints and Review Viewports

```text
--breakpoint-sm:  390px
--breakpoint-md:  768px
--breakpoint-lg:  1024px
--breakpoint-xl:  1280px
--breakpoint-2xl: 1536px
```

固定视觉回归：390 × 844、768 × 1024、1440 × 900。蓝色面积采用截图人工审查，不要求实现脆弱的自动像素百分比测试。
