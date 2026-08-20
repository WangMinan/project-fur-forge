# 当前状态：需求4 · 站点视觉升级与内容合规

> **角色**：整个需求的状态机与收敛中枢（对应 spec-kit `/converge`）。
> **规则**：每轮工作开始时读、结束时回写；任务勾选以 `implementation/TASKS.md` 为准。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 当前阶段

阶段 E 工程交接 · 2026-08-21 已完成 T04～T34、T34-F1、M01～M11 与 T37～T46（含 T38-F1、T40-F1、T46-F1～F4）当前工程实现。首页 ≥1024px 按 Hero → 代表作品 01 → 代表作品 02 → 委托 → 领养 → Footer 逐幕 wheel，1023px 以下原生滚动；Header 固定且单一 offset 不覆盖内容；Hero 焦点使用可拖标记和双滑杆。T47 真实手机/连续性能、王旻安/景宸人工验收、T35/T36 分发证据和最终独立 Review 保持开放。

## 最近验证

- 2026-08-21：完成 T46-F4 用户复核修正。首页中文主标题取消首载 clip/位移动画并预加载拼贴字体，刷新后从第一帧保持最终字号；公开路由使用单一同步 `scrollBehavior`，`/works`、`/commission?view=home-commission` 与两条作品详情共享对象路径在导航完成第一帧均为 `scrollY=0`，返回/前进仍保留 saved position，真实 hash 仍按 Header offset 定位。自设委托主图改为纯展示，只有两个明确行动可导航。代表作品删除角色信息旁无语义的孤立 `01`，PC 两个停靠点改为同一“代表作品”标题与 `SELECTED WORK · 01/02` 眉题；移动端只显示第一处标题。lint、typecheck、production build/content guard、1440×900/390×844 真实 Chrome 通过；证据见 `implementation/evidence/T46-F4-2026-08-21/`。本条不代签 T47 真实手机、人工视觉验收或最终独立 Review。
- 2026-08-21：最终交接的 lint、typecheck 通过；全部运行逻辑与 Nuxt 配置完成后 production build/content guard 成功。构建后只追加 Header 单一 offset、“继续浏览”按钮对齐两处 CSS 与文档修正，按用户明确要求未再重跑 build、临时 Playwright、core 或 smoke。T47 真实手机/连续性能和人工验收保持开放，不由构建结果代签。
- 2026-08-21：本轮最终用户反馈要求首页 Header 固定、继续浏览减少空旷、hover 离图即回落，并在完成后 commit/push/结束 goal。Header 改为首页 fixed、滚动后浅色实底；逐幕 offset 最初同时写入 scroll-padding 与 scroll-margin 导致上一幕露出，已删除重复 scene margin，只保留容器 offset。次级媒体提高到约 56svh，hover 回落改为 180ms state。
- 2026-08-21：最终对齐修正：继续浏览标题此前受 scene padding 下推，而绝对定位轨道按钮仍按 section 顶部定位；现改为共享 `--secondary-scene-padding-top`，按钮与标题同一行。
- 2026-08-21：用户新增阶段 E 反馈：参考 `lingxun.me` 的桌面逐幕结构，但沿用本项目 1024px PC 断点；1023px/768/移动端不采用外站 768px wheel 边界。用户否决 T40 九宫格，改为作品编辑器同类的画面拖动焦点和水平/垂直滑杆；另要求首屏无重启动画、三幕同款 hover、领养到 Footer 间距收紧和复制邮箱按钮组稳定。代码已修改，文档同步中，浏览器验收待执行。
- 2026-08-21：完成 T41。公共端只保留 `motion-duration-feedback/state/content/media` 与 `motion-ease-standard/playful/linear-progress`，旧 duration/easing 与散落 620/680ms 已清零；全局 reduced 不再用 0.01ms 杀死全部反馈。浏览器确认 pointer/keyboard intent 分离；reduced-motion 等待 10.6 秒不自动换片但可手动切换；reduced-transparency 使用实底，contrast 提高文字/边界变量。lint、typecheck 通过；状态证据为 `t41-input-reduced.json`，390 截图为 `t41-reduced-motion-390x844.png`。
- 2026-08-21：完成 T39/T40 历史首版。`AdminHeroItemDto.asset` 增加 version/focal，create/update 请求携带 asset version 与焦点；service 只允许 disabled item，在 collection version + asset version 双 CAS 中更新焦点，共享 asset 焦点变化返回 `HERO_FOCAL_SHARED_ASSET_CONFLICT`，残留 PUBLIC variant 返回 cleanup pending。首版九宫格曾通过 focused core 与隔离浏览器，后由用户 T40-F1 明确替换为可拖焦点和双滑杆；底层 CAS/变体结论继续有效，旧截图不代表当前 UI。
- 2026-08-21：根据用户连续两轮首页实画面反馈完成 T38-F1。三个章节标题复用 `/works` 标题 token，三个主媒体在 390/430/768/1024/1440 下分别统一为 439/485/532/612/612px，章节起始间距压至 32px；桌面图片按左—右—左交替。六个目录/详情行动统一为圆角 primary/secondary，标题右侧箭头入口和冗余营销/邮箱说明已删除。`currentAdoptions.status` 直接投影现有领养营业状态，委托与领养分别显示 `委托咨询开放 · 有限开放`、`领养信息以页面为准 · 有限开放`；五视口无水平溢出或 console error，领养最后行动仍在一屏内。focused adoption projection 6/6、lint、typecheck 通过。
- 2026-08-21：用户进一步发现委托状态 SSR 闪现后在客户端消失。12 秒时间序列复现 0ms 存在、500ms 水合后节点被移除，并捕获 `Failed to resolve component: HomeBusinessStatus` / hydration mismatch；两个调用方改为显式 import 后，0/0.5/2/5/12 秒委托与领养状态均持续可见，控制台不再出现解析或水合错误。证据为 `t38-static/status-timeline.json`。
- 2026-08-21：T38 首版静态四幕在当前本地展示数据上通过五视口检查并修复次级精选轨道横向撑宽；随后版式与行动已按上方 T38-F1 用户反馈继续修订，本条只保留首版无 JavaScript、图片解码和零 console/request failure 证据，不代表当前最终尺寸或行动数量。
- 2026-08-21：PR #21、本地分支和上游共同指向 `2920214`，工作树在开工前干净。T37 只读审计覆盖 reveal/hover/carousel/route/menu/状态反馈与三条共享对象路径；7 个机会通过频率、目的、速度和功能门禁，逐项记录 autoplay/pointer/touch/keyboard、reduced 与中断策略。审计没有修改应用代码或安装动效依赖；证据为 `.design/MOTION_OPPORTUNITIES.md`。
- 2026-08-20：阶段 E 文档 Review 对照历史设计讨论、当前代码与 1440×900、768×1024、390×844 浏览器截图，确认 Hero 控制器静默态和首页领养一屏表达此前未进入可验收契约。1440×900 下当前领养 section 实测 949px、媒体 737px，caption 落到下一屏；空上下文读者也无法从旧文档判断控件显隐、一屏边界、输入模态或普通路由范围。本轮已把这些事实同步到 design/SPEC/PLAN/TASKS/REVIEW，未修改应用代码或代签视觉验收。
- 2026-08-20：阶段编号统一为 A 组件/进度、B 测试/领养、C 内容/隐私、D retention/删除/声明、E 动效/Hero/四幕、F Review/发布。阶段 E 顺序改为 `T37 机会审计 → T38 静态四幕 → T39/T40 焦点与预览 → T41 token/输入模态/reduced → T42～T46 场景动效 → T47 连续验收`；T35/T36 只继续阻塞最终发布闭环。
- 2026-08-20：修复后空上下文 Reader Test 已能明确回答 Hero 静默态、领养一屏、T37～T47 顺序、T35/T36 边界、输入模态、路由/View Transitions/Footer/reveal 与勾选状态；测试指出旧 `page-in: 300ms` token 与普通路由 120～180ms 上限冲突，已删除 page token 并统一由 `state: 180ms` 承担短路由 opacity。
- 2026-08-20：用户确认生产采用完整重新部署后，完成 M07/M08/M10/M11。四套管理上传统一走 `runAdminUploadSession`，精选排序、作品列表/编辑、内容与营业状态行动统一使用 `AdminAction`；`0047_r4_retire_paired_hero` 前向删除旧 pair 表/触发器，运行时删除旧 routes/DTO/Schema/repository/recipe/runner，四集合不变。累计 diff 为新增 608 行、删除 22,579 行，净减少 21,971 行。lint、typecheck、notices drift、focused 48/48、auth/database 28/28、完整 core 315/315、smoke 9/9、production build 与 diff check 通过。
- 2026-08-20：完成仓库简化 M01～M07/M09。删除 21 个 legacy Vitest、24 个 legacy Playwright、3 个旧 Vitest 配置、3 个无引用 Vue 组件、2 个无引用 Hero composable、4 个临时诊断脚本、测试专用 fake、重复 notices TXT 与确认无调用的导出；净删除约 1.74 万行。`pnpm test:groups`（core 52、smoke 1）、`pnpm notices:check`、lint、typecheck、core 327/327、smoke 9/9 与 production build 通过。首轮 core 暴露的内部 `findHeroItemAsset` import 过删已恢复，目标 12/12 与完整 core 复跑通过。
- 2026-08-20：PR #21 GPT-5.6 Pro Review 的阶段 E 前 finding 已在当前 HEAD 重新核验并修复。隐私政策共享校验同时保护申请页、上传会话、submission、health readiness 和 live preflight；空白、占位、旧“不收集”、处理者/收集范围/当前邮箱不完整时申请 fail closed，管理端仍可修正文案。确认不变量新增小型 core integration，申请提交改用 `PublicAction`，删除 busy 对话框不再被 Escape/遮罩关闭。
- 2026-08-20：notices 明确为当前生成环境安装快照，平台可选包不冒充 Linux runtime closure；`SEE LICENSE IN ...` 视为未知许可证；drift 从 `check:fast` 移入显式 release。`/licenses` 只导入 1,995 字节 summary，436,715 字节完整 JSON 不进入应用 bundle，完整 TXT 保留下载。`check:fast` 52 文件/327 项、smoke 9/9、production build/verify、ESA/observability、notices drift 与 586 tracked files Secret scan 通过。
- 2026-08-20：用户确认个人信息处理者的精确名称为“有点小狗工作室”。`0046_r4_privacy_controller` 只对 NULL、空白或精确历史默认的 `privacy_policy` 写入完整政策并复用当前 `contact_email`；管理员自定义文本保持不变。

