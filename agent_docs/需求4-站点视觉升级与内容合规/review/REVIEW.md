# 评审记录：需求4

> **角色**：记录 SPEC ↔ COPY ↔ design ↔ models ↔ PLAN ↔ TASKS ↔ 当前代码的一致性与风险。
> **状态**：2026-08-20 已完成 T04～T34、阶段 E 前 GPT-5.6 Pro Review finding 修复，以及阶段 E 文档/浏览器 Review；最终应用独立 Review 仍未执行，本文不以实现者修复和自检代签。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 1. 评审对象

- 需求4全部活文档；
- 首页聚合、当前领养、`/adoptions` repository/page；
- Hero 四集合、管理页面、collection composable、上传和 publication operation；
- 公开/管理按钮与局部 CSS；
- Hero、作品、二维码、水印上传状态机和进度显示；
- `FfmpegProgress.vue`、`PublicationPanel.vue`、`HeroCollectionItemCard.vue`；
- unit/integration/E2E 配置、代表性测试与 `.github/workflows/quality.yml`；
- 当前隐私/服务条款、委托请求 Schema、retention 与 licenses 计划；
- Apple Design Skill 的适用边界。

## 2. 代码 Review findings

### F1 · `/adoptions` 当前排序不符合新业务要求

**现状**：`loadPublishedWorks` 先按公开/创建时间排序，`adoptionItems` 保持该顺序，`listAdoptions` 再搜索和分页。状态从 available 改为 adopted 后，没有“开放优先”的稳定 bucket。

**影响**：已完成作品可能排在开放领养之前；修改时间也未作为状态组内排序依据。

**结论**：在 adoption 专用投影中使用 `available → adopted`、`updated_at DESC → id ASC`；不改变 `/works` 排序。

### F2 · 首页当前领养仍是两项

**现状**：repository 聚合对 available `.slice(0, 2)`，`HomeCurrentAdoptions.vue` 再 `.slice(0, 2)` 并在 768px 以上使用双列。

**影响**：与“首页只保持一项单幅完整展示”直接冲突，且重复 slice 让真实契约不清楚。

**结论**：repository 最多返回一项；组件删除二次 slice 和双列假设。没有 available 时隐藏。

### F3 · 按钮与行动样式已经碎片化

**现状**：commission、about、adoptions、Home、空态和管理页分别维护多套胶囊/边框/主按钮 CSS；同一层级的 loading/disabled/focus 行为不完全一致。

**影响**：首页视觉重构若继续在页面内写 CSS，会扩大维护成本和视觉漂移。

**结论**：公共行动和管理行动必须成为第一批实现，不再放在隐私 Schema 之后。

### F4 · 进度反馈有真实数据，但展示不统一

**现状**：

- XHR 上传已经能提供真实进度；
- `UploadSessionCard` 自制 determinate bar；
- `FfmpegProgress` 提供 indeterminate + elapsed；
- `PublicationPanel` 自制计数进度；
- `HeroCollectionItemCard` 没有显示 upload 百分比，并将 operation 阶段映射成 12/35/56/91 等人为百分比；
- QR、Hero、水印、作品图各有自己的状态标签和失败文案。

**影响**：用户无法形成一致预期；部分进度条看似精确但没有真实工作量依据。

**结论**：统一 `AdminTaskProgress` 三模式；OSS 用真实百分比，FFmpeg 用阶段/elapsed，operation 用真实阶段/计数，删除伪百分比。

### F5 · Hero 数据模型正确，管理信息架构可改进

**现状**：四集合、owner context、CAS、发布与上传都已按 placement/orientation 抽象；管理页却用四个平级 Tab 暴露底层组合。

**影响**：业务用户需要在四个 Tab 间来回确认首页/委托和横/竖，缺少两方向总体状态。首轮实现曾在宽屏同时展开委托横竖单槽，用户复核确认这会破坏二级 Tab 的筛选语义。

**结论**：保留四集合，不建立 pair。管理端改为“首页/委托”一级、“横/竖”二级，显示双方摘要和设备画框预览，但页面只渲染当前方向。

### F6 · 隐私方案超过当前业务所需

