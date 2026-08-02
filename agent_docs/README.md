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

当前模型分工、main 直推、串行交接和独立门禁见 [`需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`](./需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md)。

GPT-5.6 Sol 固定担任 `BACKEND_PRIMARY` 和新上下文中的 `REVIEW`；`FRONTEND_PRIMARY` 由用户按任务在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中选择。联合任务按后端 → 前端 → Review 串行直接提交 `main`。

## 当前状态

截至 2026-08-03，T01–T21、GATE-06、GATE-07、EXT-01 与 EXT-02 已完成。T22 后端已完成三用途共享 Schema、管理 API/service、历史展会兼容、人工排序/精选和公开精选 6 项上限；现有数据库结构已满足约束，没有新增迁移。T22 仍等待前端接线、独立浏览器 Review 和用户验收，保持未勾选，不得进入 T23。

当前活动水印为 `brand-centered-v2`，默认 50% 不透明度、60% 缩放；旧 `brand-standard-v1` 只保留为历史身份。

项目新增两项通用质量门禁：所有长耗时操作必须展示基于真实服务端状态、可恢复的任务进度；E2E 必须验证有意义的用户路径和实际页面结果，不能以用例数量、状态码或元素数量自证页面质量。

当前技术主线仍为单 Nuxt 4 全栈应用、Node.js 24 LTS、Nitro、SQLite/Drizzle、单镜像/单进程和两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、私有处理源、品牌候选、草稿和受控预览；
- `project-furry-forge-public`：只保存已经发布并验证的网页衍生图。

一期不建设站内交易、支付、订单、多管理员、万能 CMS、消息队列或自动媒体 worker。
