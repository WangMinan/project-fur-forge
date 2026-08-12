# T06 · 委托邮件估价 FAQ

## 基线与范围

- 基线：`aa49e59 feat: show official contact channel cards`。
- 复用 `commission_faq_json`、现有 FAQ 管理 Card、公开委托页和 FAQ 分区并发版本。
- 不增加 SMTP、邮件发送、访客表单、附件上传或第二个模板组件。

## 实现

- 新增前向迁移 `0029_requirement_2_commission_email_faq.sql`，固定 UUID 为 `2f7c23c4-8e8a-4cc4-a8c5-3a8f3b8e9d61`。
- 问题为“邮件估价咨询可以按什么格式填写？”，回答包含角色名、委托装型、身高/体型、设定图、希望实现的细节、期望时间和其它说明，并说明由工作室人工回复估价。
- FAQ Schema 与管理提示上限统一从 8 提高到 9；已有 8 项全部保留，模板追加为第 9 项。
- SQL 仅在固定 UUID 不存在且当前数组少于 9 项时追加；写入时递增 `commission_faq_version` 和更新时间，避免旧管理会话静默覆盖迁移结果。

## 验证

- 首次数据库定向测试：12/13；旧联系渠道迁移测试硬编码剩余迁移为 2，新增 `0029` 后实际为 3。改为根据 journal 与 `0027` 位置计算剩余数量。
- `pnpm test -- tests/unit/site-content.test.ts tests/unit/site-content-presentation.test.ts`：2 files、14/14。
- `pnpm test:integration -- tests/integration/database.test.ts tests/integration/site-content-sections.test.ts`：2 files、18/18。
- 空库 FAQ 从 5 条变为 6 条，最后一条固定 ID/问题/资料清单正确。
- 既有 8 条全部保留，模板追加为第 9 条，FAQ 分区版本加一；第二次 `migrateDatabase` 应用 0 条。
- `pnpm lint`、`pnpm typecheck`、`git diff --check`：通过。

## 结论

`PASS`。T06 完成；公开委托页继续消费既有 FAQ 投影，T07 搜索契约为下一项，T16 独立 Review 与 T17 用户验收保持开放。
