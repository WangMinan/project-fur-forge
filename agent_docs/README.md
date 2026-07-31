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

该文件只记录可变的执行安排，不属于产品契约，也不改变 `TASKS.md` 的任务范围、依赖或完成定义。Kimi K3 继续担任后续前端切片的 `UI_PRIMARY`；T06–T11 与 EXT-02 已完成。

## 当前状态

截至 2026-07-31，T01–T11 与 EXT-02 已完成。T10 的双 Bucket、水印和跨桶能力完整通过；T11 已建立 SQLite/Drizzle、版本化迁移、强制 PRAGMA、环境路径隔离和一致性备份底座。

同日根据用户提供的渔屋参考截图、横版领养设定例图和现有代码交叉检查，已把以下后续契约同步到 foundation、SPEC、PLAN、设计、模型、TASKS 和 STATE：

- 首页 1–5 项横版/竖版双源轮播及后台专用编辑器；
- 领养设定图、出厂照、返图和首页图的媒体角色与比例；
- 私有原图无水印、公开衍生图 OSS 烘焙水印；
- 当前 Logo 图形标衍生 favicon、Touch Icon 与水印。

这些后续内容尚未实现。下一项为 T12；当前批次在 T13 后停止，不进入 T14。

当前技术主线为单 Nuxt 4 全栈应用、Node.js 24 LTS、Nitro、SQLite/Drizzle、单镜像/单进程，以及已创建的两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、草稿衍生图、临时对象和受控预览；
- `project-furry-forge-public`：仅保存已发布的网页衍生图。

一期不建设站内委托表单、交易、支付、订单、多管理员、万能 CMS、消息队列或自动媒体 worker。
