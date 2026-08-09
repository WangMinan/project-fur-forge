# 实施记录索引

> **角色**：导航 dated notes。历史记录描述当时事实；当前规则以 `STATE.md`、SPEC、媒体策略、PLAN 和 TASKS 为准。
> **最后校准**：2026-08-09。

## 当前入口

- [`../../STATE.md`](../../STATE.md)：当前阶段；
- [`../../requirements/SPEC.md`](../../requirements/SPEC.md)：业务契约；
- [`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)：媒体事实源；
- [`../../planning/PLAN.md`](../../planning/PLAN.md)：技术计划；
- [`../TASKS.md`](../TASKS.md)：唯一任务清单；
- [`../PRODUCTION-LAUNCH-HANDBOOK.md`](../PRODUCTION-LAUNCH-HANDBOOK.md)：上线前人工 Handbook；
- [`../../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](../../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)：阿里云调研；
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

- [`STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md`](./stage-e/STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md)：两个既有 Bucket、CDN 鉴权、Endpoint、AK/SK、备案品牌和撤销时限的用户决策。
- [`STAGE-E-F-BOUNDARY-2026-08-09.md`](./stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md)：后续用户决策，产品与上线基线开发合并进阶段 E；阶段 F 主要由用户/远程开发机执行，并允许补充独立运维小脚本。该记录覆盖旧文档中的阶段归属，不改变生产技术事实。
- [`STAGE-E-TLS-DECISION-2026-08-09.md`](./stage-e/STAGE-E-TLS-DECISION-2026-08-09.md)：最终宿主机部署与 TLS 决策：app-only Compose，并复用现有宿主机 Nginx、`acme.sh + dns_ali`、证书与 root cron；覆盖聊天中曾考虑的原生 `nginx-module-acme` 和后续过度改造方案。
- [`T46-ENGINEERING-2026-08-09.md`](./stage-e/T46-ENGINEERING-2026-08-09.md)：最小化第一方统计的迁移、HMAC/90 天清理、公开采集、管理概览及自动/浏览器门禁；用户隐私文案与 T49 Review 保持开放。
- [`T51-ENGINEERING-2026-08-09.md`](./stage-e/T51-ENGINEERING-2026-08-09.md)：公开导航短品牌、备案配置/空值隐藏、页脚与 tracked 素材审计；正式素材选择与 T49 Review 保持开放。
- [`T51-F1-ENGINEERING-2026-08-09.md`](./stage-e/T51-F1-ENGINEERING-2026-08-09.md)：作品页间距、低分辨率设定图私有 FFmpeg 适配、原图保留、失败恢复与门禁结果；T49 Review 保持开放。
- [`T51-F2-ENGINEERING-2026-08-09.md`](./stage-e/T51-F2-ENGINEERING-2026-08-09.md)：公开作品/领养固定数量编号分页、单页分页栏、筛选/非法页码契约与三视口真实浏览器证据；T49 Review 保持开放。

后续按任务新增 T52-E1～E6/T49/T50/GATE-E 的工程与 Review 证据，以及 T53-F1～F5 的远程执行/验收证据。

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
