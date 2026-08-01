# 产物索引

> **角色**：登记当前契约、状态路由、历史证据和实施产物。

## 当前契约

水印相关条款按以下局部增量读取；冲突时增量优先，其他内容继续由原主文件约束：

| 层级 | 主文件 | 当前水印增量 |
| --- | --- | --- |
| 地基 | `foundation/README.md` | `foundation/WATERMARK-CENTERED-V2.md` |
| 规格 | `requirements/SPEC.md` | `requirements/WATERMARK-CENTERED-V2.md` |
| 计划 | `planning/PLAN.md` | `planning/WATERMARK-CENTERED-V2.md` |
| 模型投影 | `models/README.md` | `models/WATERMARK-CENTERED-V2.md` |
| 设计 | `.design/` | `.design/WATERMARK-CENTERED-V2.md` |
| 任务 | `implementation/TASKS.md` | GATE-07 为下一项，T19 被阻断 |
| 状态 | `STATE.md` | 2026-08-01 水印 v2 校准后 |

## 当前实施与证据

| 产物 | 状态 | 说明 |
| --- | --- | --- |
| T01–T13 | 已完成 | 应用底座、配置/Host/日志、共享契约、视觉基线、SQLite/P0 Schema、唯一管理员认证 |
| GATE-06 | 已完成 | Kimi 接入真实登录/Session/退出/改密和浏览器安全证据 |
| T10/EXT-02 | 已完成 | 双 Bucket、30 MB 原图、FFmpeg 私有处理源、OSS 水印和跨桶保存实测 |
| T14–T18 后端记录 | 已完成 | `implementation/notes/T14-UPLOAD-ENGINEERING-2026-07-31.md` 至 `T18-PUBLICATION-ENGINEERING-2026-07-31.md` |
| T14–T18 UI/修复记录 | 已完成 | `implementation/notes/t14-t18-ui/T14-T18-UI-REPAIR-2026-08-01.md` |
| 水印 v2 校准记录 | 当前 | `implementation/notes/DOCS-WATERMARK-CENTERED-V2-2026-08-01.md` |
| GATE-07 工程记录 | 工程完成、待合入 | `implementation/notes/GATE07-WATERMARK-ENGINEERING-2026-08-01.md`：迁移、种子、API、真实 OSS、原子切换、清理和自动化验证 |
| GATE-07 UI 交接 | 已锁定 | `implementation/notes/GATE07-UI-HANDOFF.md`：Kimi 页面接线、版本、状态、失败恢复与证据契约 |
| GATE-07 | 待 UI/视觉/用户确认 | 工程侧完成不等于门禁通过；任务保持未勾选 |
| T19–T21 | 未开始 | 依赖 GATE-07 |

## 当前执行文档

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 执行责任路由 | `implementation/EXECUTION_ROUTING.md` | S4 工程完成待合入 → K2 仅 GATE-07 UI → S5 门禁收口；T19/T20 后置 |
| 任务清单 | `implementation/TASKS.md` | 唯一可勾选清单；T14–T18 保持完成，GATE-07 下一项 |
| 状态机 | `STATE.md` | 当前决定、门禁和下一步 |

## 历史证据

- `materials/`：竞品截图、景宸品牌/Logo/设定图证据，只读参考，不复制竞品资产；
- `planning/prototype-v1/`：只保留页面职责和交互参考；
- `implementation/notes/`：记录当时事实；
- `brand-standard-v1`：18% 宽度、70% 不透明度、四角水印的历史实现；
- `brand-centered-v2`：新目标，居中、默认 50% 不透明度、60% 缩放，可选 Logo 候选。

## 外部门禁

- EXT-01：正式 Logo 使用范围、完整组合标/图形标/favicon/Touch Icon、正式水印候选和跨素材安全区；
- EXT-02：已通过。

## 下一批预期产物

K2 应新增：

- `/admin/site/branding` 三视口与真实预览证据；
- v1 四角控件移除、版本冲突、生成失败和清理重试证据。

S5 应新增 GATE-07 独立收口记录。T19/T20 产物只在 GATE-07 通过并重新路由后创建。
