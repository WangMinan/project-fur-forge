# 产物索引

> **角色**：登记当前权威文档、历史证据和实施产物。

## 当前权威文档

| 层级 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- |
| 地基 | `foundation/README.md` | 2026-07-29 已校准 | P0/P1/P2、双 Bucket、字段与视觉硬边界 |
| 规格 | `requirements/SPEC.md` | 2026-07-29 整理版 | 旧 118 项 OQ 讨论保留于 Git 历史；当前结论已收敛 |
| 计划 | `planning/PLAN.md` | 2026-07-29 已校准 | 视觉前置、第一件作品垂直切片、双 Bucket 与受限 recipe |
| 设计路由 | `.design/README.md` | 已校准 | 公开站/管理端分轨、蓝色比例和阶段可见性 |
| 公开设计 | `.design/public-site/` | 已校准 | 图片大底/白底、A/B 精选、OSS 预生成图片 |
| 管理设计 | `.design/admin-console/` | 已校准 | P0/P1/P2 导航、可选授权记录、无 ACL 文案 |
| 模型 | `models/README.md` | 已校准 | 删除付款备注/美元预留，增加可选授权记录 |
| 任务 | `implementation/TASKS.md` | 已重排 | T01–T03 已完成；T04–T08 视觉；T09–T21 第一垂直切片 |
| 本轮校准记录 | `implementation/notes/DOCS-REALIGNMENT-2026-07-29.md` | 已记录 | 字段、双 Bucket、图片配方、阶段范围和任务顺序变更证据 |
| 状态 | `STATE.md` | 持续更新 | 当前决策、外部门禁和下一步 |

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
- T03：共享 Schema/DTO 初版，已登记 T09 修订债务；
- T04 尚未开始。

## 外部门禁产物

- EXT-01：正式素材 manifest、授权范围、焦点和文字安全区；
- EXT-02：双 Bucket 地域/CORS/BPA/权限/30 MB 配额与跨 Bucket `sys/saveas` 测试记录。
