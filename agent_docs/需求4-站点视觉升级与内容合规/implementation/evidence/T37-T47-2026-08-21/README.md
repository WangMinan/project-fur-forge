# 阶段 E 本地证据索引

> 日期：2026-08-21  
> 分支：PR #21 `codex/r4-t04-t21-foundation`  
> 边界：以下均为本地/隔离浏览器证据，不代签真实手机、王旻安/景宸人工验收、独立 Review 或生产状态。

## T37

- 动效机会与拒绝清单：`../../../.design/MOTION_OPPORTUNITIES.md`。

## T38 / T38-F1

- 五视口、无 JavaScript、用户反馈、双营业状态与水合时间序列：`t38-static/README.md`。

## T39 / T40

- `r3-hero-collection-publication` + error reason focused core：2 files / 9 tests 通过。
- 核心不变量覆盖：未启用 item 的 collection + asset 双 CAS、任意浮点焦点精度、共享 asset 冲突阻断、停用清理后按新焦点生成不重用旧 Key 的不可变公开变体。
- 历史首版隔离 Playwright：登录管理端、上传 3840×2160 横图、九宫格从中心改为右上、创建 item、重新读取 100% / 0%、按钮 pressed 与预览 `object-position: 100% 0%`，1/1 通过。
- 历史截图：`t39-t40-admin-hero-1440x900.png`。用户随后否决九宫格，当前 T40-F1 改为可拖焦点与双滑杆；该截图只证明当时双 CAS/焦点写入成立，不代表当前 UI。

## T41

- `t41-input-reduced.json`：pointer/keyboard intent、reduced-motion 10.6 秒 autoplay 停止与手动切换、reduced-transparency/contrast 媒体特性结果。
- `t41-reduced-motion-390x844.png`：reduced-motion 下的移动 Hero 静态画面。
- 旧公共端 duration/easing 与 620/680ms 扫描为零；drag 未实施。
