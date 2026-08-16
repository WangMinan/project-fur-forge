# 当前状态：需求3 · 站点业务简化与委托投递

> **最后校准**：2026-08-16。
> **当前阶段**：GATE-A 已由用户确认发布完成；阶段 B 已完成并通过 GATE-B；阶段 C 的 T15～T21 与本地浏览器门禁已完成，GATE-C 仅余真实手机人工验证。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **当前 main 基线**：`979b7db`；阶段 B/C 任务分支为 `codex/r3-phase-b-c-t08-t21`，未合并 main，未开展阶段 D/E/F。

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
| A 立即退役返图/动态并收缩联系渠道 | 已发布；用户已确认完成 | GATE-A 已完成 |
| B Expand 新模型与安全 | T08～T14 已完成并完成全量回归 | GATE-B 已完成 |
| C 动效与 Hero | T15～T21 已完成；五档本地浏览器通过，真实手机待用户验证 | GATE-C 部分完成 |
| D 作品与领养 | 未开始 | GATE-D |
| E 委托投递 | 未开始 | GATE-E |
| F 最终评审与发布 | 未开始 | GATE-R3 |

## 4. 当前风险

### 4.1 R3-A 不可恢复

生产删除开始后返图媒体不可恢复。必须 dry-run、用户核对、强确认、对象验证、database contract、clean backup restore。

### 4.2 外部快照

应用只能管理自己创建/已知的备份。ECS/云盘/第三方快照必须由用户在控制台确认，Agent 不得虚报完成。

### 4.3 Hero 集合版本

四个 collection 已分别使用 version、上传归属和完整顺序 CAS；后续写入仍必须串行处理 409，不得退回共享首页 version 或局部顺序 patch。

### 4.4 领养误公开

`preparing/scheduled/in_production/event_sale/NULL` 不会自动变 available；后台人工复核清单已提供，实际歧义项仍必须由景宸确认。

### 4.5 OSS CORS 与应用 Origin

OSS CORS 通配是用户确认的现状和目标，不是风险 finding，也不是门禁。实现风险在于匿名 API 自身的 Origin/token/TTL/限流与签名 PUT 校验，不能误把 CORS `*` 当成取消应用安全校验的理由。

### 4.6 联系渠道迁移

应用和目标 Schema 均已收缩为 `qq | qq_group`。`0036_r3_a_contract.sql` 要求复杂旧库存在 T03 成功标记，但允许只含历史默认退役账号、不含二维码/媒体/业务数据的新库直接收缩；对象或 ESA 未清理时仍在 DROP 前阻断。

### 4.7 委托 PII

手机号、QQ、体型和私有设定图已限制在委托持久模型及认证管理详情边界；日志/URL/analytics/错误仍禁止，阶段 E 接入表单时必须复用现有匿名安全服务。

## 5. 下一步

1. 推送 `codex/r3-phase-b-c-t08-t21`，以最终远端分支 SHA 运行 CI/Review；本地测试不代签远端 CI 或独立 Review；
2. 用户使用真实手机验证首页动态地址栏、横竖方向切换、首屏无白块、轮播控件与 reduced-motion；完成前保持 GATE-C 第一项未勾选；
3. 用户验收与独立 Review 仍分别记录，不由本次实现代签；
4. 本分支不得自行合并 main；GATE-C 关闭前不进入阶段 D，阶段 E/F 同样保持未开始。

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
