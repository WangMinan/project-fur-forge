# agent_docs

本目录是项目的 spec-driven 工作区。当前唯一活动需求为 [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)。

## 权威顺序

1. `foundation/README.md`：产品边界与不可违背的原则；
2. `requirements/SPEC.md`：业务需求、数据边界与验收结果；
3. `planning/PLAN.md`：技术路线、阶段优先级与实施策略；
4. `.design/`：公开站与管理端的体验、信息架构和视觉契约；
5. `implementation/TASKS.md`：唯一可勾选任务清单；
6. `STATE.md`：当前状态、最近决策和下一步入口。

`materials/`、`planning/prototype-v1/` 与 `implementation/notes/` 是证据或历史记录；出现冲突时不得覆盖上述当前契约。

## 当前状态

截至 2026-07-29，T01–T03 已完成，下一项为 T04。T04–T08 先完成公开站与管理端的生产视觉基线；T09 之后按垂直切片先跑通“一件作品从后台录入、上传、发布到公开站展示”的完整链路，再扩展其余一期能力。当前这轮只校准文档，不实施 T04；恢复视觉编码仍以用户后续明确指令为准。

当前技术主线为单 Nuxt 4 全栈应用、Node.js 24 LTS、Nitro、SQLite/Drizzle、单镜像/单进程，以及已创建的两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、草稿衍生图、临时对象和受控预览；
- `project-furry-forge-public`：仅保存已发布的网页衍生图。

一期不建设站内委托表单、交易、支付、订单、多管理员、万能 CMS、消息队列或自动媒体 worker。
