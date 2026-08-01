# agent_docs

本目录是项目的 spec-driven 工作区。当前唯一活动需求为 [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)。

## 权威顺序

1. `foundation/README.md`：产品边界与不可违背的原则；
2. `foundation/WATERMARK-CENTERED-V2.md`：2026-08-01 居中可配置水印地基增量；仅在水印条款冲突时覆盖上一文件；
3. `requirements/SPEC.md` 与 `requirements/WATERMARK-CENTERED-V2.md`：业务需求、数据边界与水印增量规格；
4. `planning/PLAN.md` 与 `planning/WATERMARK-CENTERED-V2.md`：技术路线、阶段优先级与水印迁移计划；
5. `.design/`：公开站、管理端及 `.design/WATERMARK-CENTERED-V2.md` 的体验与视觉契约；
6. `implementation/TASKS.md`：唯一可勾选任务清单；
7. `STATE.md`：当前状态、最近决策和下一步入口。

`models/README.md` 与 `models/WATERMARK-CENTERED-V2.md` 是上游规格/计划的实施投影，不构成额外权威层级。`materials/`、`planning/prototype-v1/` 与 `implementation/notes/` 是证据或历史记录，不得覆盖当前契约。

## 执行责任路由

当前模型分工、短分支批次、全栈任务交接和独立门禁见 [`需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`](./需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md)。

Kimi K3 继续担任 `UI_PRIMARY`，GPT 5.6 Sol 担任阶段 B 的 `ENGINEERING_PRIMARY`。联合任务必须由工程侧先锁定 Schema/API/权限/错误/事务/媒体配方，再由 Kimi 实现页面和浏览器证据。

## 当前状态

截至 2026-08-01，T01–T18、GATE-06 与 EXT-02 已完成。T14–T18 已跑通角色化上传、媒体核验与大图私有预处理、OSS 公开配方与水印、非领养作品 CRUD、发布/下架和管理端接线。

景宸随后确认水印方向变更：

- 从小型四角角标升级为大尺寸居中水印；
- 新目标 profile 为 `brand-centered-v2`，默认 50% 不透明度、60% 缩放；
- 水印 Logo 候选可以在管理端上传和选择，不再由服务端硬编码唯一文件路径；
- 配置变化必须生成新 variant 并原子切换，不能覆盖旧对象或混用 profile。

因此 T14–T18 的历史完成状态保持不变，但 T19 被 `GATE-07 · 可配置居中水印迁移` 阻断。下一步由 GPT 5.6 Sol 执行更新后的 S4，先实现 GATE-07 工程侧与 T19/T20 服务端交接；随后 Kimi 完成品牌配置和 T19/T20 UI。

当前技术主线仍为单 Nuxt 4 全栈应用、Node.js 24 LTS、Nitro、SQLite/Drizzle、单镜像/单进程和两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、私有处理源、品牌候选、草稿和受控预览；
- `project-furry-forge-public`：只保存已经发布并验证的网页衍生图。

一期不建设站内交易、支付、订单、多管理员、万能 CMS、消息队列或自动媒体 worker。
