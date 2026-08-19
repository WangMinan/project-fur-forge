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

### Gate B（通过）

测试逐文件分类落在 `tests/test-groups.ts`，并由 `pnpm test:groups` 拒绝漏分组、重复分组和未知文件：

| 组 | 文件数 | 主要边界 |
| --- | ---: | --- |
| core | 47 | Host/session/CSRF/Origin、上传 token/TTL/一次消费、PII/私有媒体、migration/FK/integrity、operation/publication、受控删除和领养排序 |
| smoke | 1 文件 / 8 旅程 | 首页、works/adoptions 目录与详情、委托成功/重复失败、admin 登录、真实 XHR progress、发布/下架、privacy/service/licenses |
| legacy Vitest | 21 | 历史展示、内容默认、发布工具与重复层级覆盖；保留可显式运行但不作默认门禁 |
| legacy Playwright | 24 | `0.68s`、局部 class/DOM、完整文案、历史截图/视觉修复和旧四平级 Hero Tab 等实现型断言 |

主要决定与证据：

- `check:fast = test:groups + lint + typecheck + test:core`；最终通过，core 为 47 文件 / 308 项。
- `test:smoke` 使用 dev server，不重复 production build；最终 8/8 通过。
- `test:release` 在 Windows/Linux 都通过 pnpm 当前 CLI 串行运行 smoke、production build、production verify、ESA/observability policy 和 Secret scan；最终通过，Secret scan 覆盖 572 个 tracked 文件。
- `test:legacy` 只显式运行 legacy Vitest + 历史 Playwright，不进入默认 Actions。本轮没有为了 legacy 全绿修改旧 DOM/文案/毫秒断言。
- 默认 `quality` 对 markdown/`agent_docs/**` 使用 `paths-ignore`，代码 push/PR 只执行 `check:fast`。`release=true` 才执行 `test:release`、image-build、Compose/restore/Nginx 等重任务；`release-image` 继续是手动工作流并显式传入 `release: true`，外部发布确认未放宽。
- `/adoptions` comparator 唯一位于 repository：状态 bucket → `updated_at DESC` → ID；名称搜索只过滤已排序集合，分页最后执行。综合 core 用例同时证明同时间 ID、搜索、跨页和 `/works` 原公开时间顺序不受影响。
- 首页聚合只返回第一项 available；`HomeCurrentAdoptions` 只消费第一项，不再 `.slice(0, 2)` 或建立双列。

真实浏览器：

- 2026-08-20 使用隔离 test SQLite、合成公开图片和真实 Chrome 检查 390×844、768×1024、1440×900。
- 公开首页三视口均只有一项 current adoption，无正向水平溢出，键盘从 skip link 进入品牌链接，登录后 console error 为 0。
- Hero 管理刷新后恢复 `GENERATING_PUBLIC` 的真实阶段与 elapsed；将隔离 operation 改为 FAILED 后，统一 error 终态和真实“重试长任务”入口可见。
- 委托宽屏横/竖双槽并排，390/768 上下堆叠；两方向摘要、16:9 / 9:16 画框、disabled 上传和 3px focus outline 均可见。
- 截图位于 `implementation/evidence/T04-T21-2026-08-20/`。合成棋盘素材不能证明真实角色构图或审美，王旻安/景宸视觉验收仍开放。

未运行/未代签：

- `pnpm test:legacy`：按新契约为 non-gating，且包含已确认的旧实现型失败；本轮不以修旧套件换取结论。
- Docker image-build、Compose、restore、Nginx、destructive drill：只在显式 release/manual 路径，当前未触发。
- 远端 Actions、独立 Review、真实 OSS/ESA、生产 Secret/数据、真实手机与生产发布：均未执行或代签。

结论：GATE-B 五项满足，本轮严格停止在 T22 之前。本节未记录 Secret、PII、私有 Object Key、签名 URL 或生产数据。
