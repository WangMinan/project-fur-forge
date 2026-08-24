# 当前状态：需求4 · 站点视觉升级与内容合规

> **最后校准**：2026-08-24
> **状态**：仅阶段 E 开放。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。

## 当前阶段

阶段 A～D 的产品/工程范围已关闭；阶段 F 及最终发布闭环按 2026-08-21 产品决策关闭，不再作为需求4 backlog。当前唯一开放范围是：

> **阶段 E：UI 美化、布局与响应式优化、Hero 焦点体验、动效质量和人工视觉验收。**

T37～T46-F8 已完成当前工程实现。T47 与 GATE-E 保持开放，用于真实手机、连续逐幕/reduced/performance、可访问性和王旻安/景宸人工视觉验收。

## 状态语义

- `[x]`：已有相应实现或证据；
- `[ ]`：仅阶段 E 中仍开放；
- `[-]`：按产品决策关闭、不再执行，不能解释为生产、独立 Review、真实手机或用户验收已完成。

T35/T36 的 Linux runtime/分发证据与原阶段 F 的 Review、镜像和生产事项不再是活跃 UI 任务；若未来实际发布镜像或部署，仍必须按第三方声明、媒体策略和部署 Runbook 现场核对，不能因 backlog 关闭而跳过运行或法律义务。

## 已实现基线

- 首页固定四幕；桌面 `>=1024px` 为 Hero → 代表作品 → 委托 → 领养 → Footer 逐幕 wheel，1023px 以下原生滚动。
- 代表作品最多 2 件且必须有竖版出厂照；首页 2-4 幕共用同一文字卡组件与同一套栏比/留白骨架（见 [`.design/README.md` §2.5](./.design/README.md)），桌面为「文字卡左—右—左」、主媒体右—左—右，代表作品为并排双竖图且文字卡中只保留唯一 `/works` 按钮，整幕保持一屏；代表作品详情使用直接路由切换，不做竖图到详情舞台的大幅共享形变。`/works` 有出厂照时优先出厂照，完全没有时才回落领养横版封面。
- Header 使用单一 offset；公开非 hash 导航到页头，back/forward 恢复 saved position，hash 让开 Header。
- Hero 横/竖四集合独立，管理端提供画面拖动焦点和水平/垂直滑杆。
- 首页领养只投影一项 `available`；`/adoptions` 按状态 bucket、修改时间和 ID 排序。
- 首页 2-4 幕导语为管理端可编辑字段（`site_content.home_*_lead`，迁移 0048）；章节标题、英文 eyebrow 与按钮文字写死不配置，首页不放防御性表述。
- 领养营业状态已退役（迁移 0049）：只维护委托营业状态，开放程度只有开放/不开放两档，默认开放；首页领养幕与 `/adoptions` 都不再展示营业状态。
- 行动、上传与长任务进度已收敛；OSS 使用真实字节，FFmpeg/未知任务不伪造百分比。
- 两项委托确认、隐私 readiness、人工 retention/单条删除和生成式 notices 已落地。
- 官方联系面为单张联系清单（`ContactChannelList`，邮箱/QQ/QQ群 同卡 hairline 行），`/about` 与 `/commission` 共用；二维码在桌面 fine pointer 收进 hover 浮层，触屏与无跳转链接的行保持常驻。`ContactChannelGrid` 已删除。
- `/adoptions` 卡片与 `/works/{slug}` 详情展示同源的领养价格与状态（价格在状态之前）；详情 work DTO 的 `adoptionStatus`/`price` 为 optional，仅领养作品带，服务端复用既有 snapshot，未新增查询或迁移。

## 阶段 E 后续边界

后续 PR 只做 UI、布局、响应式、可访问性、性能和动效优化。不得恢复退役业务，不新增隐私/安全能力、媒体拓扑、交易能力或部署流程；如确需改变，先由用户重新开放范围。

数据库范围例外（已发生，2026-08-23/24 由王旻安逐次明确授权）：迁移 `0048` 新增首页导语可配置字段，迁移 `0049` 退役领养营业状态并把委托开放程度收敛为两档。除这两条已授权改动外，仍不新增数据库/迁移；后续如再需要，同样必须先取得明确授权。

本轮（2026-08-24）联系面与身份行迭代的设计记录见 [`.design/contact-and-identity-lines/`](./.design/contact-and-identity-lines/)。

视觉权威：[`requirements/SPEC.md`](./requirements/SPEC.md) 与 [`.design/README.md`](./.design/README.md)。最近证据见 [`implementation/evidence/T37-T47-2026-08-21/`](./implementation/evidence/T37-T47-2026-08-21/) 和 [`implementation/evidence/T46-F4-2026-08-21/`](./implementation/evidence/T46-F4-2026-08-21/)。
