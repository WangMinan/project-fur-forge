# TASKS：首页摄影集式改版（阶段 E 本轮迭代）

> **日期**：2026-08-23　**分支**：`codex/r4-e-home-photoset-refresh`
> **依据**：`./DESIGN_BRIEF.md`（定稿方向经用户当日逐轮实画面确认）；上位任务权威仍是 `implementation/TASKS.md`（本文件不勾选 T47/GATE-E）。
> **规则**：`[x]` 已实现并有本地证据；`[ ]` 待做。

- [x] **R0 · 代表作品上限 2→3**：`PUBLIC_FEATURED_LIMIT=3`，server 校验/管理端提示/公开投影共用同一常量自动跟随；`work-management` 集成测试改为三件成立、第四件拒绝。**暂缓**：实际引入第三件作品由用户后续在管理端决策（用户 2026-08-23 指示不着急）。
- [x] **R1 · 三幕统一「题注行 + 居中图版」骨架**：幕高 `100svh − Header`、网格行 `auto / minmax(14rem, 1fr)`；题注行通栏（标题左、文案与按钮右端两行）；移除桌面 `--home-scene-media-height` 的 svh 猜测；1440 矮视窗不再溢出。
- [x] **R2 · 三幕媒体严格等高**：`--scene-media-height = min(图版余高, 三竖图均分宽 ÷ 0.75)`；第二幕 1～3 张 3:4 竖图等高居中；三四幕媒体 = 等高 × 16:9 居中。实测 1440×709 三幕媒体均 485px。
- [x] **R3 · 文案行同号同轴**：lede 内全部 `--font-size-sm`、flex 行内居中、无前导 `·`；`HomeBusinessStatus` 的 tone 去掉 `<small>` 字号差；领养幕 `WorkIdentityLabel` 名称/物种在首页上下文拉平到同族同号，只靠颜色区分；目录卡片不受影响。
- [x] **R4 · 统一进入动效与 hover**：三幕图版同一 clip+scale 进入（media 720ms standard），题注行 content 420ms 延后 90ms；hover 统一 `scale(1.025) rotate(0.3deg)` / state 180ms / 仅 fine pointer；reduced 只留 state opacity；无 JS 默认可见。
- [ ] **R5 · 真实浏览器八视口验收**：1440×740（主）、1440×900、1280×800、1024×900、1023×900、768×1024、430×932、390×844 逐幕截图；一幕一视窗、wheel 顺序/反向/锁定、console/network、reduced、无 JS；证据存 `./screenshots/after-*.png`。**等用户确认当前构图后继续。**
- [ ] **R6 · 回归验证**：`check:fast`；必要时修正受影响 core/smoke；不为全绿回退产品行为。
- [ ] **R7 · 收口**：提交小而可审查的 commit；按实装回填 STATE/相关文档差异说明。

边界（不做）：Hero 主标题与轮播、四幕顺序、聚合 DTO/接口、既有文案、媒体投影、数据库、部署；不新增营销文案；不恢复 `01/02` 页次与横向轨道；不替用户添加第三件代表作品数据。