**现状（文档计划）**：新增处理者字段、metadata API、intake contract v1/v2、多个确认列、expand/contract、客户端版本和 stale 409。

**代码事实**：当前表单已经通过现有站点内容 API 取得隐私/条款，正式订单仍在 QQ 逐单确认；用户只要求提交前确认和实际删除能力。

**影响**：迁移、兼容、管理 UI、测试和发布复杂度显著增加，却没有建立真正的在线合同能力。

**结论**：取消全部新字段/API/版本协议；只增加两个 strict boolean，复用现有 policy/email，服务端在消费 upload 前校验。

### F7 · 测试体系成本过高且包含实现型断言

**现状**：默认 quality 包含全量 unit、integration、production build、verify、镜像/Compose/恢复/Nginx，再串行执行完整 Playwright。Playwright 冷构建约 80 秒、单 worker；现有用例包含精确 `0.68s` 动画时长、全文文案、局部 DOM 和历史修复语义。大型 integration 文件混合数据库、媒体、operation 和公开投影。

**影响**：普通小改反馈慢；业务变化时大量工作变成“更新旧测试以匹配新实现”，但仍不能替代人工视觉核验。

**结论**：测试改为 core/smoke/release/legacy；默认只跑快速路径；视觉由用户人工门禁。稳定安全/数据不变量仍保留少量测试。

### F8 · 第一版动效文档过度放大“克制”

**现状**：原文大量强调不 bounce、不 overshoot、hover ≤2px，容易让实现退化为统一淡入和轻上移。

**影响**：不符合兽装角色本身的生命感，也无法形成 DITE DOG 独立于科技公司网站的情绪。

**结论**：定义“简洁底盘 + 灵动角色感”，允许遮罩、图文错峰、轻聚焦/tilt、控制器/成功状态一次低幅回弹；继续禁止持续噪声和大面积视差。

### F9 · FFmpeg “未分发”口径与真实发布面冲突

**现状**：`release-image.yml` 要求输入 `PUBLISH_GATE_E_IMAGE` 以授权 `external publication`，随后把包含 `ffmpeg-static` 的镜像推送到 Docker Hub。2026-08-19 只读核对 `wangminan/project-fur-forge` API，仓库为公开（`is_private=false`）。需求4与仓库入口却仍写“只在自有服务器使用、不对外分发”。

**影响**：公开容器已构成真实二进制分发面；继续沿用“未分发”会让 `/licenses`、容器内声明、对应源码和构建信息计划建立在错误事实之上。当前页面还硬编码 Windows FFmpeg 构建，不能代表 Linux 发布镜像。

**结论**：网页没有单独下载入口可以继续说明，但发布合规按公开容器分发处理。`ffmpeg-static` npm 包与实际 FFmpeg 二进制分开登记；从 Linux 发布镜像提取版本、SHA-256、许可证、对应源码、补丁和构建配置，并让容器与 `/licenses` 消费同一生成事实。镜像可见性改变后重新核对，不凭意图覆盖事实。

## 3. 第二轮 Review 已修正文档

1. 首页设定领养从“一大一小/最多两项”改为唯一开放项单幅展示。
2. 增加 `/adoptions` 状态 bucket + 修改时间排序契约。
3. 把公共行动、管理行动、上传和进度组件移到实施首阶段。
4. 把测试分类、脚本和 Actions 减重移到大规模视觉开发之前。
5. 删除 `privacy_controller_name`、metadata API、intake contract、确认持久列、version handshake 和 stale 409。
6. 申请确认收缩为两个未预勾选 checkbox + server literal true。
7. 正式申请删除收缩为逐条 execute，人工批次不提供时间批量删除。
8. Hero 保留横竖独立数据，只重组 admin 信息架构。
9. 统一进度明确区分 determinate/stage/indeterminate，不再制造阶段百分比。
10. 动效从“Apple 式克制”改为“空间纪律 + 兽装角色感”。
11. CLAUDE 测试纪律改为稳定不变量优先、legacy non-gating、用户人工视觉门禁。
12. 修正评审基线、委托表单/QQ 文案分工、服务条款接受节点和 FFmpeg 公开容器分发口径。

