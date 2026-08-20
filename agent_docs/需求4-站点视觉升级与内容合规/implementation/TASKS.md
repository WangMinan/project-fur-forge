# 任务清单：站点视觉升级与内容合规

> **角色**：需求4唯一任务与勾选权威；每个任务均可由 Agent 独立实现、验证和交接。
> **状态**：2026-08-20 已完成 T04～T34 的当前工程实现；T35/T36 的 Linux runtime/容器分发证据保持开放，当前在进入 T37 前收口独立 Review finding。
> **规则**：完成即勾选；不删除已完成历史项；实现、独立 Review、用户验收和生产发布互不代签。

## 当前目标

先统一按钮、上传和长任务进度，再减轻测试体系并修正领养排序；随后用现有字段完成轻量隐私、单条删除和第三方声明，最后推进 Hero 焦点、灵动动效与首页四幕。不得从旧版复杂 intake Schema 方案继续实施。

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
- [x] **T14 · 快速命令**：建立 `check:fast`、`test:core`、`test:smoke`、`test:release`；迁移期可保留 `test:legacy`，但不作默认门禁。
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
- [ ] **T35 · Runtime/资产 registry（部分后置）**：本轮登记 Noto Serif SC 与 ZhuoHei Collage 已核实授权类型；Linux 发布镜像的 FFmpeg 版本、SHA-256、对应源码、补丁与构建配置后置到部署阶段，本轮不勾选。
- [ ] **T36 · `/licenses` 与分发产物收口（部分后置）**：本轮让页面消费生成 notices，删除手写平行数组与已知错误 FFmpeg 文案；完整 runtime registry 嵌入容器、Docker Hub 分发核验与 release evidence 后置，本轮不勾选。

### GATE-D · 人工运维可执行

- [x] 单条删除 DB/OSS 一体、默认 dry-run、可重入；
- [x] 无 scheduler/批量自动删除；
- [x] 用户请求可单独处理；
- [x] notices 与当前 npm 生产依赖/已核实字体资产一致；
- [ ] T35/T36 部署分发证据完成。

## E. 动效、Hero 焦点与首页四幕

- [ ] **T37 · Motion token**：建立 feedback/content/media/page 与 standard/playful easing；迁移散落 620/680ms，不让测试断言精确值。
- [ ] **T38 · Header/Footer/页面切换**：降低 SaaS 胶囊浮起感；一层材料、清楚 active/focus；页面/锚点/后退/焦点和 reduced preferences 无回退。
- [ ] **T39 · Hero 焦点写入契约**：未启用 item 通过 CAS 修改现有 asset focal；共享 asset 冲突阻断；焦点变化重建不可变变体。
- [ ] **T40 · 九宫格与目标裁切预览**：横/竖目标比例、中心/四角/边预设、已有任意坐标最近提示；复用 Hero 管理统一 UI。
- [ ] **T41 · 首页静态四幕骨架**：先完成 Hero/lead work/commission/single adoption 的尺寸、空态和响应式，不加复杂动画。
- [ ] **T42 · Hero 角色感**：图片聚焦、品牌 mask/clip 错峰、控制器一次轻回弹；自动轮播/reduced-motion/隐藏项加载保持正确。
- [ ] **T43 · 代表作品幕**：lead 大图、短 caption、一个行动、剩余精选次级；桌面 fine pointer 有轻聚焦，触控无 tilt。
- [ ] **T44 · 自设委托幕**：非对称分栏、同源媒体连续性、一个主行动、QQ 优先/邮箱备用短说明。
- [ ] **T45 · 单项设定领养幕**：唯一 available 单幅完整展示；无 available 隐藏；caption/行动不遮主体。
- [ ] **T46 · 区块与共享对象动效**：遮罩、图文错峰、轻弹性和 View Transitions 渐进增强；一个视口一个主要大对象运动。
- [ ] **T47 · 移动/reduced/性能**：390/430/768/1024/1440、真实手机、LCP/CLS/decode/GPU、safe area、输入法、键盘/焦点、prefers-*。

### GATE-E · 既简洁又有生命感

- [ ] 四幕顺序与主次明确；
- [ ] 领养只展示一项；
- [ ] 角色感动效一次性、有因、无持续噪声；
- [ ] 移动端不是桌面缩小版；
- [ ] Hero 横竖独立维护清楚；
- [ ] 王旻安/景宸人工视觉验收通过。

## F. 最终 Review、发布与闭环

- [ ] **T48 · SEO/固定入口同步**：DITE DOG、QQ 优先、隐私/条款/licenses 和新首页结构同步 SEO/JSON-LD/README/活文档；不恢复退役入口。
- [ ] **T49 · 最小自动验证**：`check:fast`、受影响 core、`test:smoke`、production build/verify、PII/notices scan；不要求 legacy 全绿。
- [ ] **T50 · Release/manual smoke**：显式镜像/Compose/Nginx/恢复；相关时执行 destructive drill；真实 Host home/adoptions/apply/privacy/service/licenses/admin。
- [ ] **T51 · 独立 Review**：聚焦稳定不变量、删除精确性、媒体/进度、性能和文档一致性；不以测试数量代替判断。
- [ ] **T52 · 用户验收**：王旻安/景宸确认真实图片、动效性格、首页节奏、领养排序/单项、Hero 管理、进度、文案和手机体验。
- [ ] **T53 · 生产准备**：备份/恢复、文案迁移执行、隐私政策公开投影核对、人工 retention 责任人/日期、冻结镜像和回滚候选。
- [ ] **T54 · 发布与 smoke**：执行迁移和镜像发布，验证 readiness、公开/管理主流程和边缘媒体；失败按现有恢复手册处理。
- [ ] **T55 · 闭环**：回写 TASKS/STATE/review/artifacts/CLAUDE，记录未覆盖后续项和下一次人工复核日期。

### GATE-R4 · 需求4完成

- [ ] GATE-A～E 全部通过；
- [ ] 稳定 core/smoke 与 release smoke 通过；
- [ ] legacy 全量不作为放行条件；
- [ ] 独立 Review 与用户人工验收通过；
- [ ] 生产 smoke 通过；
- [ ] 自动化、Reviewer、用户和生产操作员没有互相代签。

## 闭环结论

- T04～T34 的当前开发范围与本地证据已完成；用户已确认个人信息处理者名称为“有点小狗工作室”。
- T35/T36 的 Linux FFmpeg runtime registry、容器嵌入、Docker Hub 分发核验与 release evidence 已后置；GATE-D 未完整关闭。
- 本轮未进入 T37 及之后的 Hero 焦点、动效和首页四幕。
