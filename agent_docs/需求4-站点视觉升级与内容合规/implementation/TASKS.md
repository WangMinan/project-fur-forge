# 任务清单：站点视觉升级与内容合规

> **角色**：需求4唯一任务与勾选权威；每个任务均可由 Agent 独立实现、验证和交接。
> **状态**：仅阶段 E 开放。A～D 已关闭；原阶段 F 按产品决策关闭，不再作为需求4 backlog。
> **规则**：`[x]` 表示已有证据；`[ ]` 仅用于阶段 E 开放项；`[-]` 表示按产品决策关闭、不再执行，不补签独立 Review、用户验收或生产发布。

## 当前目标

只继续阶段 E 的 UI 美化、布局/响应式、可访问性、Hero 焦点和动效质量。T37～T46-F8 已完成当前实现，T47 与 GATE-E 保持开放；不得从本清单启动数据库、隐私、安全、分发或生产发布工作。T46-F5 的代表作品资格与数量是用户 2026-08-22 明确重新授权的轻量业务约束。

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
- [ ] **T47 · 连续移动/reduced/性能验收**：每个机会同步检查中断/反向、autoplay/pointer/touch/keyboard、390/430/768/1023/1024/1440、真实手机、LCP/CLS/decode/GPU、safe area、输入法、键盘/焦点、prefers-*；另验桌面逐幕顺序/反向/锁定与 1023px 逃生；Hero drag 未实施。

### 阶段 E 迭代记录

阶段 E 的逐轮 UI 迭代各自留有独立设计记录，均不改变 T37～T46-F8 的已完成状态，也不代签 T47/GATE-E：

- [`.design/home-scene-typography/`](../.design/home-scene-typography/)：首页 2-4 幕图文协调重排。
- [`.design/contact-and-identity-lines/`](../.design/contact-and-identity-lines/)：官方联系面按钮化、领养身份行单行收敛、详情页领养事实与图集方向切换过渡（2026-08-24）。

### GATE-E · 既简洁又有生命感

- [ ] 四幕顺序与主次明确；
- [ ] Hero 默认静默且控制器对键盘/触控可获得，暂停后恢复入口清楚；
- [ ] 领养只展示一项，并在全部目标视口一屏完成标题、角色、身份、状态和行动表达；
- [ ] autoplay、pointer/touch、keyboard 使用不同节奏，未达完整门槛时不做 drag；
- [ ] 角色感动效一次性、有因、无持续噪声；
- [ ] 移动端不是桌面缩小版；
- [ ] 首页 ≥1024px 逐幕 wheel 顺序正确，1023px 以下不拦截原生滚动；
- [ ] 代表作品单幕左上标题、下方最多两张竖图、右侧精简说明与唯一 `/works` 按钮且全部一屏可见，第二次有效 wheel 进入委托；双图在 1440×900 中保持较大画幅、明确间距与底部留白；`/works` 有出厂照优先出厂照、无出厂照才回落领养横版封面；
- [ ] Hero 横竖独立维护清楚；
- [ ] 王旻安/景宸人工视觉验收通过。

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
- 阶段 E T37～T46-F8 当前工程实现已完成；只有 T47、GATE-E 与王旻安/景宸视觉验收保持开放。
