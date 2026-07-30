# 产物索引

> **角色**：登记当前权威文档、历史证据和实施产物。

## 当前权威文档

| 层级 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- |
| 地基 | `foundation/README.md` | 2026-07-29 已校准 | P0/P1/P2、双 Bucket、字段与视觉硬边界 |
| 规格 | `requirements/SPEC.md` | 2026-07-30 T09 修订版 | 旧 118 项 OQ 讨论保留于 Git 历史；OQ-119 已回答，当前无开放 OQ |
| 计划 | `planning/PLAN.md` | 2026-07-29 已校准 | 视觉前置、第一件作品垂直切片、双 Bucket 与受限 recipe |
| 设计路由 | `.design/README.md` | 已校准 | 公开站/管理端分轨、蓝色比例和阶段可见性 |
| 公开设计 | `.design/public-site/` | 已校准 | 图片大底/白底、A/B 精选、OSS 预生成图片 |
| 管理设计 | `.design/admin-console/` | 已校准 | P0/P1/P2 导航、可选授权记录、无 ACL 文案 |
| 模型 | `models/README.md` | 已校准 | 删除付款备注/美元预留，增加可选授权记录 |
| 任务 | `implementation/TASKS.md` | 已重排 | T01–T08 已完成；T09 工程核心候选已完成但保持未勾选；T09–T21 第一垂直切片 |
| 本轮校准记录 | `implementation/notes/DOCS-REALIGNMENT-2026-07-29.md` | 已记录 | 字段、双 Bucket、图片配方、阶段范围和任务顺序变更证据 |
| T04–T05 实施记录 | `implementation/notes/T04-T05-2026-07-29.md` | 已验证 | Kimi 入选方案、两种首页精选对比、三视口截图与质量门禁 |
| T06–T07 实施记录 | `implementation/notes/T06-T07-2026-07-29.md` | 已验证 | 作品列表/详情、管理端工作台、三视口证据与自动化自查 |
| T08 验收记录 | `implementation/notes/t06-t07/T08-REVIEW-PREP.md` | 2026-07-30 已通过 | 横向轨道定稿、T06/T07 基线通过、`must-fix = 0` |
| T09 工程核心记录 | `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md` | 已验证并合入 `main` | 契约、双 Bucket 配置、错误分流、安全日志与生产守卫 |
| T09 界面交接 | `implementation/notes/T09-UI-HANDOFF.md` | 待 Kimi | 管理壳、对比度、参数响应、dirty、金额、reduce 动效与任务阶段文案 |
| 状态 | `STATE.md` | 持续更新 | 当前决策、外部门禁和下一步 |

## 当前执行文档

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 执行责任路由 | `implementation/EXECUTION_ROUTING.md` | 2026-07-30 当前生效；记录 T09 工程核心已合入、Kimi 界面修补及后续前后端交接，不属于产品契约 |

## 历史与证据

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 竞品调研 | `materials/兽装工作室主页调研_2026-07-26/` | 只读参考，不复制资产 |
| 景宸品牌例图 | `materials/景宸品牌例图_2026-07-29/` | 品牌事实与色值证据；不复制海报构图、旧价格、二维码或非正式 Logo |
| 技术方案输入 | `materials/fursuit-studio-solution-package/` | 历史输入；单 Bucket 内容已被当前 PLAN 覆盖 |
| 快速原型 v5 | `planning/prototype-v1/` | 只保留页面职责、顺序和关键交互；视觉与旧业务字段不再权威 |
| 实施记录 | `implementation/notes/` | 记录当时事实，不回写成当前架构；T03 旧字段由 T09 修正 |
| Git 历史 | commit `7b01cba966f0a9049a4af0de08f7cc4ce993760d` 及以前 | 保存旧 SPEC/OQ/PLAN 全文，供追溯而非实施 |

## 当前实施产物

- T01：应用底座与质量脚本；
- T02：运行配置、Host 边界和日志脱敏工具；
- T03：共享 Schema/DTO 初版；遗留契约已由 T09 工程核心修订；
- T04：公开站设计系统、导航壳与响应式图片组件；
- T05：首页全幅首屏、编辑型精选网格/横向轨道对比、图片式业务入口和营业状态；Kimi 方案获用户选中；
- T06：作品列表、筛选、详情图集、事实、价格和空状态生产视觉样张；
- T07：管理端登录、作品列表、编辑工作台、媒体状态和发布检查生产视觉样张；
- T08：用户完成视觉验收，横向轨道定稿，T06/T07 基线通过，`must-fix = 0`；
- T09：工程核心候选已完成，OQ-119 已回答；等待 Kimi 界面修补与最终复核，不勾选任务。

## 外部门禁产物

- EXT-01：正式素材 manifest、授权范围、焦点和文字安全区；
- EXT-02：双 Bucket 地域/CORS/BPA/权限/30 MB 配额与跨 Bucket `sys/saveas` 测试记录。
