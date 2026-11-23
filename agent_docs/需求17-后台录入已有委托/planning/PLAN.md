# 计划：后台录入已有委托

## 执行结论

用户追加授权后，以下计划已本地实施并自动验证，生产操作未执行。复用现有委托服务、后台组件、私有上传、制作单和删除链，不新增依赖或客户系统。

## 执行顺序

1. 对照 [模型](../models/README.md) 制作前向迁移，覆盖来源、可空字段、历史日期、线下确认、创建重试身份、索引与图片关系。先用老库fixture证明历史数据和官网规则不退化。
2. 在repository/service实现OR人员查重、明确冲突确认、最终事务复核和创建重试防重；公开提交继续在事务内拦截全部来源pending。区分“确认另建”与“同次请求重放”。
3. 添加管理创建、冲突查询和管理上传入口；扩展现有详情更新。认证、Origin、CSRF、no-store、归属与字段校验先于业务写入。复用管理API客户端和现有错误类别模式。
4. 接入私有图片补传/替换/移除与中断清理；适配无图详情、制作单和删除链，复用持久清理/recovery，不写一次性吞错删除代码。
5. 按来源隔离邮件：不入队、摘要无需邮件、详情不提供重试，服务端重试和worker复核均拒绝manual；回归官网和历史邮件。
6. 录入页与详情编辑复用现有表单交互；列表增加来源列/筛选及准确时间文案，保留搜索、分页、窄屏卡片；接入未保存离开提醒。
7. 完成 [SPEC验收](../requirements/SPEC.md) 的定向core和浏览器检查，更新STATE/TASKS/Review。未授权不启动release/manual或生产操作。

## 接口提案

- `POST /api/admin/v1/commissions`：仅创建manual，返回申请ID、编号与详情；请求含一次创建身份、业务资料、上传引用及必要的冲突确认信息。
- `POST /api/admin/v1/commissions/conflicts`：认证查询，联系方式只在body；仅返回核对所需摘要与匹配原因，不能泄漏到普通日志。预检查不是最终写入授权。
- 现有 `GET /api/admin/v1/commissions` 增加受限来源筛选；原未带status默认pending、显式all及非法参数拒绝语义不变。
- 现有详情PUT按origin限制字段，仍使用expectedVersion；无论UI是否禁用，服务端都必须阻止官网资料越权修改。
- 管理上传使用 `/api/admin/v1/commission-upload-sessions` 及相应complete/retry/cancel路由，具体形状复用现有上传约定；不改公开匿名上传权限。
- 保留现有图片、work-order、email、email-retry与deletion端点，分别补齐可空与来源守卫。

接口名称与字段为实现提案，最小化改动时可调整；不得改变产品、认证、PII或并发语义。

## 必须触达的调用方

| 层 | 文件或范围 |
| --- | --- |
| 数据 | `server/database/schema.ts`、新migration、迁移fixture |
| 共享契约 | `shared/schemas/commission.ts`、`commission-email.ts`、`shared/types/contracts.ts` |
| SQL/事务 | `server/utils/repository/commission-repository.ts`、邮件repository |
| 业务 | `commission-management.ts`、`commission-retention.ts`、`commission-work-order.ts`、邮件service/runner |
| 路由 | admin commissions、管理上传新入口；public提交只适配并发/内部契约，不扩展公开能力 |
| 页面/组件 | commissions index/new/detail、CommissionListTable、CommissionEmailStatus、DeletionAction、现有表单/确认复用 |
| 测试 | commission contract/follow-up/confirmation/email/work-order/retention、runtime API、管理列表smoke及新增录入用例 |
| 配置/导出 | 无需新增SMTP配置或依赖；类型导出、测试fixture和初始化工具按实际调用核对 |

## 验证策略

先lint/typecheck和受影响core；Nuxt路由/runtime与Schema变更需build。新增非平凡逻辑应有小而有效的测试，重点事务竞争、幂等、来源隔离、缺项与图片恢复。浏览器验证真实流程、失败和冲突反馈、键盘焦点、触控、偏好、320–1440px响应式、decode、console/network、性能与溢出。仅使用虚构数据和合成图片，SMTP使用桩。

本期无需运行test:release、生产邮件联调、镜像或Compose/恢复演练；后续发布另按现场授权执行。

## 开放问题

无阻塞产品/计划问题。创建请求删除后重放、图片清理的持久落点与SQLite约束细节属于实现前需验证的工程事项，见任务清单；不能以工程选择为由削弱SPEC验收。
