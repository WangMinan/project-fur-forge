# 当前状态：需求1 · 兽装工作室主页

> **最后校准**：2026-08-21
> **状态**：已关闭，保留为历史实现与运行基线。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。

## 关闭结论

需求1不再作为活跃产品 backlog。已有实现继续提供双 Host、私有原图/公开派生、OSS/ESA、发布 operation、lease/recovery、备份恢复与部署基线；后续业务契约由需求3/4覆盖。

- `[x]` 表示当时已有相应实现或证据；
- `[-]` 表示 2026-08-21 按产品决策关闭、不再执行；它不等于补签独立 Review、真实手机、用户验收、云配置、生产迁移或发布。

## 继续生效的事实源

- 媒体公开与保护：[`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md)
- 生产结构与操作：[`implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](./implementation/PRODUCTION-LAUNCH-HANDBOOK.md)
- 根部署清单：[`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
- 历史产品规格：[`requirements/SPEC.md`](./requirements/SPEC.md)

这些文件定义运行安全和恢复边界，不代表目标环境已经执行或通过。后续 UI 工作不得改变 app-only Compose、宿主机 HTTP/80 Nginx、ESA 边缘 TLS、两只私有 Bucket、精确 Host、loopback app 或 digest 部署，除非用户明确重新开放部署范围。
