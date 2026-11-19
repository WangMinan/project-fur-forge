# 核对记录：后台录入已有委托

2026-11-16，文档阶段，只读核对本地同步main代码，没有查询生产申请内容。用户截图只作为界面背景，不复制申请人数据进仓库。

| 已核对入口 | 现状与影响 |
| --- | --- |
| `shared/schemas/commission.ts` | 官网完整资料、确认true、上传一次消费；详情假设联系/体型/图片非空，更新只接收状态/备注 |
| `app/pages/admin/commissions/index.vue` | 默认全部状态，昵称/物种/回执搜索，客户端分页；无创建入口 |
| `app/pages/admin/commissions/[id].vue` | 固定有图展示、状态/备注编辑、邮件组件；accepted可导出，rejected可删除 |
| `server/utils/service/commission-management.ts` | 创建事务查pending手机号、消费上传、创建编号并入邮件队列；详情DTO假设完整资料 |
| `server/database/migrations/0042_r3_e_commission_follow_up.sql` | 全局pending手机号唯一索引阻止同手机号的第二笔pending；本期需前向调整，禁止编辑旧文件 |
| `server/database/migrations/0038_r3_b_adoption_commission_expand.sql` | 完整资料非空、图片唯一引用/触发器、handled字段约束；不能只放宽前端 |
| `server/utils/service/commission-work-order.ts` | accepted门禁，固定读取设定图，完整资料组成制作单；需处理空值与时间来源 |
| `server/utils/service/commission-retention.ts`、repository | 183天pending候选、已拒绝删除、图片关系/lease/邮件协调；需合法处理无图及替换后的清理 |

采用用户“基本都按照你说的来”作为建议采纳，不重复发问。补充说明手机号/QQ是人员冲突条件，不是申请唯一性；另用操作身份解决技术重试。

本轮没有运行应用、测试、SMTP、数据库迁移或任何生产操作。文档检查详见 [Review](../../review/REVIEW.md)。

## 后续实施

用户追加授权后的实现、测试及视觉校准见 [本地实现交接](2026-11-16-LOCAL-IMPLEMENTATION.md)。上文“未执行”仅描述初始文档阶段。
