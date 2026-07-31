# 产物索引

> **角色**：登记当前权威文档、历史证据和实施产物。

## 当前权威文档

| 层级 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- |
| 地基 | `foundation/README.md` | 2026-07-31 媒体契约校准 | P0/P1/P2、双 Bucket、首页双源轮播、媒体角色、水印与视觉硬边界 |
| 规格 | `requirements/SPEC.md` | 2026-07-31 修订版 | OQ-119 已回答；首页轮播、设定图/出厂照/返图、品牌图标与水印结果已定义，当前无开放 OQ |
| 计划 | `planning/PLAN.md` | 2026-07-31 执行版 | 视觉前置、第一件作品垂直切片、双 Bucket、角色化 recipe、水印和站点图标 |
| 设计路由 | `.design/README.md` | 2026-07-31 已校准 | 公开站/管理端分轨、双源轮播、媒体角色、蓝色比例和阶段可见性 |
| 公开设计 | `.design/public-site/` | 2026-07-31 已校准 | 首页双源轮播、横版领养设定图、竖版作品图、返图墙、水印和站点图标 |
| 管理设计 | `.design/admin-console/` | 2026-07-31 已校准 | `/admin/site/home`、横竖配对、角色化媒体区、水印预览和 P0/P1/P2 导航 |
| 模型 | `models/README.md` | 2026-07-31 已实施校准 | T12 与 S2 Review 已实现 `site_hero_slides`、媒体角色/用途矩阵、处理来源谱系、无水印原图和版本化水印 identity |
| 任务 | `implementation/TASKS.md` | 2026-07-31 已更新 | T01–T13 与 EXT-02 已完成；下一批为 T13 认证前端接线，T14 未启动 |
| T04–T05 实施记录 | `implementation/notes/T04-T05-2026-07-29.md` | 已验证 | Kimi 入选方案、两种首页精选对比、三视口截图与质量门禁；当时 Hero 仍为单图夹具 |
| T06–T07 实施记录 | `implementation/notes/T06-T07-2026-07-29.md` | 已验证 | 作品列表/详情、管理端工作台、三视口证据与自动化自查；当时媒体仍为通用样张 |
| T08 验收记录 | `implementation/notes/t06-t07/T08-REVIEW-PREP.md` | 2026-07-30 已通过 | 精选横向轨道定稿、T06/T07 基线通过、`must-fix = 0` |
| T09 工程核心记录 | `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md` | 已验证并合入 `main` | 契约、双 Bucket 配置、错误分流、安全日志与生产守卫 |
| T09 界面实施与收口 | `implementation/notes/T09-UI-2026-07-30.md`、`implementation/notes/T09-CLOSURE-2026-07-31.md` | 2026-07-31 已通过 | 用户验收、完整门禁复核和最终任务收口 |
| T10 预检说明 | `implementation/OSS-PREFLIGHT.md` | 已实现 | 最小权限、秘密放置、确定性预检、控制台与水印边界 |
| T10/EXT-02 证据 | `implementation/notes/T10-OSS-PREFLIGHT-2026-07-31.md` | 已通过 | 30 MB 原图、内嵌 FFmpeg 私有处理源、双 Bucket、水印与跨桶处理完整通过 |
| T11 SQLite 证据 | `implementation/notes/T11-SQLITE-2026-07-31.md` | 已通过 | Drizzle、版本化迁移、PRAGMA、路径隔离和 SQLite Backup API |
| T12 Schema 证据 | `implementation/notes/T12-P0-SCHEMA-2026-07-31.md` | 已通过 | 11 张 P0 表、两项领域迁移、媒体/首页约束、variant identity 和投影泄漏守卫 |
| T13 认证证据 | `implementation/notes/T13-AUTH-2026-07-31.md` | 已通过 | 唯一管理员、密封 Cookie Session、锁定、改密/重置和 Host/Origin/CSRF |
| S2 Review 收口 | `implementation/notes/S2-REVIEW-CLOSURE-2026-07-31.md` | 已通过 | production SMTP、私有响应、认证运维、媒体来源谱系和 Hero 完整发布条件 |
| 状态 | `STATE.md` | 2026-07-31 已更新 | 当前决策、T11–T13 Review 收口与 Kimi 认证前端交接 |

