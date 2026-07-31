# 状态

> **角色**：当前需求的状态机与收敛中枢。每轮开始先读本文件，结束后回写。

## 当前阶段

阶段 4 · IMPLEMENTATION 进行中。T01–T13、`GATE-06` 与 EXT-02 已完成。T14–T18 的后端工程已按顺序完成：私有原图条件直传、服务端核验/大图预处理、`recipe-v1`/基础水印、最小非领养作品 CRUD 和双 Bucket 发布/下架补偿均已锁定接口与集成测试。**该批次未修改 `app/`，T14–T18 保持未勾选，当前交给 Kimi 完成前端接线、浏览器证据与联合验收；T19 未启动。**

## 当前执行分工

- Kimi K3 继续作为 `UI_PRIMARY`；当前接手 T14–T18 的真实接口接线，交接清单见 `implementation/notes/T14-T18-UI-HANDOFF.md`。
- `ENGINEERING_PRIMARY` 已在 `feature/t14-t18-engineering-sol` 严格完成 T14 → T15 → T16 → T17 → T18 后端工程并停止，不进入 T19/T20。
- 数据库、认证、安全、OSS、事务、媒体角色、recipe/watermark identity 和运维由 `ENGINEERING_PRIMARY` 主责。
- Kimi 已完成 `GATE-06`：既有管理界面已接入 T13 认证接口，真实浏览器 Cookie、CSRF、Session 和 no-store 边界验证通过；该门禁不新增 TASKS 编号，已由用户验收并勾选完成。
- 当前联合任务采用“工程侧已锁定 Schema/API/错误/权限与集成测试，Kimi 再实现前端切片”的交接方式；T20 首页轮播仍属于后续联合任务。
- 独立审查者提供证据复核与建议；TASKS 指定的用户门禁仍由用户作最终确认。
- 完整的当前批次、后续默认路由、交付清单和分支策略见 [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)。该文件只记录可变执行安排，不改变 TASKS 的范围与依赖。

## 已废止旧口径

本轮及 2026-07-29 校准覆盖此前文档中的以下旧口径：

- 同一 Bucket 内通过 Object ACL 在 `private` / `public-read` 间切换；
- 为未来美元价格预留禁用字段；
- 在作品管理模型中保存定金与付款备注；
- 先完成大批数据库、认证、OSS 基础设施，再到后期才验证第一件真实作品链路；
- 为每张图片生成 3 个比例 × 7 个宽度 × 2 个格式的完整组合；
- 把蓝色面积约 15% 当作设计目标，而不是上限；
- 首页只维护一张 16:9 图片，再用桌面/手机焦点冒充横竖双源；
- 把设定图、出厂照和返图都压进同一个“图片/主图”列表；
- 认为正式 Logo 尚未提供，或只在页头使用 Logo 而不生成 favicon/水印；
- 只对领养设定图做模糊水印要求，不定义出厂照、首页图、返图和私有原图边界。

## 已确认决策

### 产品与范围

- 首版仍是“图片主导的工作室作品集 + 唯一管理员内容后台”，不是商城或客户管理系统。
- 联系人信息可以作为后台私有字段保留；`depositNote`、`paymentNote` 及其等价字段从需求与后续数据模型中移除。
- `ownerDisplay` 始终为非空公开显示值：工作室作品显示“有点小狗工作室”，隐私作品显示“不公开”；一期不增加 `ownerType`，不以空值表达工作室作品。
- 返图可以保存可选授权记录：授权来源、确认时间和简短备注。三者均可为空，不作为发布阻断项，也不进入公开投影。
- 一期价格只支持人民币。采用最小货币单位与固定 `CNY` 约束；未来需要其他币种时通过正常迁移扩展，不提前保存禁用美元字段。
- P0 先形成可部署的核心作品链路；P1 补齐一期增强能力；P2 是可独立后置的运维增强。只有 P0 + P1 完成后才称为“一期功能闭环”；正式上线仍需 T51–T53。
- production 必须显式提供 URL、数据库、双 Bucket、OSS AccessKey 和 `SESSION_SECRET`；P2/T43 前 SMTP 五项可以全部缺失，但只要提供任一项就必须完整提供全组，不生成占位凭据。
- development/production 的公开、后台、媒体与 OSS 上传 origin 均不提供硬编码域名 fallback；本机值只保存在被 Git 忽略的 `.env`，部署时显式注入真实域名。
- 全局配置门禁：除测试文件中的隔离值外，任何配置项的具体值都不得硬编码在应用代码、脚本或版本化文档/模板中，只能由 `.env`、进程环境变量或不入库的活动配置文件提供。

