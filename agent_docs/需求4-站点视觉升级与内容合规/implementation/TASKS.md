# 任务清单：站点视觉升级与内容合规

> **角色**：需求4唯一任务与勾选权威；每个任务均可由 Agent 独立实现、验证和交接。
> **状态**：仅阶段 E 开放。A～D 已关闭；原阶段 F 按产品决策关闭，不再作为需求4 backlog。
> **规则**：`[x]` 表示对应历史任务与 Evidence 已完成，不代表凌巽已认可其为最终视觉设计；`[ ]` 仅用于阶段 E 开放项；`[-]` 表示按产品决策关闭、不再执行，不补签独立 Review、用户验收或生产发布。

## 当前目标

只继续阶段 E 的全站静态视觉重构、Signature Motion、UI/Controls、响应式/输入/可访问性与最终一致性验收。V08-F1、只读的 V08-F2、方向重置的 V08-F3、`GATE-V08-R`、V09～V16、T47 与 T47-F1/F2 implementation/docs 已完成，`GATE-DESKTOP` 与 `GATE-MOBILE` 均已由凌巽本人放行；V13～V16 已获凌巽确认。真实 iOS/Android 与最终人工观感继续留给 GATE-E，不由 Agent 代签。不得从本清单启动其他数据库、隐私、安全、分发或生产发布工作；T47-F1/F2 是用户 2026-08-26 对委托与联系范围的精确重新授权。

## 0. 文档与基线

- [x] **T00 · 需求4文档地基**：按 `_template` 建立 foundation、SPEC、COPY、design、models、PLAN、DATA-MIGRATION、TASKS、notes、review、artifacts 和 STATE。
- [x] **T01 · 第一轮代码/历史基线复核**：对照 `main@913d257` 的首页聚合、Hero、焦点字段、委托 Schema、默认文案与 licenses 页面。
- [x] **T02 · 外部设计资料复核**：评估 Apple、渔屋、万物通行和 Apple Design Skill；只采纳可解释原则，不复制品牌或把动效库当默认依赖。
- [x] **T03 · 第二轮代码与文档 Review**：先对照 `main@aa8e5b7` 修正单项领养、领养排序、组件优先、轻量隐私、测试减负、Hero 管理和统一进度口径；再以空上下文对照谈话记录、`main@ea3ae0a`、现有委托字段与发布工作流，修正评审基线表述、表单/QQ 文案分工、服务条款接受节点，以及公开 Docker Hub 下的 FFmpeg 分发口径。

### GATE-0 · 文档可实施

- [x] SPEC/PLAN 无未答 OQ；
- [x] 领养单项与排序已跨文档统一；
- [x] 已删除复杂处理者字段、metadata API、intake contract 和版本握手计划；
- [x] 公开/管理行动和进度组件被前置；
- [x] 测试与人工门禁边界已写入 `CLAUDE.md`；
- [x] 未将“灵动”写成持续噪声或恢复退役业务。

## A. 公共组件、上传与长任务进度地基

- [x] **T04 · 行动/上传/进度清单**：盘点公开/管理按钮、Hero/作品/QR/水印上传、FFmpeg/publication/branding/Hero operation 的现有状态、组件、CSS 和真实进度来源；输出去重矩阵，不先改业务。
- [x] **T05 · `PublicAction`**：实现 link/button 双语义与 primary/secondary/text、loading/disabled/focus/active；迁移首页、commission、about、adoptions、空态的现有行动并删除重复 CSS。
- [x] **T06 · 管理端行动 primitive**：统一普通/主/danger/link/loading/disabled 视觉和交互；先迁移大图、作品上传/发布、联系配置中最常用行动。
- [x] **T07 · `AdminTaskProgress`**：实现 determinate、stage、indeterminate、elapsed、success/error/cancelled 与可选 retry/cancel；不绑定具体业务。
- [x] **T08 · OSS 上传进度接入**：Hero、作品图、二维码、水印 Logo 至少四类上传复用真实 XHR progress 和统一组件；digest/session/validating/processing 使用统一阶段标签。
- [x] **T09 · FFmpeg 与 operation 进度接入**：FFmpeg 使用 indeterminate + elapsed；publication/branding/Hero 使用真实阶段/计数；删除 `PREPARING_SOURCE=12%` 等伪精确映射和局部 progress DOM。
- [x] **T10 · 上传展示层收敛**：抽取共享状态映射/展示 helper；只在确有重复时继续抽取 composable，不以大重写阻塞组件落地。
- [x] **T11 · Hero 管理信息架构**：一级“首页/委托”、二级“横/竖”；顶部显示两方向摘要，首页与委托页都只编辑当前方向；底层四集合/API/CAS 不变。
- [x] **T12 · Hero 设备预览**：增加桌面/手机画框切换和当前方向/状态/operation 摘要，复用统一进度和行动组件。

### GATE-A · 新开发不再复制组件债

- [x] 公开端新增行动只使用统一 component；
- [x] 管理端新增耗时操作只使用统一 progress；
- [x] OSS 上传显示真实百分比；
- [x] FFmpeg 不显示虚构百分比；
- [x] operation 刷新后可恢复真实状态；
- [x] Hero 四集合仍独立且功能无回退。

## B. 测试减负与领养排序

- [x] **T13 · 测试分类审计**：把现有 unit/integration/E2E 标记为 core/smoke/legacy；识别精确文案、DOM、CSS class、动画毫秒、重复覆盖和历史 bug 专用测试。
- [x] **T14 · 快速命令**：建立 `check:fast`、`test:core`、`test:smoke`、`test:release`；迁移期曾保留 `test:legacy`，后由 M03 完成物理退役。
- [x] **T15 · Core 套件**：只保留 Host/session/CSRF/Origin、上传 token/TTL/一次消费、PII/私有媒体隔离、migration/FK/integrity、publication/deletion 和明确排序不变量；同一事实不跨三层重复。
- [x] **T16 · Smoke 套件**：收敛为少量首页/目录/委托申请/admin 登录/上传进度/发布下架/privacy-service-licenses 主旅程；不断言精确动画时长、完整文案或局部 DOM。
- [x] **T17 · Legacy 清理**：删除或降级 `0.68s` 等实现型断言、逐次视觉修复用例和重复 fixture；测试失败先分类，不机械改写为新实现。
- [x] **T18 · 默认 Actions 减重**：普通 push/PR 仅执行快速 checks（文档-only 跳过应用重型任务）；image-build/Compose/restore/Nginx/必要 destructive drill 移入显式 release/manual 流程；不新增 required check。
- [x] **T19 · `/adoptions` 唯一排序**：repository 携带 `updated_at`；available 在前、adopted 在后，组内 updatedAt 倒序、ID 稳定；搜索后保持顺序再分页。
- [x] **T20 · 排序核心测试**：只保留一组稳定用例证明状态 bucket、组内修改时间、搜索和分页；新改为 adopted 的作品不得排到 available 前。
- [x] **T21 · 首页单项开放领养**：聚合最多投影第一项 available；`HomeCurrentAdoptions` 删除双项 slice/双列布局；无 available 时隐藏，adopted 仍可进入精选。
  - **SUPERSEDED BY V11**：`V11 supersedes T21 homepage single-adoption projection. Homepage Adoption now intentionally exposes up to 3 current available entries to improve discoverability; this is an explicit user-authorized product change.` 当前有效首页规则以 V11 为准，不得把 Homepage Adoption 修回单项；`/adoptions` 的排序、搜索、分页等既有业务逻辑不变。
- [x] **T21-F1 · 用户复核修正**：作品发布操作区与进度卡增加间距；Hero 编辑卡改为白底、方向筛选条只高亮选中项并移除完成态“已就绪”；低分辨率适配自动接续发布且完成态为“已完成发布”；委托横/竖按 Tab 分开渲染。

### GATE-B · 反馈更快、业务顺序正确

- [x] 普通改动不再默认执行历史全量 unit/integration/E2E；
- [x] 快速路径失败只对应稳定不变量或静态错误；
- [x] release/manual 仍可执行部署 smoke；
- [x] `/adoptions` 排序和首页单项通过 core + 人工浏览器；
- [x] 用户人工视觉验收未被自动化代签。

## C. 轻量内容、隐私与申请确认

- [x] **T22 · 默认文案前向迁移**：按 `COPY.md` 自动处理 about/commission/terms/contact 的 NULL/空白/精确历史默认；初始迁移未写入处理者占位符，后续由 T23 的已确认处理者前向迁移收口；各分区版本正确递增。
- [x] **T23 · 隐私政策处理者成文**：用户确认个人信息处理者为“有点小狗工作室”；不新增字段，前向迁移只对空值/精确历史默认写入包含当前 `contact_email` 的完整政策，保留管理员自定义文本。
- [x] **T24 · 两项申请确认 UI**：成年/设定权利、隐私/用途/非接单两项未预勾选；错误邻近、键盘/屏幕阅读器可用，提交失败保留表单与图片。
- [x] **T25 · 严格请求校验**：Schema 增加 `adultConfirmed: true`、`privacyNoticeAcknowledged: true`；service 在消费 upload 前校验；缺失/false 返回普通 validation error。
- [x] **T26 · 删除旧复杂方案残留**：确认无 `privacy_controller_name`、intake metadata API、contract version、确认 DB 列、legacy/v2 管理 UI、客户端 policy version 或 stale 409。
- [x] **T27 · 隐私/服务/关于/委托展示**：使用现有内容投影，QQ 优先、邮箱备用；目标隐私/服务文案与展示保护已完成，隐私政策已写入确认处理者名称。
- [x] **T28 · 轻量隐私负向验证**：确认 PII 不进入公开 DTO、HTML、URL、analytics、普通日志、错误和 local/session storage；只保留必要 core 测试。

### GATE-C · 确认清楚但工程轻量

- [x] 两项确认未预勾选且服务端严格；
- [x] 校验失败不消费 upload；
- [x] commission submission 表无新增确认字段；
- [x] 无专用 metadata/version 协议；
- [x] 个人信息处理者名称由用户确认为“有点小狗工作室”，邮箱复用当前 `contact_email`；
- [x] 隐私文案与真实功能一致，无处理者占位符或旧“不收集联系方式/设定图”默认。

## D. 人工 retention、单条删除与第三方声明

