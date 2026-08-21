# 计划：站点视觉升级与内容合规

> **角色**：把 SPEC 翻译成有序、可执行的技术实现计划。
> **状态**：2026-08-21 仅阶段 E 开放；T37～T46-F4 当前工程实现完成，T47 与人工视觉验收保持开放；A～D 和原阶段 F 已关闭。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 执行结论

### 2026-08-21 唯一开放窗口

T04～T34、T34-F1、M01～M11 与 T37～T46-F4 已完成当前工程实现。T35/T36 和原阶段 F 从需求4 backlog 关闭；它们未被补签为完成，未来实际发布/部署仍按 notices 与 Runbook 现场核对。当前只继续 T47/GATE-E 的 UI、布局、响应式、性能、可访问性和动效验收。

历史顺序保留如下，只有 E 仍开放：

```text
A 组件与进度地基
  → B 测试减负与领养排序
  → C 轻量内容与隐私确认
  → D 人工 retention、单条删除与第三方声明
  → E 动效、Hero 焦点与首页四幕
  → F 最终 Review、release smoke 与发布（已关闭）
```

理由：当前最显著的工程债是按钮、上传和进度呈现碎片化；若先继续开发隐私和首页，重复实现会进一步扩大。测试体系也应在大规模视觉变更前减重，避免每次小改都被历史实现型断言拖慢。

## A. 组件与进度地基

### A1. 盘点重复面

- 列出公开端所有 primary/secondary/text 行动和局部 CSS。
- 列出管理端普通、主、danger、link、loading 按钮。
- 列出 Hero、作品、二维码、水印上传和 commission 上传的状态机/进度呈现。
- 列出 FFmpeg、publication、branding、Hero operation 的进度/反馈组件。
- 只统计职责和差异，不先做视觉重构。

### A2. 公开行动组件

- 建立 `PublicAction` 或等价组件，支持 `NuxtLink`/`button`、primary/secondary/text、loading/disabled/focus/active。
- 先迁移 about、commission、adoptions 和首页现有行动，再开始四幕新 UI。
- 删除迁移完成后的局部按钮 CSS；保留业务页面布局 CSS。

### A3. 管理行动与进度

- 建立 admin action primitive，统一主/次/danger/link/loading。
- 建立 `AdminTaskProgress`：determinate、stage、indeterminate 三模式。
- 真实 OSS upload 使用现有 XHR progress。
- FFmpeg 使用阶段 + elapsed + indeterminate；不解析伪百分比。
- publication/Hero/branding 使用真实 operation 状态和计数，移除阶段硬编码百分比。

### A4. 上传展示收敛

- 不要求一次性重写所有 composable；先把状态映射和进度 UI 收敛为共享层。
- Hero、QR、水印、作品图分别接入同一进度组件。
- 后续再视重复度抽取共享 upload state helper，避免为抽象而抽象。

### A5. Hero 管理信息架构

- 保留四集合和现有 API/composable。
- `admin/site/home` 改为 placement 一级、orientation 二级。
- 首页与委托页都显示横/竖摘要，并通过二级 Tab 只编辑当前方向；不在宽屏同时展开委托横/竖单槽。
- 统一 editor/card、设备画框预览和长任务反馈。

### GATE-A

- 新页面可只用统一行动/进度 primitive；
- OSS 上传至少一个真实流程显示真实百分比；
- FFmpeg/operation 不再显示伪精确百分比；
- Hero 管理数据契约未被合并或配对。

## B. 测试减负与领养业务修正

### B1. 测试分类

对现有测试逐文件标记：

- `core`：安全、隐私、数据、迁移、删除、上传、发布状态机等稳定不变量；
- `smoke`：少量完整用户流程；
- `legacy`：历史实现、精确 DOM/文案/动画时长或重复覆盖。

先分类再修改；测试失败时不直接把旧断言改成新 UI。

### B2. 快速命令与 workflow

- 保留 `check:fast`、`test:core`、`test:smoke`、`test:release`；分类完成后删除 `test:legacy` 及实现型测试文件。
- 默认 quality 只运行快速 checks；docs-only 跳过应用重型任务。
- image build、Compose/restore/Nginx 和完整 release smoke 由 `workflow_dispatch` 或 release 流程显式运行。
- 不新增 required check。

### B3. 精简 Playwright

