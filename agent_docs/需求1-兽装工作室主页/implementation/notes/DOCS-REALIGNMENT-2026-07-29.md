# agent_docs 跨文件校准记录（2026-07-29）

## 背景

在 T01–T03 完成后，对需求、设计、技术路线和任务主链进行一次独立复核。复核确认产品与 Nuxt 单体方向正确，但发现一期范围、媒体发布模型、图片衍生数量和任务顺序存在过度设计或验证过晚的问题。本轮只修订 `agent_docs/`，不修改业务代码。

## 已确认并写入当前契约的决策

1. 删除 `depositNote`、`paymentNote` 及等价字段；后台私有联系人保留。
2. 返图增加可选的授权来源、确认时间和简短备注；全部为空仍可发布。
3. 一期只支持 CNY，不预留禁用美元字段；未来多币种通过正常迁移扩展。
4. T04–T08 保持为视觉硬门禁；T09–T21 改为第一件作品端到端垂直切片。
5. 使用已创建的 `project-furry-forge-private` 和 `project-furry-forge-public` 双 Bucket，不再通过同一 Bucket 的 Object ACL 切换发布状态。
6. OSS 图片处理是唯一像素转换权威；默认原生 `picture/srcset` 消费预生成结果。
7. `recipe-v1` 只生成 card、hero、detail 的有限宽度与 WebP + 一种 fallback，不做比例 × 宽度 × 格式组合爆炸。
8. 公开站保持图片大底/白底；明显蓝色常态 5%–10%，15% 仅为上限。
9. 一期分为 P0 可部署核心、P1 功能闭环和 P2 独立后置；正式上线另受正式素材、部署和实际使用验收约束。

## 历史边界

- T01–T03 的实施记录按当时事实保留，不伪造为已经采用双 Bucket。
- T03 已落地 DTO 仍可能包含本轮废止字段或私有 Object Key；TASKS T09 已登记代码修正。
- `planning/prototype-v1/` 与 `materials/` 保留为历史/证据，不覆盖当前 foundation、SPEC、PLAN、`.design` 和 TASKS。

## 文档验证

本轮在提交前执行以下机械检查：

- T01–T53 编号唯一、连续，无缺失或重复；
- Markdown 代码围栏成对；
- 当前权威文件中双 Bucket 名、EXT-02、P0/P1/P2 和 `recipe-v1` 引用一致；
- `depositNote`、`paymentNote`、美元预留和单 Bucket ACL 只允许出现在“明确删除/历史覆盖/T09 修订”的语境；
- 相对 Markdown 链接指向仓库现有文件或本轮新增文件；
- 本轮不改 `.vue`、TypeScript、配置或数据库代码。
