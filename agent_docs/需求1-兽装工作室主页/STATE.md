# 状态

> **角色**：当前需求的状态机与收敛中枢。每轮开始先读本文件，结束后回写。

## 当前阶段

阶段 4 · IMPLEMENTATION 进行中。T01–T25、GATE-06、GATE-07、EXT-01 与 EXT-02 已完成。T23–T25 已全部收口。T26–T27 服务端与前端接线均已落地（现有首页管理固定区块、`/commission`、`/about`、`/contact`），自动化与实现方双 Host/三视口浏览器自测通过；**OQ-120（10 项真实文案）仍开放**，独立 Review 与用户验收尚未执行，因此 T26、T27 保持未勾选，页面不得宣布最终收口。

T21 首次独立审查的 3 个 must-fix 与 1 个 should-fix、用户人工验收发现的管理入口命名、Hero 安全边距、作品筛选视觉、页脚联系方式配置、已保存首页轮播原图预览及启用态预览按钮错配均已修复并验证。用户于 2026-08-02 明确确认 T21 收口；首次 NOT PASS 报告继续保留为历史事实，不虚构第二份独立复审报告。

阶段 C 启动说明见 [`implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md`](./implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md)。
T22 后端、前端与独立 Review 证据分别见 [`implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md`](./implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md)、[`implementation/notes/t19-t22/T22-FRONTEND-2026-08-03.md`](./implementation/notes/t19-t22/T22-FRONTEND-2026-08-03.md) 和 [`implementation/notes/t19-t22/T22-INDEPENDENT-REVIEW-2026-08-03.md`](./implementation/notes/t19-t22/T22-INDEPENDENT-REVIEW-2026-08-03.md)。
T23 工程、T25 服务端交接和本轮前端检查点分别见 [`implementation/notes/t23-t25/T23-ENGINEERING-2026-08-03.md`](./implementation/notes/t23-t25/T23-ENGINEERING-2026-08-03.md)、[`implementation/notes/t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md`](./implementation/notes/t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md) 与 [`implementation/notes/t23-t25/T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md`](./implementation/notes/t23-t25/T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md)。
T23–T25 最终收口见 [`implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md`](./implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md)。
T26–T27 服务端契约见 [`implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md)；前端交接与截图见 [`implementation/notes/t26-t27/T26-T27-FRONTEND-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-FRONTEND-2026-08-04.md)。

## 当前执行分工

- `BACKEND_PRIMARY`：固定由 GPT-5.6 Sol 负责数据库、迁移、共享 Schema、API、安全、OSS、公开投影和运维验证。
- `FRONTEND_PRIMARY`：每个任务开始前由用户按额度在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中选择，不预先锁死整个阶段。
- `REVIEW`：固定由 GPT-5.6 Sol 在新的审查上下文中执行，必须结合浏览器、视觉、真实点击、console/network、截图或 trace；不能只看 pnpm 测试或 E2E 通过数量。
- `ACCEPTANCE`：用户保留最终业务和视觉确认权。
- 完整路由见 [`implementation/EXECUTION_ROUTING.md`](./implementation/EXECUTION_ROUTING.md)。

## main 直推策略

后续所有代码、文档、Review 和修复直接在 `main` 串行完成：

1. 不创建功能分支，不发起 PR；
2. 每次开始前读取远端最新 `main`，确认没有另一个写入 Agent 正在修改同一批文件；
3. 后端 → 前端 → Review 依次提交，一个任务收口后再进入下一任务；
4. 不 force push、不重写已验收历史、不硬 reset 他人提交、不删除或清空 `.env`；
5. 只读分析可以并行，任何写入必须串行。

## 阶段 C 进入状态

- [x] T21 用户验收完成；
- [x] OQ-119 已答；**OQ-120（T26–T27 真实文案批次）开放，阻断页面最终收口**；
- [x] 双 Bucket、30 MB 原图、FFmpeg 私有处理源和真实 OSS 水印链已通过；
- [x] 包括 Logo 在内的素材已登记到 [`materials/MATERIAL-MANIFEST.md`](./materials/MATERIAL-MANIFEST.md)，EXT-01 不再等待外部文件；
- [x] 模型分工、main 直推和浏览器/视觉 Review 方法已锁定；
- [x] T22 范围已明确，不提前实现多图或展会完整矩阵。
- [x] T22 后端、前端、独立 Review 和用户人工验收已收口。
- [x] T23–T25 实现、自动化、独立 Agent Review 与用户人工核验全部收口，三项任务已勾选。

