# 实施记录索引

> **角色**：导航 dated notes。历史记录描述当时事实；当前规则以 `STATE.md`、SPEC、媒体策略、PLAN 和 TASKS 为准。
> **最后校准**：2026-08-10。

## 当前入口

- [`../../STATE.md`](../../STATE.md)：当前阶段；
- [`../../requirements/SPEC.md`](../../requirements/SPEC.md)：业务契约；
- [`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)：媒体事实源；
- [`../../planning/PLAN.md`](../../planning/PLAN.md)：技术计划；
- [`../TASKS.md`](../TASKS.md)：唯一任务清单；
- [`../PRODUCTION-LAUNCH-HANDBOOK.md`](../PRODUCTION-LAUNCH-HANDBOOK.md)：上线前人工 Handbook；
- [`../../planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](../../planning/ESA-PRODUCTION-DECISION-2026-08-09.md)：当前 ESA/DNS/TLS/媒体方案；
- [`../../planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](../../planning/ESA-PRODUCTION-DECISION-2026-08-09.md)：当前 ESA 生产决策；
- [`../../review/REVIEW.md`](../../review/REVIEW.md)：冻结的既有 Review 记录。

## 阶段 C.1

目录：`t34-c1/`。关键入口：

- [`T34-C1-RECHECK-2026-08-06.md`](./t34-c1/T34-C1-RECHECK-2026-08-06.md)：Actions、部署配置与遗留复核；
- [`T34-C1-CLOSURE-2026-08-07.md`](./t34-c1/T34-C1-CLOSURE-2026-08-07.md)：迁移、分层、恢复、双 Bucket 与 readiness 收口；
- [`T34-C1-USER-ACCEPTANCE-2026-08-07.md`](./t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md)：用户验收和 `GATE-C1`。

旧 notes 中“等待验收”或早期媒体候选已经失效。

## 阶段 D

目录：`stage-d/`。

- [`STAGE-D-SCOPE-2026-08-07.md`](./stage-d/STAGE-D-SCOPE-2026-08-07.md)：当时的初始范围，其中一图一记录等内容后来已被实现期调整覆盖；
- [`STAGE-D-DESIGN-REVIEW-2026-08-07.md`](./stage-d/STAGE-D-DESIGN-REVIEW-2026-08-07.md)：当时的设计观察；
- [`T35-ENGINEERING-2026-08-08.md`](./stage-d/T35-ENGINEERING-2026-08-08.md)：最终“设定 + 多张返图”模型、迁移与门禁；
- [`T36-ENGINEERING-2026-08-08.md`](./stage-d/T36-ENGINEERING-2026-08-08.md)：无水印媒体链、返图管理和公开墙；
- [`T37-ENGINEERING-2026-08-08.md`](./stage-d/T37-ENGINEERING-2026-08-08.md)：复用 adoption 的展会掉落；
- [`T42-USER-ACCEPTANCE-2026-08-09.md`](./stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)：用户人工验收，关闭阶段 D 用户门禁。

T35–T37 的工程记录不是独立 Review。用户同意将一次新的综合独立 Review 并入 T49；在 T49 记录出现前不得倒签。

## 阶段 E/F 决策

目录：`stage-e/`。

- [`STAGE-E-F-BOUNDARY-2026-08-09.md`](./stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md)：后续用户决策，产品与上线基线开发合并进阶段 E；阶段 F 主要由用户/远程开发机执行，并允许补充独立运维小脚本。该记录覆盖旧文档中的阶段归属，不改变生产技术事实。
- [`T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md`](./stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md)：用户授权卸载服务器 ACME/证书、改为 HTTP/80 回源，以及 ESA 私有 OSS 回源当前状态的执行与验证记录。
- [`T46-ENGINEERING-2026-08-09.md`](./stage-e/T46-ENGINEERING-2026-08-09.md)：最小化第一方统计的迁移、HMAC/90 天清理、公开采集、管理概览及自动/浏览器门禁；用户隐私文案与 T49 Review 保持开放。
- [`T51-ENGINEERING-2026-08-09.md`](./stage-e/T51-ENGINEERING-2026-08-09.md)：公开导航短品牌、备案配置/空值隐藏、页脚与 tracked 素材审计；正式素材选择与 T49 Review 保持开放。
- [`T51-F1-ENGINEERING-2026-08-09.md`](./stage-e/T51-F1-ENGINEERING-2026-08-09.md)：作品页间距、低分辨率设定图私有 FFmpeg 适配、原图保留、失败恢复与门禁结果；T49 Review 保持开放。
- [`T51-F2-ENGINEERING-2026-08-09.md`](./stage-e/T51-F2-ENGINEERING-2026-08-09.md)：公开作品/领养固定数量编号分页、单页分页栏、筛选/非法页码契约与三视口真实浏览器证据；T49 Review 保持开放。
- [`T51-F3-ENGINEERING-2026-08-10.md`](./stage-e/T51-F3-ENGINEERING-2026-08-10.md)：低分辨率出厂照非阻断上传/发布、私有 FFmpeg Lanczos 适配源、原图保留、失败重试和相关门禁；用户确认当前浏览器行为可用，T49 Review 保持开放。
- [`T51-F4-ENGINEERING-2026-08-10.md`](./stage-e/T51-F4-ENGINEERING-2026-08-10.md)：全管理端 FFmpeg 动态等待反馈、异步子进程、`recipe-v3` 作品竖图单居中水印缩放、旧配方整体回退及本地门禁；T49 Review 保持开放。
- [`T51-F5-ENGINEERING-2026-08-10.md`](./stage-e/T51-F5-ENGINEERING-2026-08-10.md)：竖版作品详情、3:4 卡片和后台公开水印预览统一相对水印尺寸，新不可变身份、完整本地门禁与用户视觉确认；T49-R1 独立 Review 保持开放。
- [`T52-E1-ENGINEERING-2026-08-09.md`](./stage-e/T52-E1-ENGINEERING-2026-08-09.md)：服务端 OSS、浏览器上传与 ESA 公开媒体 Endpoint 分离，独立 ESA 配置、生产 Schema/模板/verify 与测试证据；T49 Review 保持开放。
- [`T52-E2-ENGINEERING-2026-08-09.md`](./stage-e/T52-E2-ENGINEERING-2026-08-09.md)：OSS/ESA preflight 的 dry-run/live 边界、Bucket/对象/衍生物/权限验证、官方 SDK、脱敏证据与本地门禁；真实云侧 live 与 T49 Review 保持开放。
- [`T52-E2-PREFLIGHT-RELAXATION-2026-08-10.md`](./stage-e/T52-E2-PREFLIGHT-RELAXATION-2026-08-10.md)：用户明确允许排障期通配 CORS 并保留既有本地测试衍生对象；预检只验证上传能力，不再检查衍生 Bucket CORS 或全桶数据库一致性，也不清理旧对象。
- [`T52-E3-ENGINEERING-2026-08-09.md`](./stage-e/T52-E3-ENGINEERING-2026-08-09.md)：ESA `prod/web/**` 公开投影、SSR/API 泄漏门禁、H3 直接依赖与生产产物验证；真实云侧 live 与 T49 Review 保持开放。
- [`T52-E4-ENGINEERING-2026-08-10.md`](./stage-e/T52-E4-ENGINEERING-2026-08-10.md)：ESA 缓存策略基线、精确 file purge、持久状态/重试/启动恢复、作品/返图/Hero 管理反馈与本地门禁；真实云侧 warm-cache 实测和 T49 Review 保持开放。
- [`T52-ESA-NODE-ESM-FIX-2026-08-10.md`](./stage-e/T52-ESA-NODE-ESM-FIX-2026-08-10.md)：远端 live preflight 在云写入前暴露 ESA SDK 原生 Node ESM 默认导出缺陷；实现提交 `70538e0` 统一 preflight/Nitro 互操作并补真实构造守卫，SHA `4e24916` Actions 全绿，等待独立 Review 与新镜像。
- [`T52-HTTP-ORIGIN-DEV-RUNTIME-FIX-2026-08-10.md`](./stage-e/T52-HTTP-ORIGIN-DEV-RUNTIME-FIX-2026-08-10.md)：宿主机检查器继续阻断 443、Nginx 证书配置和活动 ACME，但不再因停用 unit/未引用历史文件 FAIL 或删除；同时将 ESA SDK 内联进 Nitro，修复本地 dev 错误解析到 `D:\scripts\esa-sdk.mjs`。

后续按任务新增 T49/T50/GATE-E 的 Review 与冻结证据，以及 T53-F1～F5 的远程执行/验收证据。

## 新记录最低要求

1. 日期、任务号和基线 commit；
2. 范围与非目标；
3. 变更和数据/回滚边界；
4. 首次失败与冻结 findings；
5. 修复、重放和实际命令；
6. 浏览器/媒体/进程证据；
7. `PASS / PASS WITH FOLLOW-UP / NOT PASS`；
8. Review 与用户验收分别由谁签署。

不得记录凭据、完整私有 Object Key、签名 URL、联系人、授权备注或真实 Session。普通截图和 trace 留在测试产物目录，只有批准的最终证据进入 notes。

## 历史目录

- `t01-t09/`：视觉基线与底座；
- `t14-t18/`：上传、媒体与发布；
- `gate07-watermark/`：历史水印 profile；
- `t19-t34/`：作品、首页、内容、安全、性能与镜像；
- `t34-c1/`：阶段 C.1；
- `stage-d/`：阶段 D；
- `stage-e/`：阶段 E/F 决策、工程和远程执行证据。
