# 当前状态：需求4 · 站点视觉升级与内容合规

> **最后校准**：2026-08-26
> **状态**：仅阶段 E 开放。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。

## 当前阶段

阶段 A～D 的产品/工程范围已关闭；阶段 F 及最终发布闭环按 2026-08-21 产品决策关闭，不再作为需求4 backlog。当前唯一开放范围是：

> **阶段 E：UI 美化、布局与响应式优化、Hero 焦点体验、动效质量和人工视觉验收。**

T37～T47、V00、GATE-V00、V00-F1、V00-F2、V01～V08-F3、`GATE-V08-R` 与 V09～V16 implementation/evidence/docs 已完成。Shared Visual Language、Homepage Featured Works、Commission、Adoption、Works Catalog、统一 Detail、About/Contact、Commission Apply、Legal/Privacy/Licenses、Error/Empty/Media Failure、Sitewide Typography、Desktop/Mobile Art Direction、Signature Motion、UI/Controls、Full Responsive/Input/Accessibility Final QA、Consistency/Evidence Review 与连续移动/reduced/性能本地验收均有独立 Evidence 和 Handoff。2026-08-26 用户另行明确授权 T47-F1 的委托文案、营业状态、QQ 联系与代表作品上限收口。`GATE-DESKTOP` 与 `GATE-MOBILE` 已由凌巽本人于 2026-08-25 明确放行；真实 iOS/Android 与最终人工观感继续留给 GATE-E，不由 Agent 代签。

V08-F3 的字体闪动、标题入场、Hero 4s 自动轮播与本地 Hero 衍生图修复继续保持。V09 的 Featured 继续使用 Desktop overlap / Mobile clear 的 Type × Media scene；V10/V10-F1 将首页委托和内页委托重做为两种不同的 Media-led Service Scene。V11 将首页领养、双列目录和统一详情入口收口为完整设定图优先的 Character Display / Directory，同时保留搜索、分页、排序、路由与营业状态。V12-A～V12-E-F4 已完成剩余公开页、状态、字体与 Desktop 验收修正。V12-F/V12-G 完成 Homepage 与其余公开页面的 Mobile Final Art Direction。V13 已为 Hero、Featured、Homepage Adoption 补齐 4s autoplay、directional reverse、interrupt、Reduced Motion 与分层 motion；Hero/Featured 继续提供 pause/resume。T47 按用户最终决定删除 Homepage Adoption 独立上一项/下一项/分页线/暂停控制条，只保留 4s autoplay、下方角色选择、swipe、键盘方向与 Reduced Motion 停播；同时收短 Mobile Adoption 尾部高度，让 Footer 紧接内容但不修改 Footer 自身。V14 已统一 Header、导航、轮播、搜索、分页、行动和详情缩略图交互；V15 已完成六档视口、输入模式、偏好、SSR/无 JavaScript、语义、图片解码、safe area 与错误状态的最终 QA。V16 已完成三档 fresh review、全证据索引、OSS/license 追溯和活动契约校准。正式公开路由继续使用短 opacity 入场并关闭跨页媒体 morph；Featured 保留与 Homepage Adoption 同源的图片与角色名/物种方向切换，CTA、媒体外框和保留的 controls 保持静止。当前停止实现工作，只等待 GATE-E 人工验收。

## 状态语义

- `[x]`：已有相应实现或证据；
- `[ ]`：仅阶段 E 中仍开放；
- `[-]`：按产品决策关闭、不再执行，不能解释为生产、独立 Review、真实手机或用户验收已完成。

T35/T36 的 Linux runtime/分发证据与原阶段 F 的 Review、镜像和生产事项不再是活跃 UI 任务；若未来实际发布镜像或部署，仍必须按第三方声明、媒体策略和部署 Runbook 现场核对，不能因 backlog 关闭而跳过运行或法律义务。

## 已实现基线

