# 实施备注

> 只记现场核对与过程。正式契约在 [SPEC](../../requirements/SPEC.md)，执行状态在 [TASKS](../TASKS.md)。

## 当前备注

2026-09-06，本轮只读核对与文档初始化：

- `git fetch` 后 `main` / `origin/main` 同为 `651148e32a678698b48ed6fec4f193ba97fe2971`，工作树干净；创建 `codex/requirement-5-smtp-spec` 文档分支。
- `server/api/public/v1/commission-submissions/index.post.ts` 调用 `createCommissionSubmission`；服务在同一 SQLite 事务中插入委托并消费上传会话，响应只有 `receiptCode`。当前不存在 SMTP 副作用。
- `createCommissionSubmission` 已有一次性上传消费、手机号 pending 查重、版本、资产 READY 和确认项检查；通知须在这一共同入口整合，不能改变既有拒绝规则。
- `getCommissionDesignReference` 经 `commission_design_reference` / READY 关联取私有图，返回内容和 MIME，可评估复用。
- `shared/schemas/commission.ts` 允许单张 JPEG/PNG/WebP，最大 `20,000,000` 字节；须验证编码后邮件大小，不推断 QQ SMTP 一定接受上限附件。
- 管理内容页 contact 锚点由 `SiteOfficialChannelsCard.vue` 承载，复用 contact 分区版本。公开 service 显式投影 `email` / `officialChannels`，新增内部字段须维持显式隔离。
- 当前页名出现在 `app/pages/admin/site/content.vue` 与 `app/utils/admin-nav.ts`；`AdminShell.vue` 还有旧名称说明注释。
- `package.json` 没有 SMTP 库；`server/plugins/02.operation-recovery.ts` 有媒体 operation 启动恢复，但不能假设它已支持通知或持续重试。
- `docker-compose.yaml` 使用显式环境映射；仅更新 `.env.compose.example` 不足以接入运行环境。
- `.gitignore` 忽略 `.env`，允许两个环境示例跟踪；本轮未读取真实 `.env` 内容，也未写入授权码。
- 用户已明确内部邮箱用途和不改隐私文字；保留用户决定，不以此宣称已完成法律评审。

## 初始化时尚无运行证据

未启动服务、打开本地后台、连接 SMTP 或投递邮件；本次代码阅读不是浏览器验收、收件证明或生产状态证明。

## 实施交接

后续编码与验证已完成，当前事实见 [2026-09-06 Handoff](2026-09-06-SMTP-HANDOFF.md)，以上只读笔记保留为初始化时的历史记录。

- [PR 与镜像发布交接](2026-09-06-PR-RELEASE.md)：后续文案核对、测试不变约束与明确发布授权。