- [x] **T29 · Retention review repository/service**：rejected 拒绝后立即列入 masked 删除候选；pending 只提示复核，accepted 不按时间列入；CLI 与管理端共用且不输出 PII/Key。
- [x] **T30 · 单条删除 dry-run**：输入一个 submission ID/回执，统一 service/API/CLI 枚举 DB/OSS 精确关系、异常引用和脱敏计数；默认不写不删。
- [x] **T31 · 单条删除 execute**：固定强确认，current/version/delete marker/preview/pending 删除并验证后事务删行；每次只一条，管理端与 CLI 共用，不支持时间批量 execute。
- [x] **T32 · 管理端入口、重入与隔离演练**：`/admin/commissions` 列表/详情先展示单条脱敏 dry-run，再强确认 execute；对象已不存在、DB commit 失败、异常引用、重复执行和备份恢复后复核均有明确行为。
- [x] **T33 · 人工 SOP**：只维护月度上传清理、半年度申请 Review、用户权利请求、accepted 人工判断、单条 dry-run/execute 与备份恢复后复核流程；不建调度/提醒，不写虚构生产记录。
- [x] **T34 · 第三方声明生成**：从当前生成环境已安装的 production dependencies 生成稳定 JSON/TXT，无生成时间、排序稳定、未知许可证失败；平台可选包不冒充目标 Linux runtime closure，`ffmpeg-static` 包记录与实际二进制记录分开。
- [x] **T34-F1 · 阶段 E 前独立 Review 修复**：统一隐私政策 readiness 并接入申请页、上传/提交、health 与 live preflight；确认门禁提升为小型 core；notices 平台口径、`SEE LICENSE IN ...`、`/licenses` SSR 载荷、统一提交行动、busy 对话框和删除审计文档模型完成收口。
- [-] **T35 · Runtime/资产 registry**：按产品决策从活跃 backlog 关闭；若未来实际发布 Linux 镜像，仍须在发布边界核对 FFmpeg 版本、SHA-256、对应源码、补丁与构建配置。
- [-] **T36 · `/licenses` 与分发产物收口**：按产品决策从活跃 backlog 关闭；当前页面继续消费生成 notices，未来镜像发布时仍须核对 runtime registry 与 release evidence。

### GATE-D · 人工运维可执行

- [x] 单条删除 DB/OSS 一体、默认 dry-run、可重入；
- [x] 无 scheduler/批量自动删除；
- [x] 用户请求可单独处理；
- [x] notices 与当前 npm 生产依赖/已核实字体资产一致；
- [-] T35/T36 部署分发证据不再作为需求4任务；实际发布时按 Runbook 现场核对。

## D.1 仓库简化维护（不改变产品行为）

- [x] **M01 · 范围冻结**：素材继续由 Git 管理；固定版式委托制作单 PDF 及其字体/依赖保留；业务逻辑、动效设计和现有 UI 不因简化而改变。
- [x] **M02 · 文档口径校准**：按 `_template` 保留各文档职责，修正需求3 foundation 的领养发布冲突，并同步测试与 notices 的当前事实。
- [x] **M03 · Legacy 物理退役**：删除 21 个 legacy Vitest、24 个 legacy Playwright、旧脚本/配置与分类数组；`pnpm test` 收敛为 core 别名。
- [x] **M04 · 无引用文件清理**：删除无运行时引用的 3 个 Vue 组件、2 个旧 Hero composable、4 个临时诊断脚本和确认无调用的导出函数。
- [x] **M05 · Notices 单一文本产物**：只生成 `public/THIRD_PARTY_NOTICES.txt`，保留 JSON/summary 各自用途，不再提交相同 TXT 副本。
- [x] **M06 · 测试 fake 收敛**：删除只被测试自身调用、复制公开搜索/分页/精选逻辑的 `createFakePublicSiteRepository` 及验证 fake 自身的断言。
- [x] **M07 · 上传 session runner**：抽取 `runAdminUploadSession`/`completeAdminUploadSession`，统一声明、创建、XHR PUT、状态码、complete 与失败状态查询；四套业务 composable 只保留 owner/role、额外校验、业务文案、恢复和回调。
- [x] **M08 · 旧 paired Hero 服务端链退役**：用户确认生产将完整重新部署；删除旧 pair routes/DTO/Schema/repository/recipe/runner/测试夹具兼容面，以 `0047_r4_retire_paired_hero.sql` 前向删除 `site_hero_slides` 和旧触发器；四个独立 collection、version、CAS、item 与 operation 保持不变。
- [x] **M09 · 本轮验证**：test group（core 52、smoke 1）、lint、typecheck、notices drift、core 327/327、smoke 9/9 与 production build 通过；不代签 UI/动效人工验收或生产状态。
- [x] **M10 · AdminAction 完成迁移**：精选排序、作品列表/编辑、内容加载、营业状态和筛选行动改用统一 primitive；保留容器布局与移动触控高度，删除重复 hover/focus/disabled/button CSS。
- [x] **M11 · 跟进验证**：lint、typecheck、notices drift、focused 48/48、auth/database 28/28、完整 core 315/315、smoke 9/9、production build 与 diff check 通过；不代签 UI/动效人工验收或生产状态。

## E. 动效、Hero 焦点与首页四幕

- [x] **T37 · 动效机会审计与拒绝清单**：只读盘点 reveal/hover/carousel/route/menu/状态反馈/共享对象路径；按频率、目的、速度、功能筛选约 5～7 个高置信机会，记录 rejected candidates、输入模态、reduced 版本和中断策略；不改应用代码、不预装动效库。证据：`.design/MOTION_OPPORTUNITIES.md`。
- [x] **T38 · 首页静态四幕骨架**：先完成 Hero、lead work、非对称 commission、single adoption 的尺寸、空态和响应式，不加复杂动画；内容 SSR/无 JavaScript 默认可见，删除通用 section 上浮 reveal 假设；三幕标题同级、主媒体等高，桌面图片左—右—左交替，委托/领养营业状态复用同一组件，领养在全部目标视口一屏看见标题、角色、名称/物种、状态和两个行动。证据：`implementation/evidence/T37-T47-2026-08-21/t38-static/`。
- [x] **T39 · Hero 焦点写入契约**：未启用 item 通过 collection version + asset version 双 CAS 修改现有 asset focal；共享 asset 冲突阻断；公开旧变体未清理时阻断，下一次发布按新焦点生成不可变变体。
- [x] **T40 · 九宫格与目标裁切预览（历史首版）**：曾完成横/竖目标比例与九宫格预设；用户后续明确拒绝该交互，由 T40-F1 替代。
- [x] **T40-F1 · 可拖焦点与双滑杆**：目标画框内 1:1 拖动焦点，水平/垂直滑杆 0.1% 步进；仅 disabled item 可改，双 CAS、共享冲突和不可变变体规则不变。
- [x] **T41 · Token、输入模态与 reduced**：在已通过机会后建立 feedback/state/content/media 与 standard/playful easing，删除旧公共 duration/easing 与散落 620/680ms；Hero autoplay、pointer/touch、keyboard 分开 intent/时序，reduced 保留短状态淡化并覆盖 transparency/contrast；drag 未满足 1:1 跟手/反向/中断/速度/纵向滚动门槛，因此未实施。证据：`implementation/evidence/T37-T47-2026-08-21/`。
- [x] **T42 · Hero 角色感与静默控制器**：首屏动画从首次绘制直接开始，无完整显示后重启；图片聚焦、品牌 mask/clip 错峰；默认只显示低权重分页/进度，箭头与暂停/继续按键盘、fine pointer 边缘/控制区和触控显式唤起，暂停后恢复入口持续可见；自动轮播/页面隐藏/reduced/隐藏项加载保持正确。
- [x] **T43 · 代表作品幕**：lead 大图、短 caption、`/works` 与当前作品两个圆角行动、剩余精选次级；桌面 fine pointer 有轻聚焦，触控无 tilt；桌面逐幕导航时代表作品 01/02 为两个停靠点。
- [x] **T44 · 自设委托幕**：非对称分栏、桌面图片在右、同源媒体连续性，只保留 QQ 优先短说明、`/commission` 与申请表单两个行动；主媒体使用与 lead 相同的 fine-pointer 聚焦。
- [x] **T45 · 单项设定领养幕**：唯一 available 单幅完整展示；无 available 隐藏；1440×900、1024×900、768×1024、430×932、390×844 从章节起点进入后，无需第二次滚动即可看到标题、角色、名称/物种、状态、目录与当前角色两个行动；主媒体同款聚焦，删除到 Footer 的额外尾部 padding。
- [x] **T46 · Header、菜单、路由与共享对象**：Header 降低 SaaS 胶囊感、Footer 静态；普通路由即时或短 opacity，不做全站 `out-in + translateY`；View Transitions 只增强经实画面确认流畅的委托与领养路径；不恢复通用 section reveal、全面 tilt 或 CTA 回弹。
- [x] **T46-F1 · 首页桌面逐幕与委托反馈**：仅 ≥1024px 拦截 wheel，按 Hero → 代表作品 01 → 代表作品 02 → 委托 → 领养 → Footer 移动；1023px 以下原生滚动。复制邮箱前后提交/邮箱按钮顶边不移动。
- [x] **T46-F2 · 固定 Header 与次级作品布局**：首页 Header 固定并在离开 Hero 后切换实底；滚动 offset 不叠加、不覆盖当前幕或露出上一幕；“继续浏览”提高媒体高度、从 Header 下方开始；三张主媒体 hover 只在图片内生效并以 state 时序回落。
- [x] **T46-F3 · 次级轨道控制对齐**：“继续浏览”标题与左右轨道按钮共享顶部 padding 并在同一行对齐。
- [x] **T46-F4 · 用户复核的首绘、导航与代表作品修正**：中文主标题第一帧使用最终字号/位置且预加载拼贴字体；公开非 hash 路由统一在目标页面第一帧到顶，当前页品牌/导航入口也回页头，返回/前进在目标页加载完成后恢复 saved position，hash 保持 Header offset；委托主图取消点击；代表作品删除 caption 内孤立 `01`，PC 以同一标题和 `01/02` 眉题区分两屏，移动端只显示第一处标题，轨道控制下置。`check:fast` 53 文件/320 项、production build/content guard、router core 3/3、159 帧首绘采样、桌面 22/22 与移动 7/7 首页内部导航逐项点击通过。
- [x] **T46-F5 · 代表作品资格与数量约束**：管理端只允许至少有一张 READY 竖版出厂照的作品成为代表作品，服务端覆盖新建、编辑和展示设置路径；成员最多 2 件，移除竖版出厂照前必须先移出代表作品。复用现有作品/媒体表和展示设置接口，不新增迁移。
- [x] **T46-F6 · 单屏双图代表作品与目录回调**：首页代表作品合并为一个停靠幕；桌面左侧并排最多两张较小 3:4 竖图，右侧显示短说明与唯一“浏览作品展示”按钮，隐藏名称/物种并取消 lead/次级轨道与左右按钮，全部保持在一屏内。`/works` 恢复横竖等高混排，有出厂照优先出厂照，完全没有时才回落领养横版封面。
- [x] **T46-F7 · 景宸反馈回归与文档同步**：同步 STATE/SPEC/design/models/PLAN/foundation，补充竖版资格、两件上限、出厂照目录优先与单幕 wheel 稳定断言；自动验证只证明实现，不代签景宸/王旻安真实手机和最终观感。
- [x] **T46-F8 · 代表作品标题、留白与详情切换修正**：三业务幕复用同一左上标题 CSS；代表作品标题移到左上，桌面双图上限收敛为 360×480，并在 1440px 宽视口使用 56px 间距，右侧只保留精简说明和目录按钮。代表作品详情取消 720ms 共享媒体形变，保留 `view=home-featured` 入口语义并使用直接路由切换，避免第二张链接误让第一张图片参与跨页形变。

