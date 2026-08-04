# 状态

> **角色**：当前需求的状态机与收敛中枢。每轮开始先读本文件，结束后回写。

## 当前阶段

阶段 4 · IMPLEMENTATION 进行中。T01–T27、GATE-06、GATE-07、EXT-01 与 EXT-02 已完成。T26-F1/T27-F1 于 2026-08-05 完成新上下文独立 Review，结论 `PASS WITH FOLLOW-UP`；两项保持未勾选，等待用户验收。**OQ-120 已由用户整批确认，0014/0015 已登记正式默认值。**当前按用户授权进入 T28–T34。

T21 首次独立审查的 3 个 must-fix 与 1 个 should-fix、用户人工验收发现的管理入口命名、Hero 安全边距、作品筛选视觉、页脚联系方式配置、已保存首页轮播原图预览及启用态预览按钮错配均已修复并验证。用户于 2026-08-02 明确确认 T21 收口；首次 NOT PASS 报告继续保留为历史事实，不虚构第二份独立复审报告。

阶段 C 启动说明见 [`implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md`](./implementation/notes/P0-C-STAGE-READINESS-2026-08-02.md)。
T22 后端、前端与独立 Review 证据分别见 [`implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md`](./implementation/notes/t19-t22/T22-BACKEND-2026-08-03.md)、[`implementation/notes/t19-t22/T22-FRONTEND-2026-08-03.md`](./implementation/notes/t19-t22/T22-FRONTEND-2026-08-03.md) 和 [`implementation/notes/t19-t22/T22-INDEPENDENT-REVIEW-2026-08-03.md`](./implementation/notes/t19-t22/T22-INDEPENDENT-REVIEW-2026-08-03.md)。
T23 工程、T25 服务端交接和本轮前端检查点分别见 [`implementation/notes/t23-t25/T23-ENGINEERING-2026-08-03.md`](./implementation/notes/t23-t25/T23-ENGINEERING-2026-08-03.md)、[`implementation/notes/t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md`](./implementation/notes/t23-t25/T25-BACKEND-HANDOFF-2026-08-03.md) 与 [`implementation/notes/t23-t25/T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md`](./implementation/notes/t23-t25/T24-T25-FRONTEND-CHECKPOINT-2026-08-03.md)。
T23–T25 最终收口见 [`implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md`](./implementation/notes/t23-t25/T23-T25-CLOSURE-2026-08-04.md)。
T26–T27 服务端契约见 [`implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-BACKEND-HANDOFF-2026-08-04.md)；前端交接见 [`implementation/notes/t26-t27/T26-T27-FRONTEND-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-FRONTEND-2026-08-04.md)；独立 findings、修复、浏览器与安全证据见 [`implementation/notes/t26-t27/T26-T27-INDEPENDENT-REVIEW-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-INDEPENDENT-REVIEW-2026-08-04.md)。
T26-F1 工程交接与低分辨率追加设计见 [`implementation/notes/t26-t27/T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md`](./implementation/notes/t26-t27/T26-F1-COMMISSION-HERO-CHANGE-2026-08-04.md)；用户下班后补验步骤见 [`implementation/notes/t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md)。
T27-F1 实现、迁移、自动化、浏览器与截图证据见 [`implementation/notes/t26-t27/T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md`](./implementation/notes/t26-t27/T27-F1-PUBLIC-INFORMATION-ARCHITECTURE-2026-08-05.md)。

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
- [x] OQ-119、OQ-120 均已答；OQ-120 正式默认值由 0014 迁移只补空字段或缺失状态，不覆盖管理员已有内容；
- [x] 双 Bucket、30 MB 原图、FFmpeg 私有处理源和真实 OSS 水印链已通过；
- [x] 包括 Logo 在内的素材已登记到 [`materials/MATERIAL-MANIFEST.md`](./materials/MATERIAL-MANIFEST.md)，EXT-01 不再等待外部文件；
- [x] 模型分工、main 直推和浏览器/视觉 Review 方法已锁定；
- [x] T22 范围已明确，不提前实现多图或展会完整矩阵。
- [x] T22 后端、前端、独立 Review 和用户人工验收已收口。
- [x] T23–T25 实现、自动化、独立 Agent Review 与用户人工核验全部收口，三项任务已勾选。
- [x] T26–T27 实现、独立 Review 与 findings 修复已收口；本轮 USER_GATE 为否，两项任务已勾选。
- [ ] T26-F1 委托页独立大图及持久低分辨率适配已通过新上下文独立 Review；等待用户验收。
- [ ] T27-F1 公开信息架构与政策页增量已通过新上下文独立 Review；等待用户验收。