- 客户选择 B + M3；dev-only V00-F1 已收成 `Homepage Featured Works Visual Baseline`，包含 Desktop/390/430、Next/Previous/reverse/interrupt、Keyboard/Touch/Reduced Motion 证据。它不是全站模板，正式落地属于 V03。
- 首页固定四幕；桌面 `>=1024px` 为 Hero → 代表作品 → 委托 → 领养 → Footer 逐幕 wheel，1023px 以下原生滚动。
- 代表作品最多 5 件且必须有竖版出厂照；当前 Type × Media scene 一次展示一件真实作品，多项时提供循环上一项/下一项与连续编号，单项隐藏控制器和数字。可维护性复核后已删除前端写死的作品说明，只显示既有角色名、物种和 `/works` 行动，不新增后台字段。代表作品详情继续使用直接路由切换；`/works` 有出厂照时优先出厂照，完全没有时才回落领养横版封面。
- Header 使用单一 offset；公开非 hash 导航到页头，back/forward 恢复 saved position，hash 让开 Header。
- Hero 横/竖四集合独立，管理端提供画面拖动焦点和水平/垂直滑杆。
- V01 已将正式 Hero 收口为 Quiet / Cinematic Opening；保留品牌中文标题冻结终态，完成 Media → Brand → Supporting Copy → Controls 的一次性入场、低权重控制器和 Hero → Featured 章节提示。
- V02 已将正式首页委托收口为 Media-led Service Scene、当前领养收口为 Display / Character Scene；领养设定图使用 contain 与浅色 art-directed canvas，委托移动媒体高度与信息组完成独立响应式节奏。
- V03 已将 B + M3 的静止背景 Typography、媒体 overlap 和分层入场正式落入 `FeaturedWorks.vue`；未恢复 V00 测试轮播、folio 或角色字段，桌面 staged wheel 正反向与详情直达已验证。
- V04 已完成首页 390/430/768/1023/1024 跨幕结构和输入边界；Hero 可交互控件真实命中区固定为至少 44px，1023 原生滚动与 1024 staged wheel 均已验证。
- V05 只新增 Editorial ink、背景 Typography 与 Adoption canvas 三个语义 token；四幕媒体规则保持 Hero/Featured/Commission cover、Adoption contain，作品目录继续真实横竖混排。
- V06 已完成 Works/Adoption 目录五断点视觉与输入复核；Works 横竖等高混排、Adoption contain、共享空态、长名称/物种、搜索/分页、非法/越界状态、键盘/触控与图片解码均有证据。
- V06-F1 已将作品与领养入口的统一详情收口为 Media-led Archive Scene；多图横竖切换使用稳定舞台，单图保留真实比例，无图库复用共享空态，返回来源、301/404、Keyboard/Touch/Reduced Motion 与无 JavaScript 均有证据。
- V07 已将 About/Contact 收口为编辑式信息页；T47-F1 进一步将 Contact scene 改为白底，并把 Email/QQ/QQ 群统一为等高联系目录。QQ 按钮带 Logo，fine pointer hover/focus 显示二维码，触控端保留直达按钮；复制邮箱使用不占位反馈浮层。
- V07-F1 已将 `/commission` 收口为独立 Media-led Service Narrative；T47-F1 以更短、去重复的默认文案和共享联系目录更新委托内页。委托营业状态现只保留开放/暂停与标签，领养全局营业状态和委托独立短说明已退役。
- V07-F2 已将服务条款与隐私政策收口为带内容目录、编号章节、语义锚点和固定行长的阅读系统；许可证在 1024px 以下使用单列信息，原生 `details`、等宽许可证、TXT 下载、301、Keyboard 与 Reduced Motion 均有证据。
- V08 已将 `/commission/apply` 收口为稳定的完整表单状态：字段、单位前缀、双列测量、上传预览、两项确认和提交反馈拥有同一阅读节奏；空错误节点不渲染，成功与不可用状态保持静态分隔结构。390/430/768/1024/1440、Keyboard、Touch、软键盘、44px、Reduced Motion、CLS 和上传/核验/提交各状态均有证据。
- V08-F1 已将 404/500、公开空态与媒体失败收口为同一编辑式状态语言：错误页不泄露底层信息、图片失败保留横竖比例且提供回落文字、无 JavaScript 保留原始图片。五视口与 Keyboard/Touch/Reduced Motion 证据以及 500 非泄露核心测试均已通过。
- V09 已建立 Shared Visual Language 可执行契约，并把 Homepage Featured Works 重做为摄影优先的 Type × Media scene：Desktop 明确 overlap，Mobile 明确让开且在摄影下方直接展示 44px 切换控制；双项编号连续真实，单项不显示孤立 `01`。后续用户复核修正使 1440×768/900、768×1024、375×812、390×844、430×932 的当前 Featured scene 与 destination rail 同屏，Desktop CTA/切换器间隔 36px、Mobile 切换器/内容间隔 16px，并恢复 Hero Mobile 的“下一幕”。Featured 未加入 autoplay、transition 或 Motion choreography，Hero 与 Footer 锁保持。
- V10 已将 Homepage Commission 重做为去卡片化的 Service Docket：四幕标题字号保持一致，横版摄影为第一媒体锚点，营业状态、说明和 CTA 沿媒体下缘分三段排列，摄影与信息栏使用独立网格行和硬间距；390/430 与 1280×800、1440×900、2048×1080 均完整显示且不相交。`/commission` 使用不同的 Photographic Service Ledger，以横/竖 Hero、身份/状态/行动台账、制作范围与估价联系双列构成独立内页。两处继续使用既有内容投影、申请、QQ/Email、条款与 `home-commission-media` 共享切换，不新增业务字段、迁移或依赖；摄影统一使用 `--radius-image`，Footer 与 Hero 品牌锁未改。
- V10-F1 将 Homepage Commission 调整为约 65% Media / 35% Service Narrative，并让“从角色设定出发”承担第二视觉锚点；`/commission` 首屏改为叙事左、摄影右，并增加可点击的“继续查看 / 制作范围与估价 ↓”。Hero、Featured、Homepage Commission 与 Commission 申请入口的同类方向引导统一为中文；英文继续只作为小型 scene metadata，不承担必要导航含义。三处场景顶栏中无信息作用的右侧 register 已删除，标题下规则线统一收至 32rem 上限。
- V11 将首页领养改为按既有排序自动投影最新三项 `available`，排除 `adopted`，真实 1/2/3 项分别渲染；多项循环切换，媒体和主行动均进入当前详情。`/adoptions` 继续按状态 bucket、修改时间和 ID 排序，Desktop 双列、Mobile 单列；目录优先使用既有完整设定图，缺失时才回退横版封面。每项以完整 `contain` 媒体和独立信息面板共同构成角色记录：Desktop 左右并置、Mobile 上下重排；名称横排，物种/价格/状态仅显示真实值并以 `·` 与三行留白容纳未来长数据，右下角圆润数字按公开列表位置连续编号并保留足够可辨认面积。字段线和卡片间横线均删除。目录页头保留放大的 `ADOPTIONS / 设定领养` 和右上斜向淡色工作室标志，不显示可领养数量或营业提示；搜索与“联系我们申请领养”在无上下边线的右侧操作组中紧邻排列，搜索结果数量仅在搜索生效时显示。整项可点击；1440×900 首屏完整显示前两个角色，390/430 完整显示第一项。详情新增真实状态、价格与“联系咨询领养”；未新增后台精选字段、Schema、迁移或依赖。
- V12-A 将 `/works` 重做为角色等权的目录：Desktop 四列、统一 4:5 圆角媒体画布与底部身份层，横版设定图使用 `contain` 保证完整展示；页头使用背景 `WORKS`、中文标题/说明和右侧搜索。统一 Work / Adoption Detail 在 Desktop 保持左侧 gallery、右侧 sticky 信息账本，gallery 舞台与缩略图统一圆角，领养详情继续保留状态、价格、咨询入口和 V11 媒体优先级。公共布局只以 flex 让短内容页 Footer 贴底，Footer 组件未修改；V12-A 的 390/430 证据仍只代表 Mobile Structural Safety，最终 Mobile Art Direction 留给 V12-G。
- V12-B 将 `/about` 重做为紧凑 `ABOUT / 关于我们` masthead、工作室/制作范围双列 story 与浅灰 Contact scene。Desktop 联系区以 32/68 构图组织申请入口和官方联系目录；邮箱与 QQ/QQ群横排并用竖线分组，二维码为 152px，防诈骗提示紧接下方且只用淡灰竖线提示。Mobile 保持邮箱、QQ/QQ群、防诈骗的纵向阅读顺序和双二维码横排。公开内容投影、渠道数据、邮件/复制、申请入口、`/contact` 301、Header 锚点让位与 Footer 均未改变。
- V12-C 保留 `/commission/apply` 从申请信息到设定图、提交确认和反馈的竖向阅读顺序；页名、隐私说明和表单使用同一 56rem 主轴，字段在 768px 以上内部双列、390/430 单列，身高/体重继续成组。孤立页头说明并入隐私提示；Desktop/Tablet 页名左侧使用现有工作室 Logo 的低对比度灰度水印，逆时针旋转 15°并放大覆盖标题与内部评估说明，Mobile 隐藏该装饰。上传使用紧凑圆角媒体面，确认、错误、失败保留、成功与不可用状态保持无多余卡片的静态层级。全部字段、校验、上传、提交、隐私确认、联系与私有媒体边界未变。
- V12-D 将 `/service`、`/privacy` 与 `/licenses` 统一为同站但克制的 Document Reading System：document 页名变体只显示事实型 metadata；Desktop 使用 sticky 章节导航和 46rem 正文轴，Mobile 使用 44px 目录目标与自然单列正文。编号章节、返回页首、许可证原生 `details`、等宽全文和授权资产列表共享同一结构节奏。法务正文、许可证数据、重定向、Footer、依赖和 Motion 未变。
- V12-E 将 404、500、普通 empty、搜索 no result 与 image failure 统一为同站的状态语言。共享空态使用规则线、放大标题、恢复行动和现有工作室 Logo 的低对比度灰度水印；错误页增加 brand-only Header，保留真实状态码且 500 不投影底层错误信息；图片失败在原媒体比例内使用同款水印和回落文字，无 JavaScript 继续输出原图。装饰 Logo 不进入读屏、不改变布局；搜索、Footer、媒体安全边界、接口、依赖和 Motion 均未改变。
- V12-E-F1 建立 Display、Body、Metadata、UI、Legal、Code 语义 token，Windows/Edge 实测分别命中 STSong、Microsoft YaHei 与 Consolas；Hero 继续命中 ZhuoHeiPinTieTi。Noto Serif SC 以 OFL-1.1 登记并只用于 PDF；系统字体只引用不分发。11 个公开状态的 33 组 before/after 与两档 specimen 证明无横向溢出，最大 CLS 0.000237，网页只 preload 19KB 品牌关键子集且不请求 11.6MB PDF 字体。Hero 品牌终态和 Footer 未改。
- V12-E-F2 将图片失败 Logo/短提示统一居中到实际媒体框；公开领养只投影 `available`，前台移除领养状态但保留物种/价格与后台状态模型，`adopted` 继续可进入 `/works` 归档。Works 页首增加低对比度工作室水印；Commission 采用 3:7 与响应式淡灰分隔线；Works/Adoptions 共用的分页改为 editorial wayfinding。三视口自动审计八项全通过，Hero 品牌终态、Footer、Motion、Schema 与依赖未改。
- V12-E-F3 删除 Featured 的局部黑色 primary override，使 Homepage Featured/Commission 同语义主按钮统一使用共享蓝色 token；1280/768/375 before/after 和 computed-style 证明颜色一致。该历史任务当时限定四条 shared-media transition；后续 V13 的五条用户明确授权已 supersede Homepage Adoption → Detail 的移除口径。
- V12-E-F4 将 Featured 的名称、物种、CTA 与切换器收成单一 Desktop 信息组并整体上移；摄影外框扩大并向 12-column field 中部延伸，与背景 `SELECTED WORKS` 形成明确 overlap。后续人工复核复用 Homepage Adoption 的浅灰 media canvas，在外框不变时缩小照片，并以 `12px / 8px` 外内圆角形成承托层。1280/1440/1920 Desktop 与 768/390 Structural Safety 证据无溢出，窄屏继续保持图片 → 切换 → 信息顺序。
- V12-F 为 Homepage 四幕建立 390/430 独立静态终态：Hero 只优化摄影周边 scrim 和 supporting copy；Featured 提升媒体存在感并保留浅灰承托、圆角和双项控制；Commission 使用满宽媒体和轻微错轴信息组；Adoption 将三项选择、循环切换和页码收为稳定控制行。Hero 品牌字、4s autoplay、一次性首次入场、Reduced Motion、font flash 修复、Desktop 构图和 Footer 均保持。
- V12-G 对 Works、Adoptions、统一 Work/Adoption Detail、Commission、About/Contact、Apply、Service、Privacy、Licenses、404/500、空态/无结果和媒体失败完成 390/430 Final Art Direction 审查。各页面保留不同的目录、媒体、表单、联系和长文阅读构图；多图 Detail 的 Mobile 舞台改为 `clamp(17rem, 92vw, 24rem)`，五张缩略图在 390/430 单行排列，单图领养详情仍按原比例完整展示。搜索、分页、表单、双二维码、法务锚点与原生展开、错误恢复、后台投影和 Footer 均未改变；1440 冻结回归通过。
- V13 为 Hero、Featured、Homepage Adoption 建立完整 carousel 行为：4s autoplay、pause/resume、页面隐藏暂停、next/previous 反向、interrupt 与 Reduced Motion 终态可靠。Featured 只移动媒体与角色名/物种，删除名称高度引起的布局位置补间，Desktop 名称固定单行且 CTA/controls 终态不移动；Homepage Adoption 使用 Media → Name → Facts → Action 的递减方向层级。V13 的 shared-media forward/reverse Evidence 作为历史记录保留；当前正式公开路由统一短 opacity 入场且不启用跨页媒体 morph。背景 Typography、Hero 品牌锁与 Footer 均未回退。
- V15 对 6 个视口 × 15 个公开状态完成 90 项页面矩阵、30 项无 JavaScript SSR、36 项 Design Review 与 6 项 500 页证据；634 个可见控制的最小目标为 44×44，全部图片完成解码，所有自动检查为 true。Safe Area 采用浏览器约束默认视口，不启用 `viewport-fit=cover`；真实懒加载图片由证据脚本滚动触发后再验证。详情主图复用共享圆角，装饰 Logo 补齐显式尺寸；Footer、Hero 品牌锁、冻结构图、业务投影和依赖未改。
- V16 对 375×812、768×1024、1280×800 的 15 个公开状态、媒体失败和 500 重新采集 51 张单页截图与 3 张联系表；10 项 checks 全部为 true。交接确认前用户补充发现 Homepage 非 Hero scene → `/works` 单帧闪动，逐帧证明确为 Header 定位过早切换；修复后旧 scene 位移由 77px 降为 0，新增 before/after 与 smoke 回归。其余 V16 工作只校准 SPEC/PLAN/Design/CLAUDE 历史口径，并建立 V00-F2、V09～V16 与 OSS/font/license 的最终 Evidence Index。
- T47-F1 在用户明确重新开放该范围后完成 0048 前向迁移：退役领养全局营业状态、将委托收口为开放/暂停、删除独立短说明；同时从官方二维码安全派生 `qm.qq.com` 直达链接，代表作品上限调为 5。迁移只替换空值或精确历史默认委托文案，管理员自定义文案保留。
- 行动、上传与长任务进度已收敛；OSS 使用真实字节，FFmpeg/未知任务不伪造百分比。
- 两项委托确认、隐私 readiness、人工 retention/单条删除和生成式 notices 已落地。
- 13 个公开路由文件（含 3 个重定向）与全局错误入口已归并为 11 个独立视觉状态：首页、作品/领养目录、统一详情、委托、申请、关于/联系、服务、隐私、许可证和 404/500；目录、表单、空态与媒体失败状态也已分配到 V06～V08-F1。
- `/adoptions/[slug]`、`/contact`、`/terms` 继续复用既有终点，不创建重复模板；Footer 内容、布局、样式、响应式和交互全部冻结。

## 阶段 E 后续边界

后续 PR 只做 UI、布局、响应式、可访问性、性能和动效优化。不得恢复退役业务，不新增数据库/迁移、隐私/安全能力、媒体拓扑、交易能力或部署流程；如确需改变，先由用户重新开放范围。

视觉权威：[`requirements/SPEC.md`](./requirements/SPEC.md)、[`.design/README.md`](./.design/README.md)、[`SHARED_VISUAL_LANGUAGE.md`](./.design/SHARED_VISUAL_LANGUAGE.md) 与 [`VISUAL_DIRECTION_V2_2026-08-22.md`](./.design/VISUAL_DIRECTION_V2_2026-08-22.md)。Latest completed Handoff 为 [`2026-08-26-T47-F1-COMMISSION-CONTACT-REFRESH.md`](./implementation/notes/2026-08-26-T47-F1-COMMISSION-CONTACT-REFRESH.md)；T47 连续移动证据见 [`implementation/evidence/T47/`](./implementation/evidence/T47/)，V16 及更早任务继续保留各自 Evidence/Handoff。GATE-E 仍等待真实设备与最终人工视觉验收。