> **当前视觉执行状态**：`Homepage Featured Works Visual Baseline: B + M3`、V01～V08-F3 与全站公开内容覆盖审计均作为第一轮布局/视觉覆盖历史保留；这些 `[x]` 不代表全站方案已获最终视觉认可。两道静态 Gate 均已由凌巽本人明确放行，V09～V16 与 T47 已分别完成独立 Evidence/Handoff，V13～V16 已获凌巽确认；当前只剩 GATE-E 的真实设备与最终人工视觉验收。

- [x] **V00 · Visual Art Direction & Motion Prototype**：使用同一张 Homepage Featured Works 竖版摄影、同一文案、同一 Header 和同一 CTA，完成 A Editorial Offset、B Typography × Media、C Living Media Window 三个真实可运行候选，并完成 M1–M3 Motion Character 与 Shared Continuity 技术原型。所有候选独立可恢复，已提供 1440×900 与 390×844 截图、arrival / settle / next / previous / interrupt、shared forward / fallback / reduced / interruption evidence、Design Card、Accessibility / Reduced Motion、复杂度和依赖说明。原型仅通过 dev-only `/__prototype/v00/...` 展示，production build 不注册、不索引，正式首页、业务数据、API、数据库和发布逻辑不变。证据索引：`.design/prototypes/v00/INDEX.md`。

### GATE-V00 · Visual Direction Selected

- [x] A、B、C 至少三个真实候选已可运行、可截图、可比较；不是只改 gap、字号、圆角或图片尺寸。
- [x] 所有候选使用同一内容并拥有统一 Desktop / Mobile 截图；Motion 候选拥有短动态 evidence。
- [x] 所有候选代码仍可独立恢复，`.design/prototypes/v00/INDEX.md` 完整，production build 不暴露 prototype route。
- [x] 用户 / 客户明确记录选择组合 `B + M3`；Recommended 不等于 Selected。
- [x] 未通过本 Gate 前未开始 V01 正式生产实现。

- [x] **V00-F1 · Homepage Featured Works Visual Baseline**：将客户选定的 B + M3 精修为可交接基线。摄影 / 中文标题 / meta 与说明 / CTA 的 Directional Motion 振幅依次为 66 / 40 / 24～20 / 10px；Next / Previous 真正反向，reverse / interrupt 最终无残留；`SELECTED WORKS` 与 folio `01` 完全静止。Mobile 独立降低 `01` 权重，摄影保持第一焦点；轻量画册式 Previous / Next 保留 44px target。已验证 1440×900、390×844、430×932、Keyboard、Touch、Reduced Motion、图片解码与五段 WebM。证据：`implementation/evidence/V00/featured-b-m3/`；Handoff：`implementation/notes/2026-08-23-V00-B-M3-REFINEMENT.md`。

- [x] **V00-F2 · Full Public Surface Coverage Audit**：对照运行中的公开站、`app/pages`、共享公共组件与 V01～V12，确认 13 个公开路由文件中有 3 个重定向；连同全局错误入口，实际归并为 11 个独立视觉页面状态：`/adoptions/[slug]` 复用 `/works/[slug]`，`/contact` 重定向 `/about#contact`，`/terms` 重定向 `/service`。在 1280×800、768×1024、375×812 保存 33 张全页证据，补出此前遗漏的统一详情页、委托独立内容页、法务/许可证、404/500 与媒体失败状态任务；明确 V00 Gate 只选择 Art Direction，不代签全站完成。证据：`.design/screenshots/coverage-audit-2026-08-23/`；报告：`implementation/notes/2026-08-23-PUBLIC-VISUAL-COVERAGE-AUDIT.md`。

- [x] **V01 · Hero Art Direction & Homepage Opening Continuity**：复用并修改 `HomeHeroCarousel.vue`，把 Hero 设计为 Quiet / Cinematic Opening，并建立 Hero → Featured 的连续性；不照抄 B + M3，不改业务数据、横/竖独立集合、focal/CAS、SSR 可见性或 1023/1024 滚动边界。证据：`implementation/evidence/V01/`；Handoff：`implementation/notes/2026-08-23-V01-HANDOFF.md`。
  - **BRAND LOCK · Desktop 与 Mobile 默认规则**：“有点小狗工作室”的文案内容、字体身份/字体资产、font-weight、letter-spacing、line-height、品牌整体视觉身份和已确认的一次性首次入场逻辑继续锁定。Desktop 的最终视觉尺寸、位置、对齐和排版关系继续冻结；Mobile 的 visual size、核心位置、alignment 及与 viewport 的空间关系也不得因进入 Mobile Art Direction 而自动修改，必须优先在当前品牌文字终态约束下重构其周围 Hero composition。
  - **MOBILE HERO 可独立设计范围**：Photography、crop/focal、media size、scrim/overlay、background composition、Hero controls、arrows、pagination、pause/resume、controls grouping、wayfinding、`NEXT / destination` 表现、supporting copy、Negative Space、media/copy relationship 与 Hero → Featured continuity。
  - **EXPLICIT EXCEPTION APPROVAL**：仅当真实 390×844 / 430×932 构图证明现有品牌字号、核心位置或对齐造成角色主体遮挡、摄影焦点严重受损、不可接受的换行/裁切、controls/wayfinding 无法合理布置或首屏层级明显失效时，V12-F 才可记录具体冲突、提供 Mobile-specific alternative、输出 before/after screenshot，并说明为何周边构图不足以解决。获得用户明确批准前，不得修改品牌字的字号、核心位置或对齐关系。
  - **REOPENED**：摄影、crop/focal/media composition、scrim、mask/clip、图片切换与 autoplay 表现、箭头/分页/暂停恢复、控件 grouping/appearance/reveal、pointer/touch/keyboard 呈现、media settle、directional motion、scene arrival/departure、Hero → Featured 连续性和 Mobile Hero 构图。
  - **Acceptance**：允许品牌文字做一次性 stagger / reveal / 轻位移入场，但结束后必须精准回到冻结终态，换图时不重复，Reduced Motion 直接显示终态；阅读顺序以 Media → Brand → Supporting Copy → Controls 为起点。每完成 Desktop 构图立即验证 390×844、430×932、Keyboard、Touch、Reduced Motion并保存证据。

- [x] **V02 · Homepage Commission / Adoption Scenes**：修改 `HomeBusinessEntries.vue`、`CommissionLead.vue`、`HomeCurrentAdoptions.vue`、`AdoptionCard.vue`，分别建立 Media-led Service Scene 与 Display / Character Scene；只继承摄影主导、黑白灰 UI、Typography / Negative Space 和克制 motion，不机械复制 B + M3 版式。Commission Mobile 重新安排 media/copy/CTA，不压缩 Desktop 非对称布局；Adoption 以设定图完整性优先，使用 contain / art-directed canvas，禁止严重 cover 裁切。每个 Scene 完成时立即验证 390/430。证据：`implementation/evidence/V02/`；Handoff：`implementation/notes/2026-08-23-V02-HANDOFF.md`。

- [x] **V03 · Homepage Overall Scene Composition & Continuity**：把 V00-F1 基线正式落入 `FeaturedWorks.vue`，并整体验收 Hero → Featured → Commission → Adoption → Footer。Scene 强度固定为 Hero Quiet/Cinematic Opening、Featured Editorial Visual Peak、Commission Media-led Service、Adoption Display/Character、Footer Quiet Closure；检查第一焦点、第二落点、媒体尺寸节奏、Negative Space、Typography / Motion 强弱、构图与转场重复、Hero → Featured 同站感、≥1024 staged wheel 与 390/430 独立成立。依赖 V01、V02；Featured 竖图规则不得传播到其他页面。证据：`implementation/evidence/V03/`；Handoff：`implementation/notes/2026-08-23-V03-HANDOFF.md`。

- [x] **V04 · Homepage Mobile / Responsive Structural Pass**：在 V01～V03 已逐 Scene 做 390/430 检查的基础上，完成首页跨 Scene 移动重构与 768/1023/1024 边界复核。Mobile 是同一 Art Direction 下的重新构图，不是 Desktop CSS 缩小版；允许 Hero controls 的 position/grouping/density/reveal strategy 与 Desktop 不同，但功能、44px target、键盘/触控、暂停恢复和 Reduced Motion 不得丢失。Featured 保持摄影第一、背景 `SELECTED WORKS` 静止；正式产品按单幕双图契约不恢复 V00 测试 folio/翻页。Commission / Adoption 遵守 V02 的移动规则。**Historical only; the active Featured visual contract is superseded by V09+ and the current GATE-E criteria.** 该旧描述只保留为 V04 历史实现/Evidence 记录，不再约束当前 Type × Media Scene 或 Featured switching。证据：`implementation/evidence/V04/`；Handoff：`implementation/notes/2026-08-23-V04-HANDOFF.md`。

