# 需求导航

本目录保存需求契约、实施记录与证据。先定位任务所属需求，再读取 STATE、SPEC、TASKS；不要把最新需求当成对全部历史契约的替换。

## 需求目录

状态摘要只用于导航，实时事实和执行勾选分别以各目录的 STATE、TASKS 为准。

| 需求 | 导航状态 | 状态 / 规格 / 任务 |
| --- | --- | --- |
| 需求1 · 兽装工作室主页 | 已关闭；Host、媒体、部署与恢复历史基线 | [STATE](需求1-兽装工作室主页/STATE.md) · [SPEC](需求1-兽装工作室主页/requirements/SPEC.md) · [TASKS](需求1-兽装工作室主页/implementation/TASKS.md) |
| 需求2 · 站点导航与内容增强 | 已关闭；部分能力被后续需求覆盖 | [STATE](需求2-站点导航与内容增强/STATE.md) · [SPEC](需求2-站点导航与内容增强/requirements/SPEC.md) · [TASKS](需求2-站点导航与内容增强/implementation/TASKS.md) |
| 需求3 · 站点业务简化与委托投递 | 已关闭；业务与退役基线 | [STATE](需求3-站点业务简化与委托投递/STATE.md) · [SPEC](需求3-站点业务简化与委托投递/requirements/SPEC.md) · [TASKS](需求3-站点业务简化与委托投递/implementation/TASKS.md) |
| 需求4 · 站点视觉升级与内容合规 | 仅阶段 E 开放；其范围不限制另行授权的新需求 | [STATE](需求4-站点视觉升级与内容合规/STATE.md) · [SPEC](需求4-站点视觉升级与内容合规/requirements/SPEC.md) · [TASKS](需求4-站点视觉升级与内容合规/implementation/TASKS.md) |
| 需求5 · 委托邮件通知与站点配置 | 本地实现记录已形成；发布、部署见该需求记录 | [STATE](需求5-委托邮件通知与站点配置/STATE.md) · [SPEC](需求5-委托邮件通知与站点配置/requirements/SPEC.md) · [TASKS](需求5-委托邮件通知与站点配置/implementation/TASKS.md) |
| 需求6 · 作品图片构图与详情展示 | 本地实现与验证完成；待用户人工验收 | [STATE](需求6-作品图片构图与详情展示/STATE.md) · [SPEC](需求6-作品图片构图与详情展示/requirements/SPEC.md) · [TASKS](需求6-作品图片构图与详情展示/implementation/TASKS.md) |

## 按主题补读

| 主题 | 文档与覆盖关系 |
| --- | --- |
| 业务与退役 | [需求3 foundation](需求3-站点业务简化与委托投递/foundation/README.md)；关闭不等于允许恢复退役能力 |
| 公开文案、模型与视觉 | 需求4 [COPY](需求4-站点视觉升级与内容合规/requirements/COPY.md)、[models](需求4-站点视觉升级与内容合规/models/README.md)、[design](需求4-站点视觉升级与内容合规/.design/README.md)；后续需求按明确条款覆盖 |
| 媒体与预览 | [媒体策略](需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md) 包含历史水印、返图与旧配方描述；当前退役结果以需求3 foundation、需求4 SPEC 的退役条款及 [T47-F4](需求4-站点视觉升级与内容合规/implementation/notes/2026-08-29-T47-F4-MOBILE-PDF-MEDIA-RETIREMENT.md) 为准。当前管理同源预览见 [需求5交接](需求5-委托邮件通知与站点配置/implementation/notes/2026-09-09-ADMIN-IMAGE-PROXY.md) 与部署文档 |
| 内部邮件与站点配置 | 需求5 SPEC 的内部 SMTP 授权覆盖早期“禁用 SMTP”条款，不扩展为对外自动邮件 |
| 图片构图与详情显隐 | 需求6 SPEC 明确列出拟覆盖条款；本地已实现；生产生效状态以实际部署记录为准 |
| 部署、恢复与云验证 | [DEPLOYMENT](../docs/DEPLOYMENT.md)、[生产发布手册](需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)；发布事实只认对应执行证据 |

## 文档职责与工作范围

- foundation 定边界；SPEC 定产品契约和验收；COPY 定文案；models 定模型映射；design 定视觉行为；PLAN 定技术路线；TASKS 定执行勾选；STATE 定当前事实。
- 用户明确的新需求可以修改指定的数据库、业务或媒体契约；历史阶段的局部限制不构成全仓库永久禁令。安全与部署基线未经明确覆盖继续继承。
- notes、截图、Review、commit、Actions run 只证明当时的工作；不能用历史摘要替代现场验证。
- `[x]` 表示有相应完成证据；`[ ]` 表示未完成；历史 `[-]` 表示按产品决策关闭，不补签独立 Review、真实手机、用户验收或生产操作。
- 新需求使用 [_template](_template/)；仅生成文档时，不将计划中的实现与验收标记为完成。
