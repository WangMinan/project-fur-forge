# 当前状态：需求3 · 站点业务简化与委托投递

> **最后校准**：2026-08-21
> **状态**：已关闭，保留为当前业务与安全基线。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。

## 关闭结论

需求3的工程实现已成为后续需求的业务基线，本目录不再接受新增功能。任务清单中的未完成生产数据判断、真实手机、独立 Review、用户验收和最终发布按产品决策关闭，而不是被追认为完成：

- `[x]` 表示已有相应实现或证据；
- `[-]` 表示 2026-08-21 按产品决策关闭、不再执行。

## 继续生效的业务边界

- 品牌为 `DITE DOG`；返图墙、最新动态、FAQ、抖音、小红书和 Bilibili 已退役。
- 官方联系面只有邮箱、QQ、QQ群。
- 首页/委托 × 横/竖四个 Hero 集合独立。
- 作品、领养和私密委托投递沿用本需求已经实现的模型与安全边界。
- 匿名上传继续校验 Origin、token、TTL、限流、蜜罐、摘要、MIME、尺寸和一次消费。
- 委托 PII 与私有设定图不得进入公开投影、普通日志或客户端持久存储。

详细契约见 [`foundation/README.md`](./foundation/README.md)、[`requirements/SPEC.md`](./requirements/SPEC.md) 与 [`models/README.md`](./models/README.md)。

## 生产迁移边界

历史生产数据判断和迁移没有因本次文档关闭而自动发生。若未来部署包含需求3迁移，必须按 [`planning/DATA-MIGRATION.md`](./planning/DATA-MIGRATION.md) 和 [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) 重新做只读盘点、停止点、备份与前向迁移验证；不得把本状态文件当作生产数据已清理或迁移完成的证据。