### 首页轮播

- 首页首屏改为站点级 1–5 项轮播；每项必须配置两份独立原图：`home_hero_landscape` 与 `home_hero_portrait`。
- 横屏使用 16:9 横版衍生图，竖屏使用 9:16 竖版衍生图；不能只保存一个 `src` 和两个焦点。
- 每项保存非空 alt、顺序、启用状态和可选已发布作品关联；至少 1 项、最多 5 项。
- SSR 直出第一项及两种 `<source>`；关闭 JavaScript 时第一项可用，浏览器不应同时下载隐藏的横版/竖版大图。
- 手动控制、触控和键盘始终可用。自动轮播默认关闭；开启后间隔不少于 6 秒，提供暂停，在 Hover/焦点进入时暂停，并在减少动效下停用。
- 后台使用 `/admin/site/home` 专用编辑器；首页轮播与 T08 已选定的精选横向轨道是两个独立对象。

### 图片角色与页面比例

- `design_sheet`：领养作品独有，最多 1 张，横版完整画布；`/adoptions` 以它为主图。
- `studio_photo`：每件作品最多 5 张；`/works` 以 3:4 卡片为主，详情保持原比例。
- `return_photo`：P1，每件最多 5 张；返图墙保持原比例，不混入出厂照图集。
- 领养详情把“设定图”和“出厂照/作品图集”分区。尚无出厂照的领养作品进入 `/works` 时，只能使用完整设定图置入 3:4 安全画布的明确 fallback，不做破坏性裁切。
- 当前 T06/T07 代码和夹具仍使用通用媒体样张；角色化模型、管理界面和公开页面分别由 T12、T23–T25、T35–T36 实现。

### 品牌、站点图标与水印

- `agent_docs/materials` 中的 Logo 是当前品牌源；完整组合标已用于页头，图形标将用于 favicon、Apple Touch Icon、水印和必要社交分享标。
- favicon 契约已锁定；运行时声明与实现尚未开始，T30 负责从 EXT-01 确认的图形标确定性生成并声明站点图标。
- 私有原图永久无水印、不可覆盖。水印只由 OSS 烘焙进公开衍生图，不使用 CSS 叠层冒充发布结果。
- P0 的首页横竖图、设定图和出厂照使用 `brand-standard-v1`；P1 的返图使用 `brand-subtle-v1`。
- Logo 摘要、profile 版本、比例/透明度/边距和四角锚点进入 recipe identity；改变参数生成新 Key，不原位覆盖。
- profile 的最终视觉参数由 T51 使用正式素材校准；在此之前不得把开发样张参数宣布为品牌定稿。

### 媒体架构

- 已创建 `project-furry-forge-private` 与 `project-furry-forge-public` 两个 Bucket。
- 私有 Bucket 永久拒绝匿名读取；公开 Bucket 只保存发布后的网页衍生图，不保存原图、联系人或其他私有资料。
- 浏览器只向私有 Bucket 直传永久原图。超过 OSS 20 MB 图片处理上限的合规原图由服务端使用随应用安装的固定版本 FFmpeg 生成私有处理源；OSS 是公开 variant、最终格式和水印的唯一配方权威，并使用 `sys/saveas` 把结果写入公开 Bucket。
- 发布/下架不再切换 Object ACL。发布验证公开对象后提交数据库引用；下架先移除公开投影，再删除公开 Bucket 对象并记录未完成清理。
- `@nuxt/image` 若使用，只负责组件封装和 `picture/srcset/sizes` 表达，不发起第二套动态裁切、缩放或转码。

### `recipe-v1`

- `work-card` 3:4：480 / 768 / 1200；
- `home-hero-landscape` 16:9：768 / 1280 / 1920；
- `home-hero-portrait` 9:16：480 / 768 / 1080；
- `design-sheet` 完整横版画布：960 / 1600 / 2400；
- `detail` / P1 `return` 原比例：960 / 1600 / 2400；
- WebP + 一种源兼容 fallback；透明度确有需要时使用 PNG，否则使用 JPEG。

只为实际页面用途生成；1:1 等新比例只有真实页面使用后再加新 recipe 版本。

### 视觉方向

