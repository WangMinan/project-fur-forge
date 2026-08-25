# V08-F3 · Bug Fix Report

> 日期：2026-08-24  
> 证据：[`implementation/evidence/V08-F3/after/`](../evidence/V08-F3/after/)  
> 状态：三项问题均已修复并重新取证；等待 `GATE-V08-R` 人工验收。

## 1. 首页品牌字刷新闪动

关键 WOFF2 已 preload，`@font-face` 使用 `font-display: block`，字重范围也匹配；这条链路负责阻止 fallback 字形先绘制后再替换。上一版修复把 `.home-hero__title` 主动执行的 560ms 入场动画误判为闪动并整体删除，超出了 bug 修复范围。

凌巽在 2026-08-24 的验收反馈中明确该动画属于应保留的设计。现已从本地构建缓存原样恢复 V01 的 `560ms + 180ms delay` 标题入场：从 `opacity: 0`、`clip-path: inset(0 0 22% 0)`、`translateY(10px)` 进入冻结终态。最终字体、字号、字重、位置、间距和构图均未修改；换图不会重播，reduced-motion 仍直接显示终态。

新的刷新审计同时确认：

- 正常动效下 `animationName` 为 `home-hero-title-in-*`；
- 动画开始前关键字体已经处于 `loaded`，且 `document.fonts.check(...)` 为 `true`；
- 动画结束后 `opacity: 1`、clip 归零、transform 归零；
- reduced-motion 下标题无动画；
- 字体仍为 `Zhuohei Collage Critical` 优先。

## 2. 图片无法填满展示区域

### 根因

页面链路本身是正确的：390 使用 `commission-hero-portrait`，1440 使用 `commission-hero-landscape`；图片、`<picture>` 与媒体容器等大，`object-fit: cover`，无水平溢出。真正的问题在本地全量测试媒体：3:2 横图与 2:3 竖图曾按 `contain + pad` 生成，纯色补边已经写进 JPEG/WebP 像素，因此 CSS `cover` 无法消除。

原始 7008×4672 / 4672×7008 文件没有补边；当前正式配方仍使用 OSS `resize,m_fill`。本轮没有修改 Vue、`ResponsivePicture`、上传契约或正式媒体拓扑。

### 修复

- 从六张原图按数据库现有 focal 重建当前启用 Hero 的 44 个本地 `site-display-v2` 横/竖、JPEG/WebP 变体；
- 同步本地 `asset_variants.sha256`、`byte_size` 与 `updated_at`，保持本地文件和校验元数据一致；
- 修复前数据库与 44 个衍生物备份在忽略 Git 的 `.data/backups/v08-f3-site-display-cover-20260824/`；
- 未触碰首页业务入口、领养设定图或详情图集的 `contain` 规则。

### 运行时结果

| 视口 | 资源 | 图片尺寸 | 媒体容器 | 结果 |
| --- | --- | --- | --- | --- |
| 1440×900 | `commission-hero-landscape` | 1309.8125×608 | 1309.8125×608 | 解码成功、`cover`、无溢出、无像素补边 |
| 390×844 | `commission-hero-portrait` | 343×640 | 343×640 | 解码成功、`cover`、无溢出、无上下补边 |

像素级证据同时检查截图对应的委托横图和首页第二张横图：修复前左右纯色边带均为 `15 + 15 / 192` 采样列，修复后均为 `0 + 0 / 192`。这补上了旧 audit 只检查 DOM 几何、无法发现图片内部补边的缺口。

## 3. 轮播间隔统一为 4s

共享 `HERO_AUTOPLAY_INTERVAL_MS` 已由 `10_000` 改为 `4_000`。Hero 继续复用原有 `resolveAutoplayIntervalMs()`、暂停/恢复、页面隐藏暂停和 reduced-motion 停止逻辑；未来 Featured 自动轮播任务也已在 V09 中规定复用 4s 默认值。

浏览器实测：

- 默认自动轮播从索引 0 推进到 1；
- 暂停后等待 4.3s，索引仍为 1；
- 恢复后 4024ms 从索引 1 切换到 0；
- reduced-motion 下标题无动画，轮播停止规则保持不变。

## Evidence

- `home-1440x900.png`
- `home-390x844.png`
- `home-second-1440x900.png`
- `home-second-390x844.png`
- `commission-1440x900.png`
- `commission-390x844.png`
- `review-home-{desktop-1280,tablet-768,mobile-375}.png`
- `review-commission-{desktop-1280,tablet-768,mobile-375}.png`
- `home-refresh-title-stability.webm`
- `hero-4s-autoplay-pause-resume.webm`
- `audit.json`

## Stop Gate

本轮没有开始 Featured、Commission、Adoption 或其余公共页面的下一阶段视觉重构。下一步仍是 `GATE-V08-R · 凌巽方向重置人工验收`；只有凌巽确认 TASKS 顺序正确并明确允许继续后，才可开始 V09。
