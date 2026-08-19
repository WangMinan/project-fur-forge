# 评审记录：需求4

> **角色**：记录 SPEC ↔ COPY ↔ design ↔ models ↔ PLAN ↔ TASKS ↔ 当前代码的一致性与风险。
> **状态**：2026-08-19 完成第二轮预实施代码/文档 Review；应用实现后的独立 Review 仍未执行。
> **代码基线**：`main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`。

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

**影响**：业务用户需要在四个 Tab 间来回确认首页/委托和横/竖，缺少两方向总体状态；委托横竖单槽本可并排处理。

**结论**：保留四集合，不建立 pair。管理端改为“首页/委托”一级、“横/竖”二级，显示双方摘要和设备画框预览。

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
- FFmpeg 当前是服务器内部工具；ZhuoHei Collage 按免费商用授权资产留档。
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

### 5.7 默认文案与真实经营主体

风险：`{{controller_name}}` 未替换或文案与真实流程不一致。

缓解：不新增字段；生产 readiness 检查占位；王旻安/景宸逐段人工 Review；Agent 不把文档评审称为法律保证。

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

## 7. 预实施放行结论

文档之间未发现阻止进入新 T04 的未决矛盾。放行仅表示修订后的顺序和边界可以实施，不表示代码、视觉、法务、测试重构、生产或数据清理已经通过。

## 8. 评审记录

- 2026-08-19：GPT-5.6 Pro 第一轮 Review，建立需求4初稿。
- 2026-08-19：GPT-5.6 Pro 第二轮代码/文档 Review，按用户反馈修正单项领养、排序、轻量隐私、组件优先、测试减负、Hero admin、统一进度与灵动动效。
- 代码实现后的 independent Reviewer：待执行。