当前无阻断 OQ。最终小图标与部署参数仍分别在 T30、T34/T52 前确认。

## 已完成基础

- 双访问面、公开设计系统和管理视觉基线；
- 双 Bucket、30 MB 永久原图、内嵌 FFmpeg 私有处理源和 OSS 跨桶水印能力；站点大图低分辨率适配已完成实现方自测；
- SQLite/Drizzle、P0 Schema、唯一管理员认证和真实浏览器认证接线；
- 角色化上传、服务端媒体核验、`recipe-v2`（兼容读取完整 v1 集合）、非领养作品 CRUD、发布/下架和管理端媒体工作流；
- 真实作品详情、作品列表、首页双源轮播、大图管理和站点联系方式投影；
- T22 三用途写入联合类型、完整管理读写、人工排序/精选、历史展会只读兼容、公开精选 6 项上限和用户人工验收；
- T23 服务端设定图/出厂照关系、数量/主图/顺序、按需 recipe、活动 profile 原子切换和 T21 迁移兼容；
- T25 regular adoption 发布检查、公开 adoption 列表和统一详情媒体分区服务端契约；
- T24 管理端设定图/出厂照分区、同源原图与活动水印预览、上传恢复、媒体摘要和分区直达；
- T25 `/adoptions` 横版设定图列表、真实空状态和统一详情两类媒体分区；
- T26–T27 受限固定字段、委托/领养独立营业状态、版本化管理 API、即时公开投影和 ownerContact 泄漏守卫服务端能力；
- T26–T27 前端历史基线：独立“文案配置”、公开 `/commission` `/about` `/contact`、邮件行动、空值隐藏、委托背景引导区，以及作品查找/筛选/分页和内页标题统一；T27-F1 已在不抹除历史的前提下把联系合并进 `/about`，新增 `/service` `/privacy`，并把 `/contact`、`/terms` 改为兼容重定向；
- T27-F1 页头关于圆角二级导航、紧凑页脚右下法律/署名区、52rem 关于/政策正文、后台 FAQ 按钮间距、隐私政策受限字段、领养状态公开呈现与委托状态圆角矩形已完成实现方自测；
- 当前活动目标 `brand-centered-v2`：可配置 Logo、默认 50% 不透明度；`recipe-v2` 使用 1.6 倍图形，出厂照及首页/委托页竖版大图使用单个居中水印，横版设定图及首页/委托页横版大图使用左右双水印；设定图全部响应式宽度按 960 px 基准同比缩放，并保留原子全站切换和失败恢复。

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
- 2026-08-04：用户追加视觉跟进：`/works` 标题与 `/commission` 同尺度；作品管理移除可见 caption/表格外框并增加查找、筛选、分页；委托页改为单张双源背景引导；后台新增独立“文案配置”入口。参考渔屋只提炼布局和信息组织，OQ-120 候选稿不自动入库。
- 2026-08-04：上述跟进已完成实现方自测；`pnpm typecheck` / `pnpm lint` / `pnpm build` 、列表单测与定向 Playwright 通过，新增五张视觉证据。该结论不代替新上下文独立 Review。
- 2026-08-04：用户要求删除关于页的防御性隐私说明，并确认基本约定中的逐单报价、邮件协商周期与付款比例、工作室著作权和签收后一年非人为损坏保修原则；OQ-120 候选稿据此修订为 v2，未写入数据库，T26/T27 状态不变。
- 2026-08-04：T26–T27 新上下文独立 Review 初始登记 2 个 must-fix，修复后键盘复测补充 1 个 should-fix；共享异步数据键、未经确认的公开事实和跳转焦点均完成最小修复。自动化、SSR/Host/DTO/私有 Bucket、真实图片、三视口和公开端键盘复测通过，结论 `PASS WITH FOLLOW-UP`；按本轮 USER_GATE 否的授权勾选 T26/T27。
- 2026-08-04：用户启动 T26-F1：委托页大图不再复用首页第一项；“首页管理”增加首页/委托页大图 Tab，复用既有双源上传、排序与水印发布。公开委托页保持单张背景，只取独立集合排序第一项；无图隐藏且不回退首页。
- 2026-08-04：T26-F1 文档、迁移、管理/公开契约、复用式 Tab、实现方自动化和浏览器自测完成；任务保持未勾选，等待新上下文独立 Review 与用户验收。
- 2026-08-04：用户追加 T26-F1 大图尺寸策略：低于横版 `1920×1080` / 竖版 `1080×1920` 不再直接阻断保存；页面提示清晰度风险，启用前确认后由内嵌 FFmpeg Lanczos 生成私有适配源。该处理不宣称 AI 恢复细节，原图保留，作品媒体不扩展。
- 2026-08-04：T26-F1 低分辨率追加实现与实现方验证完成：尺寸不足可保存、取消无副作用、确认后生成可追溯私有适配源并继续既有 OSS 发布；unit 102、integration 95、定向真实 Chromium 1 项及 lint/typecheck/build 通过。任务仍待统一的独立 Review/用户验收。
- 2026-08-04：用户确认 OQ-120 全部正式文字；新增 0014 初始化迁移，只补空内容和缺失营业状态，并应用到当前开发数据库。管理入口统一改名为“大图管理”，`#commission-details` 增加固定页头滚动偏移；返图墙仍按 T35–T36 在 P1 建设。
- 2026-08-05：用户启动 T27-F1：页脚删除重复联系方式，版权/服务条款/隐私政策/ICP备案入口合并到右下信息区；关于与联系合并，服务条款和隐私政策单独成页，“关于我们”增加桌面 Hover/键盘与移动展开二级导航；委托状态框改圆角矩形，领养页直接显示领养营业状态。隐私政策允许参考渔屋的信息组织，但默认文案必须按本站真实功能重新起草并进入受限 `site_content` 字段。
- 2026-08-05：T27-F1 契约、0015、管理/公开 UI 和实现方验证完成；首次 E2E 暴露 768px 隐藏二级菜单造成 20px 横向溢出，改为贴右对齐后回归通过。当前开发库已应用 0015 且创建迁移备份；任务不勾选，等待独立 Review/用户验收。
- 2026-08-05：用户反馈 `/adoptions` 在浏览器选中 1600/2400 px 设定图时水印仍偏小。根因是 `design-sheet` 响应式输出复用固定像素水印；修复按既有 960 px 设定图基准等比缩放，并通过新配置摘要沿现有原子切换链重建公开图，不改写 T25 历史收口结论。
- 2026-08-05：用户追加 T27-F1 视觉收口：关于二级导航改为完整圆角矩形；文案配置 FAQ 新增按钮与最后一项增加间距；页脚压缩高度，并追加链接至 `https://github.com/wangminan` 的 `Design by Arktouros` 彩蛋署名。
- 2026-08-05：T25 水印比例缺陷与 T27-F1 视觉追加完成实现方验证：当前开发库新活动 profile 真实 OSS 生成/核验 60/60，公开领养三视口通过；页头/页脚真实浏览器通过，定向生产 Playwright 4/4 PASS。T27-F1 仍等待独立 Review/用户验收。
- 2026-08-05：T26-F1/T27-F1 新上下文独立 Review 在基线先冻结 3 个 must-fix、3 个 should-fix，修复复核又发现 1 个陈旧 E2E 契约；持久 UPSCALE 操作、文档冲突、0015 版本、持续风险、移动菜单焦点/inert、重复链接和页脚断言均已关闭，最终 `PASS WITH FOLLOW-UP`。用户验收与真实 OSS 安全前缀新写入仍保留为独立边界。

## 下一步

当前交接：

1. 按 TASKS 串行完成 T28–T34，不提前实现 T35/T37 等 P1 能力。
2. T26-F1、T27-F1 与 T34 最终勾选等待用户验收；Review 初始 findings 保持可追溯。
3. 用户可按 [`T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md`](./implementation/notes/t26-t27/T26-T27-HOME-MANUAL-ACCEPTANCE-2026-08-04.md) 补验 T26-F1/T27-F1；该 follow-up 不回退已通过的工程 Review。
