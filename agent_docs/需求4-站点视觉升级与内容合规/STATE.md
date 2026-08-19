# 当前状态：需求4 · 站点视觉升级与内容合规

> **角色**：整个需求的状态机与收敛中枢（对应 spec-kit `/converge`）。
> **规则**：每轮工作开始时读、结束时回写；任务勾选以 `implementation/TASKS.md` 为准。
> **评审基线**：第二轮应用代码审查基于 `main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档随后以 `main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109` 合入，后者没有应用代码变更。

## 当前阶段

阶段 4 · 2026-08-20 完成第一批工程实施 T04～T21，GATE-A/GATE-B 已由实现与本地证据关闭。当前停在 C 阶段 T22 之前；轻量内容/隐私、删除、第三方声明、Hero 焦点、动效体系和首页四幕均未开始。

## 最近验证

- 2026-08-20：任务分支 `codex/r4-t04-t21-foundation` 从 `main@cbaf98fec4868e94af5b28faf5c3d9a23344d859` 开始；Gate A 提交为 `767a1d4`，领养排序提交为 `16e4288`，测试/Actions 提交为 `daacff2`，文档与浏览器证据由本轮末次提交收口。
- 2026-08-20：公开 `PublicAction`、管理 `AdminAction` 与 `AdminTaskProgress` 已落地；Hero、作品图、二维码、水印 Logo 四类上传使用 XHR 字节进度；FFmpeg 为阶段 + elapsed + indeterminate；Hero/branding/publication operation 使用持久状态并可刷新恢复。
- 2026-08-20：Hero 管理改为“首页/委托”一级与“横/竖（桌面/手机画框）”二级；委托宽屏双槽并排、窄屏堆叠。四个 collection 的 API、version、owner context、CAS、items 与 operation 仍独立。
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
- `/adoptions` 固定排序：`available` 在前、`adopted` 在后；每组按 `works.updated_at DESC`，再以稳定 ID 打破平局；搜索后仍保持该顺序，再分页。
- PC Web 是第一视觉基准；移动端同步等价重排，不依赖 hover，不使用 scroll-jacking、长时间 pinned scroll 或强制横向叙事。
- 公开视觉以简洁、摄影优先为底盘，但允许有节制的角色感动效：遮罩揭示、轻微弹性、图片聚焦、图文错峰和一次性成功反馈；不做持续摇摆、粒子、全屏视差或多对象同时抢动。
- 公开行动组件、管理端行动样式、上传进度和长 operation 反馈必须先于首页重构收敛；不得继续复制局部按钮和 progress CSS。
- OSS 上传使用真实字节进度；持久 operation 使用真实阶段/计数；FFmpeg 无可信百分比时显示阶段、经过时间和终态，不伪造进度。
- Hero 横版/竖版素材继续分别维护，四集合版本和顺序互不耦合；管理端只统一信息架构和组件，不合并数据或强迫横竖一一配对。
- 隐私实现保持轻量：通过现有 `privacy_policy` 和 `contact_email` 维护真实处理者/联系信息；申请页只有两个未预勾选确认，服务端校验字面量 `true`，不新增确认持久字段或版本协议。
- 人工保留复核继续采用“人的判断 + 工具执行”；首版正式删除只支持单条申请精确执行，不建设定时任务、Worker、批量自动删除或通用生命周期引擎。
- 测试只保护稳定不变量；视觉、排版、文案语气和真实图片效果以王旻安/景宸人工验收为最终门禁。
- 普通改动不默认跑历史全量 unit/integration/E2E；先运行快速静态检查和受影响的核心不变量，发布前再运行精简 smoke、构建/部署验证与人工浏览器验收。
- 不新增 GitHub required check；默认质量 workflow 需要在实现阶段减重，重型镜像/恢复/完整历史套件改为显式 release/manual 路径。
- 当前公开发布的容器镜像包含 FFmpeg，按二进制分发场景维护精确版本/摘要、许可证、对应源码与构建信息；网页没有单独下载入口不能被写成“未分发”。
- 需求1的 Host、媒体、OSS/ESA、安全、发布、恢复和部署基线，以及需求3仍适用的业务与匿名上传安全边界继续生效。

## 待确认问题（OQ 汇总）

无（所有阶段 OQ 已答）。真实经营主体名称仍由工作室在发布前通过现有文案维护能力写入隐私政策，并由工作室最终核对。

## 下一步交接

本轮停止于 GATE-B。下一轮只能从 `implementation/TASKS.md` 的 T22 开始轻量内容/隐私阶段；不得把本轮本地自动化当作独立 Review、王旻安/景宸视觉验收或生产发布，也不得恢复旧复杂 intake Schema 方案。