- [x] **V05 · Homepage Shared Design Language / Tokens / Media Rules**：从已完成的 Homepage Scenes 中收束摄影主导、黑白灰 UI、Typography 空间构图、Negative Space、无普通 Card/Shadow 层级、Directional Motion、Media Settle 与安静背景字为最小生产语义 token；明确 Hero、Featured、Commission、Adoption 各自布局不可互相复制。同步 Hero 横/竖 focal、Commission 媒体策略、Works/Detail 真实混合比例和 Adoption contain 边界；不改变上传、Schema、发布或水印策略。证据：`implementation/evidence/V05/`；Handoff：`implementation/notes/2026-08-23-V05-HANDOFF.md`。

- [x] **V06 · Works / Adoption Catalog 内容节奏**：修改 `/works`、`/adoptions`、`WorkCard`、`AdoptionCard`、`PublicCatalogSearch`、`PublicPagination` 与目录空态，复用 V05 的真实比例边界，建立横竖混排、角色封面、长名称/物种、状态/价格、搜索、分页、无内容、无匹配、非法筛选与越界页的完整视觉节奏；不改搜索、排序、数据、详情链接或新增瀑布流。验证 390/430/768/1024/1440、Keyboard、Touch、图片解码和极端比例。证据：`implementation/evidence/V06/`；Handoff：`implementation/notes/2026-08-23-V06-HANDOFF.md`。

- [x] **V06-F1 · Unified Work / Adoption Detail Scene**：修改 `/works/[slug]` 与 `WorkDetailGallery`，把作品入口和领养入口复用的同一详情模板设计成完整 Media-led Archive Scene；覆盖单图/多图、横图/竖图/混合图、缩略图选中与切换、返回作品/返回领养、长名称/物种、无图库和现有 404/500 路径。`/adoptions/[slug]` 只保留既有 301，不另造详情模板；不新增 DTO、状态/价格字段、灯箱或业务说明。验证 390/430/768/1024/1440、Keyboard、Touch、Reduced Motion、切图无位移和图片解码。证据：`implementation/evidence/V06-F1/`；Handoff：`implementation/notes/2026-08-23-V06-F1-HANDOFF.md`。

- [x] **V07 · About / Contact Editorial Information Page**：修改 `/about`、`PublicPageIntro`、`ContactChannelGrid` 与 `ContactEmailActions`，建立工作室事实、制作范围、联系和防诈骗提示的编辑式信息层级；Email / QQ / QQ群 QR 使用紧凑且可扫描的网格，1/2 个渠道和长号码均成立。`/contact` 继续 301 到 `/about#contact`，不创建第二套页面；不扩展五平台、不改后台字段、文案或二维码数据。验证 390/430 的二维码可读性、44px target、锚点让位和键盘焦点。证据：`implementation/evidence/V07/`；Handoff：`implementation/notes/2026-08-23-V07-HANDOFF.md`。

- [x] **V07-F1 · Commission Service Page**：修改 `/commission`、`CommissionLead`、制作范围、估价联系、联系行动与二维码区域，把当前已有摄影主导页收口为独立的 Media-led Service Narrative；覆盖横/竖 Hero、Hero 缺失回落、营业状态、制作范围、长短文案、Email/QQ/QQ群与服务条款入口。保留现有内容投影、共享媒体入口和业务逻辑，不把首页 Commission Scene 机械复制到内页。验证 390/430/768/1024/1440、Keyboard、Touch、Reduced Motion、二维码可读性与共享媒体 fallback。证据：`implementation/evidence/V07-F1/`；Handoff：`implementation/notes/2026-08-23-V07-F1-HANDOFF.md`。

- [x] **V07-F2 · Legal / Privacy / Licenses Reading System**：修改 `PublicLegalDocument`、`/service`、`/privacy` 与 `/licenses`，建立适合长篇中文条款、编号段落、许可证清单、原生 `details`、等宽信息和下载链接的阅读系统；`/terms` 继续 301 到 `/service`。重点修正 Mobile 许可证多列挤压、长段落扫描性、行长、段落节奏、锚点/focus 和展开内容溢出；不改法律/许可证文本、生成数据、下载产物或 Footer。证据：`implementation/evidence/V07-F2/`；Handoff：`implementation/notes/2026-08-23-V07-F2-HANDOFF.md`。

- [x] **V08 · Commission Apply Complete Form States**：修改 `/commission/apply` 与现有上传/表单组件，统一引导、字段、单位前缀、双列测量、上传区、确认项和主行动的阅读节奏，移除空错误位并控制 CLS；保留字段、校验、隐私、确认、上传与提交逻辑。验证不可用、空白、部分填写、字段错误、文件拒绝、上传/处理中、提交错误、可提交与成功回执状态，以及 390/430/768、Keyboard、Touch、软键盘和 44px target。证据：`implementation/evidence/V08/after/`；Handoff：`implementation/notes/2026-08-23-V08-HANDOFF.md`。

- [x] **V08-F1 · Public Error / Empty / Media Failure States**：修改 `error.vue`、`PublicEmptyState` 与 `ResponsivePicture` 的现有公开失败呈现，把 404、500、空内容、无匹配、图片加载/解码失败和无 JavaScript 回落纳入同一视觉语言；页面错误保留明确返回路径，图片失败不改变容器尺寸或让关键文字/行动消失。不新增重试 API、监控平台或第二套状态组件。五视口、Keyboard、Touch、Reduced Motion、无 JavaScript、无水平溢出、图片比例稳定与 500 非泄露测试均通过。证据：`implementation/evidence/V08-F1/after/`；Handoff：`implementation/notes/2026-08-23-V08-F1-HANDOFF.md`。

- [x] **V08-F2 · Full Public Static Surface Review & User Stop**：在 V08-F1 完成后，对 V00-F2 确认的 11 个独立公开视觉状态及三个重定向终点完成一次全站静态页面审查；覆盖 390/430/768/1024/1440、默认/长文/空态/失败态与 Footer 邻接，逐页核对层级、摄影、排版、间距、控制器、表单、法务、overflow、decode、Keyboard、Touch 与 reduced preferences。该任务只采集证据、写 Review 和形成按优先级排序的问题清单，未修改应用代码；现已暂停等待凌巽验收。证据：`implementation/evidence/V08-F2/after/`；Review：`implementation/notes/2026-08-24-V08-F2-STATIC-REVIEW.md`。

### GATE-V08 · 原静态审查人工验收（已由方向重置接管）


- [x] 凌巽已查看 V08-F2 审查并以新的方向重置要求提出明确修正范围；原 Gate 不构成进入 V09 的放行。
- [x] 所有已授权修正已登记为 `V08-F3`，并在新的证据与任务对齐报告中收口。
- [-] 原 Gate 的放行判断由 `GATE-V08-R` 替代，避免将旧“静态审查”误当作新的“全站视觉重构”授权。

- [x] **V08-F3 · Direction Reset Bug Fix & Task Reconciliation**：修复首页品牌标题刷新时的字体替换闪动，同时按凌巽 2026-08-24 的验收反馈恢复 V01 已确认的 `560ms + 180ms delay` 一次性标题入场；关键 WOFF2 继续 preload，`font-display: block` 阻止 fallback 字形先绘制，reduced-motion 仍直接显示终态，最终字体、字号、位置和排版不变。将共享 Hero 自动轮播默认间隔从 10s 收敛为 4s，保留暂停/恢复、页面隐藏和 reduced-motion 行为；定位图片填充异常为本地全量测试数据把 `cover` 资源错误生成为 `contain + pad`，从无边原图按现有 focal 重建当前启用 Hero 的 44 个本地横/竖、JPEG/WebP 变体并同步本地校验元数据，修复前后像素采样由左右各 15/192 列纯色补边归零。正式 OSS `m_fill` 配方、媒体拓扑、Vue 容器和通用 `ResponsivePicture` 均不改。证据：`implementation/evidence/V08-F3/after/`；Bug Fix Report：`implementation/notes/2026-08-24-V08-F3-BUG-FIX-REPORT.md`；任务重排：`implementation/notes/2026-08-24-TASK-RECONCILIATION-RESET.md`。

### GATE-V08-R · 凌巽方向重置人工验收（后续视觉重构阻断点）

- [x] 凌巽本人已查看 V08-F3 的 bug 证据、第二次 `TASKS.md` Patch 和 `2026-08-24-TASK-RECONCILIATION-STATIC-MOTION-UI.md`。
- [x] 凌巽本人曾明确确认 Static → Static Gate → Motion → UI → Final 的阶段原则；2026-08-24 的后续客户授权将原单一静态 Gate 细化为 Desktop Gate 与 Mobile Gate，以下 Phase S 新路线为当前权威顺序。
- [x] 凌巽本人已明确允许从 V09 开始；自动化、设计 Review、王旻安/景宸或其他成员不得代签。
- [x] 本 Gate 已通过；V09 依授权执行。V10～V16 与 T47 implementation/evidence/docs 已完成，`GATE-DESKTOP` 与 `GATE-MOBILE` 均已由凌巽本人放行；V13～V16 Handoff 已获确认，GATE-E 继续遵守下方人工验收边界。

### Open-source Resource Policy · 全阶段适用

- 可以主动评估和采用许可清晰、维护状态合理、与当前视觉方向一致的 GitHub / 开源 icon、motion、carousel、interaction、small UI 或 typography/layout primitive；“当前没有依赖”不得成为拒绝大胆设计的理由。
- 采用前必须记录 license、来源、bundle/维护成本，并验证 SSR、Accessibility 与 Reduced Motion；不得引入无关大型 framework、为了使用库而使用库、复制其他品牌设计或破坏现有业务契约。
- 原生 CSS / WAAPI 能可靠满足 reverse、interrupt、最终状态与可访问性时继续优先使用；出现可复现缺口后再选择最小合适资源。

### Phase S · Full Static Visual Redesign

本阶段先在完全静止的状态下解决 Composition、Typography、Media Placement、Negative Space、Scene Identity、Visual Hierarchy、Shared Visual Grammar 和 Desktop / Mobile 静态构图。“有动画”不是完成标准；关闭所有非必要动画后仍须像完整设计稿。统一的是 typography、directional/wayfinding grammar、media treatment、monochrome UI、spacing rhythm、control geometry 和 motion philosophy，不是把所有页面做成 `eyebrow + 中文标题 + 左图右文` 模板。