- 保留约 8–12 条主旅程。
- 删除精确 `transitionDuration`、全文文案、局部 class/DOM、每次历史视觉修正等断言。
- Playwright 只验证路由、主要行动、关键状态、无明显溢出/错误和 reduced-motion 基础可用。
- 真实观感由人工浏览器验收。

### B4. 领养排序

- `loadPublishedWorks` 或专用投影携带 `updated_at`。
- `adoptionItems` 使用状态 bucket + updatedAt + ID 的唯一 comparator。
- 名称搜索在排序后过滤，再分页。
- 添加一条稳定 core test：新近 adopted 仍位于所有 available 之后；组内 updatedAt 倒序。

### B5. 首页单项领养

- 聚合最多投影一项 available。
- `HomeCurrentAdoptions` 删除双项 slice 和双列布局。
- 没有 available 时隐藏；adopted 仍可在精选中出现。
- 只保留一条 smoke 证明首页/目录入口可达，不测试具体卡片数量之外的版式细节。

### GATE-B

- 普通代码反馈路径显著短于现有全量 workflow；
- 不再维护或运行平行 legacy 套件；
- `/adoptions` 和首页单项满足业务排序；
- 用户人工验收仍是视觉门禁。

## C. 轻量内容与隐私确认

### C1. 默认文案

- 按 `COPY.md` 前向替换 about/commission/terms/contact 的 NULL/空值/精确历史默认。
- 不覆盖管理员改写；已确认的处理者名称“有点小狗工作室”只写入 NULL、空白或精确历史默认的 privacy 文本。
- 完整隐私政策继续通过现有 `privacy_policy` 编辑能力维护，联系邮箱复用 `contact_email`，不新增字段。
- QQ 优先、邮箱备用在 about/commission/privacy/anti-scam 一致。
- 服务条款公开可读不等于客户已经接受；工作室在 QQ 确认接单或收取约定款项前明确提供/引用当时条款并提示重大事项。

### C2. 两项提交确认

- 页面增加成年/设定权利确认和隐私/非接单确认。
- 两项不可预勾选，错误邻近显示。
- request Schema 使用 literal true。
- service 在消费 upload 前验证。
- 不新增 DB 列、metadata API、版本传递、stale 409 或 legacy 管理 UI。

### C3. 就绪、展示与负向边界

- privacy readiness 同时保护申请页、匿名上传、submission、health 和 live preflight；政策不完整时申请 fail closed，管理端仍可修正。
- about/commission/privacy/service 继续复用现有内容投影；QQ 私聊优先、邮箱备用、QQ群非默认确认渠道。
- PII 和私有设定图不进入公开 DTO、HTML、URL、analytics、普通日志、错误或浏览器持久存储。

### GATE-C

- 表单确认严格但无新增隐私平台复杂度；
- 隐私政策与真实收集行为一致且无占位；
- PII/私有媒体负向检查保持通过。

## D. 人工 retention、单条删除与第三方声明

### D1. 人工 Review 与 SOP

- `review` 命令输出 masked 候选；accepted 不按时间标可删。
- rejected 一经拒绝即列为候选；pending 只提示人工复核。
- 月度上传清理、半年度申请复核、用户权利请求和 accepted 人工判断写入 SOP；不建调度或提醒，不填写虚构生产记录。

### D2. 单条 dry-run/execute

- 每次只接受一个 submission ID/回执；默认 dry-run、固定强确认，不提供时间批量 execute。
- repository/service/storage 为 CLI 和 `/admin/commissions` 共用；关系存在时枚举精确 DB/OSS 集合，对象验证后删行。
- 隔离数据验证 current/version/delete marker/preview/pending、异常引用、部分失败、execute 重入和重复执行。

### D3. 管理端入口

- `/admin/commissions` 列表与详情先展示脱敏 dry-run 计数/阻断，再确认单条 execute。
- busy 对话框不可由 Escape、遮罩或取消按钮误关；失败后保留明确重试入口。

### D4. 第三方声明与发布闭包

- 从当前生成环境已安装的 production dependencies 生成稳定 JSON/TXT；平台可选包只代表该环境快照。
- `/licenses` 消费紧凑 summary，完整清单只作下载/构建产物；`ffmpeg-static` npm 包与实际 FFmpeg 二进制分开登记。
- Noto Serif SC、ZhuoHei Collage 进入人工资产 registry；未知许可证失败，不猜测。
- 当前 Docker Hub 仓库公开，release 视为二进制分发；不能保留“仅内部使用、未分发”文案。
- T35/T36 从固定 Linux 发布产物提取 FFmpeg 版本、SHA-256、对应源码、补丁和构建配置，嵌入容器并核对 Docker Hub 分发证据；本地阶段 E 不等待该部署证据，最终发布必须等待。

