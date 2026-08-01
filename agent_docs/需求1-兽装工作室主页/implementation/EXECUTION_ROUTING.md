# 执行责任路由

> **角色**：记录模型、人员与工作轨道的可变执行安排。
> **效力**：本文件不改变 foundation、SPEC/增量、PLAN/增量、`.design` 或 `TASKS.md` 的产品范围和完成定义。
> **生效日期**：2026-08-02（GATE-07 用户验收后）。

## 1. 当前角色

| 角色 | 当前责任 | 当前安排 |
| --- | --- | --- |
| `UI_PRIMARY` | Vue 页面/组件、响应式、浏览器状态、交互、无障碍与视觉证据 | Kimi K3 |
| `ENGINEERING_PRIMARY` | 数据库、迁移、认证、安全、OSS、事务、服务端契约、公开投影与运维验证 | GPT 5.6 Sol |
| `REVIEW` | 对代码、截图、性能、安全、媒体和任务证据做独立复核 | 未参与相应实现的独立 Agent |
| `ACCEPTANCE` | 业务和视觉结果最终确认 | 用户 |

`UI_PRIMARY` 无权自行修改数据库、API、权限、profile identity、发布事务或产品事实。发现接口冲突时应停止相关实现并交回工程侧。

## 2. 已收口状态

- T01–T18、GATE-06、GATE-07 与 EXT-02 已完成；GATE-07 已发布回 `main`。
- T14–T18 已完成条件直传、媒体核验/私有预处理、`recipe-v1`、`brand-standard-v1`、作品 CRUD、发布/下架和管理端接线。
- 景宸在 S4 前追加的大型居中、可配置 Logo 水印已通过 GATE-07 用户验收；旧 v1 完成状态继续作为历史事实保留。
- T19/T20 的服务端工程批次已启动；最终 Vue 页面仍未启动。

## 3. 当前批次顺序

### T19/T20 · 工程契约

1. GPT 5.6 Sol 在 `feature/t19-t20-engineering-sol` 实现公开作品 repository/service、列表/精选投影和 fake adapter；
2. 同一分支实现 `/api/admin/v1/site/home/**`、首页启用发布校验、公开首页投影与稳定错误；
3. 工程侧提供请求/响应、版本、srcset、SSR 和 fixture 交接并运行完整门禁；
4. 本批不实现最终 Vue 页面、不勾选 T19/T20、不合并 `main`；Kimi 后续在独立 UI 批次接线。

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

下一批分支名在路由 T19 时确定。模型或订阅变化只更新本文件；业务、数据、接口和体验变化必须先更新上游契约。