> **2026-08-24 Mobile 路线校准**：V09～V11 的完成状态、实现、Evidence 与 Handoff 保持关闭，不重新打开。其既有 390/430 Evidence 只证明当时版本没有溢出、遮挡、功能丢失等 **Mobile Structural Safety**，不等于 Mobile Final Art Direction 已获批准。V12-A～V12-E-F4 仍为 Desktop 静态方向的收口任务；其中要求的 390/430 证据同样先证明结构安全和字体渲染可靠。Desktop 全站方向在 `GATE-DESKTOP` 单独验收后，再进入 V12-F/V12-G 的 Mobile 独立构图，最后由 `GATE-MOBILE` 验收。

- [x] **V09 · Shared Visual Language Contract & Featured Works Static Redesign**：**前置依赖：`GATE-V08-R` 已由凌巽本人明确放行。** 已把 Shared Visual Language 写成可执行契约，并将 `FeaturedWorks.vue` 重做为 Type × Media 静态 scene：Desktop 使用明确 Typography / Media overlap，Mobile 独立采用 Typography 明确让开摄影的纵向构图；摄影为第一视觉 anchor，信息组错轴，Hero 的 `NEXT ─ SELECTED WORKS` 由 Featured 的 `NEXT ─ CUSTOM COMMISSION` 语义延续。代表作品继续最多两项；只有两项真实内容时显示可操作的上一项/下一项与连续 `01 / 02`、`02 / 02`，单项时不显示孤立编号或伪造 `03`。切换为无动画 hard cut，不实现 Featured autoplay 或 Motion choreography；Hero 4s autoplay、字体闪动修复、品牌终态与一次性入场未回退。证据：`implementation/evidence/V09/after/`；Handoff：`implementation/notes/2026-08-24-V09-HANDOFF.md`。
  - 用户后续响应式复核已收口：移除 Desktop 固定 `39rem` 舞台造成的短视口溢出，`1440×768` 与 `1440×900` 均显示完整 `NEXT ─ CUSTOM COMMISSION`；Mobile 在 375/390/430 内同屏显示标题、Typography、摄影、双项切换、内容、CTA 和 destination rail。CTA 与 Desktop 切换器保留 36px，Mobile 切换器与内容保留 16px；Hero Mobile 不再隐藏 `NEXT`。

- [x] **V10 · Homepage Commission + `/commission` Static Redesign**：**前置依赖：V09 已完成并获该任务交接确认。** 已将首页委托重做为摄影主导的 Service Docket：保留四幕标题尺度一致性，以背景 Typography、横版摄影和沿媒体下缘展开的三段服务信息栏建立焦点，不使用右下完整白色 UI Card；摄影与信息栏使用独立网格行和硬间距，在 1280×800、1440×900、2048×1080 等宽屏/短屏均不相交。`/commission` 使用独立 Photographic Service Ledger：横/竖 Hero 后接身份、营业状态、说明与行动台账，制作范围和估价联系形成非机械复制的双列内容面。两处复用既有 `PublicBusinessStatus`、`PublicAction`、横竖媒体、内容投影、申请/QQ/Email/条款与共享媒体入口；业务数据、focal、媒体拓扑、Footer 与 Hero 品牌锁不变。摄影统一复用 `--radius-image`；按用户维护性决定删除 Featured 中写死的说明段，不新增字段、DTO 或迁移。Desktop、390、430、375、768、1280 与 2048 静态 Evidence、自动审计和独立 Handoff 已完成。证据：`implementation/evidence/V10/after/`；Handoff：`implementation/notes/2026-08-24-V10-HANDOFF.md`。

- [x] **V10-F1 · Commission Composition & Chinese Wayfinding Refinement**：按人工复核把首页委托收口为约 65% Media / 35% Service Narrative 的非对称构图，摄影保持第一锚点，“从角色设定出发”成为第二锚点；`/commission` 首屏使用左侧服务叙事、右侧摄影，并以可点击的 `继续查看 / 制作范围与估价 ↓` 明确提示下方内容。Hero、Featured、Homepage Commission 与 Commission 申请入口的同类引导统一为 `下一幕 / 代表作品`、`下一幕 / 自设委托`、`下一幕 / 设定领养`、`开始申请 / 填写委托表单 →`；英文仅保留为非必需的 scene metadata。Featured、Homepage Commission 与 `/commission` 顶栏中无信息作用的右侧 register 已统一移除，标题下规则线收至 32rem 上限。未进入 Motion、V11、业务字段或数据层。证据：`implementation/evidence/V10-F1/after/`；Handoff：`implementation/notes/2026-08-24-V10-F1-HANDOFF.md`。

- [x] **V11 · Adoption Character Archive Static Redesign**：**前置依赖：V10 已完成并获该任务交接确认。** V11 以用户明确授权的产品调整 supersede T21 首页单项投影：为提高领养内容可见性，首页按既有排序自动读取最多三项当前 `available`，排除 `adopted`，不足三项按真实数量展示；多项提供循环“上一个 / 下一个”和媒体下方角色索引，主图与主行动均进入当前详情，单项隐藏伪切换或孤立编号。不得把 Homepage Adoption 修回单项；`/adoptions` 的排序、搜索、分页等既有业务逻辑保持不变。`/adoptions` Desktop 使用双列、Mobile 使用单列；目录优先投影既有完整设定图，缺失时才回退横版领养封面。每项采用“完整 `contain` 媒体 + 独立信息面板”：Desktop 左右并置、Mobile 上下重排；信息面板只保留横排角色名称、以 `·` 和留白分开的无字段名物种/价格/状态三行值、进入详情的单一行动，以及右下方以圆润无衬线字体呈现并被容器轻微裁切的真实列表顺序 `01 / 02…`。整项可点击，无英文档案标签、容器阴影、字段分隔线、卡片间横线或额外详情按钮。目录页头删除可领养数量与营业提示，保留放大的 `ADOPTIONS / 设定领养`，并用现有工作室标志形成右上斜向淡色水印；搜索框位于无上下边线的右侧操作组中并紧邻“联系我们申请领养”，搜索结果数量仅在搜索生效时显示，清除后隐藏。1440×900 首屏完整显示前两个角色，390/430 完整显示第一项。领养详情新增真实领养状态、价格和“联系咨询领养”，并保留返回目录。复用既有排序、搜索、分页、路由、媒体记录和数据库结构；后端仍返回 `availableCount`，但目录页不再展示；编号由当前公开排序与分页位置推导，不暴露 UUID、不误用精选 `sortOrder`，不新增字段、Schema、迁移或依赖。Desktop、390/430 静态 Evidence、自动审计与独立 Handoff 已完成。证据：`implementation/evidence/V11/after/`；Handoff：`implementation/notes/2026-08-24-V11-HANDOFF.md`。

- [x] **V12-A · Works Catalog & Work Detail Static Redesign**：**前置依赖：V11 已完成并获该任务交接确认。** `/works` 已重做为等权作品目录：Desktop 统一四列且不按角色或媒体比例分配视觉权重，统一 4:5 圆角媒体画布与底部渐变身份层；竖版摄影保持主视觉填充，横版设定图使用 `contain` 保证完整展示。页头以背景 `WORKS`、中文标题/说明和右侧搜索建立 archive/editorial identity，搜索、结果数、分页、路由与空态行为不变。统一 Work / Adoption Detail 在 Desktop 保持左侧 gallery + 右侧 sticky 信息账本的一屏优先结构，gallery 舞台、缩略图和媒体统一圆角；领养详情继续保留真实状态、价格、咨询入口、返回目录和 V11 媒体优先级。公共布局只通过 flex 让短内容页 Footer 贴近视口底部，未修改 Footer 组件。1440×900、390×844、430×932 的 before/after、图片解码、无横向溢出、Reduced Motion 静态审计与独立 Handoff 已完成。证据：`implementation/evidence/V12-A/`；Handoff：`implementation/notes/2026-08-25-V12-A-HANDOFF.md`。

- [x] **V12-B · About / Contact Static Redesign**：**前置依赖：V12-A 已完成并获该任务交接确认。** About 已重做为紧凑的 `ABOUT / 关于我们` masthead 与工作室/制作范围 editorial story；Contact 使用独立浅灰 scene，Desktop 左侧为联系说明和委托主行动，右侧以竖线分隔邮箱与横向 QQ/QQ群二维码，防诈骗提示紧接下方并只用淡灰竖线强调。Mobile 保持纵向阅读顺序与两枚 152px 二维码横排。后台内容投影、渠道数据、Email/复制、申请入口、`/contact` 301、锚点、Footer 和业务功能均未改变。1440、2048、768、1023、1024、390、430 截图、单渠道/长账号/图片解码/44px/键盘/Reduced Motion/复制邮箱/重定向自动审计与独立 Handoff 已完成。证据：`implementation/evidence/V12-B/`；Handoff：`implementation/notes/2026-08-25-V12-B-HANDOFF.md`。

- [x] **V12-C · Commission Apply Static Redesign**：**前置依赖：V12-B 已完成并获该任务交接确认。** 按用户复核保留申请页原有竖向阅读顺序，不改成 Desktop 左右分栏；页名、隐私说明和表单统一到 56rem 主轴，字段在 Desktop/Tablet 内部双列、390/430 单列，身高/体重继续作为并列 measurement group。原页头右侧孤立的“只用于内部评估”并入表单首段隐私提示；现有工作室 Logo 在 Desktop/Tablet 页名左侧作为 5% 灰度水印并逆时针旋转 15°，放大后纵向覆盖标题与内部评估说明，Mobile 隐藏该装饰。上传区改为紧凑圆角媒体面、预览与轻量更换/移除行动，确认、错误、进度、失败保留、成功与不可用状态保持去卡片化静态层级。字段、校验、上传、提交、两项确认、QQ/Email、失败保留、后台内容投影与安全边界均未改变。1440、768、390、430、输入法安全、错误、预览、失败保留、成功和不可用 Evidence、自动审计与独立 Handoff 已完成。证据：`implementation/evidence/V12-C/`；Handoff：`implementation/notes/2026-08-25-V12-C-HANDOFF.md`。