## 4. 已确认结论

- `DITE DOG`、表单投递、QQ 私聊优先、邮箱备用、QQ群非默认订单确认在所有文档中一致。
- 首页仍覆盖完整核心业务，但最后一幕只展示一项开放领养。
- adopted 可以进入精选，不进入首页领养幕。
- Hero 横/竖独立维护不是冗余，而是必要艺术指导；不应为了后台“统一”牺牲构图。
- 当前 upload callback 已足以显示真实 OSS 百分比；问题是未统一消费。
- FFmpeg 单图处理当前没有可信总工作量，indeterminate + elapsed 比伪百分比更诚实。
- 轻量 checkbox 不能替代 QQ 逐单合同，但足以完成当前网页提交前的成年/隐私提示。
- 测试减负不等于删除安全边界；稳定不变量仍应进入 core。
- 用户人工验收是视觉、文案和真实图片效果的最终权威。
- FFmpeg 在服务器容器内运行，但当前镜像公开发布，必须按二进制分发场景留档和提供对应声明；ZhuoHei Collage 仍按免费商用授权资产留档。
- main/required check 保持现状。

## 5. 主要风险与缓解

### 5.1 测试减负过度

风险：删除太多后，安全或数据回归失去自动提醒。

缓解：

- 先分类，后移出门禁；
- core 明确保留 Host/session/Origin/PII/migration/publication/deletion；
- 同一不变量只保留最合适的一层；
- 新遗漏应提升具体不变量，不恢复历史全量。

### 5.2 人工视觉门禁不可复现

风险：只有口头判断，后续不知道为什么通过。

缓解：

- 保存关键视口截图/短视频和人工结论；
- 记录真实图片、设备和浏览器；
- 自动 smoke 仍检查可达性、错误和基本溢出；
- 不把截图像素比较变成新的脆弱门禁。

### 5.3 人工 retention 漏执行

风险：没有 scheduler 时忘记月度/半年度复核。

缓解：发布门禁登记责任人和下一次日期；CLI 输出脱敏结果；用户请求不等待批次。

### 5.4 Hero 共享 asset 焦点

风险：同一 asset 被多个 item 复用却需要不同焦点。

缓解：首版检测并阻断；上传独立横/竖资产；真实需求稳定后再单独评审 item-level focal。

### 5.5 灵动动效扩大性能成本

风险：clip/scale/tilt/共享对象叠加导致 LCP、GPU 或眩晕问题。

缓解：一个视口一个主要大对象运动；只动画 transform/opacity/clip；后续媒体 lazy；移动减幅；prefers-reduced-motion；真实设备人工验收。

### 5.6 轻量确认缺少持久证据

风险：系统不记录 checkbox 版本，无法把网页提交本身当成完整法律证明。

缓解：明确本轮确认只是提交门槛，不冒充电子签名；正式范围/价格/付款/排期/合同继续在官方 QQ 中逐单确认并由工作室保存。

### 5.7 默认文案与已确认处理者

风险：生产未执行新迁移，或管理员自定义政策仍保留旧“不收集联系方式/设定图”表述。

缓解：用户确认处理者名称为“有点小狗工作室”；不新增字段；前向迁移只覆盖空值/精确历史默认；生产 readiness/smoke 核对完整政策与当前 `contact_email`。

### 5.8 容器可见性或 FFmpeg 构建漂移

风险：Docker Hub 可见性、`ffmpeg-static` 平台二进制或上游构建变化后，页面仍展示旧 Windows 版本、旧源码提交或“未分发”说明。

缓解：在 Linux release 产物中提取并校验二进制事实；公开/私有可见性进入发布检查；未知来源或对应源码不完整时停止发布，不猜测。

## 6. 后续评审点

