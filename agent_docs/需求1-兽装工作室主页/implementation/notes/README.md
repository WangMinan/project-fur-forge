# 实施记录索引

> **角色**：为 dated implementation notes 提供导航。历史记录描述当时事实；当前规则以 `../../STATE.md`、SPEC、PLAN、TASKS 和 REVIEW 为准。
> **最后校准**：2026-08-07。

## 当前入口

- 当前阶段：[`../../STATE.md`](../../STATE.md)；
- 当前规格：[`../../requirements/SPEC.md`](../../requirements/SPEC.md)；
- 当前媒体策略：[`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)；
- 当前计划：[`../../planning/PLAN.md`](../../planning/PLAN.md)；
- 未来候选：[`../../planning/FUTURE-ITERATIONS.md`](../../planning/FUTURE-ITERATIONS.md)；
- 当前任务：[`../TASKS.md`](../TASKS.md)；
- 当前执行路由：[`../EXECUTION_ROUTING.md`](../EXECUTION_ROUTING.md)；
- 当前评审：[`../../review/REVIEW.md`](../../review/REVIEW.md)；
- 当前产物：[`../../artifacts/ARTIFACTS.md`](../../artifacts/ARTIFACTS.md)。

未来候选不是实施授权；dated note 也不能覆盖当前活文档。

## 阶段 C.1 记录

目录：`t34-c1/`

- `T34-F1-SITE-DISPLAY-MEDIA-2026-08-05.md`：站点无水印媒体身份和新发布路径；
- `T34-F2-PUBLIC-VISUAL-CLOSURE-2026-08-06.md`：首页入口、聚合投影和竖图详情；
- `T34-F3-CONTENT-CARDS-2026-08-06.md`：文案 Card 与分区并发；
- `T34-F4-ARCHITECTURE-DEBT-2026-08-06.md`：错误契约与后端分层实施过程；
- `T34-F5-OPERATION-RECOVERY-2026-08-06.md`：上传清扫、限流和 operation 恢复过程；
- [`T34-C1-RECHECK-2026-08-06.md`](./t34-c1/T34-C1-RECHECK-2026-08-06.md)：Actions、部署配置和剩余任务复核；
- [`T34-C1-CLOSURE-2026-08-07.md`](./t34-c1/T34-C1-CLOSURE-2026-08-07.md)：迁移 0020/0021、五层边界、lease/heartbeat/启动恢复、SIGKILL、reconcile、双 Bucket、首页/文案和 readiness 收口；
- [`T34-C1-USER-ACCEPTANCE-2026-08-07.md`](./t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md)：用户浏览器人工验收、`GATE-C1` 通过与 CI 后置结论。

阶段 C 已完成。旧 notes 中“等待用户验收”“未完成后端分层”或“返图轻量水印候选”等语句只描述当时事实，不再代表当前状态。

## 阶段 D 记录

目录：`stage-d/`

- [`STAGE-D-SCOPE-2026-08-07.md`](./stage-d/STAGE-D-SCOPE-2026-08-07.md)：用户确认独立 `/returns`、无水印返图、一图一记录、轻量展会掉落、T38/T40 取消、T39 当前取消和 T41 合并。

后续按任务新增：

- T35 实施记录、独立模型/隐私 Review；
- T36 媒体与发布记录、公开/管理 UI 记录、独立浏览器 Review 和用户验收；
- T37 轻量展会掉落后端/前端记录、独立 Review 和用户验收；
- T42 阶段 D 总门禁记录。

## 记录要求

每份新 note 至少包含：

1. 日期、任务号和基线 commit；
2. 范围与明确非目标；
3. 变更文件或服务边界；
4. 数据迁移、兼容和回滚边界；
5. 首次失败与 findings；
6. 修复和重放证据；
7. 实际命令及结果；
8. 浏览器路径、视口、console/network 和图片观察；
9. 最终 `PASS / PASS WITH FOLLOW-UP / NOT PASS`；
10. 用户门禁是否完成。

阶段 D 还应记录：

- 返图是否误用作品水印；
- EXIF、私有 Key 和授权记录泄漏检查；
- 关联作品下架后的公开行为；
- event_drop 是否错误产生独立 event 模型；
- 取消项是否被误建空表、空页面或空导航。

禁止：

- 把 dated note 当作当前 SPEC；
- 为了让结果看起来通过而删除首次失败；
- 默认把测试截图写回旧历史目录；
- 记录凭据、私有 Object Key、签名 URL、联系人、授权备注或真实 Session；
- 用测试数量替代真实浏览器、媒体和进程恢复观察。

## 历史目录

- `t01-t09/`：视觉基线与工程底座；
- `t14-t18/`：上传、媒体与发布；
- `gate07-watermark/`：历史可配置作品水印 profile；
- `t19-t22/`：作品详情、首页与完整字段；
- `t23-t25/`：多图角色与常规领养；
- `t26-t27/`：委托、信息页与营业状态；
- `t28-t34/`：首页、SEO、备份、安全、性能和历史最小镜像；
- `t34-c1/`：阶段 C.1 收口和用户验收；
- `stage-d/`：阶段 D 范围和后续实施证据；
- 其他根级 dated notes：早期数据库、认证、OSS 与阶段门禁证据。

普通截图和 trace 进入 `test-results/`、`playwright-report/` 或 GitHub Actions artifact；只有明确批准的最终验收证据才进入对应阶段记录目录。