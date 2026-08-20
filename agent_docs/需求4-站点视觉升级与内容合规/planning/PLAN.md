# 计划：站点视觉升级与内容合规

> **角色**：把 SPEC 翻译成有序、可执行的技术实现计划。
> **状态**：2026-08-19 第二轮 Review 与空上下文文档复核后定稿；无未答 OQ。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 执行结论

### 2026-08-20 本轮执行窗口

保留 TASKS 的原编号：本轮先完成 T22～T28，再完成 T29～T34 及 `/admin/commissions` 单条删除入口。T35/T36 中 Linux 发布镜像 runtime registry、容器嵌入和 Docker Hub 分发核验后置到部署阶段；本地 notices 与 `/licenses` 开发完成也不会强行关闭 GATE-D。

本轮不再从复杂隐私 Schema 开始。正确顺序是：

```text
A 组件与进度地基
  → B 测试减负与领养排序
  → C 轻量内容/隐私、单条删除与第三方声明
  → D Hero 管理、动效和首页四幕
  → E 人工验收、release smoke 与发布
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

- 增加 `check:fast`、`test:core`、`test:smoke`、`test:release`；迁移期可保留 `test:legacy`。
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
- old legacy 失败不再阻止日常开发；
- `/adoptions` 和首页单项满足业务排序；
- 用户人工验收仍是视觉门禁。

## C. 轻量内容、隐私、删除与第三方声明

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

### C3. 单条申请删除

- `review` 命令输出 masked 候选；accepted 不按时间标可删。
- rejected 一经拒绝即列为候选；pending 只提示人工复核。
- `delete` 正式每次一个 ID/回执；默认 dry-run、固定确认。
- 关系存在时枚举精确 DB/OSS 集合，对象验证后删行。
- 隔离数据验证 execute 和重入；不实现批量 execute。
- `/admin/commissions` 列表与详情使用同一后端能力，先 dry-run 展示脱敏计数/阻断，再确认单条 execute。
- 补充人工月度/半年度 SOP 文档；不建调度/提醒，不填写虚构的生产执行记录。

### C4. 第三方声明

- 从 production dependencies 生成稳定 JSON/TXT。
- 本轮从当前生成环境已安装的 production dependencies 生成稳定 JSON/TXT，并明确平台可选包只代表该环境快照；`/licenses` 消费紧凑 summary，完整清单只作下载/构建产物；`ffmpeg-static` npm 包与实际 FFmpeg 二进制概念分开。
- Linux 发布镜像中实际 FFmpeg 的版本、SHA-256、对应源码、补丁、构建配置和容器分发核验后置到 T35/T36 部署阶段；缺少 registry 时不宣称具体二进制事实。
- Noto Serif SC、ZhuoHei Collage 进入人工资产 registry。
- 当前 Docker Hub 仓库公开，release 视为二进制分发；容器与 `/licenses` 必须消费同一份声明事实，不能保留“仅内部使用、未分发”文案。
- `/licenses` 使用生成 summary，不保留平行手写依赖数组，也不把全部 transitive 清单渲染进 SSR/DOM。
- 未知许可证失败，不猜测。
- notices drift 从 `check:fast` 移到显式 release 检查；Linux 运行闭包由 T35/T36 的固定发布产物核验。

### GATE-C

- 表单确认严格但无新增隐私平台复杂度；
- 隐私政策与真实收集行为一致且无占位；
- 单条删除 DB/OSS 一体可重入；
- licenses 与实际依赖/资产一致。

## D. Hero 焦点、灵动动效与首页四幕

### D1. 动效 token

- 建立 feedback/content/media/page 和 standard/playful easing。
- 替换局部 620/680ms 等散落常量。
- 保留 standard 底盘，playful 只用于角色图片、控制器、CTA 图标和一次性完成反馈。
- reduced-motion/移动端同步实现。

### D2. Header/Footer 与页面切换

- Header 降低 SaaS 式浮起/阴影感，保持一层材料和清楚 active/focus。
- Footer 保持静态收尾。
- 页面切换使用统一 token；View Transitions 渐进增强，不破坏历史/锚点/焦点。

### D3. 焦点与 Hero 管理

- 为未启用 Hero item 提供九宫格。
- 预览使用目标横/竖比例和真实 cover。
- 修改焦点后走既有变体生成/验证/清理。
- 检测共享 asset 焦点冲突并阻断。

### D4. 首页骨架

- 重排为四幕，不新增版式表或多余公开请求。
- 建立每幕响应式尺寸、空态和 lazy/prefetch 策略。
- 先静态成立，再加动效。

### D5. 四幕实现

- Hero：品牌揭示、轮播控制和焦点。
- 代表作品：lead 大图 + 次级精选。
- 委托：大图分栏 + 一个主行动。
- 领养：唯一开放项单幅完整展示。

### D6. 角色感动效

- 图片/标题/CTA 使用有因的遮罩、错峰、聚焦和轻弹性。
- fine pointer 可轻 tilt/scale；触控使用按压/淡化。
- 一个视口一个主要大对象运动。
- success/selection 允许一次低幅回弹，不持续循环。

### D7. 性能与无障碍

- Hero 第一帧唯一高优先级，后续大图 lazy。
- 精确 sizes/srcset，避免不必要 3840 下载。
- 检查 LCP/CLS、decode、GPU、prefers-*、键盘、焦点、后退、锚点。
- 真实图片与手机人工验收。

### GATE-D

- 首页既简洁又具有角色生命感；
- 设定领养只一项；
- Hero 横竖维护清楚且进度统一；
- 移动/reduced 可用；
- 人工验收通过。

## E. 评审、发布与闭环

### E1. 最小自动验证

- `check:fast`；
- 与改动相关的 core；
- `test:smoke`；
- production build/verify；
- notices drift/PII scan。

不要求把 legacy 全量套件修到全绿作为放行条件。

### E2. Release 验证

- 显式运行镜像/Compose/Nginx/恢复 smoke；
- 涉及删除时运行隔离 destructive drill；
- 真实公开/管理 Host smoke；
- 真实手机和多视口人工浏览。

### E3. 独立 Review 与用户验收

- 独立 Review 聚焦安全/数据/删除/性能，不以历史测试数量评估质量。
- 王旻安/景宸确认首页节奏、动效性格、真实图片、admin 进度、文案与业务流程。
- 未通过人工视觉验收不得发布，即使自动 smoke 全绿。

### E4. 发布

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

## 开放问题（OQ）

无。实现发现必须改变上述边界时，先回到 SPEC/PLAN 登记，不在代码中自行扩张。
