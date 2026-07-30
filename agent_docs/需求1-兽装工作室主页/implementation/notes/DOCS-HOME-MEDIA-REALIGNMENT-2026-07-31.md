# 首页媒体、图片角色与品牌衍生契约校准（2026-07-31）

> **范围**：只修改 `agent_docs`。不修改 Vue/TypeScript、运行配置、数据库、OSS、图片文件或测试；不启动 T10，不勾选任何新任务。
> **触发**：用户在 T09 合入 `main` 后，结合渔屋官网参考截图和三张横版领养设定图，提出首页横竖轮播、媒体比例区分、站点图标与自动水印需求。

## 1. 交叉确认结论

| 用户判断 | 代码与文档证据 | 结论 |
| --- | --- | --- |
| 管理端没有首页轮播/底图上传 | `app/pages/admin/works/[id].vue` 只有通用“图片/上传出厂照”样张；当前导航只有作品入口；SPEC/IA 只泛称“必要站点内容”，没有轮播项、双源配对和发布条件 | **确认存在** |
| 首页没有横版/竖版独立配置与切换 | `HeroMedia.vue` 读取单个 `heroFixture`；`ResponsiveAsset.vue` 只有一个 `src`，桌面/手机只改变 `object-position`；`visual-home.ts` 只有一张 1920×1080 Hero | **确认存在** |
| 领养横版设定图与竖版作品/返图没有区分 | 模型虽出现 `design_sheet`/`studio_photo` 名称，但当前管理夹具 helper 实际统一生成 `studio_photo`，页面只有通用图片区；公开列表统一 3:4，详情统一原比例；TASKS 没有明确按页面角色分区 | **确认存在** |
| Logo 没有应用到网站 | `PublicHeader.vue` 已使用 `public/brand/logo-full-light.png` / `logo-full-dark.png`，因此“完全没有应用”不准确 | **部分不成立：页头已使用** |
| 浏览器图标没有使用 Logo | `nuxt.config.ts` 没有站点 icon head 配置，`app/app.vue` 没有 `useHead`，仓库中无 `public/favicon.ico` | **确认存在** |
| 上传后没有自动水印 | PLAN/TASKS 只零散提到领养设定图水印；代码没有水印 profile、OSS 水印 recipe、管理预览或发布校验；出厂照、首页图、返图和私有原图边界没有完整定义 | **确认存在** |

T04–T09 的完成结论仍然有效：它们按当时任务完成了视觉样张与 T09 工程收口。上述问题属于上游需求在真实素材和竞品参考到位后暴露出的后续契约缺口，不把已通过任务改写为“当时就已经实现”。

## 2. 本轮产品决策

### 2.1 首页双源轮播

- 首页首屏是站点级 1–5 项轮播，不复用作品 `isFeatured` 或单件作品主图字段。
- 每项必须同时关联两份独立资产：`home_hero_landscape`（横屏 16:9）和 `home_hero_portrait`（竖屏 9:16）。
- 两份图片可以是同一作品的不同构图，但不能是同一文件只改焦点。
- 每项包含非空 alt、排序、启用状态和可选已发布作品关联。
- SSR 直出第一项和 `<picture>/<source>`；无 JavaScript 时第一项可用，浏览器不同时下载隐藏的两份全尺寸首屏。
- 手动上一张/下一张、分页指示、触控和键盘始终存在。自动轮播默认关闭；开启时间隔不少于 6 秒，有可见暂停，Hover/焦点进入暂停，减少动效下停止。
- `/admin/site/home` 是专用编辑器，逐项展示横版/竖版槽位和两个方向的真实预览；缺失任一方向、alt、READY variant 或水印结果时不能启用。

### 2.2 媒体角色与页面构图

