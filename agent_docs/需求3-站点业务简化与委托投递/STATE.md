# 当前状态：需求3 · 站点业务简化与委托投递

> **最后校准**：2026-08-15。
> **当前阶段**：阶段 A 本地实施中；T01 已完成，正在执行 T02。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **当前 main 基线**：`639d15b`；任务分支 `feat/r3-retire-returns-updates` 已完成 T01 品牌/入口/展示基线，未触碰生产数据。

## 1. 已锁定产品结论

- 英文品牌名：`DITE DOG`。
- slogan：`不只做小狗毛 | 只做海绵头`。
- 返图墙/最新动态永久删除，且必须作为第一实施发布单元立即推进。
- 官方联系方式只维护邮箱、QQ、QQ群；抖音、小红书和 Bilibili 不再维护。
- OSS Bucket CORS 继续保持当前通配 `*`；精确 Origin、禁止 wildcard 或 CORS 收紧不作为实现/验收/生产门禁。
- 匿名委托 API 仍校验应用层 Origin、token、TTL、限流、蜜罐和一次性消费。
- 公开端增加动效，保留 reduced-motion。
- 桌面 Hero 中文居中、英文/slogan 同行左右；移动整体左对齐下移。
- 首页/委托横竖 Hero 四集合独立。
- works/detail 只公开名称、物种和图片。
- 删除作品 suit、owner、contact、tags、旧 progress、method、event。
- adoption 状态 available/adopted；歧义旧状态必须人工确认。
- adoption 使用独立横版 cover；design sheet 最多一张且可选。
- commission 一张图 + 称呼/手机号/QQ/身高/体重；后台 pending/accepted/rejected。
- FAQ 完整删除；`commission_email_action` 保留但不作委托页主行动。
- 不接 SMTP、短信、用户账号、公开查询或自动建作品。

## 2. 文档复查与后续修订

2026-08-15 首轮合入后复查修正：

1. **退役顺序错误**：返图/动态删除提前为第一发布单元。
2. **Hero 并发域缺失**：新增四个 collection version 和上传归属。
3. **领养状态映射过于激进**：仅自动映射 available/delivered，其余人工确认。
4. **文案删除越界**：只删除 FAQ，保留 `commission_email_action` 作为备用说明。
5. **媒体 usage 漂移**：沿用当前 `detail`。
6. **备份顺序风险**：净化备份恢复成功后再删旧应用备份。
7. **无关清理越界**：不顺手删除未获授权的数据。

用户本轮追加并覆盖首轮复查中的两项判断：

8. **OSS CORS**：现网 OSS CORS 均为通配，继续保持 `AllowedOrigin=*`；不要求收紧为 public/admin 精确 Origin，也不把 CORS 配置作为门禁。
9. **官方渠道收缩**：仅保留邮箱、QQ、QQ群；`douyin`、`xiaohongshu`、`bilibili` 从当前模型、管理端、公开端和数据迁移目标中移除。

## 3. 阶段状态

| 阶段 | 状态 | 门禁 |
| --- | --- | --- |
| GATE-00 文档与决策 | 已完成 | — |
| A 立即退役返图/动态并收缩联系渠道 | 未开始 | GATE-A |
| B Expand 新模型与安全 | 未开始 | GATE-B |
| C 动效与 Hero | 未开始 | GATE-C |
| D 作品与领养 | 未开始 | GATE-D |
| E 委托投递 | 未开始 | GATE-E |
| F 最终评审与发布 | 未开始 | GATE-R3 |

## 4. 当前风险

### 4.1 R3-A 不可恢复

生产删除开始后返图媒体不可恢复。必须 dry-run、用户核对、强确认、对象验证、database contract、clean backup restore。

### 4.2 外部快照

应用只能管理自己创建/已知的备份。ECS/云盘/第三方快照必须由用户在控制台确认，Agent 不得虚报完成。

### 4.3 Hero 集合版本

没有 collection version 会导致四个方向互相 409 或无安全排序 CAS；实现必须按模型落地。

### 4.4 领养误公开

`preparing/scheduled/in_production/event_sale/NULL` 不能自动变 available，必须景宸确认。

### 4.5 OSS CORS 与应用 Origin

OSS CORS 通配是用户确认的现状和目标，不是风险 finding，也不是门禁。实现风险在于匿名 API 自身的 Origin/token/TTL/限流与签名 PUT 校验，不能误把 CORS `*` 当成取消应用安全校验的理由。

### 4.6 联系渠道迁移

当前 `official_channels_json`、平台常量和二维码管理仍按五平台实现。第一发布单元必须安全迁移为固定 `qq | qq_group`，保留邮箱，并清理三类退役平台失去引用的二维码资产，避免后台和公开 DTO继续携带僵尸槽位。

### 4.7 委托 PII

手机号、QQ、体型和图片只能进入认证管理详情；日志/URL/analytics/错误均禁止。

## 5. 下一步

1. 在 `feat/r3-retire-returns-updates` 按 T02–T06 完成本地实现、演练、CI 和 focused review；
2. 保持 T07/GATE-A 未完成，不进入阶段 B/C；
3. 用户核对生产 dry-run 后执行 T07；
4. GATE-A 关闭后再进入 Expand；
5. 后续按 B→C→D→E→F 推进。

## 6. 文档入口

- [`foundation/README.md`](./foundation/README.md)
- [`requirements/SPEC.md`](./requirements/SPEC.md)
- [`models/README.md`](./models/README.md)
- [`.design/README.md`](./.design/README.md)
- [`planning/PLAN.md`](./planning/PLAN.md)
- [`planning/DATA-MIGRATION.md`](./planning/DATA-MIGRATION.md)
- [`implementation/TASKS.md`](./implementation/TASKS.md)
- [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)
- [`review/REVIEW.md`](./review/REVIEW.md)