- [x] **V12-D · Legal / Privacy / Licenses Reading Design**：**前置依赖：V12-C 已完成并获该任务交接确认。** `/service`、`/privacy` 与 `/licenses` 已统一为克制的长文阅读系统：`PublicPageIntro` 增加不影响默认内页的 document 变体，以大页名和事实型 metadata 建立入口；服务条款和隐私政策使用动态章节数、编号章节、Desktop sticky 章节导航、Mobile 双列目录、46rem 正文行长和返回页首；许可证沿用同一阅读网格，并保留原生 `details`、等宽许可证全文、第三方资产和生产依赖数据。章节锚点、44px 导航/折叠目标、键盘开合、无横向溢出和图片解码均已自动验证。法务正文、许可证数据、重定向、Footer、业务逻辑和依赖均未修改，也未加入 Motion。Desktop、390/430 与许可证展开态 Evidence、自动审计和独立 Handoff 已完成。证据：`implementation/evidence/V12-D/`；Handoff：`implementation/notes/2026-08-25-V12-D-HANDOFF.md`。

- [x] **V12-E · Error / Empty / Media Failure Static States**：**前置依赖：V12-D 已完成并获该任务交接确认。** 404、500、普通 empty、搜索 no result 与 image failure 已归入同一编辑式状态系统：共享空态以规则线、放大标题、清楚恢复行动和现有 `/brand/logo-mark.png` 的低对比度灰度水印建立品牌归属；404/500 增加 brand-only Header，保留真实状态码，500 只显示安全通用说明；媒体失败在原横/竖比例内显示同款水印和回落文字，无 JavaScript 时继续输出原始图片。作品目录卡片按底部身份渐变的占位量补偿失败层，使文字与水印落在可见媒体区域的视觉中心。Logo 均为绝对定位装饰层、`aria-hidden` 且不改变布局。错误语义、恢复路径、搜索行为、Footer、媒体 DTO/安全边界、接口、依赖与 Motion 均未改变。五类状态的独立 1440×900、390×844、430×932 截图、键盘焦点、无 JavaScript、Reduced Motion、自动审计与独立 Handoff 已完成。证据：`implementation/evidence/V12-E/`；Handoff：`implementation/notes/2026-08-25-V12-E-HANDOFF.md`。

- [x] **V12-E-F1 · Sitewide Typography Audit & Governance**：**前置依赖：V12-E 已完成并获该任务交接确认。** 已以 `public-base.css` / `admin-base.css` 建立 Display、Body、Metadata、UI、Legal、Code 语义 token，并把正式公开页面、共享 UI 与管理端外壳从历史字体别名收口到相应角色；V00 原型兼容别名保留。Windows/Edge 实测 Display 命中 STSong，Body/Metadata/UI/Legal 命中 Microsoft YaHei，Code 命中 Consolas，Hero 品牌字继续命中 ZhuoHeiPinTieTi。用户明确接受现有拼贴体，不把其授权复核作为本任务阻塞；仓库分发的其他字体 Noto Serif SC 为 SIL OFL 1.1，仅供委托制作单 PDF 嵌入并按字形子集输出，网页不请求也不 preload；PingFang SC、Microsoft YaHei、Songti/STSong、Arial Rounded、Consolas 只作为系统字体引用，不随项目分发。未新增字体或依赖。11 个公开状态在 1440×900、390×844、430×932 的 before/after、Desktop/Mobile specimen、computed platform-font、preload/font-display、fallback、CLS 与 overflow 自动审计均已完成；最大 CLS 0.000237、无横向溢出，只有 19KB 品牌关键子集 preload。Hero 品牌终态、Footer、scene、业务文案、数据、路由、Motion 与后台功能未改变。证据：`implementation/evidence/V12-E-F1/`；Handoff：`implementation/notes/2026-08-25-V12-E-F1-HANDOFF.md`。

- [x] **V12-E-F2 · Desktop Acceptance Corrections**：**前置依赖：V12-E-F1 已完成，来源为凌巽在 `GATE-DESKTOP` 的人工复核反馈。** 已完成共享图片失败层居中与短提示、公开领养仅投影 `available`、前台领养状态移除、Homepage 物种替换、Works 水印、Commission 3:7 与响应式灰线、共享 editorial 分页，以及 Homepage Adoption DOM ref 运行错误修复；后台状态模型、`/works` 归档资格、Hero 品牌文字、Footer、Motion、管理端字段、数据库 Schema、媒体 DTO 和依赖均未改变。1440×900、390×844、430×932 的失败态、Homepage Adoption、Adoptions、Works、Commission、Detail 与分页 Evidence、领养投影回归测试和独立 Handoff 已完成。证据：`implementation/evidence/V12-E-F2/after/`；Handoff：`implementation/notes/2026-08-25-V12-E-F2-HANDOFF.md`。完成后重新停在 `GATE-DESKTOP`，不得进入 V12-F。

- [x] **V12-E-F3 · Homepage CTA Consistency & Motion Scope Reconciliation**：**前置依赖：V12-E-F2 已完成，来源为凌巽在 `GATE-DESKTOP` 的人工复核反馈。** 删除 Featured 对共享 primary action 的局部黑色覆盖，使“浏览作品展示”与 Homepage Commission 的“提交委托申请”统一使用 `PublicAction` 蓝色 primary token；保留尺寸、位置、文案、路由、交互和次级按钮。该历史任务当时把 V13 跨页 shared-media transition 收紧为 Homepage Commission → `/commission`、Homepage Featured → Work Detail、`/works` → Work Detail、`/adoptions` → Adoption Detail 四条；后续 V13 的五条用户明确授权已 supersede Homepage Adoption → Detail 的移除口径。1280×800、768×1024、375×812 before/after、computed color、`check:fast` 与独立 Handoff 已完成。截图：`.design/screenshots/v12-e-f3-*`；Handoff：`implementation/notes/2026-08-25-V12-E-F3-HANDOFF.md`。

- [x] **V12-E-F4 · Featured Desktop Composition Density**：**前置依赖：V12-E-F3 已完成，来源为凌巽在 `GATE-DESKTOP` 的人工复核反馈。** 不新增内容或装饰，将 Featured 名称/物种/CTA/切换器收为同一 Desktop 信息组并上移；大屏摄影向中部延伸一列，尺寸放宽至 `34rem / 36vw / 可用高度` 三重约束，使 1440/1920 更饱满、1280×800 仍完整显示底部 wayfinding。后续人工复核要求复用 Homepage Adoption 的 `--public-media-canvas` 浅灰承托：媒体外框尺寸不变，照片在画布内缩小，外框/照片分别使用 `12px / 8px` 圆角。Tablet/Mobile 保留“图片 → 切换 → 信息”顺序。1280×800、1440×900、1920×1080、768×1024、390×844 截图、canvas/inner-image computed style、overflow/DOM-order 审计、`check:fast` 与独立 Handoff 已完成。截图：`.design/screenshots/v12-e-f4-*`；Handoff：`implementation/notes/2026-08-25-V12-E-F4-HANDOFF.md`。

### GATE-DESKTOP · Full Desktop Static Art Direction Approval

- [x] V09～V12-E、V12-E-F1、V12-E-F2、V12-E-F3 与 V12-E-F4 均已完成各自实现、Desktop 静态 Evidence 与独立 Handoff；未使用 Mobile Structural Safety 或一份总报告代替各子任务 Desktop 交接。
- [x] V12-E-F1 已证明 Display、Body、Metadata、UI、Legal/Code 五类角色在同类内容中一致，中文/英文/数字/等宽及混排成立；字体来源、授权、preload、fallback、`font-display`、Desktop/Mobile specimen 与页面 before/after 证据完整，Hero 品牌字专属锁与 Footer 均未被改动。
- [x] 凌巽本人已在关闭所有非必要动画的条件下浏览 Hero、Featured、Homepage Commission、Homepage Adoption、Works、统一 Detail、`/adoptions`、`/commission`、About/Contact、Apply、Service、Privacy、Licenses、Error/Empty/Media Failure 的完整 Desktop 静态构图。
- [x] 凌巽本人已于 2026-08-25 明确确认“没问题，继续按照 TASKS 往下做”，据此冻结 Desktop 并放行 Mobile 独立构图；Agent、自动测试、设计 Review 或其他成员未代签。
- [x] V12-F 与 V12-G 开始前均已遵守本 Gate；`GATE-MOBILE`、V13～V16 与 T47 implementation/evidence/docs 后续均已完成，V13～V16 Handoff 已获确认；GATE-E 的真实设备与最终人工视觉验收仍未代签。

### Mobile Independent Art Direction Contract

Mobile 的核心原则是：**Same visual language, different composition.** Mobile 必须继续继承同一品牌语言、业务内容、功能语义、数据来源、路由与 Accessibility 义务，但不要求继承 Desktop grid，也不得把 Desktop 版式机械缩小。

在 390/430 等 Mobile 视口内，V12-F/V12-G 可独立修改 `media position / size`、`crop / contain`、页面级 `typography scale`、非品牌标题与 metadata 位置、CTA grouping、wayfinding、背景 Typography、Negative Space、overlay strategy，以及 controls 的位置与分组。Featured、Commission、Adoption 若 Desktop 结构不能自然成立，可以完全重新构图。Mobile Hero 可以独立重新设计 Photography、media composition、controls、wayfinding、supporting copy 与周边空间关系；“有点小狗工作室”品牌文字默认继续遵守既有 Brand Lock，优先重新设计品牌字周围空间。只有在 390×844 / 430×932 实际构图证明无法优雅成立时，才可提交带具体冲突、理由和 before/after screenshot 的 Mobile-specific brand placement/scale exception 供用户人工批准；不得自动解除品牌锁。Desktop 已通过的 Art Direction 冻结，不因 Mobile 重构被反向改写。