- 公开站采用图片大底与白底编辑型摄影作品集。
- 明显蓝色面积以 5%–10% 为常态，15% 是单页硬上限；作品图、白色和中性文字承担主要视觉面积。
- `#324DAF` 用于主要行动和焦点，`#293C84` 用于 Hover/深强调，`#1D2D5A` 用于极少量反白表面，`#6274BB` 只作大字或装饰，`#CED3E5` 只作弱背景和边界。
- 禁止连续蓝底区块、蓝色卡片墙、蓝色渐变大按钮，以及“半张图片 + 半张蓝色说明面板”的通用营销构图。
- T05 已通过真实截图比较“横向精选轨道”和“编辑型图片网格”；T08 最终选定横向轨道。首页首屏轮播是后续新增能力，不推翻精选轨道结论。

## T09 完成状态

T03 遗留工程问题已在 `main` 完成以下修正：

- 废止付款类字段和禁用美元字段已从 Schema、类型、mapper、fixture 与测试删除；
- 已增加三字段全部可空、不阻断发布且不进入公开投影的返图授权记录 Schema；
- 管理端媒体 DTO 只暴露 `assetId` 等业务标识；公开 mapper 逐字段投影；
- 单 Bucket 运行配置已拆为私有/公开 Bucket，旧字段显式报弃用错误；
- API 错误保持 JSON，普通页面错误交给 Nuxt `error.vue`；
- 安全日志已接入 500 路径，并对 message 与结构化 context 做泄漏回归；
- production 构建产物会阻断占位文案和 `/fixtures/samples/`。

工程记录见 `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md`；界面实施记录见 `implementation/notes/T09-UI-2026-07-30.md`；最终复核见 `implementation/notes/T09-CLOSURE-2026-07-31.md`。管理布局、文字对比度、参数响应、dirty、金额校验、reduced-motion 和任务阶段文案均已修补并通过自动化验证。

## 开放问题

当前无开放 OQ。轮播数量、横竖配对、默认不自动播放、媒体角色、水印强制范围和 favicon 来源均已在 2026-07-31 文档校准中确定。若景宸后续要求调整水印透明度、大小或默认角，属于 T51 正式素材校准，不需要提前重开产品范围 OQ。

## 外部门禁

- `EXT-01`：确认当前 Logo 源的来源/可使用范围和最终导出，形成完整组合标、图形标、favicon/Touch Icon 与两个水印 profile 的 manifest；同时确认正式作品图和返图可公开范围、桌面/手机焦点、文字/水印安全区。通过后解除 T30 与 T51 的素材门禁。
- `EXT-02`：已通过。双 Bucket、30 MB 私有原图、内嵌 FFmpeg 私有处理源、OSS 水印、跨 Bucket `sys/saveas`、匿名边界和精确清理均已实测。
- 用户已完成两端 CORS 与公开 Bucket `public-read`；预检确认私有 Bucket BPA 开启且匿名 GET 失败、公开衍生对象匿名 GET 成功。私有 Bucket 未为图片处理限制放宽。

## 最近验证

