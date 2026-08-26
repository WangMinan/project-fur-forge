# T47 Evidence Index

日期：2026-08-26

范围：连续移动、反向/中断、autoplay、输入模态、Reduced Motion、响应式边界、性能、媒体解码、safe area、输入法、焦点与 Homepage 离场回归。

状态：20 项本地/自动化 hard checks 全部通过；`realDeviceManual` 明确保留为 GATE-E 用户真机验收，不由 Agent 代签。

## Evidence

- `audit.json`：390×844、430×932、768×1024、1023×900、1024×900、1440×900 六档结构、轮播、输入、偏好、性能和路由回归结果。
- `interrupt-390x844.webm`、`interrupt-1440x900.webm`：Hero、Featured、Homepage Adoption 连续 next/previous/interrupt 录屏。
- `home-boundary-1023x900.png`、`home-boundary-1024x900.png`：原生滚动与桌面逐幕边界。
- `home-reduced-390x844.png`：Reduced Motion 终态。
- `commission-mobile-390x844.png`、`commission-apply-desktop-1440x900.png`：输入与布局抽查。
- `works-after-home-transition-1280x800.png`：Homepage 非 Hero scene → Works 离场回归；旧 scene 最大位移为 0。
- `home-adoption-footer-tightened-390x844.png`：用户交接前追加的 Mobile Adoption 尾部收束；行动到底部 Footer 约 19px，Footer 组件未改。

## Final Checks

- 无运行时错误、无水平溢出、响应式导航和 safe-area 策略：通过。
- Hero/Featured/Homepage Adoption 方向、反向、中断、单一活跃媒体与 compositor-friendly properties：通过。
- 4s autoplay：三幕通过；Hero/Featured pause/resume 通过。
- Homepage Adoption：独立上一项/下一项/分页线/暂停控制条为 0，真实 folio 为 1，下方三项角色选择可点击；autoplay、swipe、键盘方向保留。
- Reduced Motion：autoplay 停止、手动切换进入可靠终态、无残留动画：通过。
- Desktop scene 顺序/反向/锁定与 1023px 以下原生滚动逃生：通过。
- Skip link、focus-visible、Mobile Nav focus trap/restore、中文 IME、reduced transparency、more contrast：通过。
- 图片 decode、CLS、LCP、long task 与 Homepage 离场位移：通过；本次采样 CLS 0、失败图片 0、long task 0、旧 scene 位移 0。
- `pnpm check:fast`：lint、Nuxt typecheck、53 个 core 测试文件 / 314 项测试全部通过。

## Boundary

- 本索引不代签真实 iOS/Android、最终人工观感、GATE-E、远程 CI、部署或生产状态。
- Hero drag 仍未实施；没有为 T47 新增依赖、Schema、迁移或业务字段。
