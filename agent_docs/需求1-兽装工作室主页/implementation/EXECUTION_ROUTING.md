# 执行责任路由

> **角色**：记录模型、人员与工作轨道的可变执行安排。
> **效力**：本文件不改变 foundation、SPEC/增量、PLAN/增量、`.design` 或 `TASKS.md` 的产品范围和完成定义。
> **生效日期**：2026-08-02（T21 findings 修复后）。

## 1. 当前角色

| 角色 | 当前责任 | 当前安排 |
| --- | --- | --- |
| `UI_PRIMARY` | Vue 页面/组件、响应式、浏览器状态、交互、无障碍与视觉证据 | T19/T20 已交付，Kimi K3 |
| `ENGINEERING_PRIMARY` | 数据库、迁移、认证、安全、OSS、事务、服务端契约、公开投影与运维验证 | T21 findings 修复已交付，GPT 5.6 Sol |
| `REVIEW` | 对代码、截图、性能、安全、媒体和任务证据做独立复核 | T21 下一执行者，必须未参与本轮修复 |
| `ACCEPTANCE` | 业务和视觉结果最终确认 | T21 独立证据后由用户确认 |

`UI_PRIMARY` 无权自行修改数据库、API、权限、profile identity、发布事务或产品事实。发现接口冲突时应停止相关实现并交回工程侧。

## 2. 已收口状态

- T01–T20、GATE-06、GATE-07 与 EXT-02 已完成；GATE-07 已发布回 `main`。
- T14–T18 已完成条件直传、媒体核验/私有预处理、`recipe-v1`、`brand-standard-v1`、作品 CRUD、发布/下架和管理端接线。
- 景宸在 S4 前追加的大型居中、可配置 Logo 水印已通过 GATE-07 用户验收；旧 v1 完成状态继续作为历史事实保留。
- T19/T20 的服务端契约、最终 Vue 页面、管理任务进度、真实图片浏览器证据与工程门禁已在 `feature/t19-t20-kimi` 收口；记录见 `implementation/notes/T19-T20-CLOSURE-2026-08-01.md`。

## 3. 当前批次顺序

### T21 · findings 修复后的独立复审

1. 首次独立审查结论及复审条件见 `implementation/notes/T21-REVIEW-2026-08-01.md`；
2. 实现者已修复 3 个 must-fix 与 1 个 should-fix，并完成 lint、typecheck、单元、集成、全量 E2E、生产 build/verify；
3. 未参与本轮修复的 `REVIEW` 从空库和真实 OSS 重放完整链路，复核小图 409、同源预览、下架冲突/失败状态和精确清理；
4. 独立审查通过后再交用户 `ACCEPTANCE`，其前不得勾选 T21 或进入 T22。

## 4. 联合任务交接规则

工程侧先提供：

1. Zod 请求/响应 Schema；
2. API 路由、方法、权限、资源版本和 no-store；
3. 成功、校验、冲突和服务失败响应；
4. 数据库约束、迁移、fixture/fake adapter；
5. 媒体角色、profile identity、OSS 参数、发布/切换原子性；
6. 服务端单元/集成/真实 OSS 结果。

Kimi 再提供：

1. Vue 页面、组件和 composable；
2. loading/empty/error/conflict/operation 状态；
3. 桌面、平板、手机布局；
4. 真实 OSS 预览和公开请求证据；
5. 键盘、焦点、减少动效、无溢出和 E2E；
6. 截图、实施记录和接口冲突清单。

所有执行角色共同遵守：长耗时操作必须有真实、持续、可恢复的进度；E2E 必须按用户路径和页面风险设计断言并复核截图/日志/trace，不能以测试数量代替质量结论。

## 5. 独立门禁

实现者准备证据，独立审查者复核；用户批准明确要求用户验收的结论：

- GATE-07：可配置居中水印迁移；
- T21：第一垂直切片；
- T34：P0 可部署版本；
- T42：P1 一期闭环；
- T49/T50：上线前综合审查和最终 E2E；
- T53：景宸真实使用验收。

## 6. 分支策略

每个批次从已经合并并验证的最新 `main` 创建短分支；不得依赖长期 mock、过期 DTO 或未合并 profile。GATE-07 历史分支在发布完成后删除：

```text
feature/gate07-watermark-engineering-sol
feature/gate07-watermark-ui-kimi
```

当前批次分支为 `feature/t19-t20-kimi`；用户已明确授权真实预览服务端补丁留在该分支。模型或订阅变化只更新本文件；业务、数据、接口和体验变化必须先更新上游契约。
