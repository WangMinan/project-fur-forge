# T04～T21 第一批工程实施记录（2026-08-19）

> 本记录只覆盖需求4 A/B 阶段。独立 Review、用户视觉验收、生产发布和 T22+ 均不在本轮代签或实施。

## 1. 基线与 Git 边界

- 开工分支：`codex/r4-t04-t21-foundation`。
- fetch 后起始 SHA：`cbaf98fec4868e94af5b28faf5c3d9a23344d859`。
- 开工时 `main`、`origin/main` 与 `HEAD` 一致，工作区无已修改或暂存文件。
- 本轮不新增数据库迁移，不改变四个 Hero collection、媒体身份、CAS、lease、heartbeat、recovery、ESA purge 或双 Host 安全边界。

## 2. T04 行动重复面审计

| 表面 | 当前实现与差异 | 本轮收敛点 |
| --- | --- | --- |
| 公开主行动 | `about.vue`、`commission/index.vue`、`CommissionLead.vue`、`HomeBusinessEntries.vue` 分别复制高度、padding、圆角、主色和 hover | 建立 `PublicAction`，保留页面布局 CSS，只删除行动外观 CSS |
| 公开次行动/文字行动 | `FeaturedWorks.vue`、`HomeCurrentAdoptions.vue`、`works/index.vue`、`adoptions/index.vue` 与空态分别维护下划线、边框或文字箭头 | 统一 `secondary/text`、focus-visible、active 与触控高度 |
| 公开语义 | 当前行动多为 `NuxtLink`，表单/控件为原生 button；loading/disabled 没有统一契约 | `PublicAction` 根据 `to`/`href`/无链接属性渲染 NuxtLink/a/button；链接禁用时阻止导航并声明 `aria-disabled` |
| 管理主/次行动 | 全局已有 `.editor__button*`，但 Hero、上传卡、二维码、确认框、列表页仍复制 button CSS，loading 文案/`aria-busy` 不一致 | 建立 `AdminAction` primitive，先覆盖 Hero、四类上传、作品发布、品牌保存和联系方式上传 |
| 管理 danger | `PublicationPanel.vue`、Hero 卡、上传卡分别维护 danger 颜色和边框 | danger 收敛到 `AdminAction`，确认对话框与破坏性语义保持明确 |

组件边界：`PublicAction` 只负责公开行动语义/状态/视觉；`AdminAction` 只负责管理行动语义/状态/视觉；页面和业务组件继续决定文案、权限与请求。

## 3. T04 上传与长任务真实来源审计

| 流程 | 真实状态来源 | 审计发现 | 本轮接入 |
| --- | --- | --- | --- |
| Hero 上传 | `useHeroAssetUpload` + `signed-put.ts` 的 XHR `loaded/total` | 已记录 `item.progress`，当前 `HeroCollectionItemCard` 不显示百分比 | `AdminTaskProgress(determinate)` |
| 作品图上传 | `useStudioPhotoUpload` + 同一 XHR helper | `UploadSessionCard` 自制 div bar；FFmpeg 另用 `FfmpegProgress` | 同一 `AdminTaskProgress`，保留真实 cancel/retry |
| 联系二维码上传 | `useContactQrUpload` + 同一 XHR helper | `SiteOfficialChannelsCard` 自制 `<progress>`，校验/FFmpeg 使用不同 DOM | 同一 determinate/indeterminate 展示 |
| 水印 Logo 上传 | `useWatermarkLogoUpload` + 同一 XHR helper | `BrandingCandidatesCard` 自制 `<progress>` | 同一 determinate/stage 展示 |
| 单图 FFmpeg | 服务端处理状态；客户端无可信总帧/总工作量 | `FfmpegProgress` 已使用 indeterminate + elapsed，职责与其它进度分裂 | 直接改用 `AdminTaskProgress(indeterminate)`，不制造百分比 |
| 作品 publication | `publication_operations.status`；变体数量来自 publication check | 请求期间以缺失变体计数轮询，但刷新后没有恢复最近 operation 的 UI | publication check 返回最近持久 operation；统一阶段/计数并恢复 polling |
| branding rebuild | `watermark_operations.status` 与 generated/verified/target counts | 已能刷新恢复，组件自制计数 progress DOM | 保留真实计数，改用共享 stage 组件 |
| Hero operation | item 的 `publicationOperation` / `upscaleOperation` 与持久轮询 | 已能刷新恢复；`HeroCollectionItemCard` 把阶段硬映射为 12/35/56/76/91% | 删除伪百分比，只显示真实阶段/终态/可重试入口 |
| 旧 Hero 组件 | `HomeSlideCard.vue`、`HomeHeroSlotField.vue` | 当前无调用者，仍保留另一套进度 DOM/阶段文案 | 删除无调用者文件，避免审计与维护继续出现第五套实现 |

统一组件边界：`AdminTaskProgress` 只接收真实 view model（mode、label、stage、value/max、计数、elapsed、终态、retry/cancel），不发请求、不解释业务错误码、不推测进度。

## 4. Hero 管理实施边界

- 页面层只编排一级 placement、二级 orientation、两方向摘要和响应式布局。
- 单集合 editor 继续独立调用现有 collection API/composable；四个 version、owner context、items、排序和 operation 不合并。
- 横/竖切换同时承担桌面/手机画框切换；预览按目标方向使用 16:9 / 9:16 画框，不新增焦点写入、pair 或数据库字段。
- 委托 placement 在宽屏并排显示横/竖单槽，窄屏上下堆叠；首页仍按当前方向编辑多项。

## 5. Gate A / Gate B 证据

### Gate A（通过）

- `pnpm lint`：通过，0 warning / 0 error。
- `pnpm typecheck`：通过。
- focused integration：
  - `upload-session`、`r3-hero-collection-publication`、`watermark-branding`、`site-content-sections` 共 26 项通过；
  - `work-publication` 在显式 `APP_ENV=test` 下 20/20 通过；第一次未显式设置环境时统一停在 test-only ESA cache override 前置条件，不是业务断言失败。
- `admin-home` 现有 E2E：稳定的“已启用预览不读原图”和移动/桌面无横向溢出 2 项通过；其余 3 项分别绑定旧四平级 Tab 文案、旧 `.editor__button--primary` class 和旧容器 selector，归入 T13/T17 分类，不作为 Gate A 回归。
- 静态债务检查：管理端只剩 `AdminTaskProgress.vue` 自己渲染 `<progress>`；`PREPARING_SOURCE=12`、`GENERATING_PUBLIC=35`、`APPLYING_WATERMARK=56`、`COMMITTING=91` 等伪映射为 0 处。
- 四类 OSS 上传都继续消费 `signed-put.ts` 的 XHR `loaded/total`；共享 helper 只映射展示，不改变 owner、role、session 或完成逻辑。
- Hero collection URL 仍由 placement + orientation 组成；四个组件实例分别持有自己的 version、items、polling 与 operation。委托双槽只是宽屏并排，不建立共享 version 或 pair。
- Hero/branding 原有持久 operation 恢复保持；作品 publication check 新增最近 operation 快照，页面刷新后按 operation ID 恢复 polling。

结论：GATE-A 六项满足；本轮未实现焦点编辑、动效 token、首页四幕或 T22+。

### Gate B

待 B 阶段完成后回填。本节不会记录 Secret、PII、私有 Object Key、签名 URL 或生产数据。
