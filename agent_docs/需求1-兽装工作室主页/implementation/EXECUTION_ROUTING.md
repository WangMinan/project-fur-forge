# 执行责任路由

> **角色**：记录当前执行角色、main 写入纪律和交接要求。
> **效力**：不改变 foundation、SPEC、媒体策略、PLAN、设计 IA 或 TASKS 的产品范围。
> **当前阶段**：C.1，按 T34-F1–T34-F8 串行收口。

## 1. 角色

| 角色 | 责任 | 当前安排 |
| --- | --- | --- |
| `BACKEND_PRIMARY` | 数据库、迁移、Schema、API、安全、OSS、事务、长任务、部署和运维命令 | GPT-5.6 Sol |
| `FRONTEND_PRIMARY` | Vue 页面/组件、状态、响应式、无障碍、视觉和浏览器接线 | 用户按任务在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中选择 |
| `REVIEW` | 契约、代码、浏览器、媒体、安全、性能、部署和证据复核 | GPT-5.6 Sol，必须使用新的审查上下文 |
| `ACCEPTANCE` | 最终业务和视觉确认 | 用户；T34-F8 统一验收 C.1 |

`FRONTEND_PRIMARY` 不自行修改数据库、API 权限、媒体身份、发布事务或部署安全边界。发现接口缺口时形成明确清单交回 `BACKEND_PRIMARY`。

实现者不能为自己的自测代签独立 Review。Reviewer 必须从最新 `main` 重新读取文档、启动应用并重放路径。

## 2. 当前任务顺序

严格按以下顺序：

1. T34-F1：站点无水印媒体契约；
2. T34-F2：首页与详情视觉；
3. T34-F3：文案 Card 与分区并发；
4. T34-F4：架构与错误契约减债；
5. T34-F5：长任务恢复、上传清扫、限流；
6. T34-F6：完整镜像、Compose、Nginx、健康检查；
7. T34-F7：CI；
8. T34-F8：总门禁与用户验收。

每项允许先做只读分析，但写入必须串行。不得为了并行让多个 Agent 同时改动 `media-recipe`、Hero 服务、共享 Schema、内容 API 或部署文件。

## 3. main 直推纪律

- 不创建功能分支或 PR；
- 写入前读取远端最新 `main`；
- 确认没有另一个写入 Agent 正在修改同一批文件；
- 一个任务按后端 → 前端 → Review 顺序交接；
- 提交小而可回滚，提交信息带任务号和意图；
- 不 force push、不硬 reset、不重写已验收历史；
- 不删除或清空 `.env`；
- 冲突时停止写入并重新读取当前契约，不以整文件覆盖抢分支；
- dated notes 保留首次失败和后续修复。

## 4. 文档读取顺序

编码前至少读取：

1. [`../STATE.md`](../STATE.md)；
2. [`../foundation/README.md`](../foundation/README.md)；
3. [`../requirements/SPEC.md`](../requirements/SPEC.md)；
4. [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)；
5. [`../planning/PLAN.md`](../planning/PLAN.md)；
6. [`../models/README.md`](../models/README.md)；
7. [`TASKS.md`](./TASKS.md)；
8. 与本任务对应的 `.design` IA；
9. [`notes/README.md`](./notes/README.md) 和相关历史 notes。

五份 `WATERMARK-CENTERED-V2.md` 是归档指针，不是独立规格。

## 5. 后端交接

`BACKEND_PRIMARY` 在前端开始前提供：

- Zod 请求/响应 Schema；
- 路由、方法、权限、Host、Origin、CSRF、版本和 no-store；
- 稳定错误 `code` 与业务 `reason`；
- 数据库迁移、约束、backfill 和回滚边界；
- 媒体用途、保护模式、配方身份和公开投影；
- 长任务状态、失败、lease 和恢复行为；
- fake adapter、fixture 与相关测试；
- 明确非目标。

接口发生变化时先更新共享 Schema，不让前端复制本地临时类型。

## 6. 前端交接

`FRONTEND_PRIMARY` 提供：

- 页面、组件、composable 和样式；
- loading、empty、dirty、saving、saved、validation、conflict、operation、failure、recovery；
- 三固定视口；
- 横竖图片请求和自然尺寸；
- 键盘、焦点、触控和减少动效；
- console/network 检查；
- 定向 E2E 和截图/trace；
- 未解决接口清单。

视觉修改不得通过泄漏原图、关闭水印保护或放宽服务端约束完成。

## 7. Review 要求

Reviewer 必须：

- 对照当前文档和任务完成定义；
- 审查迁移、数据兼容和失败恢复；
- 运行与改动相关的 lint/typecheck/build/unit/integration/E2E；
- 实际启动公开和管理 Host；
- 模拟管理员和新访客点击；
- 检查 400、401、403、404、409、429、500；
- 检查容器中断、任务恢复、清理和重载；
- 检查真实图片解码、URL、横竖资源和水印矩阵；
- 在 `390×844`、`768×1024`、`1440×900` 检查布局；
- 记录首次 findings、修复和最终结论。

只看 HTTP 200、元素数量、测试通过数或实现者截图不能判定完成。

## 8. C.1 特定责任

### T34-F1

- 后端先完成 schema、配方、生成器、公开投影和真实 OSS；
- 前端再更新 Hero、业务入口和管理预览文案；
- Reviewer 验证 profile 切换只改变作品图片。

### T34-F2

- 后端优先提供首页聚合 DTO；
- 前端完成业务入口和方向感知图集；
- Reviewer 使用真实横竖图和路由复用路径。

### T34-F3

- 后端先做分区版本和局部 API；
- 前端拆 Card 和冲突体验；
- Reviewer 使用两个管理上下文验证不同分区和同分区并发。

### T34-F4

- 先冻结行为测试，再拆服务和 composable；
- 不在同一提交混入新功能和大范围命名整理；
- Reviewer 比较重构前后 API、SQL、公开 DTO 和页面行为。

### T34-F5

- 后端主导；
- 必须真实杀进程、重启和恢复；
- 前端只接服务端持久状态，不模拟完成。

### T34-F6/F7

- 部署和 CI 由后端主导；
- Nginx、Compose、镜像和工作流必须进入版本控制；
- **本轮禁止本地 Docker 构建与容器验收**：F6 只准备文件并做静态检查，镜像构建验证在 F7 的 GitHub Actions 中执行；
- Docker Hub 发布只读 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`，本轮不创建 tag、不触发发布；
- 空目录、空卷、正式域名与 TLS 演练延期到用户部署阶段。

### T34-F8

- **本项由用户执行**，实施者只负责交付可 Review 状态与证据；
- 实施者不得代签 T34-F8 或 GATE-C1，也不得把自测记为独立 Review；
- 用户查看公开端、管理端后明确确认，再勾选本项与 GATE-C1。

## 9. 测试策略

常规任务：

- `pnpm lint`；
- `pnpm typecheck`；
- 改 Nuxt、迁移、运行时或生产输出时 `pnpm build`；
- 运行直接相关 unit/integration/E2E。

T34-F8：

- 完整 unit、integration、E2E、build、production verify；
- 真实双 Bucket；
- Docker/Compose/Nginx；
- 空卷 migrate/init/ready；
- 进程中断恢复；
- 升级和回滚；
- CI 结果；
- 三视口真 Chrome。

测试截图默认进入 `test-results` 或 CI artifact，只有明确批准的最终验收截图进入 notes。
