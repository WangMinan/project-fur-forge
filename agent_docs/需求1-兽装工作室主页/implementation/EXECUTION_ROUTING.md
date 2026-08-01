# 执行责任路由

> **角色**：记录模型、人员与工作轨道的可变执行安排。
> **效力**：本文件不改变 foundation、SPEC/增量、PLAN/增量、`.design` 或 `TASKS.md` 的产品范围和完成定义。
> **生效日期**：2026-08-01（水印 v2 校准后）。

## 1. 当前角色

| 角色 | 当前责任 | 当前安排 |
| --- | --- | --- |
| `UI_PRIMARY` | Vue 页面/组件、响应式、浏览器状态、交互、无障碍与视觉证据 | Kimi K3 |
| `ENGINEERING_PRIMARY` | 数据库、迁移、认证、安全、OSS、事务、服务端契约、公开投影与运维验证 | GPT 5.6 Sol |
| `REVIEW` | 对代码、截图、性能、安全、媒体和任务证据做独立复核 | 未参与相应实现的独立 Agent |
| `ACCEPTANCE` | 业务和视觉结果最终确认 | 用户 |

`UI_PRIMARY` 无权自行修改数据库、API、权限、profile identity、发布事务或产品事实。发现接口冲突时应停止相关实现并交回工程侧。

## 2. 已收口状态

- T01–T18、GATE-06 与 EXT-02 已完成并合入 `main`。
- T14–T18 已完成条件直传、媒体核验/私有预处理、`recipe-v1`、`brand-standard-v1`、作品 CRUD、发布/下架和管理端接线。
- 景宸在 S4 前追加大型居中、可配置 Logo 水印要求。旧 v1 完成状态保留；新要求通过 GATE-07 增量实现。
- T19 尚未启动，不得绕过 GATE-07。

## 3. 当前批次顺序

### S4 · GPT 5.6 Sol

分支建议：

```text
feature/gate07-t19-t20-engineering-sol
```

职责：

1. 复核 T14–T18 当前 `main` 的业务、安全、OSS 和事务边界；只修复会阻塞后续的工程问题，不重做已验收 UI。
2. 完成 GATE-07 工程侧：
   - `watermark_logo` 站点资产角色；
   - 不可变 `watermark_profiles` 与 `site_branding`；
   - 默认 `brand-centered-v2`（center / 50 / 60）；
   - 受保护上传、候选、草稿、预览、应用和进度 API；
   - 真实 OSS 私有预览；
   - 已发布作品/首页目标 variant 完整再生成、验证、原子切换和精确清理；
   - 旧 v1 不再满足当前发布检查；
   - 删除服务端唯一硬编码 Logo 路径和单图四角业务依赖。
3. 锁定 T19/T20 服务端 repository、公开 DTO、首页轮播管理 API 和 SSR 数据接口。
4. 输出 `GATE07-T20-UI-HANDOFF.md`，不得实现 Kimi 的最终页面。
5. 工程侧完成不等于 GATE-07 通过；GATE-07 保持未勾选，等待 Kimi UI 和最终复核。

### K2 · Kimi K3

分支建议：

```text
feature/gate07-t19-t20-kimi
```

依赖：S4 已合入最新 `main`，接口和 fake/test adapter 已锁定。

执行顺序：

1. `/admin/site/branding`：候选上传/选择、50/60 默认参数、固定居中、真实 OSS 四比例预览、影响摘要、应用进度和失败恢复；移除作品编辑器四角安全角控件。
2. T19：真实作品详情 SSR 页面和三视口证据。
3. T20：真实作品列表、首页精选、首页横竖双源轮播、`/admin/site/home` 和浏览器请求证据。
4. 不得在 Kimi 分支内发明 profile 字段、Object Key、处理参数或原子切换规则。
5. GATE-07、T19、T20 的最终勾选交给后续工程复核。

### S5 · GPT 5.6 Sol

分支建议：

```text
review/gate07-t19-t20-closure-sol
```

职责：

1. 复核并收口 GATE-07：真实 OSS、默认视觉、更换候选、参数变化、旧 profile 保持、完整切换、泄漏、三视口和清理；
2. 复核并收口 T19/T20：SSR、公开投影、横竖请求、缓存、错误、无障碍和安全；
3. 只有完整定义满足时才勾选 GATE-07、T19、T20；
4. 形成 `T21-REVIEW-PREP.md`；不自行通过 T21。

### R1 · 独立 GPT 5.6 Sol

使用全新会话和干净环境执行 T21，从空库完成：管理员初始化、作品创建、私有上传、居中水印发布、首页双源轮播、公开浏览、Logo 候选切换/原子再生成、下架和精确清理。用户拥有最终批准权。

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

## 5. 独立门禁

实现者准备证据，独立审查者复核；用户批准明确要求用户验收的结论：

- GATE-07：可配置居中水印迁移；
- T21：第一垂直切片；
- T34：P0 可部署版本；
- T42：P1 一期闭环；
- T49/T50：上线前综合审查和最终 E2E；
- T53：景宸真实使用验收。

## 6. 分支策略

每个批次从已经合并并验证的最新 `main` 创建短分支；不得依赖长期 mock、过期 DTO 或未合并 profile。当前推荐：

```text
feature/gate07-t19-t20-engineering-sol
feature/gate07-t19-t20-kimi
review/gate07-t19-t20-closure-sol
```

模型或订阅变化只更新本文件；业务、数据、接口和体验变化必须先更新上游契约。
