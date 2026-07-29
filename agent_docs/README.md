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

## 执行责任路由

当前模型分工、短分支批次、全栈任务交接和独立门禁安排见 [`需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`](./需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md)。

该文件只记录可变的执行安排，不属于产品契约，也不改变 `TASKS.md` 的任务范围、依赖或完成定义。Kimi K3 继续担任后续前端切片的 `UI_PRIMARY`；T06–T08 已完成，当前批次切换到由 `ENGINEERING_PRIMARY` 主责的 T09。

## 当前状态

截至 2026-07-30，T01–T08 已完成。用户已经从 A/B 候选中选定 Kimi 方案作为后续生产视觉基线，并完成 T08 验收：横向精选轨道为首页最终方案，T06/T07 视觉基线通过，C1、C3–C5 接受现状，`must-fix = 0`。落选的编辑型网格及实验开关已删除；下一项为 T09。

当前技术主线为单 Nuxt 4 全栈应用、Node.js 24 LTS、Nitro、SQLite/Drizzle、单镜像/单进程，以及已创建的两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、草稿衍生图、临时对象和受控预览；
- `project-furry-forge-public`：仅保存已发布的网页衍生图。

一期不建设站内委托表单、交易、支付、订单、多管理员、万能 CMS、消息队列或自动媒体 worker。
