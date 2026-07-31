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
| 模型 | `models/README.md` | 2026-07-31 已校准 | `site_hero_slides`、媒体角色、无水印原图、FFmpeg 私有处理源、版本化水印 identity |
| 任务 | `implementation/TASKS.md` | 2026-07-31 已更新 | T01–T10 与 EXT-02 已完成；下一项为 T11 |
| 首页媒体校准记录 | `implementation/notes/DOCS-HOME-MEDIA-REALIGNMENT-2026-07-31.md` | 已记录 | 对代码与文档做交叉确认，说明三类缺口、决策、修改范围和未实现边界 |
| 第一轮校准记录 | `implementation/notes/DOCS-REALIGNMENT-2026-07-29.md` | 已记录 | 字段、双 Bucket、图片配方、阶段范围和任务顺序变更证据 |
| T04–T05 实施记录 | `implementation/notes/T04-T05-2026-07-29.md` | 已验证 | Kimi 入选方案、两种首页精选对比、三视口截图与质量门禁；当时 Hero 仍为单图夹具 |
| T06–T07 实施记录 | `implementation/notes/T06-T07-2026-07-29.md` | 已验证 | 作品列表/详情、管理端工作台、三视口证据与自动化自查；当时媒体仍为通用样张 |
| T08 验收记录 | `implementation/notes/t06-t07/T08-REVIEW-PREP.md` | 2026-07-30 已通过 | 精选横向轨道定稿、T06/T07 基线通过、`must-fix = 0` |
| T09 工程核心记录 | `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md` | 已验证并合入 `main` | 契约、双 Bucket 配置、错误分流、安全日志与生产守卫 |
| T09 界面交接 | `implementation/notes/T09-UI-HANDOFF.md` | 已完成 | 管理壳、对比度、参数响应、dirty、金额、reduce 动效与任务阶段文案 |
| T09 界面实施与收口 | `implementation/notes/T09-UI-2026-07-30.md`、`implementation/notes/T09-CLOSURE-2026-07-31.md` | 2026-07-31 已通过 | 用户验收、完整门禁复核和最终任务收口 |
| T10 预检说明 | `implementation/OSS-PREFLIGHT.md` | 已实现 | 最小权限、秘密放置、确定性预检、控制台与水印边界 |
| T10/EXT-02 证据 | `implementation/notes/T10-OSS-PREFLIGHT-2026-07-31.md` | 已通过 | 30 MB 原图、内嵌 FFmpeg 私有处理源、双 Bucket、水印与跨桶处理完整通过 |
| 状态 | `STATE.md` | 2026-07-31 已更新 | 当前决策、外部门禁与 T10 收口 |

## 当前执行文档

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 执行责任路由 | `implementation/EXECUTION_ROUTING.md` | 2026-07-31 当前生效；记录 T10 已收口和后续默认分工，不属于产品契约 |

## 历史与证据

| 类型 | 路径 | 当前效力 |
| --- | --- | --- |
| 竞品调研 | `materials/兽装工作室主页调研_2026-07-26/` | 只读参考，不复制资产 |
| 景宸品牌与 Logo 例图 | `materials/景宸品牌例图_2026-07-29/`、`materials/picture-examples/logo/` | 当前品牌源与色值证据；最终使用范围和衍生 manifest 由 EXT-01 确认，不复制旧价格或二维码 |
| 领养设定例图 | `materials/picture-examples/领养/` | 横版设定图、色板与完整画布的产品证据；不代表已获正式上线授权 |
| 技术方案输入 | `materials/fursuit-studio-solution-package/` | 历史输入；单 Bucket 内容已被当前 PLAN 覆盖 |
| 快速原型 v5 | `planning/prototype-v1/` | 只保留页面职责、顺序和关键交互；视觉与旧业务字段不再权威 |
| 实施记录 | `implementation/notes/` | 记录当时事实，不回写成当前架构；T04–T09 的单 Hero/通用媒体样张不能冒充新契约已实现 |
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

尚未实施：后台首页轮播、横竖双源切换、媒体角色分区、正式媒体编排中的 OSS 水印、favicon/Touch Icon。它们已进入后续任务契约，但不得写入当前完成产物。

## 外部门禁产物

- EXT-01：Logo 来源与使用范围、完整组合标/图形标/favicon/Touch Icon/水印 profile manifest、正式作品/返图授权范围、焦点和文字/水印安全区；
- EXT-02：双 Bucket 地域/CORS/BPA/权限、30 MB 私有原图、内嵌 FFmpeg 处理源、OSS 水印与跨 Bucket `sys/saveas` 已验证通过。
