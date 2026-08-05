# 产物索引

> **角色**：列出当前可用产物和历史证据入口，不复制需求、技术方案或任务状态。
> **当前阶段**：C.1 P0 收口。当前状态见 [`../STATE.md`](../STATE.md)。

## 1. 当前权威文档

| 主题 | 文件 |
| --- | --- |
| 产品边界 | [`../foundation/README.md`](../foundation/README.md) |
| 功能规格 | [`../requirements/SPEC.md`](../requirements/SPEC.md) |
| 媒体公开与保护 | [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) |
| 技术计划 | [`../planning/PLAN.md`](../planning/PLAN.md) |
| 数据模型 | [`../models/README.md`](../models/README.md) |
| 设计入口 | [`../.design/README.md`](../.design/README.md) |
| 任务清单 | [`../implementation/TASKS.md`](../implementation/TASKS.md) |
| 执行路由 | [`../implementation/EXECUTION_ROUTING.md`](../implementation/EXECUTION_ROUTING.md) |
| 当前评审 | [`../review/REVIEW.md`](../review/REVIEW.md) |
| 历史证据索引 | [`../implementation/notes/README.md`](../implementation/notes/README.md) |

## 2. 当前代码产物

主分支当前包含：

- Nuxt 4 公开站与管理端；
- SQLite/Drizzle schema 与迁移；
- 唯一管理员认证；
- 双 OSS Bucket 媒体存储；
- 条件直传和媒体校验；
- 作品、领养、首页、委托和站点内容管理；
- 作品发布/下架；
- Hero 发布和低分辨率适配；
- 水印候选和 profile 应用；
- 备份、恢复和生产验证脚本；
- unit、integration 和 Playwright 测试；
- 历史最小 Dockerfile。

这些代码是 C.1 修改基线，不代表新规格已经实现。特别是：

- 站点 Hero 当前仍使用旧水印公开变体；
- 首页入口仍复用委托 Hero 和领养设定图；
- 文案仍使用集中 Card 和整包保存；
- 长任务仍缺少重启 lease；
- 当前镜像仍是最小运行镜像，没有 Compose/Nginx/完整运维命令；
- 还没有 GitHub Actions 门禁。

## 3. 品牌与素材

正式素材来源和角色映射见：

- [`../materials/MATERIAL-MANIFEST.md`](../materials/MATERIAL-MANIFEST.md)；
- `../materials/picture-examples/`；
- `public/brand/` 中的已生成站点图标。

素材文件说明来源和授权边界，不定义媒体是否打水印。当前保护规则只看媒体策略。

## 4. 设计产物

设计 Token 和信息架构：

- `../.design/public-site/`；
- `../.design/admin-console/`。

`planning/prototype-v1/` 是早期原型验证，不是生产源码模板。dated screenshots 是当时验收证据，不是自动更新的视觉基线。

## 5. 历史实施证据

历史记录集中在 `../implementation/notes/`，包括：

- T01–T09 视觉与基础工程；
- T10/EXT-02 OSS 预检；
- T11–T13 数据库与认证；
- T14–T18 上传、媒体和发布；
- GATE-07 水印 profile；
- T19–T25 作品、首页和领养；
- T26–T30 委托、信息页、筛选和 SEO；
- T31–T34 备份、安全、性能、Docker 与全链 Review。

这些记录保留当时命令、截图、finding 和结论。当前规则变化不修改其历史内容。

## 6. 归档指针

以下旧文件不再维护独立规则，只指向唯一媒体策略：

- `../.design/WATERMARK-CENTERED-V2.md`；
- `../foundation/WATERMARK-CENTERED-V2.md`；
- `../requirements/WATERMARK-CENTERED-V2.md`；
- `../planning/WATERMARK-CENTERED-V2.md`；
- `../models/WATERMARK-CENTERED-V2.md`。

需要查看 GATE-07 当时实现时，使用 `../implementation/notes/gate07-watermark/`。

## 7. C.1 预期新增产物

T34-F1–T34-F8 将新增或更新：

- 站点无水印媒体迁移与配方；
- 首页聚合投影和业务入口组件；
- 方向感知详情图集；
- 分区文案 API、版本和 Card；
- 持久操作 runner 与上传清扫命令；
- 稳定业务错误 reason；
- 标准完整 Node 24 镜像；
- `compose.yaml`；
- Nginx 双 Host 配置；
- live/ready；
- GitHub Actions；
- C.1 实施和独立 Review notes。

只有 T34-F8 通过后，以上产物才构成 P0 正式候选。