- 2026-08-20：PR #21 Review 修复提交 `55487b9`；PublicationPanel 按“pending action → active persisted operation → terminal operation → feedback”展示，cleanup retry 具备 active/loading/disabled/防重/失败后可再试。目标 Playwright 2/2 通过。
- 2026-08-20：轻量确认与文案迁移提交 `5d4c7f8`；`0045_r4_default_copy` 只处理 NULL/空白/精确历史默认，不自动写 privacy 占位。半装目标文案明确为“仅头部和爪，不含尾巴”。迁移/委托 integration 26/26，确认/重复申请 smoke 2/2 通过。
- 2026-08-20：retention 与单条删除提交 `bf33c85`，非 rejected 人工批准覆盖修正 `f84f3c9`；rejected 立即进入脱敏候选，CLI 与 `/admin/commissions` 共用单条 dry-run/execute service，覆盖精确 current/version/delete marker、OSS/DB 失败、异常引用、重入与幂等。核心测试 6/6、CLI 1/1、管理端 smoke 1/1 通过。
- 2026-08-20：第三方 notices 提交 `e7c60bc` 初始生成 798 条包/版本+资产记录；T34-F1 已把口径修正为当前生成环境安装快照，并将页面收敛为摘要。Linux runtime 事实明确待部署 registry。

