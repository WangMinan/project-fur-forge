# 产物索引

> 本地实现与证据已登记；生产部署、真实手机与默认两个收件箱未代签。

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 地基 | 地基 | [foundation](../foundation/README.md) | 已实现校准 | 范围授权与继承 |
| 1 规格 | 需求规格 | [SPEC](../requirements/SPEC.md) | 已同意并实现 | 用户决定及验收 |
| 2 计划 | 实施计划 | [PLAN](../planning/PLAN.md) | 已实现校准 | 最小实施路径 |
| 3 任务 | 任务清单 | [TASKS](../implementation/TASKS.md) | 已实现校准 | 本地实现与验证完成 |
| 4 实施 | 现场备注 | [notes](../implementation/notes/README.md) | 已记录 | 初始化与实施交接 |
| 5 评审 | 评审记录 | [REVIEW](../review/REVIEW.md) | 文档读者检查完成 | 非独立实现验收 |
| 模型 | 模型说明 | [models](../models/README.md) | 已实现校准 | 0052 与 DTO 实际字段 |
| 状态 | 当前状态 | [STATE](../STATE.md) | 已更新 | 当前事实与交接 |

## 外部资料

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 文档模板 | [_template](../../_template/) | 本目录九份文件结构 |
| 当前业务基线 | [需求3地基](../../需求3-站点业务简化与委托投递/foundation/README.md) | 私有媒体和投递边界 |
| 当前产品契约 | [需求4规格](../../需求4-站点视觉升级与内容合规/requirements/SPEC.md) | 公开用户侧回归基线 |
| 部署约束 | [DEPLOYMENT](../../../docs/DEPLOYMENT.md) | 后续真实环境核验 |

- [Nodemailer SMTP 官方文档](https://nodemailer.com/smtp)：客户端 SMTP 配置与 TLS 行为参考，实际传输以联调结果为准。
- [Nodemailer 附件官方文档](https://nodemailer.com/message/attachments)：Buffer 附件及文件/URL 访问限制参考。
- [实施 Handoff](../implementation/notes/2026-09-06-SMTP-HANDOFF.md)：完成范围、失败复跑与剩余边界。
- [证据索引](../implementation/evidence/INDEX.md)：浏览器截图、度量与脱敏 SMTP 实证。

- [PR/镜像发布交接](../implementation/notes/2026-09-06-PR-RELEASE.md)：用户文案核对与本轮 GitHub 发布范围。