- `AdminTaskProgress` 是否真的替换了局部 progress，而非再增加一套；
- Hero upload 是否展示真实字节百分比；
- operation 是否移除伪百分比并能恢复；
- test:core 是否只含稳定不变量且执行时间可接受；
- smoke 是否不再绑定精确文案/DOM/时长；
- quality workflow 是否默认减重且 release 验证仍可执行；
- `/adoptions` 搜索/分页是否保持唯一排序；
- 首页是否只请求/展示一项 available；
- 两个 checkbox 的服务端校验是否在 upload consume 前；
- 单条删除是否覆盖 current/version/delete marker/preview；
- Hero 管理是否统一心智但不耦合四集合；
- 真实页面是否同时满足简洁和灵动，而不是退化为统一动画模板。
- Hero 是否默认保持低权重静默态，同时让键盘、fine pointer、触控用户获得方向与暂停/继续；暂停后恢复入口是否持续可见。
- 首页单项领养在 1440×900、1024×900、768×1024、430×932、390×844 是否无需第二次滚动即可看见标题、角色、名称/物种、营业/单项状态和两个行动。
- autoplay、pointer/touch、keyboard 是否使用不同节奏；drag 未满足完整手势门槛时是否保持离散切换。
- 普通路由是否避免全站位移模板，首页各幕是否不再依赖通用 section reveal 才可见。
- release 镜像中的 FFmpeg 版本/摘要/源码/构建信息是否与 `/licenses` 一致，Docker Hub 公开时是否仍存在“未分发”文案。

## 7. 预实施放行结论

文档之间未发现阻止进入新 T04 的未决矛盾。放行仅表示修订后的顺序和边界可以实施，不表示代码、视觉、法务、测试重构、生产或数据清理已经通过。

## 8. 评审记录

- 2026-08-19：GPT-5.6 Pro 第一轮 Review，建立需求4初稿。
- 2026-08-19：GPT-5.6 Pro 第二轮代码/文档 Review，按用户反馈修正单项领养、排序、轻量隐私、组件优先、测试减负、Hero admin、统一进度与灵动动效。
- 2026-08-19：Codex 空上下文文档复核，对照谈话记录、当前 main、真实表单字段、发布工作流与公开 Docker Hub 元数据，修正文案、条款接受节点和 FFmpeg 分发边界。
- 代码实现后的 independent Reviewer：待执行。

## 9. 2026-08-20 工程 focused 自检（非 independent Review）

- PR #21 已确认的 PublicationPanel 旧 terminal operation 覆盖新任务问题已修复；两条目标 Playwright 覆盖发布后立即下架、cleanup retry active/防重/失败后可再试。
- `0045_r4_default_copy` 已验证只替换 NULL/空白/精确历史默认，保留管理员自定义内容，不写入 privacy 占位。半装写入值明确不含尾巴。
- `0046_r4_privacy_controller` 把已确认处理者“有点小狗工作室”与当前 `contact_email` 写入完整目标隐私政策，仍只替换空值/精确历史默认。
- 两项确认在客户端上传前与 service 消费前双重校验；缺失/false 不消费 upload、不创建 submission。
- retention/deletion 只提供单条能力；rejected 立即进候选，pending 只复核，accepted 不按时间候选。隔离 fake storage 已覆盖 dry-run、current/version/delete marker、异常引用、OSS 失败、DB 失败后重入与重复执行。
- `/admin/commissions` 列表和详情共用同一删除组件/API；真实浏览器已覆盖未认证 401、dry-run 脱敏、防重、失败可再试和成功刷新。
- notices 生成器消费当前生成环境已安装的 production dependencies，去除本机路径/时间、稳定排序并对未知许可证（含 `SEE LICENSE IN ...`）失败；平台可选包不冒充 Linux runtime closure，`/licenses` 不再声称 Windows/gyan.dev 构建或旧源码 revision。
- T35/T36 Linux runtime/容器分发、生产迁移/删除、隐私政策正式投影 smoke、独立 Review、用户验收和发布均保持开放。

## 10. 2026-08-20 阶段 E 前 GPT-5.6 Pro Review 修复