- 2026-08-20：任务分支 `codex/r4-t04-t21-foundation` 从 `main@cbaf98fec4868e94af5b28faf5c3d9a23344d859` 开始；Gate A 提交为 `767a1d4`，领养排序提交为 `16e4288`，测试/Actions 提交为 `daacff2`，文档与浏览器证据由本轮末次提交收口。
- 2026-08-20：公开 `PublicAction`、管理 `AdminAction` 与 `AdminTaskProgress` 已落地；Hero、作品图、二维码、水印 Logo 四类上传使用 XHR 字节进度；FFmpeg 为阶段 + elapsed + indeterminate；Hero/branding/publication operation 使用持久状态并可刷新恢复。
- 2026-08-20：Hero 管理改为“首页/委托”一级与“横/竖（桌面/手机画框）”二级；用户复核后首页与委托页均只渲染当前方向 Tab，筛选条只让选中项使用白底高亮，并移除完成态“已就绪”。四个 collection 的 API、version、owner context、CAS、items 与 operation 仍独立。
- 2026-08-20：用户复核修正了三处管理端反馈：作品下架行动与进度卡增加间距；低分辨率 Hero 适配完成后恢复自动接续发布，完成态显示“已完成发布”且刷新不再恢复陈旧适配状态；委托横/竖不再同页并排。
- 2026-08-20：`tests/test-groups.ts` 将 47 个 Vitest 文件归为 core、21 个归为 legacy，24 个历史 Playwright 文件归为 legacy；新 smoke 为 8 条黑盒主旅程。`pnpm check:fast` 通过，core 为 47 文件/308 项；`pnpm test:smoke` 8/8 通过。
- 2026-08-20：`pnpm test:release` 通过 8 条 smoke、production build、production output verify、ESA/observability policy 与 572 个 tracked 文件 Secret scan；没有触发镜像、Compose、Nginx、恢复或生产发布。
- 2026-08-20：`/adoptions` 在 repository 唯一按 `available → adopted`、组内 `updated_at DESC → id ASC` 排序，搜索保持相对顺序后分页；`/works` 保留原公开时间顺序。首页聚合最多一项 available，组件不再二次双项 slice/双列。
- 2026-08-20：真实 Chrome 使用合成隔离数据复核 390×844、768×1024、1440×900；公开首页和 Hero 管理无正向水平溢出，登录后无 console error，焦点、disabled、错误终态、retry 和 operation 刷新恢复可见。该证据不代签真实图片审美、真实手机、王旻安/景宸验收或独立 Review。
- 2026-08-19：确认 `/adoptions` 当前沿用全站发布时间顺序，尚未满足“开放领养优先、已完成在后、组内按修改时间降序”。
- 2026-08-19：确认首页当前领养仍取前两项并使用双列布局；需求4目标改为只投影并完整展示一项开放领养。
- 2026-08-19：确认 Hero 横/竖四集合及 CAS/发布模型应继续独立；问题主要在管理端四个扁平 Tab 的操作心智，而不是数据模型。
- 2026-08-19：确认上传、FFmpeg、发布、品牌重建和 Hero operation 已存在多套进度呈现；部分上传已有真实字节进度，部分长任务使用局部组件或人为阶段百分比，需统一。
- 2026-08-19：确认默认 Actions 同时执行全量 unit、integration、production build、镜像/Compose/恢复/Nginx 与完整 Playwright；部分测试绑定精确文案、DOM 和 `0.68s` 动画时长，反馈成本高于实际门禁价值。
- 2026-08-19：按用户意见将隐私确认收缩为现有文案字段 + 两个提交前确认 + 服务端字面量校验，不新增处理者字段、独立 metadata API、legacy/v2 contract、版本握手或 stale 409。
- 2026-08-19：重新定义动效为“简洁底盘 + 灵动角色感”；Apple Design Skill 继续提供空间一致性和响应原则，但不再把克制解释为压低所有情绪和弹性。
- 2026-08-19：空上下文复核确认发布工作流以“external publication”授权并把包含 FFmpeg 的镜像推送到 Docker Hub；`wangminan/project-fur-forge` 当前为公开仓库，旧“只在自有服务器使用、不对外分发”口径不成立。