- [x] **V12-F · Mobile Homepage Independent Art Direction**：**前置依赖：`GATE-DESKTOP` 已由凌巽本人明确放行。** Homepage Hero、Featured、Commission、Adoption 已在 390×844 / 430×932 下形成独立静态构图：Hero 只调整摄影周边 scrim 与 supporting copy，品牌文字字号、核心位置、对齐、字体身份和一次性入场未改；Featured 强化浅灰媒体承托并保留 `12px / 8px` 圆角、双项选择与清楚信息顺序；Commission 以满宽媒体和轻微错轴叙事收紧节奏；Adoption 将三项显式选择、循环上一项/下一项和 `01 / 03` 合并为稳定控制行，完整设定图、角色信息与行动均保留。四幕默认、多项、长文与整页边界 Evidence 已覆盖两档视口；44px、无水平溢出、图片解码、Hero Brand Lock、4s autoplay、标题入场不重启、Reduced Motion 与 Desktop 冻结回归均通过。用户在收口时直接指出的 Works/Adoptions 移动端背景英文/Logo 重叠与领养卡密度也已修正并在 390/430 实测，但不据此把 V12-G 视为完成。证据：`implementation/evidence/V12-F/after/`；Handoff：`implementation/notes/2026-08-25-V12-F-HANDOFF.md`。

- [x] **V12-G · Remaining Public Mobile Art Direction**：**前置依赖：V12-F 已完成并获该任务交接确认。** 已对 Works Catalog、统一 Work/Adoption Detail、`/adoptions`、`/commission`、About/Contact、Apply、Service、Privacy、Licenses、Error/Empty/Media Failure 完成逐页 390×844 / 430×932 Mobile Final Art Direction 审查；各类页面继续使用适合自身内容密度与媒体比例的构图，不套用统一模板。多图 Detail 的 Mobile 主舞台从 `58svh` 收敛为 `clamp(17rem, 92vw, 24rem)`，五张缩略图在 390/430 保持单行；单图领养详情继续完整按原比例展示。搜索、分页、表单校验聚焦、双二维码、法务目录与原生许可证展开、404/500、空态/无结果、四类媒体失败、路由和后台内容投影均保留。两档 Mobile 与 1440 Desktop 冻结回归的状态码、无横向溢出、图片解码、普通页 Footer、44px 主要控件、表单、法务与失败恢复审计全部通过；`pnpm check:fast` 为 53 文件 / 314 项。证据：`implementation/evidence/V12-G/after/`；Handoff：`implementation/notes/2026-08-25-V12-G-HANDOFF.md`。

### GATE-MOBILE · Full Mobile Static Art Direction Approval

- [x] V12-F 与 V12-G 均已完成 Mobile 独立实现、390/430 Final Art Direction Evidence 与独立 Handoff；V09～V12-E 与 V12-E-F1 的旧 Mobile Structural Safety / Typography Evidence 未被用于代替本 Gate 证据。
- [x] 凌巽本人已在关闭所有非必要动画的条件下浏览 Homepage 四幕与全部其余公开状态的 390/430 最终静态构图，并确认媒体、Typography、CTA、wayfinding、背景字、Negative Space、overlay 与 controls 在 Mobile 上独立成立。
- [x] 凌巽本人于 2026-08-25 明确确认“没问题，继续按照 TASKS 里的任务往下做”，据此允许 Mobile 静态方向与已通过的 Desktop 方向一起进入 Motion；Agent、自动测试、设计 Review 或其他成员未代签。
- [x] `GATE-DESKTOP` 与 `GATE-MOBILE` 已同时通过，V13～V16 与 T47 implementation/evidence/docs 已依次完成；V13～V16 Handoff 已获确认，GATE-E 仍等待真实设备与最终人工视觉验收。

### Phase M · Signature Motion / Carousel / Scene Continuity

- [x] **V13 · Signature Motion / Carousel / Scene Continuity**：**前置依赖：`GATE-DESKTOP` 与 `GATE-MOBILE` 均已由凌巽本人明确放行。** 在分别冻结的 Desktop 与 Mobile 静态构图上修改 `HomeHeroCarousel.vue`、`FeaturedWorks.vue` 与相关 Homepage scene，统一 Hero/Featured/Adoption carousel、4s autoplay 基准、pause/resume、next/previous、directional reverse、interrupt、Media Settle、title/meta/CTA motion hierarchy、scene arrival/departure，以及 Hero → Featured → Commission → Adoption 的站内 scene continuity。跨页 shared-media transition 只允许五条：Homepage Commission → `/commission`、Homepage Featured → 对应 Work Detail、Homepage Adoption 当前角色 → 对应 Adoption Detail、`/works` 被点击作品 → 对应 Work Detail、`/adoptions` 被点击角色 → 对应 Adoption Detail；Homepage Adoption → Detail 是凌巽在 2026-08-25 针对 V13 的后续明确授权，supersede V12-E-F3 的移除要求。只绑定实际点击 source 与对应 target，不让文字、CTA、背景 Typography 或其他卡片参与 morph。白名单外不增加跨页平滑切换；Reduced Motion、不支持 View Transition 或中断失败时直接进入可靠终态。背景 Typography 不做抽搐式大运动；不做全站统一 reveal、持续 breathing、全页 crossfade 或果冻；所有方向行为可中断、可反向、最终状态可靠。采用新依赖时必须符合 Open-source Resource Policy。Desktop/Mobile arrival/next/previous/reverse/interrupt/reduced、公开页矩阵、五条 forward/fallback/reduced 与两条目录 reverse Evidence 已完成。Featured 已按最终反馈删除名称高度变化造成的布局位置补间，Desktop 名称固定单行，Mobile 继续允许换行；切换前后 CTA 与 controls 静态终态不移动。证据：`implementation/evidence/V13/`；Handoff：`implementation/notes/2026-08-26-V13-HANDOFF.md`。
  - **Superseded runtime note（2026-08-26）**：上述五条 shared-media 与目录 reverse 只作为 V13 历史实现/Evidence 保留。凌巽后续明确要求删除正式站点全部跨页媒体平滑位移；当前公开路由统一使用短 opacity 页面渐入，正式站点不再启用命名 View Transition。该变更不删除 Hero、Featured、Homepage Adoption 的页面内 carousel motion。
  - [x] **V13-A · Homepage Adoption Carousel Completeness**：首页设定领养最多三项继续保持现有真实数据投影与静态构图；已完成 4s autoplay、pause/resume、页面隐藏暂停、Reduced Motion 停止自动播放，以及上一项/下一项真正反向的媒体、名称、物种、价格和详情行动分层切换。图片与“查看领养详情”始终指向当前角色，连续点击可中断且最终只保留一个可靠终态；点击图片或详情行动时，当前设定图作为唯一 source 进入对应 Adoption Detail。
  - [x] **V13-B · Sitewide Public Motion Audit & Missing-State Completion**：已逐页审查 Homepage 四幕、`/works`、`/works/:slug`（含 Adoption Detail）、`/adoptions`、`/commission`、`/commission/apply`、`/about`、`/service`、`/privacy`、`/licenses`、404/500、空态与媒体失败的页面入场、页面内切换、返回路径、跨页连续性和 Reduced Motion。该任务的 shared-media 白名单属于历史 Evidence；当前有效运行时规则已由上述 superseded note 收口为所有正式公开路由统一短 opacity 入场、无跨页媒体 morph。背景 Typography 与 Footer 保持静止。

### Phase UI · Controls / Header / Navigation / Interaction Polish

- [x] **V14 · Controls / Header / Navigation / Interaction Final Integration**：**前置依赖：V13 已完成并获该任务交接确认（已满足）；凌巽于 2026-08-26 明确确认本 Handoff 并允许进入 V15。** 已统一 `PublicHeader.vue`、`PublicMobileNav.vue`、Hero/Featured/Adoption controls、`PublicCatalogSearch.vue`、`PublicPagination.vue`、gallery thumbnails、`PublicAction.vue` 的 control geometry 与 hover/focus/active/disabled/loading 状态；所有可见审计目标均不小于 44×44，键盘焦点、触控、Accessibility 与 Reduced Motion 保持。移动导航继续使用实底并保留 focus trap/关闭恢复，Homepage primary CTA 继续共享同一主色；Footer 未修改。Featured 按后续明确反馈保留与 Homepage Adoption 同源的图片及角色名/物种 directional carousel motion，CTA、controls 和媒体外框静止；正式站点跨页只使用短 opacity 渐入。Desktop 1440×900、Mobile 390×844、键盘焦点、移动导航、空搜索、详情缩略图与 Reduced Motion 自动 Evidence 均通过；Reduced Motion 下根节点动画数为 0。证据：`implementation/evidence/V14/`；Handoff：`implementation/notes/2026-08-26-V14-HANDOFF.md`。

### Final · Responsive / Accessibility / Consistency

- [x] **V15 · Full Responsive / Input / Accessibility Final QA**：**前置依赖：V14 已完成并获该任务交接确认（已满足）；凌巽已于 2026-08-26 明确确认 V15 Handoff 并允许进入 V16。** 已对 390×844、430×932、768×1024、1023×900、1024×900、1440×900 的 15 个公开状态完成 90 项页面矩阵，并覆盖键盘/skip link/焦点顺序、触控与移动导航 focus trap/恢复、fine pointer 下拉、中文 IME、480px 软键盘视口、Reduced Motion/Transparency/More Contrast、30 项无 JavaScript SSR、6 项 500 页、safe area、语义、图片尺寸/解码、44×44 目标、缩放与水平溢出。确认 `/commission` Mobile 二维码空白只来自自动化未滚动触发原生 lazy loading；生产数据和组件在真实滚动后正常，证据脚本现会先触发 lazy image 并把 decode 失败纳入硬门禁。Safe Area 固定采用不启用 `viewport-fit=cover` 的浏览器约束视口策略。V15 只补齐详情主图共享圆角和三个装饰 Logo 的显式尺寸，没有重设计冻结构图、修改 Footer/Hero 品牌锁、业务模型或依赖。全部自动检查为 true；证据：`implementation/evidence/V15/` 与 `.design/screenshots/v15-final-review/`；Handoff：`implementation/notes/2026-08-26-V15-HANDOFF.md`。