- `design_sheet`：领养独有，最多 1 张，横版完整画布；`/adoptions` 以它作为主图。
- `studio_photo`：每件最多 5 张；`/works` 使用 3:4 卡片，详情保持原比例。
- `return_photo`：P1，每件最多 5 张；返图墙按原比例展示，不混入出厂照图集。
- 领养详情把“设定图”和“出厂照/作品图集”分为两个媒体区。
- 领养作品尚无出厂照时，`/works` 可用完整设定图置入 3:4 安全画布的 fallback；不能把横版设定图破坏性中心裁切。
- 首页横竖资产是站点级角色，不占作品 5 张出厂照上限。

### 2.3 Logo、favicon 与水印

- `agent_docs/materials` 中的 Logo 作为当前品牌源。页头继续使用完整组合标；favicon、Apple Touch Icon、水印和必要社交品牌标使用从同一源受控导出的图形标。
- EXT-01 从“等待 Logo 出现”改为“确认来源/使用范围和衍生 manifest”；Logo 已存在不等于上线授权门禁已通过。
- 私有原图永久无水印且禁止覆盖。水印只由 OSS 烘焙进公开衍生图，不能只在页面上 CSS 叠加。
- P0 首页横竖图、设定图和出厂照使用 `brand-standard-v1`；P1 返图使用 `brand-subtle-v1`。
- 水印 profile 包含 Logo 摘要、版本、比例、透明度、边距和四角锚点；默认左上，可按资产选择安全角。
- profile、Logo 摘要或锚点变化必须生成新 variant Key，不原位覆盖。
- 精确比例、透明度和边距在 T51 用正式素材二次校准，本轮不把开发参数写死为品牌定稿。

## 3. 任务映射

没有新增编号，也没有改变依赖主链：

- T10：提前验证 OSS 图片水印与跨 Bucket `sys/saveas`；
- T12：增加 `site_hero_slides`、媒体角色和公开投影；
- T14–T15：角色化上传、方向/比例校验、焦点/contain 和水印安全角；
- T16：新增双源 Hero、设定图、作品图 recipe 与 `brand-standard-v1`；
- T20：实现 `/admin/site/home` 与公开双源轮播；
- T21：第一垂直切片加入一组首页横竖轮播和水印边界证据；
- T23–T25：多图角色、管理端分区和横版领养设定图；
- T30：favicon/Touch Icon；
- T33：方向资源请求、按需加载和水印视觉回归；
- T35–T36：返图角色与 `brand-subtle-v1`；
- T38：只编辑受限文字，明确不接管首页媒体；
- T51：正式 Logo 衍生、水印 profile、横竖焦点和安全区校准。

T10 仍是下一项，不能因为 T20/T25/T30 的契约已写清就提前实施。

## 4. 同步修改路径

- `foundation/README.md`
- `requirements/SPEC.md`
- `planning/PLAN.md`
- `.design/README.md`
- `.design/public-site/DESIGN_BRIEF.md`
- `.design/public-site/INFORMATION_ARCHITECTURE.md`
- `.design/admin-console/DESIGN_BRIEF.md`
- `.design/admin-console/INFORMATION_ARCHITECTURE.md`
- `models/README.md`
- `implementation/TASKS.md`
- `implementation/EXECUTION_ROUTING.md`
- `STATE.md`
- `artifacts/ARTIFACTS.md`
- `agent_docs/README.md`

## 5. 一致性检查

- T01–T53 编号连续，完成状态仍为 T01–T09；
- 依赖主链未重排，T10 仍为下一项；
- 首页轮播与首页精选横向轨道被明确分离；
- 私有原图无水印、公开衍生图有水印的边界在 foundation、SPEC、PLAN、模型和 TASKS 一致；
- `design_sheet`、`studio_photo`、`return_photo` 与 `home_hero_*` 的角色、数量和页面用途在业务、技术、设计和任务层一致；
- Logo 已用于页头的事实得到保留，同时新增 favicon/水印缺口；
- 没有把用户上传的竞品截图或参考设定图复制进生产资产，也没有修改 `materials`；
- 本轮没有运行代码门禁，因为没有业务代码变化；后续实现仍必须执行标准 lint/typecheck/test/E2E/build 和对应 OSS 契约测试。
