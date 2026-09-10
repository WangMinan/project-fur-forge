# 产物索引：作品图片构图与详情展示

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 | 地基 | [foundation](../foundation/README.md) | 文档已整理 | 范围与安全继承 |
| 1 | 规格 | [SPEC](../requirements/SPEC.md) | 产品选择已确认 | OQ及验收标准 |
| 2 | 计划 | [PLAN](../planning/PLAN.md) | 文档已整理 | 技术路线与验证 |
| 3 | 任务 | [TASKS](../implementation/TASKS.md) | T00～T09/T10-A/T11完成 | 待T10-B人工验收 |
| 3 | 模型 | [models](../models/README.md) | 已实现 | 0053及严格DTO已接通 |
| 4 | 备注 | [notes](../implementation/notes/README.md) | 已含实现交接 | 测试与浏览器证据见索引 |
| 4 | 立项交接 | [交接](../implementation/notes/2026-09-10-DOCUMENTATION-HANDOFF.md) | 已记录 | 基线与前序只读复现 |
| 5 | 评审 | [REVIEW](../review/REVIEW.md) | 文档与代码复核完成 | 不代签人工验收 |
| 6 | 状态 | [STATE](../STATE.md) | 本地实现完成 | 未闭环 |

## 外部资料

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 前期讨论 | [代码评估方案](chatgpt-conversation://6aa17634-fcdc-83e9-ac8b-8b4cb4f444c1) | 阅读材料，已按用户最终确认校准 |
| 裁切交互 | [Cropper.js API](https://fengyuanchen.github.io/cropperjs/v2/api/) | 官方能力参考，实施时核实并锁定依赖 |
| 选区能力 | [CropperSelection](https://fengyuanchen.github.io/cropperjs/v2/api/cropper-selection.html) | 移动、调整与比例控制 |

## 尚未产生的产物

尚无人工验收、PR/远程CI、镜像或生产部署证据。

## 本地实现与验证产物

- [实现交接](../implementation/notes/2026-09-10-IMPLEMENTATION-HANDOFF.md)
- [验证索引与截图](../implementation/evidence/INDEX.md)
- [0053前向迁移](../../../server/database/migrations/0053_r6_image_compositions.sql)
- [共享几何](../../../shared/utils/image-composition.ts)
- [Cropper编辑控件](../../../app/components/admin/ImageCompositionControls.vue)
