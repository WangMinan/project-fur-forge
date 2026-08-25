# V00-F1 · Homepage Featured Works Visual Baseline Handoff

日期：2026-08-23  
选择：`B + M3（Typography × Media + Directional）`  
范围：仅 dev-only V00 Prototype；正式 Homepage、Hero、API、数据库、依赖和 V01 均未修改。

## Completed

- 将客户选择的 B + M3 精修并冻结为 `Homepage Featured Works Visual Baseline`。
- 翻页控制删除 pill border / background，改为箭头、文字与状态细线；保留 44px target、键盘、触控和可见 focus，hover 只做轻微方向位移。
- 左侧 meta 向左错轴，说明和 CTA 向右缩进，控制条使用独立轴线，降低标准 CMS 字段排列感。
- Desktop 选择明确 overlap：摄影压入 `SELECTED WORKS` 的空间；Mobile 重新构图，不复制 Desktop 负空间。
- 删除 prototype manifesto，只保留有构图作用的 folio 与结构细线。
- Mobile folio 使用独立 `opacity: 0.14`，优先级稳定为摄影 > 中文标题 > 内容 / CTA > folio / 背景 Typography。
- `SELECTED WORKS` 与 folio `01` 从 arrival、Next、Previous、reverse、interrupt 中完全移除，始终静止。
- 修复文字 entry delay 期间的一帧闪动：WAAPI entry 使用 `fill: both`，延迟期间保持透明起始帧。

## Motion Hierarchy

| Layer | Entry distance | Delay | Duration | 作用 |
| --- | ---: | ---: | ---: | --- |
| Media | 66px | 0ms | 440ms | 主要 directional carrier；2px 克制 settle，0.994 → 1.001 → 1 |
| 中文标题 | 40px | 45ms | 370ms | 明确跟随方向，振幅小于摄影 |
| Meta | 24px | 80ms | 300ms | 次级跟随 |
| 说明 / 物种 | 20px | 100ms | 310ms | 阅读内容后到位 |
| CTA | 10px | 150ms | 300ms | 位移最小、最后落位 |

Next 先向左退出、从右进入；Previous 完整反向。新输入从当前 computed frame 接管，旧 WAAPI 经 `commitStyles()` 后取消，递增 run id 阻止旧 Promise 改写最终状态。

## Evidence

- `implementation/evidence/V00/featured-b-m3/b-m3-desktop-1440.png`（1440 × 900）
- `implementation/evidence/V00/featured-b-m3/b-m3-mobile-390.png`（390 × 844）
- `implementation/evidence/V00/featured-b-m3/b-m3-mobile-430.png`（430 × 932）
- `implementation/evidence/V00/featured-b-m3/b-m3-arrival.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-next.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-previous.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-reverse.webm`
- `implementation/evidence/V00/featured-b-m3/b-m3-interrupt.webm`

## Verification

- Edge / Playwright 1440×900、390×844、430×932：图片 `768×1024` 解码成功，无正向水平溢出。
- Previous / Next 两个 target 在三个视口均为 `51.3125×44px`。
- Touch tap、Enter、ArrowLeft、ArrowRight 均触发正确方向。
- Next 最大采样振幅：Media 53.4px、Title 40px、Meta 24px、Description 20px、CTA 10px；Previous 符号完整反向，层级不变。
- Reverse / interrupt 完成后五层均为 `state=idle`、`transform: none`、无 inline transform、0 animations。
- Reduced Motion 点击切换后五层均为 `transform: none`、0 animations。
- `SELECTED WORKS` 与 folio 在 Desktop / 390 / 430 均为 `transform: none`、`animation-name: none`、0 animations；翻页期间 X/Y 最大位移为 0。
- 定向 ESLint 与 `pnpm typecheck` 通过。
- 五段 WebM 均由本地 `ffmpeg-static` 完整解码，exit code 0。

## Locked Decisions

- B + M3 是 Homepage Featured Works 的视觉基准，不是全站版式模板。
- 摄影 > 中文标题 > Meta / Description > CTA 是 motion 与阅读层级。
- `SELECTED WORKS` 与 folio 完全静止。
- Mobile folio 必须独立降权；Desktop / Mobile 允许不同视觉参数。
- Previous / Next 保持轻量画册式形式和至少 44px target。
- 当前原生 CSS + WAAPI 足够，不安装 motion 依赖。

## Open Issues

- 当前开发数据库只有一项 Featured Work；控制只重放正反方向，不伪造第二项。正式 V03 仍需用真实 1 项 / 2 项数据验证。
- V00 baseline 尚未进入正式 `FeaturedWorks.vue`；该工作属于 V03。
- 真实手机和客户最终视觉签字仍属于后续任务 / GATE-E。

## Regression Risks

- 把背景 Typography 或 folio 重新加入 `data-motion-layer` 会恢复不必要的晃动。
- 改回 `fill: forwards` 会使延迟中的文字再次闪动。
- 统一 Desktop / Mobile folio opacity 会破坏 Mobile 的焦点层级。
- 在正式 Homepage 机械复制 B + M3 轴线会让各 Scene 同质化。

## Next Task

`V01 · Hero Art Direction & Homepage Opening Continuity`。

## Do Not Start Yet

- V02 Commission / Adoption Scenes
- V03 Homepage Overall Scene Composition & Continuity
- V04 Homepage Mobile / Responsive Structural Pass
- V05–V12
- T47 / GATE-E

本轮到此停止，未开始 V01。