进入阶段 C 时无阻断 OQ；当前 **OQ-120** 阻断 T26/T27 最终收口。最终小图标与部署参数仍分别在 T30、T34/T52 前确认。

## 已完成基础

- 双访问面、公开设计系统和管理视觉基线；
- 双 Bucket、30 MB 永久原图、内嵌 FFmpeg 私有处理源和 OSS 跨桶水印能力；
- SQLite/Drizzle、P0 Schema、唯一管理员认证和真实浏览器认证接线；
- 角色化上传、服务端媒体核验、`recipe-v2`（兼容读取完整 v1 集合）、非领养作品 CRUD、发布/下架和管理端媒体工作流；
- 真实作品详情、作品列表、首页双源轮播、首页管理和站点联系方式投影；
- T22 三用途写入联合类型、完整管理读写、人工排序/精选、历史展会只读兼容、公开精选 6 项上限和用户人工验收；
- T23 服务端设定图/出厂照关系、数量/主图/顺序、按需 recipe、活动 profile 原子切换和 T21 迁移兼容；
- T25 regular adoption 发布检查、公开 adoption 列表和统一详情媒体分区服务端契约；
- T24 管理端设定图/出厂照分区、同源原图与活动水印预览、上传恢复、媒体摘要和分区直达；
- T25 `/adoptions` 横版设定图列表、真实空状态和统一详情两类媒体分区；
- T26–T27 受限固定字段、委托/领养独立营业状态、版本化管理 API、即时公开投影和 ownerContact 泄漏守卫服务端能力；
- T26–T27 前端：首页管理内营业状态/页面内容固定区块、公开 `/commission` `/about` `/contact`、邮件行动与空值隐藏（正式文案待 OQ-120）；
- 当前活动目标 `brand-centered-v2`：可配置 Logo、默认 50% 不透明度；`recipe-v2` 使用 1.6 倍图形，普通图片居中、横版设定图左右双水印，并保留原子全站切换和失败恢复。

T14–T22 的完成状态保持有效。后续扩展不能把既有验收改写为失败，也不能用旧 `brand-standard-v1` 或四角锚点回退当前发布要求。

## 素材与品牌状态

用户已确认当前项目素材均位于 `materials/picture-examples/`。正式清单已经区分：

- 三份 Logo 源与当前浅色/深色组合标衍生物；
- 出厂照、横版领养设定图、返图和首页宽图候选；
- 宣传海报/二维码的使用边界；
- T30 favicon/Touch Icon 与 T51 二次视觉校准职责。

EXT-01 现在只表示“正式素材输入已经到位并完成角色映射”。最终衍生物仍按 T30/T51 生成和验收，但不再阻塞 T22–T29。

## 仍然有效的产品与技术边界

- `works` 是统一聚合，公开详情 canonical 为 `/works/{slug}`；
- 私有原图、私有预处理源和水印 Logo 候选不可公开、不可覆盖；
- 水印不替代访问控制；OSS 是公开 variant、最终格式和水印的唯一像素权威；
- 首页横版/竖版、设定图、出厂照、返图和 Logo 是独立资产角色；
- 公开 DTO、HTML、日志和错误不含作品私有联系人、私有 Key、签名 URL、Session 或水印源；
- 不引入消息队列、媒体 worker、多实例、万能 CMS、访客账号、订单、支付或站内估价；
- 所有非测试配置值由 `.env`、环境变量或不入库配置文件注入；
- 用户触发的长耗时操作必须显示真实、可恢复的服务端进度；
- E2E 是回归手段，不是页面质量的替代品。

## 阶段 C 执行波次

1. **C1 / T22（已完成）**：完整作品字段与约束；
2. **C2 / T23–T25（已完成）**：多图角色、管理快速编辑、常规领养；
3. **C3 / T26–T30（进行中）**：委托、关于/联系、首页完整内容、筛选/重定向、SEO 与品牌图标；
4. **C4 / T31–T34**：备份恢复、安全、性能三视口和 P0 可部署总门禁。

依赖、完成定义和具体边界只以 [`implementation/TASKS.md`](./implementation/TASKS.md) 为准。

## 自动化与 Review 状态

每个任务使用最小充分测试集合：常规执行 lint/typecheck，按改动执行 build 和定向 unit/integration/E2E；完整测试与 `verify:production` 主要放在 T31–T34、跨层高风险修复和明确总门禁。

含 UI、公开投影、媒体或用户操作的任务，GPT-5.6 Sol Review 必须实际启动应用，使用管理 Host 和公开 Host模拟管理员/新访客，检查成功、冲突、失败、恢复、重载、图片解码、横竖请求、三视口、焦点/键盘、溢出和浏览器日志。Review 结论记录为 `PASS / PASS WITH FOLLOW-UP / NOT PASS`。