### GATE-D

- 单条删除 DB/OSS 一体、默认 dry-run、可重入；
- 无 scheduler 或批量自动删除；
- notices 与当前生成环境 npm 生产依赖、已核实字体资产一致；
- T35/T36 Linux runtime、容器嵌入与分发证据在最终发布前完成。

## E. 动效、Hero 焦点与首页四幕

### E1. 动效机会审计

- T37 只读盘点现有 reveal、hover、carousel、route、menu、状态反馈与共享对象路径。
- 每项通过频率、目的、速度、功能四项门禁，记录位置、触发、输入模态、reduced 版本和中断策略。
- 最终只保留约 5～7 个高置信机会，并维护 rejected candidates；本任务不修改应用代码、不预装动效库。

### E2. 静态四幕

- T38 先让 Hero、lead representative work、非对称自设委托和单项 available 领养在桌面、平板、手机静态成立；三幕标题同级、主媒体等高，桌面按图片左—右—左交替。
- 领养从章节起点进入目标视口后，同屏包含标题、角色图、名称/物种、状态、目录入口和当前角色入口；图片不因全宽 16:9 把 caption 推到下一屏。
- 内容 SSR/无 JavaScript 默认可见；删除所有章节共用同一种上浮 reveal 的假设。

### E3. Hero 焦点与裁切

- T39 固化未启用 item 的 CAS/focal 写入、共享 asset 冲突阻断和不可变变体重建。
- T40 首版曾提供九宫格，后由用户 T40-F1 反馈替换为横/竖目标画框内可拖焦点，以及水平/垂直滑杆；任意坐标继续保留，四集合独立管理不变。

### E4. Token、输入模态与 reduced

- T41 在已通过机会清单后建立 feedback/state/content/media 与 standard/playful easing，迁移散落 620/680ms，完成后不保留两套长期 token。
- autoplay 使用完整媒体时序；pointer/touch 先立即反馈；keyboard 即时或只做短 crossfade。
- drag 只有真正 1:1 跟手、可反向、可中断、释放速度连续且不抢纵向滚动时实施，否则保留离散切换。
- reduced-motion 关闭自动轮播、大位移、错峰、tilt、overshoot 和共享对象飞行，但保留约 120～180ms 的 opacity/color/state 反馈。

### E5. 场景动效与整合

- T42 Hero：图片聚焦、品牌 mask/clip 错峰；默认只保留低权重分页/进度，箭头与暂停/继续按键盘、fine pointer 和触控显式唤起，暂停后恢复入口常在。
- T43 代表作品：lead 大图、短 caption、`/works` 与当前作品两个圆角行动和低权重次级浏览；次级作品不逐卡 reveal。
- T44 自设委托：桌面图片在右，文字轻错峰，只保留 QQ 优先短句、`/commission` 与申请表单两个行动；主媒体使用与 lead 相同的 fine-pointer 聚焦，不让整个章节卡片浮起。
- T45 单项领养：一次媒体揭示和 caption 交接，保留目录与当前角色两个行动并保持一屏完整表达；主媒体使用同款聚焦，删除到 Footer 的额外尾部 padding。
- T46 Header/移动菜单、普通路由与三条共享对象路径最后整合；普通路由默认即时或短 opacity，不使用全站 `out-in + translateY`，Footer 保持静态。
- T46-F1：首页 ≥1024px 增加 Hero/lead/继续浏览/委托/领养/Footer 的逐幕 wheel；1023px 及以下原生滚动。修复 Hero 首屏动画重启、Hero 焦点拖动/滑杆和委托复制邮箱布局。
- T46-F2：首页 Header 固定并在离开 Hero 后切换实底；只保留 scroll container 的单一 Header offset；“继续浏览”提高媒体高度并从 Header 下方开始；三张主媒体 hover 命中区缩到图片本身、回落改用 state 时序。
- T46-F3：“继续浏览”标题与轨道按钮共享 scene 顶部 padding，修复按钮悬在 Header 下方而标题位于内容区的问题。
- T46-F4：按用户实画面复核取消中文主标题首载动效并预加载拼贴字体；以 router scroll behavior 统一保证非 hash 导航第一帧到顶、当前页入口回页头，并在目标页加载完成后恢复返回/前进位置，hash 仍使用 Header offset；委托主图取消整图链接；代表作品删除 caption 内孤立 `01`，PC 两个停靠点都使用“代表作品”标题与 `SELECTED WORK · 01/02` 眉题，移动端只显示第一处标题，轨道控制下置。
- T46-F5：在 service 与管理列表统一收紧代表作品资格：READY 竖版出厂照必需，成员最多两件，移除最后一张竖版前先移出代表作品；不新增迁移。
- T46-F6：把首页代表作品收敛为桌面左侧两张较小 3:4 竖图、右侧短说明与唯一 `/works` 按钮，隐藏名称/物种并删除 lead/轨道/左右控制，全部保持一屏；`/works` 恢复横竖等高混排，有出厂照优先出厂照，无出厂照才回落领养横版封面。
- T46-F7：更新稳定契约与核心/smoke 断言，浏览器覆盖 1440/1024/768/430/390；结果不代签真实手机和景宸/王旻安人工验收。

