# 当前状态：需求3 · 站点业务简化与委托投递

> **最后校准**：2026-08-15。
> **当前阶段**：文档复查完成，工程尚未开始。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **当前 main 基线**：文档 PR 已合入；本次复查已通过一个 main commit 修正文档，不改变应用代码、数据库、OSS 或生产数据。

## 1. 已锁定产品结论

- 英文品牌名：`DITE DOG`。
- slogan：`不只做小狗毛 | 只做海绵头`。
- 返图墙/最新动态永久删除，且必须作为第一实施发布单元立即推进。
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

## 2. 本次文档复查发现并修正

1. **退役顺序错误**：原计划把返图/动态删除拖到本轮末尾，违背“立即永久删除”；现改为第一发布单元。
2. **Hero 并发域缺失**：原模型有 collection DTO version，却没有持久 collection；现新增四个 collection version 和上传归属。
3. **领养状态映射过于激进**：原计划把所有非 delivered 状态默认为 available；现仅自动映射 available/delivered，其余人工确认。
4. **匿名上传部署缺口**：原计划未明确私有 Bucket 对公开 Origin 的 CORS；现纳入 Schema、任务、preflight 和生产门禁。
5. **文案删除越界**：原计划把 `commission_email_action` 与 FAQ 一起物理删除；现只删除 FAQ，邮件说明保留为备用。
6. **媒体 usage 漂移**：原文档使用不存在的 `work-detail`；现沿用当前 `detail`。
7. **备份顺序风险**：原顺序可能在 clean backup 验证前删除旧备份；现改为净化备份恢复成功后再删旧应用备份。
8. **无关清理越界**：旧 contact 兼容列不再纳入需求3删除。

## 3. 阶段状态

| 阶段 | 状态 | 门禁 |
| --- | --- | --- |
| GATE-00 文档与决策 | 已完成 | — |
| A 立即退役返图/动态 | 未开始 | GATE-A |
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

### 4.5 公开直传 CORS

私有 Bucket 当前主要服务管理端上传；新增 public Origin 前必须收紧 CORS、签名 headers 和 live probe，不能使用 wildcard 作为正式方案。

### 4.6 委托 PII

手机号、QQ、体型和图片只能进入认证管理详情；日志/URL/analytics/错误均禁止。

## 5. 下一步

1. 从最新 main 创建 `feat/r3-retire-returns-updates`；
2. 按 T01–T06 完成本地实现、演练、CI 和 focused review；
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
