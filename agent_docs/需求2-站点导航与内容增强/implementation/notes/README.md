# 实施记录索引

> **状态**：实施中。dated notes 只记录执行事实，不覆盖 STATE、SPEC、PLAN 或 TASKS。

## 当前入口

- [`../../STATE.md`](../../STATE.md)：当前阶段与开放决策；
- [`../../requirements/SPEC.md`](../../requirements/SPEC.md)：产品契约；
- [`../../planning/PLAN.md`](../../planning/PLAN.md)：技术方案与动态方案比较；
- [`../TASKS.md`](../TASKS.md)：唯一任务清单；
- [`../../models/README.md`](../../models/README.md)：目标模型；
- [`../../review/REVIEW.md`](../../review/REVIEW.md)：后续独立 Review。

## 当前记录

- [`T01-NAVIGATION-2026-08-12.md`](./T01-NAVIGATION-2026-08-12.md)：合并委托导航、首次 E2E 失败、修复与同一 SHA 远端质量闭环。
- [`T02-CONTACT-CONTRACT-2026-08-12.md`](./T02-CONTACT-CONTRACT-2026-08-12.md)：固定五平台 contact 契约、旧值迁移和分区并发。
- [`T03-CONTACT-QR-MEDIA-2026-08-12.md`](./T03-CONTACT-QR-MEDIA-2026-08-12.md)：二维码私有上传、无水印公开派生、失败重试与安全投影。
- [`T04-CONTACT-ADMIN-2026-08-12.md`](./T04-CONTACT-ADMIN-2026-08-12.md)：固定五平台账号和二维码编辑、局部保存、预览恢复与冲突草稿保留。
- [`T05-CONTACT-PUBLIC-2026-08-12.md`](./T05-CONTACT-PUBLIC-2026-08-12.md)：公开平台 Logo、二维码、账号网格与三视口验证。
- [`T06-COMMISSION-EMAIL-FAQ-2026-08-12.md`](./T06-COMMISSION-EMAIL-FAQ-2026-08-12.md)：固定 UUID 邮件估价模板迁移、FAQ 上限同步与幂等验证。
- [`T07-PUBLIC-SEARCH-CONTRACT-2026-08-12.md`](./T07-PUBLIC-SEARCH-CONTRACT-2026-08-12.md)：三公开资源共用名称包含匹配与 `q` 契约。
- [`T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md`](./T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md)：三页原生 GET 搜索、查询保留、空态与浏览器验证。
- [`T10-B-UPDATES-ADMIN-2026-08-12.md`](./T10-B-UPDATES-ADMIN-2026-08-12.md)：独立动态表、严格契约、管理 API、后台 CRUD/发布状态与 CAS 冲突。

## 新记录最低要求

1. 日期、任务号和基线 commit；
2. 范围、非目标与依赖；
3. 迁移、媒体、公开投影和回滚边界；
4. 实际命令、首次失败、修复与重测；
5. 浏览器、二维码和三视口证据；
6. `PASS / PASS WITH FOLLOW-UP / NOT PASS`；
7. 独立 Review 与用户验收分开记录。

不得记录凭据、Session、私有 Object Key、签名 URL 或后台未公开内容。
