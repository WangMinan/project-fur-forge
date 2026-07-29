# 状态

> **角色**：当前需求的状态机与收敛中枢。每轮开始先读本文件，结束后回写。

## 当前阶段

阶段 4 · IMPLEMENTATION 进行中。T01–T08 已完成；T09 工程核心候选已于 2026-07-30 在 `fix/t09-contracts-sol` 实现，当前等待 Kimi 界面修补和工程侧最终复核。**T09 保持未勾选，不得提前进入 T10。**

## 当前执行分工

- Kimi K3 继续作为 `UI_PRIMARY`；当前按 `implementation/notes/T09-UI-HANDOFF.md` 承接 T09 界面修补。
- 当前批次仍为 T09；`ENGINEERING_PRIMARY` 已形成共享契约、错误分流、安全日志、泄漏守卫和配置修订候选，Kimi 合入后再做最终复核。
- 独立审查者提供证据复核与建议；TASKS 指定的用户门禁仍由用户作最终确认。
- 数据库、认证、安全、OSS、事务和运维仍由 `ENGINEERING_PRIMARY` 主责，具体模型不写入产品契约。
- 后续全栈任务采用“工程侧先锁定 Schema/API/错误/权限与集成测试，Kimi 再实现前端切片”的交接方式。
- 完整的当前批次、后续默认路由、交付清单和分支策略见 [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)。该文件只记录可变执行安排，不改变 TASKS 的范围与依赖。

本轮文档校准于 2026-07-29 生效，覆盖此前文档中的以下旧口径：

- 旧口径：同一 Bucket 内通过 Object ACL 在 `private` / `public-read` 间切换；
- 为未来美元价格预留禁用字段；
- 在作品管理模型中保存定金与付款备注；
- 先完成大批数据库、认证、OSS 基础设施，再到后期才验证第一件真实作品链路；
- 为每张图片生成 3 个比例 × 7 个宽度 × 2 个格式的完整组合；
- 把蓝色面积约 15% 当作设计目标，而不是上限。

## 已确认决策

### 产品与范围

- 首版仍是“图片主导的工作室作品集 + 唯一管理员内容后台”，不是商城或客户管理系统。
- 联系人信息可以作为后台私有字段保留；`depositNote`、`paymentNote` 及其等价字段从需求与后续数据模型中移除。
- 返图可以保存可选授权记录：授权来源、确认时间和简短备注。三者均可为空，不作为发布阻断项，也不进入公开投影。
- 一期价格只支持人民币。采用最小货币单位与固定 `CNY` 约束；未来需要其他币种时通过正常迁移扩展，不提前保存禁用美元字段。
- P0 先形成可部署的核心作品链路；P1 补齐一期增强能力；P2 是可独立后置的运维增强。只有 P0 + P1 完成后才称为“一期功能闭环”；正式上线仍需 T51–T53。

### 媒体架构

- 已创建 `project-furry-forge-private` 与 `project-furry-forge-public` 两个 Bucket。
- 私有 Bucket 永久拒绝匿名读取；公开 Bucket 只保存发布后的网页衍生图，不保存原图、联系人或其他私有资料。
- 浏览器只向私有 Bucket 直传原图。OSS 图片处理是唯一像素转换权威；发布时使用 `sys/saveas` 把确定性衍生结果写入公开 Bucket。
- 发布/下架不再切换 Object ACL。发布验证公开对象后提交数据库引用；下架先移除公开投影，再删除公开 Bucket 对象并记录未完成清理。
- `@nuxt/image` 若使用，只负责组件封装和 `picture/srcset/sizes` 表达，不发起第二套动态裁切、缩放或转码。

### 图片配方

`recipe-v1` 只生成页面真实使用的规格：

- 作品卡 3:4：480 / 768 / 1200；
- 首屏或宽图 16:9：768 / 1280 / 1920；
- 详情原比例：960 / 1600 / 2400；
- WebP + 一种源兼容 fallback；透明度确有需要时使用 PNG，否则使用 JPEG。

不为每张图片默认生成全部比例；1:1 等新比例只有真实页面使用后再加新 recipe 版本。

### 视觉方向

- 公开站采用图片大底与白底编辑型摄影作品集。
- 明显蓝色面积以 5%–10% 为常态，15% 是单页硬上限；作品图、白色和中性文字承担主要视觉面积。
- `#324DAF` 用于主要行动和焦点，`#293C84` 用于 Hover/深强调，`#1D2D5A` 用于极少量反白表面，`#6274BB` 只作大字或装饰，`#CED3E5` 只作弱背景和边界。
- 禁止连续蓝底区块、蓝色卡片墙、蓝色渐变大按钮，以及“半张图片 + 半张蓝色说明面板”的通用营销构图。
- T05 已通过真实截图比较“横向精选轨道”和“编辑型图片网格”；T08 最终选定横向轨道，不把组件名当作不可变需求。

## T09 工程核心状态

T03 遗留工程问题已在候选分支完成以下修正：