## 最近决策

- 2026-08-01：T14–T18 用户联合验收完成；随后新增大型居中、可配置 Logo 水印要求。
- 2026-08-02：GATE-07 完成真实 OSS、全站进度、失败恢复、三视口和用户验收。
- 2026-08-02：T19/T20 完成真实公开投影、首页双源轮播、管理端首页和完整工程收口。
- 2026-08-02：T21 首次独立审查 NOT PASS，findings 修复后完成用户人工回归；用户明确确认 T21 收口。
- 2026-08-02：用户确认后续前端模型按额度选择，后端和 Review 使用 GPT-5.6 Sol；Review 必须结合浏览器与视觉真实操作。
- 2026-08-02：用户要求所有开发直接在 `main` 完成，不再切分支。
- 2026-08-02：用户确认包括 Logo 在内的素材已经提供；建立正式素材清单并完成 EXT-01。
- 2026-08-02：阶段 C 准备文档、执行路由和任务边界同步完成，T22 可启动。
- 2026-08-03：T22 后端完成；现有 11 项迁移已满足列与约束，未制造新迁移。
- 2026-08-03：T22 前端接线、独立浏览器 Review 和用户人工确认全部完成；T22 收口，下一任务切换为 T23。
- 2026-08-03：用户调整 C2 后端顺序为 T23 → T25、明确跳过 T24 Vue 管理界面；T23 工程和 T25 服务端交接完成，任务勾选状态保持不变。
- 2026-08-03：用户启动 T24/T25 前端与真实素材全链；实现和自动化自检完成，真实浏览器已创建常规领养并验证缺设定图阻断，但本地素材选择仍等待浏览器扩展文件权限。T23–T25 均未勾选。
- 2026-08-04：根据用户界面反馈，作品发布改为先保存基础信息、设定图与出厂照的当前修改；管理媒体区删除内部配方/存储说明并统一中文用语。自动化与真实管理页回归通过，T23–T25 勾选状态不变。
- 2026-08-04：用户确认 T23–T25 其他功能没有问题；完成“只有设定图不进入 `/works`”和 `recipe-v2` 左右双水印后，按用户反馈把水印从 2.0 倍回调为不重叠的 1.6 倍。正式素材真实 OSS、公开 E2E 与全套自动化通过，用户人工核验记为通过；独立 Review 尚未执行，任务框保持未勾选。
- 2026-08-04：用户确认独立 Agent Review 已完成且 T23–T25 已完成并收口；三项任务勾选，阶段状态、执行路由、评审与产物索引同步切换到 T26–T27 服务端批次。
- 2026-08-04：T26–T27 服务端完成 0012 迁移、严格站点内容/营业状态 Schema、现有首页管理聚合 API、公开 `no-store` 投影和定向/全量验证；未确认文案未写 seed，T26/T27 未勾选。
- 2026-08-04：登记 **OQ-120**（10 项未确认文案）；前端完成首页管理固定区块与三公开页接线、自动化与实现方浏览器自测；公开页对空值整区隐藏，不编造文案；T26/T27 仍未勾选。

## 下一步

当前交接门禁：

1. 用户逐项回答 **OQ-120**（见 `requirements/SPEC.md` §6.7）：委托短说明/估价说明/邮件行动/FAQ、关于事实与制作范围、基本约定、防诈骗、委托与领养营业状态；
2. 在管理端「首页管理」录入已确认正式文案（验证用临时库文案不得当作生产内容）；
3. 新上下文 GPT-5.6 Sol 独立 Review（双 Host、三视口、真实点击、409/空值/泄漏）；用户验收后再勾选 T26、T27；不提前实现 T29/T37。

### OQ-120 缺失清单（阻断最终收口）

| 项 | 字段 |
| --- | --- |
| 委托页短说明 | `commission.intro` |
| 人工逐单估价说明 | `commission.estimateNote` |
| 邮件行动说明 | `commission.emailAction` |
| 委托 FAQ（≤8） | `commission.faqs` |
| 关于页工作室事实 | `about.studioFacts` |
| 关于页制作范围 | `about.makingScope` |
| 基本约定完整纯文本 | `about.basicTerms` |
| 联系页防诈骗文字 | `contact.antiScam` |
| 委托营业状态 tone/标签/说明 | `business_statuses.commission` |
| 领养营业状态 tone/标签/说明 | `business_statuses.adoption` |

已确认可公开：邮箱 `3114559925@qq.com`、QQ `3114559925`、抖音 `to3114559925`；结构性制作范围事实不依赖 OQ。
