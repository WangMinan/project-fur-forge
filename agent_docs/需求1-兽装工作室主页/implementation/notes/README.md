# 实施记录索引

> **角色**：为 dated implementation notes 提供导航。历史记录描述当时事实；当前规则以 `../../STATE.md`、SPEC、PLAN、TASKS 和 REVIEW 为准。
> **最后校准**：2026-08-06。

## 当前入口

- 当前阶段：[`../../STATE.md`](../../STATE.md)；
- 当前规格：[`../../requirements/SPEC.md`](../../requirements/SPEC.md)；
- 当前媒体策略：[`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)；
- 当前计划：[`../../planning/PLAN.md`](../../planning/PLAN.md)；
- 当前任务：[`../TASKS.md`](../TASKS.md)；
- 当前执行路由：[`../EXECUTION_ROUTING.md`](../EXECUTION_ROUTING.md)；
- 当前评审：[`../../review/REVIEW.md`](../../review/REVIEW.md)；
- 当前产物：[`../../artifacts/ARTIFACTS.md`](../../artifacts/ARTIFACTS.md)。

## C.1 当前记录

目录：`t34-c1/`

- `T34-F1-SITE-DISPLAY-MEDIA-2026-08-05.md`：站点无水印媒体身份和新发布路径；
- `T34-F2-PUBLIC-VISUAL-CLOSURE-2026-08-06.md`：首页入口、聚合投影和竖图详情；
- `T34-F3-CONTENT-CARDS-2026-08-06.md`：文案 Card 与分区并发；
- `T34-F4-ARCHITECTURE-DEBT-2026-08-06.md`：错误 reason 和部分前端拆分，后端拆分未完；
- `T34-F5-OPERATION-RECOVERY-2026-08-06.md`：上传清扫与限流，operation 恢复未完；
- [`T34-C1-RECHECK-2026-08-06.md`](./t34-c1/T34-C1-RECHECK-2026-08-06.md)：最新 Actions、部署配置和剩余任务复核。

后续新增：

- F4/F5 完整服务边界与恢复记录；
- F1 reconcile 与真实双 Bucket 记录；
- F2/F3 最终产品收口记录；
- F6/F7 最新全绿 Actions 记录；
- F8 用户验收与独立 Review 记录。

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

禁止：

- 把 dated note 当作当前 SPEC；
- 为了让结果看起来通过而删除首次失败；
- 默认把测试截图写回旧历史目录；
- 记录凭据、私有 Object Key、签名 URL、联系人或真实 Session；
- 用测试数量替代真实浏览器、媒体和进程恢复观察。

## 历史目录

- `t01-t09/`：视觉基线与工程底座；
- `t14-t18/`：上传、媒体与发布；
- `gate07-watermark/`：历史可配置水印 profile；
- `t19-t22/`：作品详情、首页与完整字段；
- `t23-t25/`：多图角色与常规领养；
- `t26-t27/`：委托、信息页与营业状态；
- `t28-t34/`：首页、SEO、备份、安全、性能和历史最小镜像；
- 其他根级 dated notes：早期数据库、认证、OSS 与阶段门禁证据。

GATE-07 和旧 T34 的记录对当时事实有效，但不能覆盖 2026-08-05 之后的无水印站点展示规则、C.1 operation 恢复和完整交付要求。

普通截图和 trace 进入 `test-results/`、`playwright-report/` 或 GitHub Actions artifact；只有明确批准的最终验收证据才进入 `t34-c1/screenshots/`。