- 隐私政策建立唯一共享 readiness：拒绝空白、`{{...}}`、旧“不收集联系方式/设定图”、缺少已确认处理者/真实收集范围或未引用当前有效邮箱。申请页在未就绪时不渲染表单，匿名上传会话和 submission 均在副作用/消费前返回稳定 503；health readiness 与 production live preflight 使用同一判定。
- 两项确认从 legacy 大文件抽出小型 core integration：缺失和 false 都不消费 COMPLETED upload，两项 true 保持原事务成功；不把两个历史大文件整体提升为 core。
- notices 诚实收缩为生成环境安装快照，平台 drift 在显式 release 检查处理；页面只渲染 FFmpeg、字体资产和许可证表达统计，完整 transitive JSON 不进入 SSR/DOM，TXT 继续下载。
- `PublicAction` 替换申请页局部提交按钮；`AdminConfirmDialog` busy 时禁止 Escape、遮罩和取消按钮 dismiss，既有删除 smoke 覆盖该行为。
- 删除审计模型收缩到现有 `audit_logs` 的 actor、时间、submission ID 摘要和 SUCCESS/FAILURE；对象/数据库计数只在当次 dry-run/execute 响应中核对，不新增表或通用审计平台。
- 验证：privacy/notices unit 4/4；confirmation/readiness integration 13/13；`check:fast` 52 文件/327 项；smoke 9/9；`test:release`（notices drift、smoke、build、production verify、ESA/observability、Secret scan）通过。

本节是对独立 finding 的实现者修复记录，不等于 T51 最终独立 Review、T52 用户验收或生产执行。

## 11. 2026-08-20 阶段 E 文档与浏览器 Review

### F10 · Hero 控制器默认显隐没有进入需求4

**现状**：需求4只写“控制器是辅助层”“最后出现”“一次轻回弹”，没有定义默认态、触发显示和退出条件；需求2遗留契约仍要求可见暂停按钮。当前 `HomeHeroCarousel.vue` 始终渲染上一张、分页点、下一张与暂停按钮，CSS 始终 `display: flex`。

**历史依据**：更早的首页设计讨论已经提出“桌面默认只显示简洁页码或进度，箭头在 hover/focus/靠近边缘时出现，暂停保留能力但不与全部控件一起抢注意力”。该结论此前没有进入活文档。

**修复**：design/SPEC/TASKS/STATE 已明确默认只保留低权重分页/进度；方向和暂停/继续在键盘焦点、fine pointer 边缘/控制区或触控显式唤起时出现。暂停状态和恢复入口持续可见；视觉隐藏不破坏 Tab 顺序、可访问语义或布局稳定。

### F11 · 单项领养没有形成一屏信息闭环

**现状**：旧文档只要求单项、单图、caption 不遮角色，没有规定目标视口同屏边界。当前首页复用全宽 16:9 `AdoptionCard`；1440×900 实测 section 高 949px、媒体高 737px，从章节起点进入后名称与状态仍在下一屏。

**修复**：design/SPEC/PLAN/TASKS/STATE 已把 1440×900、1024×900、768×1024、430×932、390×844 的一屏表达写成契约和 GATE-E：标题、角色、名称/物种、状态、唯一行动无需第二次滚动即可同时理解。图片可以限制高度、居中留白或改为桌面图文编排；不强制全宽，也不把 caption 压到角色脸部。

### F12 · 阶段 E 顺序和阶段名称漂移

**现状**：旧 PLAN 使用 D=Hero/动效/四幕、E=发布，TASKS 使用 E/F；T37 从 token 开始、T41 才做静态四幕。STATE 还把 T35/T36 写成进入 T37 的停止点。引用对话曾声称已推送对应文档修复，但远端 `codex/r4-t04-t21-foundation@fb3dd44` 不包含该提交。

**修复**：全部活文档统一为 A 组件/进度、B 测试/领养、C 内容/隐私、D retention/删除/声明、E 动效/Hero/四幕、F Review/发布。T37～T47 改为 `机会审计 → 静态四幕 → 焦点/预览 → token/输入模态/reduced → 场景动效 → 连续验收`。T35/T36 不阻塞本地阶段 E，但继续阻塞最终独立 Review、镜像冻结和生产发布。

### F13 · 输入模态、普通路由和 rejected candidates 不明确

