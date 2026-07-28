# 产物索引

> **角色**：收敛节点——把本需求所有文档产物和外部资料登记成册（对应 spec-kit `/converge`）。
> **写入时机**：阶段 6 闭环时整理；此后每次新增产物即更新。
> **闭环检查**：确认下表每个阶段产物都已产出、路径正确、状态为定稿。

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 地基 | 地基 | `foundation/README.md` | 已同步 | 模块边界、公开页面与业务硬约束 |
| 1 规格 | 需求规格 | `requirements/SPEC.md` | 已锁定 | 118 项 OQ 已收敛；2026-07-29 同步正式名称、临时英文名、单件公开人民币价格、有序作品短属性、30 MB 原图与 OSS 配额门禁 |
| 2 计划 | 实施计划 | `planning/PLAN.md` | 已锁定 | Nuxt 4/Nitro/SQLite/OSS 单体技术路线；23 项 PLAN OQ 已收敛，并于 2026-07-29 补齐公开投影、品牌色阶与 30 MB 媒体前置条件 |
| 2 计划 | UI/交互原型 v5 | `planning/prototype-v1/index.html` | 已确认 | 全幅作品首屏、首屏后精选、图片式委托/领养入口、自设委托作品宽图、7 个公开一级页面与独立后台 |
| 2 计划 | 原型说明与审查清单 v5 | `planning/prototype-v1/README.md` | 已确认 | 图片主导原则、参考站动线映射、正式版禁用内容、交互边界、OSS 界面约束与验证结果 |
| 2 计划 | 景宸品牌例图证据与蓝色聚类 | `materials/景宸品牌例图_2026-07-29/README.md`、`blue-palette.json`、`blue-palette.png` | 已记录 | 例图只作品牌/业务证据和配色输入；不使用狗头闪电、旧 `5600` 或景宸个人 QQ 二维码 |
| 2 计划 | 原型 SPEC 自审 v5 | `planning/prototype-v1/SPEC-REVIEW-v5.md` | 已完成 | 图片层级、全幅首页、页面顺序、委托图片引导与既有公开/后台契约复核 |
| 2 计划 | 原型 SPEC 自审 v4 | `planning/prototype-v1/SPEC-REVIEW-v4.md` | 历史 | 上一轮公开文案、FAQ 与独立后台登录复核记录 |
| 2 计划 | 原型 SPEC 自审 v3 | `planning/prototype-v1/SPEC-REVIEW-v3.md` | 历史 | 上一轮页面合并、筛选与页头复核记录 |
| 2 计划 | 原型 SPEC 自审 v2 | `planning/prototype-v1/SPEC-REVIEW-v2.md` | 历史 | 早期八页面、30 MB 输入与后台流程记录；当前契约以 v5/SPEC/PLAN 为准 |
| 3 设计 | 设计流程路由 | `.design/README.md` | 已完成 | 公开端/管理端分轨，明确 v5 仅为职责与交互基线，TASKS 为唯一任务源 |
| 3 设计 | 公开端 Design Brief / IA / Token | `.design/public-site/` | 已完成 | 图片第一层级、编辑型摄影作品集、路由与导航、响应式/动效/禁用风格 |
| 3 设计 | 管理端 Design Brief / IA / Token | `.design/admin-console/` | 已完成 | 安静内容工具、对象化导航、发布确定性、PC 完整/手机轻量 |
| 3 任务 | 任务清单 | `implementation/TASKS.md` | 已完成 | T01–T53 已正式拆解并建立依赖、验证、SPEC 覆盖和部署后置项；经 doc-coauthoring 三路无上下文 Reader Test 修订。当前 T01 已完成，下一项为 T02 |
| 4 实施 | 实施备注 | `implementation/notes/README.md` | 进行中 | T01 实施记录与验证证据已归档；后续严格按 TASKS 依赖继续 |
| 1–3 模型 | 模型说明 | `models/README.md` | 已同步 | 记录当前统一作品聚合、slug 重定向、媒体资产和后续阶段写入边界 |
| 5 评审 | 评审记录 | `review/REVIEW.md` | 未开始 | 文件仅保留阶段模板 |
| 6 闭环 | 状态 | `STATE.md` | 持续更新 | 当前阶段、验证记录、约束与 OQ 汇总 |

## 外部资料

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 竞品调研 | `materials/兽装工作室主页调研_2026-07-26/` | 只读参考信息架构、页面密度与用户动线；不复制资产 |
| 技术方案输入 | `materials/fursuit-studio-solution-package/fursuit-studio-solution.md` | 2026-07-28 Nuxt 单体技术路线输入；采用前已按当前 SPEC、同 Bucket OSS 契约和官方文档校正 |