- 废止付款类字段和禁用美元字段已从 Schema、类型、mapper、fixture 与测试删除；
- 已增加三字段全部可空、不阻断发布且不进入公开投影的返图授权记录 Schema；
- 管理端媒体 DTO 只暴露 `assetId` 等业务标识；公开 mapper 逐字段投影；
- 单 Bucket 运行配置已拆为私有/公开 Bucket，旧字段显式报弃用错误；
- API 错误保持 JSON，普通页面错误交给 Nuxt `error.vue`；
- 安全日志已接入 500 路径，并对 message 与结构化 context 做泄漏回归；
- production 构建产物会阻断占位文案和 `/fixtures/samples/`。

工程记录见 `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md`。界面仍需按 `implementation/notes/T09-UI-HANDOFF.md` 修补管理布局、文字对比度、参数响应、dirty、金额校验、reduced-motion 和任务阶段文案。

## 开放问题

- `OQ-119`（开放，T12 前必须回答）：管理端样张声称 `ownerDisplay` 留空表示工作室作品，但上游权威材料未定义该空值语义。T09 保持非空 Schema；T12 不得据当前 DTO 直接创建相关数据库列或约束。

## 外部门禁

- `EXT-01`：正式 Logo、作品图和返图的来源/可公开使用确认及焦点/安全区清单；可使用轻量 manifest，不要求每张返图填写授权字段。通过后执行 T51。
- `EXT-02`：确认目标地域图片处理源图配额不低于 30,000,000 字节，并用无个人信息的 20–30 MB 合成图片验证私有上传与跨 Bucket `sys/saveas`；通过后才能执行 T16。
- 两个 Bucket 已创建不等于门禁通过；仍需只读核对地域、CORS、Block Public Access、公开读取边界、最小权限和跨 Bucket 处理能力。

## 最近验证

- 2026-07-30：T09 工程核心候选完成。冻结安装、lint、typecheck、58 项单测、4 项集成测试、86 项 E2E、Nuxt 构建与生产运行验证全部通过；`APP_ENV=production` 产物守卫按预期阻断当前占位文案和样张素材。契约、配置、错误、日志、生产守卫与 OQ-119 记录见 `implementation/notes/T09-ENGINEERING-CORE-2026-07-30.md`；T09 仍未勾选。
- 2026-07-30：用户完成 T08 最终验收，确认 T06/T07 视觉基线通过，首页最终采用横向轨道，C1、C3–C5 接受现状，`must-fix = 0`；落选网格与 `?featured=grid` 实验开关已删除。收口后 lint、typecheck、51 项单测、3 项集成测试、84 项 E2E、生产构建与生产验证全绿；最终结论见 `implementation/notes/t06-t07/T08-REVIEW-PREP.md` 第 7 节。
- 2026-07-30：T08 第一轮用户反馈已落实（F1 轨道默认 / F2 详情主图限高 / F3 slogan「不只做小狗毛」），lint、typecheck、单测与 E2E 全绿，首页与详情截图已重采；处理记录见 `implementation/notes/t06-t07/T08-REVIEW-PREP.md` 第 6 节。
- 2026-07-29：Kimi 完成 T06/T07（`feature/t06-t07-kimi`）。lint、typecheck、51 项单测、3 项集成测试、86 项 E2E、生产构建与生产验证全部通过；T08 自动化自查 23 项通过（三视口溢出、对比度、reduce 动效、CLS、键盘、SSR/CSR 边界）。实现记录见 `implementation/notes/T06-T07-2026-07-29.md`，评审包见 `implementation/notes/t06-t07/T08-REVIEW-PREP.md`。本机 `.env` 的 OSS 配置随后已在 T09 迁移为明确的私有/公开 Bucket 名；仅用于本地启动校验，秘密不入仓。
- 2026-07-29：新增 `implementation/EXECUTION_ROUTING.md`，把 Kimi 的 UI 主责、T06–T07 当前批次、T08 独立门禁及后续前后端交接从产品任务定义中分离；TASKS、STATE、产物索引和 `agent_docs` 入口已同步。
- 2026-07-29：Kimi T04–T05 候选获用户选中并进入主线；`pnpm install --frozen-lockfile`、lint、typecheck、20 项单测、3 项集成测试、19 项 E2E、生产构建与生产验证全部通过。实现与三视口证据见 `implementation/notes/T04-T05-2026-07-29.md`。
- 2026-07-29：完成 foundation、SPEC、PLAN、模型、公开/管理设计、TASKS、产物索引与实施备注的跨文件校准；T01–T53 唯一连续，Markdown 围栏与相对链接检查通过。详细记录见 `implementation/notes/DOCS-REALIGNMENT-2026-07-29.md`。
- 2026-07-29 文档校准轮没有修改 `.vue`、TypeScript、运行配置、数据库或 OSS 资源；随后完成的 T04–T05 只新增公开站视觉实现与类型化夹具，两个 Bucket 的真实权限与配额仍由 EXT-02 验证。

## 下一步

按 `implementation/notes/T09-UI-HANDOFF.md` 由 Kimi 完成 UI-01 至 UI-07；合入后由工程侧重跑全门禁并复核泄漏边界，再决定是否勾选 T09。OQ-119 最迟在 T12 前回答。当前不得进入 T10，也不得提前实现 SQLite、认证或 OSS 业务能力。