## 当前执行文档

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 执行责任路由 | `implementation/EXECUTION_ROUTING.md` | 2026-07-31 当前生效；记录 T11–T13/S2 Review 已收口、Kimi 认证前端交接和后续默认分工，不属于产品契约 |

## 历史与证据

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 竞品调研 | `materials/兽装工作室主页调研_2026-07-26/` | 只读参考，不复制资产 |
| 景宸品牌与 Logo 例图 | `materials/景宸品牌例图_2026-07-29/`、`materials/picture-examples/logo/` | 当前品牌源与色值证据；最终使用范围和衍生 manifest 由 EXT-01 确认，不复制旧价格或二维码 |
| 领养设定例图 | `materials/picture-examples/领养/` | 横版设定图、色板与完整画布的产品证据；不代表已获正式上线授权 |
| 技术方案输入 | `materials/fursuit-studio-solution-package/` | 历史输入；单 Bucket 内容已被当前 PLAN 覆盖 |
| 快速原型 v5 | `planning/prototype-v1/` | 只保留页面职责、顺序和关键交互；视觉与旧业务字段不再权威 |
| 实施记录 | `implementation/notes/` | 记录当时事实，不回写成当前架构；仍需追溯的旧文档移入 `implementation/notes/archive/`，不再引用的重复截图只保留在 Git 历史 |
| 历史实施文档 | `implementation/notes/archive/` | 历史证据 | 保存已被当前契约覆盖的文档；效力见目录内 README |
| Git 历史 | commit `7b01cba966f0a9049a4af0de08f7cc4ce993760d` 及以前 | 保存旧 SPEC/OQ/PLAN 全文，供追溯而非实施 |

## 当前实施产物

- T01：应用底座与质量脚本；
- T02：运行配置、Host 边界和日志脱敏工具；
- T03：共享 Schema/DTO 初版；遗留契约已由 T09 工程核心修订；
- T04：公开站设计系统、导航壳与当前单 `src` 响应式图片组件；
- T05：首页单图全幅首屏、编辑型精选网格/横向轨道对比、图片式业务入口和营业状态；Kimi 方案获用户选中；
- T06：作品列表、筛选、详情图集、事实、价格和空状态生产视觉样张；
- T07：管理端登录、作品列表、编辑工作台、通用媒体状态和发布检查生产视觉样张；
- T08：用户完成视觉验收，精选横向轨道定稿，T06/T07 基线通过，`must-fix = 0`；
- T09：工程核心与界面修补均已完成，OQ-119 已回答，用户验收和工程侧完整门禁复核通过。
- T10：确定性 OSS 预检、内嵌 FFmpeg 私有预处理、最小权限与秘密说明均已实现，完整外部能力有实测证据。
- T11：SQLite/Drizzle 运行底座、版本化迁移、强制 PRAGMA、环境路径隔离、临时测试库和一致性备份底座已实现。
- T12：11 张 P0 表、媒体角色与数量约束、首页横竖配对、完整 variant identity 和显式公开/管理投影已实现；S2 Review 增量迁移补齐 role/usage、`source_variant_id` 和大原图处理来源约束。
- T13：唯一管理员服务端认证、幂等初始化、登录/退出/改密/受保护重置、SessionVersion、锁定和 Host/Origin/CSRF 已实现；S2 Review 补齐私有响应 no-store、显式迁移前置和隐藏 TTY 输入，前端接入按用户要求交给 Kimi。

尚未实施：后台首页轮播、横竖双源切换、媒体角色分区、正式媒体编排中的 OSS 水印、favicon/Touch Icon。它们已进入后续任务契约，但不得写入当前完成产物。

## 外部门禁产物

- EXT-01：Logo 来源与使用范围、完整组合标/图形标/favicon/Touch Icon/水印 profile manifest、正式作品/返图授权范围、焦点和文字/水印安全区；
- EXT-02：双 Bucket 地域/CORS/BPA/权限、30 MB 私有原图、内嵌 FFmpeg 处理源、OSS 水印与跨 Bucket `sys/saveas` 已验证通过。
