# 实施备注

> **角色**：记录阶段 4 的执行事实与验证证据。正式契约由 foundation、SPEC/增量、PLAN/增量、`.design`、TASKS 和 STATE 决定，本目录不作为需求来源。

## 当前状态

- T01–T18、GATE-06、GATE-07 与 EXT-02 已完成。
- T14–T18 的后端、管理端、真实浏览器和 OSS 证据已收口。
- 景宸随后要求把小型四角水印改为可由管理端选择 Logo 的大型居中水印。
- [`DOCS-WATERMARK-CENTERED-V2-2026-08-01.md`](./DOCS-WATERMARK-CENTERED-V2-2026-08-01.md) 记录代码/文档 Review、阿里云参数核对、产品决定、同步路径和任务映射。
- [`GATE07-WATERMARK-ENGINEERING-2026-08-01.md`](./GATE07-WATERMARK-ENGINEERING-2026-08-01.md) 记录迁移、种子、API、真实 OSS、原子切换、E2E 排查和工程验证。
- [`GATE07-UI-HANDOFF.md`](./GATE07-UI-HANDOFF.md) 是 Kimi 实现 `/admin/site/branding` 的唯一工程交接。
- [`GATE07-WATERMARK-UI-2026-08-01.md`](./GATE07-WATERMARK-UI-2026-08-01.md) 记录管理 UI、三视口和浏览器 E2E。
- [`GATE07-CLOSURE-2026-08-02.md`](./GATE07-CLOSURE-2026-08-02.md) 记录联调修复、全站应用进度、质量规则和用户人工验收。
- [`T19-T20-ENGINEERING-2026-08-01.md`](./T19-T20-ENGINEERING-2026-08-01.md) 记录公开读取、首页发布、缓存与安全契约。
- [`T19-T20-UI-HANDOFF.md`](./T19-T20-UI-HANDOFF.md) 是 Kimi 接入公开页和首页管理页的工程交接；T19/T20 仍未勾选。

## 主要实施记录

- [`T01-2026-07-28.md`](./T01-2026-07-28.md)：Nuxt 双访问面最小切片。
- [`T02-T03-2026-07-29.md`](./T02-T03-2026-07-29.md)：配置、Host/日志和共享契约初版。
- [`T02-ORIGIN-ENV-CLOSURE-2026-07-31.md`](./T02-ORIGIN-ENV-CLOSURE-2026-07-31.md)：非测试 origin 与配置硬编码收口。
- [`T04-T05-2026-07-29.md`](./T04-T05-2026-07-29.md)：公开设计系统和首页精选方案。
- [`T06-T07-2026-07-29.md`](./T06-T07-2026-07-29.md)：作品页面和管理工作台视觉样张。
- [`t06-t07/T08-REVIEW-PREP.md`](./t06-t07/T08-REVIEW-PREP.md)：T08 最终验收。
- [`T09-ENGINEERING-CORE-2026-07-30.md`](./T09-ENGINEERING-CORE-2026-07-30.md)、[`T09-UI-2026-07-30.md`](./T09-UI-2026-07-30.md)、[`T09-CLOSURE-2026-07-31.md`](./T09-CLOSURE-2026-07-31.md)：T09 工程、UI 和收口。
- [`T10-OSS-PREFLIGHT-2026-07-31.md`](./T10-OSS-PREFLIGHT-2026-07-31.md)：双 Bucket、30 MB、FFmpeg、OSS 水印和跨桶实测。
- [`T11-SQLITE-2026-07-31.md`](./T11-SQLITE-2026-07-31.md)：SQLite/Drizzle 和备份底座。
- [`T12-P0-SCHEMA-2026-07-31.md`](./T12-P0-SCHEMA-2026-07-31.md)：P0 Schema、媒体角色和投影。
- [`T13-AUTH-2026-07-31.md`](./T13-AUTH-2026-07-31.md)、[`S2-REVIEW-CLOSURE-2026-07-31.md`](./S2-REVIEW-CLOSURE-2026-07-31.md)、[`T13-AUTH-UI-2026-07-31.md`](./T13-AUTH-UI-2026-07-31.md)：认证工程、Review 和 GATE-06。
- [`T14-UPLOAD-ENGINEERING-2026-07-31.md`](./T14-UPLOAD-ENGINEERING-2026-07-31.md)：条件直传。
- [`T15-MEDIA-VALIDATION-2026-07-31.md`](./T15-MEDIA-VALIDATION-2026-07-31.md)：媒体核验和私有预处理源。
- [`T16-RECIPE-WATERMARK-2026-07-31.md`](./T16-RECIPE-WATERMARK-2026-07-31.md)：`recipe-v1` 与历史 `brand-standard-v1`。
- [`T17-WORK-CRUD-ENGINEERING-2026-07-31.md`](./T17-WORK-CRUD-ENGINEERING-2026-07-31.md)：最小作品 CRUD。
- [`T18-PUBLICATION-ENGINEERING-2026-07-31.md`](./T18-PUBLICATION-ENGINEERING-2026-07-31.md)：发布/下架和补偿。
- [`T14-T18-UI-HANDOFF.md`](./T14-T18-UI-HANDOFF.md)：T14–T18 UI 交接。
- [`t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md`](./t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md)：管理端接线、阻塞修复和用户联合验收。

## 当前批记录要求

当前工程分支只锁定 T19/T20 服务端契约；最终 Vue 页面、浏览器视觉证据和联合验收尚未完成。后续收口记录必须说明长耗时任务的进度证据，以及 E2E 实际覆盖的用户路径和页面风险，不能只登记用例数量。

旧 `brand-standard-v1` 和四角水印记录仍是历史事实，不得回写成当时已经实现居中可配置水印。