**现状**：旧文档没有分别约束 autoplay、pointer/touch、keyboard、drag；PLAN 的“页面切换使用统一 token”容易被实现成全站 `out-in + translateY`；通用 `HomeMotionReveal` 仍可能被继续复用。

**修复**：autoplay 可使用完整媒体时序，pointer/touch 先即时反馈，keyboard 即时或只做短 crossfade；drag 未满足 1:1 跟手、反向、中断、速度连续和纵向滚动门槛时不实施。普通路由默认即时或 120～180ms opacity；View Transitions 只增强三条确认路径。统一 section 上浮、全面 tilt、所有 CTA 回弹、Footer 入场、键盘长动画和持续循环已进入 rejected list。

### 证据与边界

- 设计 Review 与六张截图：`.design/DESIGN_REVIEW.md`、`.design/screenshots/`；
- 浏览器视口：1440×900、768×1024、390×844；
- 修复前空上下文读者无法回答控件显隐、一屏边界、输入模态和普通路由范围，并会按旧权威从 T37 token 开始、等待 T35/T36；
- 修复后空上下文读者已明确回答全部行为、顺序、停止点和勾选状态；唯一发现的 `page-in: 300ms` 与普通路由 120～180ms 冲突已删除，短路由 opacity 统一消费 `state: 180ms`；
- 本节只关闭文档歧义，不表示当前页面已经实现静默控制器、一屏领养或新动效顺序，也不勾选 T37～T47/GATE-E。

## 12. 2026-08-21 T38 用户实画面修正

- 用户指出首版三个章节标题过大、三张主图不等高、委托标题重复、目录入口不足、精选内部与章节间留白过大，并明确拒绝首页营销套话与邮箱说明。
- 当前实现让三个标题直接复用 `/works` 的 `--font-size-xl`，三个主媒体共用 `--home-scene-media-height`；桌面按图片左—右—左交替，章节起始间距统一为 32px。
- 代表作品、自设委托、设定领养各自使用 secondary + primary 两个圆角行动；标题右侧箭头入口全部删除。委托只保留 QQ 优先短句，不重复章节标题或邮箱说明。
- 用户随后指出营业状态消失/领养未显示。实现抽取 `HomeBusinessStatus`，并将 `currentAdoptions.status` 从既有业务状态直接加入聚合 DTO；浏览器分别确认委托与领养两条状态存在。
- 单帧检查曾漏掉委托状态在水合后消失；时间序列定位为 dev 客户端未解析新自动导入组件。两个调用方显式 import 后连续 12 秒稳定，SSR/客户端 DOM 一致。
- 五视口测量确认三标题同字号、三媒体同高度、领养两个行动仍在一屏，且无水平溢出、console error；最终整体观感仍由后续人工验收确认。

## 13. 2026-08-21 T39/T40 focused 自检

- 焦点写入复用 `assets.focal_x/focal_y`，不新增表；collection version 与 asset version 同时校验，enabled item 继续拒绝编辑。
- 同一 asset 已被另一 Hero item 引用且焦点要变化时稳定返回 `HERO_FOCAL_SHARED_ASSET_CONFLICT`；不静默覆盖。残留 PUBLIC variant 时停止焦点修改，要求先完成清理。
- 任意浮点焦点通过 service/DTO 原样保留；九宫格只在用户点击预设时写 0/0.5/1，任意坐标只显示最近提示。
- 委托横版隔离演练证明中心首次发布/停用后改焦点会生成与旧 Key 不相交的新公开变体；浏览器完成上传、右上选择、保存和重新读取。

## 14. 2026-08-21 T41 focused 自检

- 统一 token 已替换旧公共端 duration/easing；Hero 不再硬编码 680ms，其他公开组件不再消费旧 token。
- Hero 触发来源进入 DOM 状态：autoplay 使用媒体时序，pointer/touch 使用内容时序，keyboard 只使用短 opacity；精选轨道键盘滚动改为即时。
- reduced-motion 关闭 autoplay/位移并保留短 opacity，reduced-transparency 让覆盖 Header/Hero 控制成为实底，contrast 提高正文/边界对比。
- 浏览器状态验证不把精确毫秒写入永久测试；drag 因不满足完整门槛保持拒绝。
