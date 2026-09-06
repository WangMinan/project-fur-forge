# 模型说明

> 0052 与对应 Schema / DTO 已实现。产品行为以 [SPEC](../requirements/SPEC.md) 为准。

## 新增模型

### 内部通知收件列表

- 存储：`site_content.commission_notification_recipients_json`，JSON 字符串数组。
- 管理字段：`contact.commissionNotificationRecipients: string[]`；继续使用 `sectionVersions.contact`，避免为同一联系方式卡增加第二套保存协议。
- 首次默认值为客服小狗爪和景宸的两个已指定地址；空数组是有效持久状态，不能回退默认值。
- 字段不进入 `publicSiteContentDtoSchema`、首页聚合 DTO、公开页面或公开联系方式配置。

### 逐收件人委托通知

| 字段 | 用途 |
| --- | --- |
| `id` | 通知标识，可用于稳定 Message-ID |
| `submission_id` | 关联委托，不复制正文 |
| `recipient` | 投递时收件快照，仅管理员可见 |
| `status` | `pending / sending / sent / failed / cancelled` 状态 |
| `attempt_count` | 有限重试计数 |
| `next_attempt_at` | 到期重试时间 |
| `lease_expires_at` | 发送领取过期与崩溃恢复 |
| `last_error_code` | 稳定脱敏错误类别，不保存原始 SMTP 响应 |
| `created_at / updated_at / sent_at` | 状态时间；`sent_at` 表示 SMTP 接受时间 |

- 表：`commission_email_notifications`；唯一约束为 `submission_id + recipient`，地址先完成一致规范化。
- “未配置/未启用”可由委托创建时的通知策略标记表达；实施必须能区分历史未启用与意外漏建通知，不事后靠当前全局配置猜测历史。
- 同一委托的不同收件人分别记录状态；聚合“部分成功”等展示状态由记录计算，不改委托 `pending | accepted | rejected`。
- 删除委托前取消未发送项并协调发送中的领取，删除时清理关联通知；已投递的邮箱副本无法由数据库级联删除。

## 已校准模型

- 当前委托持久化称呼、物种、+86 手机、QQ、整数 cm 身高、十分位 kg 体重及一个 `design_asset_id`；邮件字段从现有委托映射。
- 当前公开提交响应只有 `receiptCode`，继续保持。两项声明只沿用既有提交校验，不新增法律证明模型。
- 当前 contact 分区只保存公开邮箱和 QQ / QQ群；新增内部列表不得改变其原有公开投影含义。

## 字段处理规则

- 邮箱采用单地址严格校验，去除首尾空白，拒绝 CR/LF；默认 QQ 邮箱按大小写不敏感去重。其它域名的本地部分是否归一化在实施中明确，不粗暴合并潜在不同账户。
- SMTP 配置字段候选：`SMTP_ENABLED`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`；587 模式必须强制 STARTTLS。最终命名须在两个示例、加载器与 Compose 中一致。
- `SMTP_PASSWORD` 不入数据库、DTO、快照、日志或文档；示例账号使用占位邮箱。
- 通知表不存附件二进制、私有 Key、签名 URL、正文或内部备注；可信关联通过委托与现有资产表解析。
- 非法/超大配置受现有请求体限制和 Schema 约束；不以写死两个列表项代替输入保护。

## 已落地补充

- `commission_submissions.email_notification_policy`：`legacy / enabled / disabled / unconfigured`，记录提交时是否安排通知，不根据当前配置猜测历史。
- `commission_submissions.email_deletion_pending`：持久删除屏障；失败的删除仍保持屏障，避免后续发送读取到不完整资料，受控删除可继续重入。
- 通知表增加 `lease_token` 与 `transmitting_at`：领取所有权与实际网络发送区分，过期领取可恢复，旧 token 不可提交新结果；传输中删除需稍后重试。
- contact 管理 DTO 增加只读 `smtpStatus`（`ready / disabled / invalid`）。ready 表示配置完整，不代签认证或投递。
- 委托列表增加 `emailNotificationStatus`；详情通过独立管理 `GET /commissions/{id}/email` 加载逐收件结果，`POST /commissions/{id}/email-retry` 仅重试符合条件的失败项。
- 最多收件数不写死，仍受既有 64 KiB 管理 JSON 请求体和单邮箱 254 字符边界保护。
