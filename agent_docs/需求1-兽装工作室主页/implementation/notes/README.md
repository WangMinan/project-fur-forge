# 实施记录索引

> **角色**：为 dated implementation notes 提供导航。这里不重复当前需求、计划、模型或任务状态。
> **重要**：历史记录描述当时的实现和 Review；当前规则以 `../../STATE.md` 与当前权威文档为准。

## 当前入口

- 当前阶段：[`../../STATE.md`](../../STATE.md)；
- 当前规格：[`../../requirements/SPEC.md`](../../requirements/SPEC.md)；
- 当前媒体策略：[`../../requirements/MEDIA-PUBLICATION-POLICY.md`](../../requirements/MEDIA-PUBLICATION-POLICY.md)；
- 当前计划：[`../../planning/PLAN.md`](../../planning/PLAN.md)；
- 当前任务：[`../TASKS.md`](../TASKS.md)；
- 当前评审：[`../../review/REVIEW.md`](../../review/REVIEW.md)。

## 记录规则

每个新的实施或 Review note 应包含：

1. 日期、任务号和基线 commit；
2. 范围与明确非目标；
3. 变更文件或服务边界；
4. 数据迁移和回滚边界；
5. 实际执行的命令和结果；
6. 浏览器路径、视口和观察结果；
7. 初始 findings，不得在修复后删除；
8. 修复与重放证据；
9. 最终 `PASS / PASS WITH FOLLOW-UP / NOT PASS`；
10. 用户门禁是否完成。

禁止：

- 把 dated note 当作当前 SPEC；
- 在多个 notes 中复制完整产品规则；
- 为了让结果看起来通过而改写首次失败；
- 默认把测试截图写回旧历史目录；
- 记录凭据、私有 Object Key、签名 URL、联系人或真实 Session。

## 历史阶段

### T01–T09 · 视觉基线与工程底座

目录：`t01-t09/`

包含公开站、作品页和管理端视觉样张，T08 设计门禁，以及基础契约和代码修复。

### T10 / EXT-02 · OSS 预检

相关文件位于实施根目录和早期 notes，记录双 Bucket、条件上传、30 MB 原图、FFmpeg 私有处理源、OSS 图片处理和精确清理。

### T11–T13 · 数据库与认证

记录 SQLite/Drizzle、迁移、唯一管理员、Session、Origin、CSRF、退出、改密和浏览器接线。

### T14–T18 · 上传、媒体与发布

目录：`t14-t18/`

记录角色化上传会话、服务端校验、私有预处理、公开派生、作品 CRUD、发布/下架和前端交接。

### GATE-07 · 可配置水印 profile

目录：`gate07-watermark/`

记录当时从角落水印迁移到 `brand-centered-v2` 的需求、工程、UI、截图、findings 和收口。

该目录是历史证据。2026-08-05 用户确认的新规则已经把首页、委托页和首页业务入口改为无水印站点展示位；当前规则见媒体策略，不回写这些历史 note。

### T19–T22 · 作品详情、首页和完整字段

目录：`t19-t22/`

记录真实 SSR 详情、列表、首页轮播、公开投影、第一作品垂直切片 Review，以及 T22 三用途字段和用户验收。

### T23–T25 · 多图角色与常规领养

目录：`t23-t25/`

记录设定图/出厂照关系、管理端媒体分区、公开领养列表、统一详情和收口。

### T26–T27 · 委托、信息页与营业状态

目录：`t26-t27/`

记录委托固定文案、FAQ、独立委托 Hero、低分辨率适配、关于/联系、政策页、导航、状态和历史人工验收步骤。

T26-F1/T27-F1 的历史工程和 Review 结果保留；最终验收已并入 C.1 T34-F8。

### T28–T34 · 首页、SEO、备份、安全、性能与最小镜像

目录：`t28-t34/`

记录：

- 首页完整顺序；
- 筛选、详情导航和重定向；
- SEO、Sitemap 和图标；
- 备份恢复与 migration hash；
- 安全边界和日志脱敏；
- 性能、三视口和 Hero 查询；
- 完整自动化、真实双 Bucket、历史最小 Docker 镜像和 `ali-oss` runtime finding。

T34 最终 `PASS` 表示当时约定的门禁完成，不覆盖 C.1 对完整镜像、Compose、Nginx、ready、重启任务恢复和 CI 的新增要求。

## C.1 新记录目录

T34-F1–T34-F8 新 notes 应统一放入：

```text
implementation/notes/t34-c1/
```

建议文件：

- `T34-F1-SITE-DISPLAY-MEDIA-YYYY-MM-DD.md`；
- `T34-F2-PUBLIC-VISUAL-CLOSURE-YYYY-MM-DD.md`；
- `T34-F3-CONTENT-CARDS-YYYY-MM-DD.md`；
- `T34-F4-ARCHITECTURE-DEBT-YYYY-MM-DD.md`；
- `T34-F5-OPERATION-RECOVERY-YYYY-MM-DD.md`；
- `T34-F6-DEPLOYMENT-STACK-YYYY-MM-DD.md`；
- `T34-F7-CI-GATES-YYYY-MM-DD.md`；
- `T34-F8-INDEPENDENT-REVIEW-YYYY-MM-DD.md`；
- `screenshots/` 仅存明确批准的最终验收图。

普通测试截图和 trace 进入 `test-results` 或 CI artifact，不写入该目录。

## 查找历史证据

查找某项历史结论时优先按任务号和日期定位，不用 STATE 或 TASKS 中的摘要替代原始 note。若历史 note 与当前活文档冲突：

- 历史 note 对当时事实有效；
- 当前活文档决定现在和下一步；
- 不能删除历史 note 来“解决”冲突；
- 应在新任务 note 中说明迁移原因和兼容边界。
