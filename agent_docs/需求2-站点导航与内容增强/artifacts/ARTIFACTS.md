# 产物索引

> **最后校准**：2026-08-13。
> **状态**：阶段 0～3 文档已锁定；阶段 4/5 已完成 T01～T16、T15-F1～T15-F4 与 T17-F1，等待 T16-R1 和 T17 用户验收。

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 地基 | 产品地基 | `foundation/README.md` | 已锁定 | 增量范围、安全与非目标 |
| 1 规格 | 需求规格 | `requirements/SPEC.md` | 已锁定 | 五组功能与验收契约；T17-F1 已实现，等待新 SHA 独立复查 |
| 2 计划 | 实施计划 | `planning/PLAN.md` | 已决策 | OQ-001 已选择方案 B |
| 3 任务 | 任务清单 | `implementation/TASKS.md` | 待验收 | GATE-01、T01～T16、T15-F1～T15-F4、T17-F1 已关闭；T16-R1/T17 开放 |
| 4 实施 | 实施记录 | `implementation/notes/README.md` | 已完成 | T01～T15、预验收修正与 T17-F1 已记录 |
| 5 评审 | 评审记录 | `review/REVIEW.md` | 已完成 | 初次 NOT PASS 的三组文档 findings 已修复；最终 PASS WITH USER FOLLOW-UP |
| 6 闭环 | 模型说明 | `models/README.md` | 已落地 | contact、FAQ、搜索与方案 B 动态均已落地并通过独立 Review |
| 6 闭环 | 当前状态 | `STATE.md` | 当前 | T17-F1 已关闭，下一步为 T16-R1 与 T17 用户验收 |

## 外部与既有资料

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 用户截图 | `codex-clipboard-999adc84-8505-4550-a501-e1de32220eaf.png`（会话附件） | 当前联系区布局事实 |
| 历史联系页截图 | `../需求1-兽装工作室主页/planning/prototype-v1/screenshots/desktop-contact-v5.png` | 既有桌面视觉参考 |
| 图片示例 | `../需求1-兽装工作室主页/materials/picture-examples/` | 作品、返图、领养和工作室 Logo 参考 |
| T01 规划基线 | commit `de2b708` | 创建需求2文档与 T01 计划 |
| T01 实现 | commit `e573760` | 修改共享公开导航数据并增加定向 E2E |
| T01 E2E 修复 | commit `a38c295` | 修复 hover 残留与作品筛选同名链接定位 |
| T01 远端门禁 | Actions run `31515689322` | 169 unit、172 integration、222 E2E；checks/image-build/e2e 全部成功 |

## 实施产物

- T01：`app/utils/public-nav.ts` 合并“委托”父项，复用既有桌面/移动 children 渲染；
- T01：`tests/e2e/public-information.spec.ts` 增加父项激活、hover/focus、圆角、路由和移动入口断言；
- T01：`tests/e2e/public-works.spec.ts` 把作品用途筛选定位收窄到“按用途筛选”分组，避免与导航/页脚“委托”同名链接冲突；
- T01 记录：[`../implementation/notes/T01-NAVIGATION-2026-08-12.md`](../implementation/notes/T01-NAVIGATION-2026-08-12.md)。
- T02：`site_content.official_channels_json`、固定五平台 Schema/DTO、contact 局部保存与安全公开投影；
- T02：迁移 `0027_requirement_2_contact_channels.sql` 保留邮箱并迁移旧 QQ/抖音；
- T02 记录：[`../implementation/notes/T02-CONTACT-CONTRACT-2026-08-12.md`](../implementation/notes/T02-CONTACT-CONTRACT-2026-08-12.md)。
- T03：`contact_qr` 私有源图、`contact-qr-v1` 稳定公开 PNG 派生、失败重试和 READY SourceSet 投影；
- T03 记录：[`../implementation/notes/T03-CONTACT-QR-MEDIA-2026-08-12.md`](../implementation/notes/T03-CONTACT-QR-MEDIA-2026-08-12.md)。
- T04：固定五平台账号与二维码编辑、前置校验、私有预览、失败重试、contact 局部保存和 409 草稿保留；
- T04 记录：[`../implementation/notes/T04-CONTACT-ADMIN-2026-08-12.md`](../implementation/notes/T04-CONTACT-ADMIN-2026-08-12.md)。
- T05：`ContactChannelGrid`、共享平台 Logo 路径、四份本地 SVG（QQ群复用 QQ）及五平台三视口公开 E2E；
- T05 记录：[`../implementation/notes/T05-CONTACT-PUBLIC-2026-08-12.md`](../implementation/notes/T05-CONTACT-PUBLIC-2026-08-12.md)。
- T06：迁移 `0029_requirement_2_commission_email_faq.sql`、FAQ 上限 9 及空库/既有 8 项/幂等迁移测试；
- T06 记录：[`../implementation/notes/T06-COMMISSION-EMAIL-FAQ-2026-08-12.md`](../implementation/notes/T06-COMMISSION-EMAIL-FAQ-2026-08-12.md)。
- T07～T14：搜索契约/UI、方案 B 动态后台/公开页/首页、数据安全回归与全量质量门禁，记录见 `implementation/notes/README.md`；
- T15：真实 QR 测试素材和公开字节保留、双 Host 三视口总体验收、管理账号响应式以及六张证据截图；
- T15 记录：[`../implementation/notes/T15-BROWSER-ACCEPTANCE-2026-08-12.md`](../implementation/notes/T15-BROWSER-ACCEPTANCE-2026-08-12.md)。
- T15-F1～F4：`0032_requirement_2_contact_qr_upscale.sql`、二维码 FFmpeg 私有适配、首页轮播/动态修正、两渠道三视口截图及两条 E2E 根因修复；
- T15-F1～F4 记录：[`../implementation/notes/T15-F1-F4-PREACCEPTANCE-FIXES-2026-08-13.md`](../implementation/notes/T15-F1-F4-PREACCEPTANCE-FIXES-2026-08-13.md)。
- T16：独立 Review 覆盖代码、功能、三视口视觉和文档一致性；三组文档 findings 已修复，记录见 [`../review/REVIEW.md`](../review/REVIEW.md)。
- T17-F1：应用实现 commit `f3df1be`；Hero 平滑过渡、首页文案/链接、防诈骗正文、共享动态卡片/类型筛选和公开目录工具栏；unit 179/179、最终合并 E2E 40/40、lint/typecheck/production build 与 Edge 三视口通过；
- T17-F1 记录：[`../implementation/notes/T17-F1-USER-REVIEW-FIXES-2026-08-13.md`](../implementation/notes/T17-F1-USER-REVIEW-FIXES-2026-08-13.md)。

## 待实施产物

- T16-R1 新 SHA 独立复查记录。
- T17 用户真实账号、物理手机扫码与完整体验验收记录。