### E6. 连续验收

- T47 在每个机会完成时同步检查中断、反向、键盘、focus、reduced preferences、LCP/CLS/decode/GPU、横向溢出和一个视口一个主要大对象运动。
- 覆盖 1440×900、1024×900、768×1024、430×932、390×844 与一台真实手机；动画放慢检查路径后恢复真实速度判断节奏。
- 自动测试只断言状态和稳定不变量，不断言精确毫秒、DOM 或审美；王旻安/景宸人工验收最终观感。

### GATE-E

- 四幕静态层级与主次成立；
- Hero 控制器默认静默且键盘/触控可获得，暂停后恢复入口清楚；
- 单项领养在全部目标视口一屏完成标题、角色、身份、状态和行动表达；
- autoplay、pointer/touch、keyboard 节奏分开，未达完整门槛时不做 drag；
- 角色感动效一次性、有因、无持续噪声；
- 移动/reduced 可用，王旻安/景宸人工视觉验收通过。

## F. 最终 Review、发布与闭环

### F1. 最小自动验证

- `check:fast`；
- 与改动相关的 core；
- `test:smoke`；
- production build/verify；
- notices drift/PII scan。

已退役的实现型套件不作为放行条件，也不恢复为平行门禁。

### F2. Release 验证

- 显式运行镜像/Compose/Nginx/恢复 smoke；
- 涉及删除时运行隔离 destructive drill；
- 真实公开/管理 Host smoke；
- 真实手机和多视口人工浏览。

### F3. 独立 Review 与用户验收

- 独立 Review 聚焦安全/数据/删除/性能，不以历史测试数量评估质量。
- 王旻安/景宸确认首页节奏、动效性格、真实图片、admin 进度、文案与业务流程。
- 未通过人工视觉验收不得发布，即使自动 smoke 全绿。

### F4. 发布

- 备份/恢复验证；
- 前向文案迁移；
- 执行隐私文案前向迁移，核对处理者“有点小狗工作室”与当前联系渠道；
- 发布新镜像；
- readiness/home/adoptions/apply/privacy/service/licenses/admin smoke；
- 记录人工 retention 下次执行日期；
- 更新 STATE/TASKS/artifacts/review。

## 技术决策

- **组件先于页面**：先还公共按钮/上传/进度债，避免新首页继续复制。
- **四集合不合并**：横竖是真实艺术指导差异，统一 UI 不等于统一数据。
- **进度必须诚实**：有字节/计数才显示百分比；未知任务用阶段和 elapsed。
- **隐私轻量化**：两个严格 checkbox，不建设新表/API/版本协议。
- **单条删除**：人工判断和逐条 execute 比自动批量更安全、也更符合小工作室维护能力。
- **测试保护不变量**：不让精确文案、DOM 和动画时长支配开发；用户人工门禁是视觉权威。
- **灵动但不噪声**：允许角色感强调，不恢复持续漂浮和无目的特效。
- **先结构后动效**：阶段 E 从只读机会审计与静态四幕开始，不从 token 或全局页面转场开始。
- **控制器默认静默**：低权重分页/进度保持可见，方向和暂停/继续按输入意图出现；视觉减法不牺牲键盘暂停能力。
- **领养一屏闭环**：单项不等于全宽铺满；目标视口必须同时看见角色身份、状态和行动。

## 开放问题（OQ）

无。实现发现必须改变上述边界时，先回到 SPEC/PLAN 登记，不在代码中自行扩张。