- [x] **V16 · Consistency & Evidence Review**：**前置依赖：V15 已完成并获该任务交接确认（已满足）；凌巽于 2026-08-26 明确确认 V16 并要求完成首页离场闪帧修复后进入 T47。** 已对照 V09 Shared Visual Language、V00-F2 公开面矩阵、V09～V15 Evidence/Handoff 审查全部公开 scene；375/768/1280 × 15 个状态、媒体失败和 500 共 51 张 fresh screenshot，加 3 张 contact sheet。10 项自动 checks 全部为 true。用户在交接确认前补充发现 Homepage 非 Hero scene → `/works` 的单帧位移；逐帧定位为 persistent Header 抢先从 `fixed` 切换 `sticky`，把仍在离场的首页下推 77px。现已让 Header 的 visual path 等页面交换边界后再提交，前向旧 scene 位移从 77px 降为 0，并补充 Playwright 回归断言与 before/after Evidence。旧文档同时统一到 V11 最多三项 available、`/adoptions` available-only、V09+ Type × Media、4s 页面内 carousel 和无跨页 media morph 的当前契约，并完成 OSS/font/license traceability。证据索引：`implementation/evidence/V16/INDEX.md`；Review：`.design/DESIGN_REVIEW.md`；Handoff：`implementation/notes/2026-08-26-V16-HANDOFF.md`。

> **逐项执行纪律**：每次只能执行最前面的一个已获授权 Task。每项必须完成 implementation、指定 Desktop/Mobile/Input/Reduced Evidence、TASKS 状态和包含 `Completed / Locked Decisions / Open Issues / Regression Risks / Next Task / Do Not Start Yet` 的独立 Handoff；禁止顺手开始后续任务。后续会话必须先读取本文件与 latest Handoff，不依赖聊天记忆。T47-F3 已完成本地/自动化验收与独立 Handoff；当前停止实现工作，只等待 GATE-E 人工验收。

- [x] **T47 · 连续移动/reduced/性能验收**：完成 390/430/768/1023/1024/1440 的中断/反向、autoplay、pointer/touch/keyboard、LCP/CLS/decode、compositor-only motion、safe area、输入法、键盘/焦点、prefers-*、桌面逐幕顺序/反向/锁定、1023px 原生滚动逃生与 Homepage → Works 离场回归验证。用户在交接前明确删除 Homepage Adoption 独立上一项/下一项/分页线/暂停控件；该幕保留 4s autoplay、下方真实角色选择、swipe 与键盘方向切换，Reduced Motion 停止自动播放。随后将 Mobile Adoption 的强制整屏最小高度改为内容高度，行动到底部 Footer 仅保留约 19px 呼吸，不修改 Footer 组件。自动化 hard checks 全部通过；真实 iOS/Android 和最终观感仍由 GATE-E 人工验收，不由 Agent 代签。证据：`implementation/evidence/T47/INDEX.md`；Handoff：`implementation/notes/2026-08-26-T47-HANDOFF.md`；Hero drag 未实施。
- [x] **T47-F1 · 委托内容与联系契约收口**：按用户明确重新授权，重写去重复的委托默认文案；退役领养全局营业状态，委托只保留开放/暂停与标签；用 `jsqr` 从 READY 官方二维码派生限定为 `qm.qq.com` 的直达链接；About/Commission 复用白底等高联系目录，fine pointer hover/focus 显示二维码，触控端保留按钮，复制邮箱用不占位浮层反馈；代表作品上限提高到 5。0048 只替换空值/精确历史默认，保留自定义文案。Handoff：`implementation/notes/2026-08-26-T47-F1-COMMISSION-CONTACT-REFRESH.md`。
- [x] **T47-F2 · 委托与联系视觉减法**：将估价说明改为用户确认的短文案，字号缩小并与联系目录等宽；About 只保留 story 与 Contact 之间的分割线；联系目录只保留外轮廓；委托营业状态卡改为全宽。0049 仅替换空值/精确旧默认。Handoff：`implementation/notes/2026-08-26-T47-F2-COMMISSION-CONTACT-POLISH.md`。
- [x] **T47-F3 · 默认文案与目录页名对齐**：0050 只替换空值/精确仓库默认的委托简介、工作室介绍和制作范围，并清空历史防诈骗提醒；`antiScam` 从管理、更新和公开 DTO 退役。`/works`、`/adoptions`、`/about` 页名区按 `/adoptions` 对齐高度、标题尺度与分割线，三者保留英文背景字和右上工作室 Logo 水印；`/commission` 保持特殊。Handoff：`implementation/notes/2026-08-27-T47-F3-COPY-HEADER-ALIGNMENT.md`。
- [x] **T47-F4 · 移动/PDF 修复与自动媒体叠加退役**：生产 PDF 字体改从 `.output/public/fonts/` 读取；窄屏领养名称单行、按钮紧凑，1023px 以下删除全部“下一幕”导线/文案，Hero 固定 3s，Featured/Adoption 保持 4s。0051 前向迁移删除自动叠加相关表列与上传角色；管理页/API、runner/repository/schema、脚本和专项 fixture 同步删除；作品使用无叠加 `recipe-v4`。新增同镜像 `retire-legacy-public-media` 默认 dry-run/强确认命令，先生成并验证 v4，再精确删除旧 v1-v3 对象、ESA purge 和数据库行；部署必须停写、显式备份、migrate、退役命令、再次 migrate 与 ready。页面 CSS 装饰 Logo 仅称背景标记，不属于媒体处理。Handoff：`implementation/notes/2026-08-29-T47-F4-MOBILE-PDF-MEDIA-RETIREMENT.md`。

### GATE-E · 既简洁又有生命感

- [x] `GATE-DESKTOP` 与 `GATE-MOBILE` 均已由凌巽本人通过，V13～V16、T47 均已完成并有独立 Evidence/Handoff；
- [ ] Hero、Featured、Homepage Commission、Homepage Adoption 与后续公共 scene 的主次明确，共享 typography/directional/wayfinding/media grammar 但不套用统一模板；
- [ ] Hero 默认静默且控制器对键盘/触控可获得，暂停后恢复入口清楚；已确认的一次性品牌标题入场保留，换图不重复整套品牌入场，Reduced Motion 直接进入终态，font flash 不回退。Desktop 品牌终态继续冻结；Mobile 默认继续遵守品牌文字 Brand Lock，优先重构周边 Hero composition。任何 Mobile 品牌字号、核心位置或对齐变更都必须有 390/430 冲突证据、before/after 和用户本人显式 exception approval，不得由 `GATE-MOBILE` 自动解除；
- [ ] Featured 以重新设计后的正式 Selected Baseline 为准：Type × Media scene 成立，Photography 是第一视觉 anchor，代表作品最多五件的业务规则和清晰 `/works` 入口保持，切换方式在 Desktop/Mobile 均成立；不得恢复“左上标题 + 下方双竖图 + 右侧说明”的普通双栏 section 作为最终硬条件；
- [ ] Hero 自动轮播固定为 3s且可暂停；Featured 与 Homepage Adoption 保持 4s。Homepage Adoption 按用户明确决定移除独立播放控制条，但保留下方角色选择、swipe、键盘方向切换与页面隐藏暂停。Motion 可 reverse/interrupt、终态可靠，Reduced Motion 停止自动播放并正确退化；普通公开页统一使用一次克制的 opacity 渐入，正式站点不启用跨页 shared-media morph 或命名 View Transition；
- [ ] Header、Mobile Nav、Hero/Featured/gallery/search/pagination/actions/icons 的 hover/focus/active/disabled/loading、44px target、键盘与触控语义完整；
- [ ] 11 个独立公开视觉状态均已按 V00-F2 矩阵完成，`/contact`、`/terms`、`/adoptions/[slug]` 继续复用既有终点而没有重复页面；
- [ ] 作品/领养统一详情、委托内容/申请、About/Contact、法务/许可证、404/500、目录/表单/媒体失败状态均有 Desktop/Mobile 截图与可访问性证据；
- [ ] Display、Body、Metadata、UI、Legal/Code 五类字体角色在最终 Desktop/Mobile 页面保持一致，中文/英文/数字/等宽混排可靠；字体资产授权、preload、fallback、`font-display` 与 notices 均可追溯，Hero 品牌字专属锁未回退；
- [ ] Footer 内容、布局、样式、响应式和交互未被修改；
- [ ] 首页 ≥1024px 逐幕 wheel 顺序正确，1023px 以下不拦截原生滚动；
- [ ] Hero 横竖独立维护清楚；
- [ ] 凌巽及指定人工验收者完成最终视觉验收；Agent 与自动化不得代签。

## F. 最终 Review、发布与闭环（按产品决策关闭）

- [-] **T48 · SEO/固定入口同步**：从需求4 backlog 关闭；后续 UI PR 只在实际影响 SEO 时同步稳定入口。
- [-] **T49 · 最小自动验证**：从阶段任务关闭；测试继续按 `CLAUDE.md` 和工作流作为每次改动的交付纪律执行。
- [-] **T50 · Release/manual smoke**：从活跃 backlog 关闭；实际发布时仍按显式 release/manual 工作流执行。
- [-] **T51 · 独立 Review**：不再作为一次性需求闭环任务；高风险改动仍按其风险单独 Review。
- [-] **T52 · 用户验收**：发布闭环任务关闭；阶段 E 的视觉人工验收仍由 T47/GATE-E 承担。
- [-] **T53 · 生产准备**：从需求4 backlog 关闭；未来部署时按部署 Runbook 重新核对。
- [-] **T54 · 发布与 smoke**：未执行，按产品决策关闭；不得据此声明已发布。
- [-] **T55 · 闭环**：由本次状态收口替代，不补写未发生的生产事实。

### GATE-R4 · 需求4完成

- [-] GATE-R4 不再作为发布完成门禁；仅 GATE-E 保持开放。
- [-] 稳定 core/smoke 与 release smoke 仍按实际改动/发布运行，不作为一次性 backlog。
- [-] 已退役实现型套件不恢复为放行条件。
- [-] 独立 Review 与生产验收未因关闭而补签。
- [-] 生产 smoke 未因关闭而补签。
- [-] 自动化、Reviewer、用户和生产操作员继续互不代签。

## 闭环结论

- T04～T34 的当前开发范围与本地证据已完成；用户已确认个人信息处理者名称为“有点小狗工作室”。
- T35/T36 与阶段 F 按产品决策关闭；实际镜像发布/部署时仍须履行 notices、Runbook 和安全检查，不能把关闭写成已完成。
- 阶段 E T37～T47、V00、GATE-V00、V00-F1、V00-F2、V01～V08-F3、`GATE-V08-R` 与 V09～V16 implementation/evidence/docs 已完成；`GATE-DESKTOP` 与 `GATE-MOBILE` 均已由凌巽本人放行，V13～V16 交接已确认。当前停止实现工作，GATE-E 仍等待真实设备和最终人工视觉验收。
