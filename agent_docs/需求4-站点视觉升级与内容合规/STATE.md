# 当前状态：需求4 · 站点视觉升级与内容合规

> **最后校准**：2026-08-21
> **状态**：仅阶段 E 开放。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。

## 当前阶段

阶段 A～D 的产品/工程范围已关闭；阶段 F 及最终发布闭环按 2026-08-21 产品决策关闭，不再作为需求4 backlog。当前唯一开放范围是：

> **阶段 E：UI 美化、布局与响应式优化、Hero 焦点体验、动效质量和人工视觉验收。**

T37～T46-F4 已完成当前工程实现。T47 与 GATE-E 保持开放，用于真实手机、连续逐幕/reduced/performance、可访问性和王旻安/景宸人工视觉验收。

## 状态语义

- `[x]`：已有相应实现或证据；
- `[ ]`：仅阶段 E 中仍开放；
- `[-]`：按产品决策关闭、不再执行，不能解释为生产、独立 Review、真实手机或用户验收已完成。

T35/T36 的 Linux runtime/分发证据与原阶段 F 的 Review、镜像和生产事项不再是活跃 UI 任务；若未来实际发布镜像或部署，仍必须按第三方声明、媒体策略和部署 Runbook 现场核对，不能因 backlog 关闭而跳过运行或法律义务。

## 已实现基线

- 首页固定四幕；桌面 `>=1024px` 为 Hero → 代表作品 01 → 代表作品 02 → 委托 → 领养 → Footer 逐幕 wheel，1023px 以下原生滚动。
- Header 使用单一 offset；公开非 hash 导航到页头，back/forward 恢复 saved position，hash 让开 Header。
- Hero 横/竖四集合独立，管理端提供画面拖动焦点和水平/垂直滑杆。
- 首页领养只投影一项 `available`；`/adoptions` 按状态 bucket、修改时间和 ID 排序。
- 行动、上传与长任务进度已收敛；OSS 使用真实字节，FFmpeg/未知任务不伪造百分比。
- 两项委托确认、隐私 readiness、人工 retention/单条删除和生成式 notices 已落地。

## 阶段 E 后续边界

后续 PR 只做 UI、布局、响应式、可访问性、性能和动效优化。不得恢复退役业务，不新增数据库/迁移、隐私/安全能力、媒体拓扑、交易能力或部署流程；如确需改变，先由用户重新开放范围。

视觉权威：[`requirements/SPEC.md`](./requirements/SPEC.md) 与 [`.design/README.md`](./.design/README.md)。最近证据见 [`implementation/evidence/T37-T47-2026-08-21/`](./implementation/evidence/T37-T47-2026-08-21/) 和 [`implementation/evidence/T46-F4-2026-08-21/`](./implementation/evidence/T46-F4-2026-08-21/)。
