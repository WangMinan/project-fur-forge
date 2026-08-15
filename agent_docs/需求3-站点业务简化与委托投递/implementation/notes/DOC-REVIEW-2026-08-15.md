# 需求3文档合入后复查 · 2026-08-15

## 范围

复查 main 中需求3的 foundation、SPEC、models、design、PLAN、DATA-MIGRATION、TASKS、routing、STATE、Review、`agent_docs/README.md` 与 `CLAUDE.md`，并对照用户最终确认和当前代码架构。

本记录只说明文档修正；没有修改应用代码、数据库、OSS、ESA 或生产数据。

## 发现

### R3-DOC-001 · HIGH · 退役时序与“立即删除”冲突

原计划把返图/动态永久删除放在 Hero、作品、领养、委托全部完成之后。用户已明确要求立即永久删除。修正为独立第一发布单元 R3-A，并要求先完成本地演练、focused review 和生产维护。

### R3-DOC-002 · HIGH · Hero 集合缺少持久并发域

原 models 定义了 `AdminHeroCollection.version`，但持久模型只有 item version。修正为固定四行 `site_hero_collections`，所有新增、排序、启停和上传使用 collection expectedVersion；四集合 upload owner context 分离。

### R3-DOC-003 · HIGH · 领养状态默认映射可能误公开

原计划把除 delivered 外的旧状态全部映射为 available。`preparing/scheduled/in_production/event_sale/NULL` 语义并不等于可领养。修正为只自动映射 available/delivered，其余保持 NULL 并由景宸逐条确认。

### R3-DOC-004 · HIGH · 公开条件 PUT 缺少 CORS 契约

匿名表单需要从 public Origin 直传私有 OSS，但原文档未把 Bucket CORS、preflight 和 live probe列为门禁。已补充精确 public/admin Origin 和所需 headers，production 禁止 wildcard。

### R3-DOC-005 · MEDIUM · FAQ 删除范围扩张到 email action

用户明确要求完整删除 FAQ；没有明确要求销毁 `commission_email_action`。原文档将两者一起删除属于越界。现保留 email action，只从 `/commission` 主行动降级为备用邮件说明。

### R3-DOC-006 · MEDIUM · 备份删除顺序风险

原计划可能在新的净化备份验证前删除旧应用备份。现改为：对象删除与 contract → 服务验证 → 创建并恢复验证 clean backup → 删除旧应用备份。外部快照由操作员单独确认。

### R3-DOC-007 · MEDIUM · 媒体 usage 与现有代码不一致

当前公开详情 usage 为 `detail`，原 models 写成 `work-detail`。已统一沿用 `detail`。

### R3-DOC-008 · LOW · 无关字段被顺手纳入删除

旧 `contact_qq/contact_douyin` 兼容列不属于本需求用户授权范围。已从删除计划移除。

### R3-DOC-009 · LOW · 匿名上传状态命名漂移

原模型使用小写 session status，与现有 upload 状态机惯例不同。已改为大写状态并要求复用失败码/阶段。

## 结果

- 活文档已同步为新的阶段顺序和契约；
- T00 仍表示“文档地基完成”，不代表任何工程、迁移或生产删除已完成；
- 下一步必须从 R3-A 返图/动态立即退役开始。