- 2026-08-01：T14–T18 后端工程按五个独立提交完成；lint、typecheck、86 项单测、56 项集成测试、100 项既有 Chrome E2E、构建和生产运行验证通过，`app/` 相对 `main` 零差异。真实 OSS 预检 `test/t10-20260731T174230Z-858b6bdd/` 的 27 项检查全部通过并完成精确清理，未记录秘密。任务框保持未勾选，前端交接见 `implementation/notes/T14-T18-UI-HANDOFF.md`。
- 2026-08-01：用户完成 `GATE-06` 认证前端验收并确认通过；门禁已勾选完成。其后的 T14–T18 后端状态见上一条。
- 2026-07-31：Kimi 完成 `GATE-06` 认证前端接线。内存态 Session/CSRF、真实登录/退出/改密、无闪现路由保护、统一 401 提示、锁定不揭示、真实 Chrome `__Host-` Cookie/CSRF/Host 隔离/no-store 共 22 项新 E2E 通过；完整门禁为 lint、typecheck、86 项单测、34 项集成测试、100 项 E2E、构建和生产验证；证据见 `implementation/notes/T13-AUTH-UI-2026-07-31.md`。
- 2026-07-31：收口 T02 非测试 origin 配置，并将“测试之外不得硬编码任何配置具体值”固化为全局工程门禁。版本化模板与 OSS 预检已移除 `localhost` / `127.0.0.1` 域名 fallback，本机 origin 写入 `.env`；86 项单测、34 项集成测试、78 项 E2E、lint、typecheck、构建和生产验证通过。证据见 `implementation/notes/T02-ORIGIN-ENV-CLOSURE-2026-07-31.md`。
- 2026-07-31：完成 T11–T13 S2 Review 修补。production SMTP 可选组、auth/admin/preview no-store、认证命令显式迁移前置与隐藏 TTY 输入、媒体 role/usage 与 `source_variant_id`、Hero 完整 recipe 发布条件均通过；新迁移为 `0002_puzzling_malcolm_colcord.sql`。完整门禁为 85 项单测、34 项集成测试、78 项 E2E、构建和生产验证；证据见 `implementation/notes/S2-REVIEW-CLOSURE-2026-07-31.md`。
- 2026-07-31：完成 T13 唯一管理员服务端认证。密封 Host-only Cookie、scrypt 密码哈希、8 小时无操作过期、5 次失败锁定 30 分钟、SessionVersion、管理员 active、Host/Origin/CSRF、资源版本、日志脱敏和受保护重置均通过；完整门禁为 84 项单测、27 项集成测试、112 项 E2E、构建和生产验证。用户要求前端由 Kimi 实现，`app/` 保持零差异；证据见 `implementation/notes/T13-AUTH-2026-07-31.md`。
- 2026-07-31：完成 T12 P0 Schema 与投影。`0000_sparkling_absorbing_man.sql` 建立 11 张 P0 表；ownerDisplay/CNY/短属性、媒体角色/数量、原图与 variant identity、首页 1–5 READY 横竖配对、发布步骤、公开/管理泄漏守卫均通过。完整门禁为 81 项单测、18 项集成测试、构建和生产验证；证据见 `implementation/notes/T12-P0-SCHEMA-2026-07-31.md`。
- 2026-07-31：完成 T11 SQLite 运行底座。Drizzle/`better-sqlite3`、WAL、外键、5 秒 busy timeout、FULL synchronous、开发/生产/测试路径边界、空库与重复迁移、独立临时库和 SQLite Backup API 一致性备份均已验证；证据见 `implementation/notes/T11-SQLITE-2026-07-31.md`。
- 2026-07-31：完成 T10 双 Bucket 真实预检。两个 Bucket 同账号同杭州地域，Region/Endpoint/名称、私有 ACL/BPA/匿名拒绝、公开 ACL/匿名读取、CORS OPTIONS、V4 条件 PUT、MD5/SHA-256/禁止覆盖均通过；内嵌 FFmpeg 不经宿主 PATH，把 29,360,568 字节原图生成 4,791,024 字节、4096×444 私有处理源，随后 OSS 水印、WebP、跨 Bucket `sys/saveas`、公开 HEAD/图片信息/匿名 GET、私有原件不变和四对象精确清理全部通过。证据见 `implementation/notes/T10-OSS-PREFLIGHT-2026-07-31.md`；T10/EXT-02 已勾选。
- 2026-07-31：交叉检查 `main` 的首页、`ResponsiveAsset`、管理端作品编辑、Logo/Head 配置、媒体夹具与 T09 后文档，确认单 Hero/单 `src`、无首页轮播管理、媒体角色未进入界面、无显式 favicon、水印只在部分文档中模糊出现；校准结论已直接吸收到 foundation、SPEC、PLAN、设计、模型、TASKS、执行路由、STATE 与产物索引。
- 2026-07-31：用户验收 Kimi 的 T09 界面修补；工程侧复跑冻结安装、lint、typecheck、70 项单测、4 项集成测试、112 项 E2E、Nuxt 构建与生产运行验证，全部通过；`APP_ENV=production` 继续按预期阻断占位文案和 `/fixtures/samples/`。T09 已勾选完成。
- 2026-07-30：用户回答 OQ-119，确认 `ownerDisplay` 的非空显示规则及“不增加 ownerType”；foundation、SPEC、PLAN、设计、模型、TASKS、STATE 与 T09 界面交接已同步。
- 2026-07-30：用户完成 T08 最终验收，确认 T06/T07 视觉基线通过，首页精选采用横向轨道，`must-fix = 0`；落选网格与实验开关已删除。
- 2026-07-29：完成 foundation、SPEC、PLAN、模型、公开/管理设计、TASKS、产物索引与实施备注的第一轮跨文件校准；T01–T53 唯一连续。

## 下一步

T14–T18 后端工程已完成，下一责任人为 Kimi `UI_PRIMARY`：按 `implementation/notes/T14-T18-UI-HANDOFF.md` 接入真实作品保存、OSS 直传、媒体状态、关系编辑、预览、发布/下架与失败恢复，并补浏览器 E2E/三视口证据。联合验收前不勾选 T14–T18；工程侧停止在 T18，不进入 T19/T20。
