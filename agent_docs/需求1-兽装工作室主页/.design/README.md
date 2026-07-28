# 设计工作区

> **角色**：把 designer-skills 的设计流程纳入本需求的 spec-driven 工作区。
> **权威边界**：业务范围、数据与存储契约以 `../requirements/SPEC.md` 为准；技术路线以 `../planning/PLAN.md` 为准；本目录只细化体验、信息架构、组件边界与视觉实现门禁。

## 设计轨

| 设计轨 | 目标 | 产物 |
| --- | --- | --- |
| 公开站 | 建立图片主导、可索引、适合连续浏览的摄影作品集体验 | `public-site/DESIGN_BRIEF.md`、`public-site/INFORMATION_ARCHITECTURE.md`、`public-site/DESIGN_TOKENS.md` |
| 管理端 | 让景宸以较低出错风险维护作品、媒体、状态和站点内容 | `admin-console/DESIGN_BRIEF.md`、`admin-console/INFORMATION_ARCHITECTURE.md`、`admin-console/DESIGN_TOKENS.md` |

可勾选执行单元只保存在 `../implementation/TASKS.md`，避免 `.design/` 与 spec-driven 主任务清单出现两套状态。

## 与 v5 原型的关系

- `../planning/prototype-v1/` 的 v5 锁定页面职责、内容顺序、关键交互和响应式基线。
- v5 的几何插画、字号、间距、控件造型、后台弹窗式布局和整体完成度均不是生产视觉标准。
- 生产实现必须基于本目录重新建立设计系统，并在 `../implementation/TASKS.md` 的 EXT-01 正式素材门禁通过后重新校准桌面/手机裁切、文字安全区和图片节奏。
- 改变页面集合、首页内容顺序、主要 CTA 或业务动作仍需先回到 SPEC/PLAN；纯视觉实现可在本目录和 TASKS 约束内迭代。

## 设计流程

1. SPEC/PLAN 已完成业务追问与方向确认，等价于 design-flow 的前置访谈。
2. 公开站、管理端分别维护 Design Brief 与 Information Architecture。
3. 设计令牌先以 Markdown 契约落档；阶段 4 再翻译为实际 CSS/Tailwind/Nuxt UI 主题。
4. 阶段 4 先用类型化夹具完成首页、作品列表/详情和管理端作品编辑关键视图，执行视觉审查并由用户确认方向。
5. 视觉方向通过后再把同一组件接入 SQLite、Nitro 与 OSS，不用临时后台组件替换已确认的公开端设计。
6. EXT-01 通过后执行第二次视觉校准、三视口回归、目标访客无提示任务测试和景宸实际内容更新验证。

## 证据来源

- `../materials/兽装工作室主页调研_2026-07-26/`：71 张竞品截图和页面调研，只提炼信息秩序与交互经验。
- `../planning/prototype-v1/`：已确认的 v5 页面职责、内容顺序与交互范围。
- `../materials/fursuit-studio-solution-package/`：技术与概念界面输入；未被 SPEC/PLAN 接纳的公告、联系表单、数据看板等能力不进入设计。