## 当前约束

- 英文品牌固定为 `DITE DOG`，不得恢复 `DITE DOG FURSUIT` 或“暂用英文名”。
- 首页固定四幕：品牌 Hero → 代表作品 → 自设委托 → 设定领养。
- 首页设定领养只展示一项开放领养；无开放项时整幕隐藏，不展示第二项、已完成项或商品式拼版。
- Hero 后三个章节标题同级、主媒体等高；桌面主图左—右—左交替，移动端图片在上；各幕行动使用圆角 primary/secondary，不在标题右侧重复箭头入口。
- 委托和领养首页营业状态复用同一组件；领养状态由 `currentAdoptions.status` 直接投影，不依赖旧 entry 图片。
- 首页领养在 1440×900、1024×900、768×1024、430×932、390×844 从章节起点进入后，无需第二次滚动即可同时看到标题、角色、名称/物种、营业/单项状态和两个行动；单幅不等于强制全宽铺满。
- `/adoptions` 固定排序：`available` 在前、`adopted` 在后；每组按 `works.updated_at DESC`，再以稳定 ID 打破平局；搜索后仍保持该顺序，再分页。
- PC Web 是第一视觉基准；首页仅 ≥1024px 使用逐幕 wheel，1023px 及以下原生纵向滚动并沿用 Hero 横竖素材逻辑；普通页面不使用 scroll-jacking，不使用长时间 pinned scroll 或强制横向叙事。
- 公开视觉以简洁、摄影优先为底盘，但允许有节制的角色感动效：遮罩揭示、轻微弹性、图片聚焦、图文错峰和一次性成功反馈；不做持续摇摆、粒子、全屏视差或多对象同时抢动。
- Hero 默认只保留低权重分页/进度；箭头和暂停/继续不常驻，但必须在键盘焦点、fine pointer 边缘/控制区和触控显式唤起时可获得，暂停后恢复入口持续可见。
- autoplay、pointer/touch、keyboard 使用不同节奏；drag 只有完整跟手/反向/中断/速度/纵向滚动模型成立时实施。普通路由默认即时或短 opacity，不做全站位移模板。
- 公开行动组件、管理端行动样式、上传进度和长 operation 反馈必须先于首页重构收敛；不得继续复制局部按钮和 progress CSS。
- OSS 上传使用真实字节进度；持久 operation 使用真实阶段/计数；FFmpeg 无可信百分比时显示阶段、经过时间和终态，不伪造进度。
- Hero 横版/竖版素材继续分别维护，四集合版本和顺序互不耦合；管理端只统一信息架构和组件，不合并数据或强迫横竖一一配对。
- 隐私实现保持轻量：通过现有 `privacy_policy` 和 `contact_email` 维护真实处理者/联系信息；申请页只有两个未预勾选确认，服务端校验字面量 `true`，不新增确认持久字段或版本协议。
- 人工保留复核继续采用“人的判断 + 工具执行”；rejected 拒绝后立即进入候选，管理端与 CLI 只支持单条精确 dry-run/execute，不建设定时任务、Worker、批量自动删除或通用生命周期引擎。
- 测试只保护稳定不变量；视觉、排版、文案语气和真实图片效果以王旻安/景宸人工验收为最终门禁。
- 普通改动先运行快速静态检查和受影响的核心不变量；实现型 legacy 套件已物理退役，发布前再运行精简 smoke、构建/部署验证与人工浏览器验收。
- 不新增 GitHub required check；默认质量 workflow 保持轻量，重型镜像/恢复验证只由显式 release/manual 路径启动。
- 当前公开发布的容器镜像包含 FFmpeg，按二进制分发场景维护精确版本/摘要、许可证、对应源码与构建信息；网页没有单独下载入口不能被写成“未分发”。
- 需求1的 Host、媒体、OSS/ESA、安全、发布、恢复和部署基线，以及需求3仍适用的业务与匿名上传安全边界继续生效。

## 待确认问题（OQ 汇总）

无（所有阶段 OQ 已答）。个人信息处理者名称已确认为“有点小狗工作室”；邮箱继续复用 `contact_email`。

## 下一步交接

下一步由人工/独立 Review 继续 T47：真实手机、连续逐幕方向/锁定、性能与最终视觉验收；T35/T36 与生产隐私文案投影仍在镜像冻结和发布前完成。本轮按用户要求 commit/push 后结束，不进入 T48+，不代签王旻安/景宸验收、生产迁移/删除、镜像构建或发布。
