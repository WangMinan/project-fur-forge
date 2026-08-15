# 当前状态：需求3 · 站点业务简化与委托投递

> **最后校准**：2026-08-15。
> **当前阶段**：需求、模型、设计和实施路线已锁定；代码尚未开始。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **审查代码基线**：`main@9a6add09db559ac134b58cd5b75af1c588c76306`。

## 1. 当前结论

需求3已经完成立项和文档地基。用户已明确确认全部关键口径，没有阻塞计划的开放问题：

- 英文品牌名恢复为 `DITE DOG`；
- 首页 slogan 更新为 `不只做小狗毛 | 只做海绵头`；
- 返图墙和最新动态连数据表、私有原图、公开派生及相关备份一起永久删除；
- 用户允许本地和生产执行不可恢复的破坏性更新；
- 公开端增加导航、页面切换、区块和卡片动效，同时保留 reduced-motion；
- 桌面 Hero 与移动 Hero 使用不同对齐：桌面中文居中、英文/slogan 左右分置，移动整体左对齐；
- 首页和委托页横竖 Hero 完全独立维护；
- 作品和详情只公开名称、物种和图片；
- 删除装型、主人、联系人、属性、制作进度、领养方式和展会字段；
- 领养状态收敛为 available/adopted，增加独立横版单头成果图；
- 设定图最多一张，只作可选详情素材；
- 新增 `/commission/apply` 和 `/admin/commissions`；
- 委托申请必须包含一张设定图、称呼、手机号、QQ、身高、体重；
- 不接 SMTP，不提供访客状态查询，不自动建作品；
- FAQ 和委托页邮件行动文案完整移除。

## 2. 与旧需求的关系

需求1继续提供：

- 双 Host 隔离；
- 私有源图与公开派生；
- OSS/ESA、安全、发布、恢复、备份和部署基线；
- 唯一管理员和质量门禁。

需求2继续提供：

- 官方五平台渠道与二维码；
- 名称搜索和通用公开组件中仍适用的能力。

需求3明确覆盖：

- 返图、动态、FAQ、旧英文名；
- 旧作品/领养字段和展会掉落；
- 旧 Hero pair；
- “无在线提交、邮件优先”的委托流程；
- “尽量少动效”的公开视觉原则。

旧 dated notes 和 Review 仍是历史事实，不回写为“当时未实现”。当前编码必须以需求3活文档为准。

## 3. 阶段状态

| 阶段 | 状态 | 下一门禁 |
| --- | --- | --- |
| GATE-00 需求冻结 | 已完成 | 文档 PR Review/合入 |
| A Expand 模型与安全 | 未开始 | GATE-A |
| B 动效与首页 | 未开始 | GATE-B |
| C 作品与领养 | 未开始 | GATE-C |
| D 委托投递 | 未开始 | GATE-D |
| E 永久退役与 Contract | 未开始 | GATE-E |
| F 独立 Review、用户验收、生产执行 | 未开始 | GATE-R3 |

当前只有 T00 文档地基可以勾选完成；任何应用代码、迁移、媒体或生产结论均未完成。

## 4. 当前风险

### 4.1 不可恢复删除

返图私有原图和动态/返图数据库内容一旦按 T28/T36 删除，没有恢复路径。清理必须先 dry-run、核对计数、输入强确认、删除对象并验证，再执行 DROP TABLE。

### 4.2 旧镜像不兼容

Contract migration 会物理删除旧表、列和枚举。完成后不保证旧镜像能启动，生产故障只能使用目标 Schema 兼容的新镜像前向修复。

### 4.3 领养补图

当前领养使用设定图作为卡片封面，没有独立横版单头成果图。切换公开投影前，所有 published adoption 必须人工补 `adoption_cover` 或先下架。

### 4.4 匿名上传

当前上传会话依赖管理员 `created_by`，不能直接开放。必须建立独立短时会话并复用底层验证，不得放宽管理员上传安全边界。

### 4.5 Hero SSR

横竖序列数量不再相同，需要重新定义 SSR 第一帧、水合和方向变化，不能继续依赖一条记录中的 `<picture>` 配对。

## 5. 当前无阻塞开放问题

SPEC 中 OQ-001～OQ-010 均为已答。普通技术取舍由实现者按现有架构完成；只有以下情况需要重新升级给用户：

- 发现无法在不保留退役内容的前提下完成生产清理；
- 发现现网 adoption 无法在发布前补齐横版头图；
- 需要新增用户未授权的委托字段、状态、通知或数据保留规则；
- 需要改变桌面/移动 Hero 的已锁定对齐；
- 需要新增第三方服务或放宽安全/隐私边界。

## 6. 下一步

1. Review 本次纯文档 PR，确认跨文件一致；
2. 合入后从最新 `origin/main` 创建 Expand 实现分支；
3. 先执行 T01–T06，关闭 GATE-A；
4. 再按 TASKS 推进 B、C、D；
5. 只有 GATE-B/C/D 全部通过后，才实施返图/动态永久清理和 Contract；
6. 最新 SHA 通过独立 Review 和用户验收后，才进入生产 T36。

## 7. 文档入口

- 产品边界：[`foundation/README.md`](./foundation/README.md)
- 权威规格：[`requirements/SPEC.md`](./requirements/SPEC.md)
- 设计要求：[`.design/README.md`](./.design/README.md)
- 模型规划：[`models/README.md`](./models/README.md)
- 实施路线：[`planning/PLAN.md`](./planning/PLAN.md)
- 迁移与永久删除：[`planning/DATA-MIGRATION.md`](./planning/DATA-MIGRATION.md)
- 任务清单：[`implementation/TASKS.md`](./implementation/TASKS.md)
- 执行路由：[`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)
- 证据规则：[`implementation/notes/README.md`](./implementation/notes/README.md)
- 独立 Review：[`review/REVIEW.md`](./review/REVIEW.md)
- 产物登记：[`artifacts/ARTIFACTS.md`](./artifacts/ARTIFACTS.md)
