# 计划：站点视觉升级与内容合规

> **角色**：把需求4规格翻译成有序、可执行的技术计划。
> **状态**：2026-08-19 已定稿；所有计划 OQ 已答。
> **原则**：先把真实信息收集和删除边界做正确，再进行视觉升级；不让首页改版掩盖隐私缺口。

## 1. 执行结论

需求4按五个发布单元推进：

```text
A 内容/隐私地基
  → B 人工删除与第三方声明
  → C 设计系统与 Hero 焦点
  → D 首页四幕与对象连续性
  → E 全站文案、独立 Review、用户验收和发布
```

A/B 可以先独立发布，避免现有表单继续使用过时隐私政策。C/D 必须使用真实图片和真实浏览器迭代，不由纯代码评审代签。E 才完成需求4闭环。

## 2. 执行顺序

### A. 内容与隐私地基

#### A1. Schema expand

- 新增 `site_content.privacy_controller_name`。
- 为 `commission_submissions` 增加 intake contract version 与确认字段。
- 旧申请保持 legacy/NULL，不伪造成年或隐私确认。
- 先 expand 支持 v1/v2，再由新代码显式写 v2；稳定后用 contract 将默认值收口为 2。
- 更新 Drizzle schema、迁移 journal、unit/integration fixture 和 DTO。
- expand/contract 均在 fresh、当前既有库副本、重复执行和回滚演练中验证。

#### A2. 公开 intake metadata

- 增加 `/api/public/v1/commission-intake-meta` 或等价投影。
- 只返回处理者公开身份、最低年龄、当前隐私/申请告知版本和页面链接。
- 未配置真实处理者名称/邮箱时返回明确不可用状态；管理端给出配置缺失，不把假值公开。
- 版本来自现有 `privacy_content_version` 与代码常量。

#### A3. 提交确认

- 在申请页 SSR 获取 intake metadata。
- 增加三个未预勾选确认，保留 field-level 错误与键盘可达性。
- 提交 API 要求字面量 true 和版本一致。
- 版本 stale 返回 409，保留表单与图片；不消费有效 upload session。
- 成功显式记录 v2 contract 和确认时间。
- 证明部署后不再新增 v1，再执行 intake contract。
- 真实 QQ/邮箱/年龄口径同步页面、测试和错误文案。

#### A4. 目标默认文案

- 按 `requirements/COPY.md` 更新 about、commission、anti-scam、privacy、terms。
- 前向迁移只替换 NULL/空值/精确历史默认值。
- 管理员真实改写进入人工 Review，不自动覆盖。
- `/privacy` 顶部结构化显示处理者、邮箱、版本和更新时间。
- `/service` 保持普通网页一般条款，不把申请 checkbox 伪装成订单合同。

### B. 人工删除与第三方声明

#### B1. 保留复核 CLI

- 扩展既有 `commission:cleanup-expired-uploads` 的运维说明，或统一到 `commission:retention`。
- 提供：
  - `review-expired-uploads`
  - `review-submissions`
  - `delete --submission-id`
  - 受限 `delete --status rejected --before`
- 默认 dry-run、掩码输出、固定强确认、严格参数组合。
- accepted 禁止仅按日期批删；pending 只列出人工复核。
- CLI 可从容器 one-shot operation 运行，不需要常驻进程。

#### B2. 精确删除实现

- 在 DB 关系存在时获取 exact private object keys。
- 阻断任何异常外部引用。
- 删除当前对象、版本/delete marker（若启用）、PRIVATE variants/preview/pending。
- 验证不可达后事务删除 submission/session/asset/非必要 note。
- 已缺失对象视为重入成功，其它失败保留可重入状态。
- 审计日志脱敏；测试覆盖只删目标申请、不碰作品和其它申请。
- 形成手工月度/半年度 SOP，不建设 scheduler。

#### B3. 第三方声明生成

- 使用 `pnpm licenses list --prod --json --long` 作为 npm 生产依赖事实。
- 编写确定性生成脚本，将 JSON/TXT 产物写入仓库或构建输入目录。
- 人工 registry 覆盖 FFmpeg、Noto Serif SC、ZhuoHei Collage。
- `/licenses` 从生成清单渲染，不保留手工 `RUNTIME` 数组为唯一真理。
- 生成/校验命令复用现有 checks 或本地验证；不新增 workflow/job/required check。
- 未知许可证、缺失 NOTICE 或生成差异时失败并提示人工修正。

### C. 设计系统与 Hero 焦点

#### C1. 设计 token 收敛

- 清点公开 CSS 中硬编码 duration/easing/distance/shadow/radius。
- 建立 feedback/content/media/page 五类 motion token。
- 移除或替换 HomeHero/HomeMotionReveal 等 620/680ms 局部常量。
- 新建/凝练公开行动组件：primary、secondary、text。
- 保持管理端样式独立，不把品牌动效扩散到后台表单。

#### C2. Header/Footer 与材料

- 降低桌面导航每项明显浮起/阴影，保留 active、hover、focus。
- 首页 Header 只使用一层轻量材料；内页保持稳定 sticky。
- 增加 reduced-transparency/contrast 渐进样式。
- Footer 调整节奏与留白，不改变备案、法务或设计署名。
- 真实 Hero 图上验证对比，不只测纯色 fixture。

#### C3. 九宫格焦点

- 复用 `assets.focal_x/focal_y`。
- 未启用 Hero item 管理 Card 增加九宫格与目标比例预览。
- 通过集合 expectedVersion/CAS 更新。
- 已启用 item 返回稳定冲突，指引先下架/替换。
- 修改后清理过期 preview/站点变体；重新发布生成新 identity。
- 不新增 crop 表，不增加拖拽/缩放编辑器。
- 横版/竖版与首页/委托四集合分别测试。

#### C4. 动效基础

- 保留 Nuxt `pageTransition`，不回退到 layout 外层 Transition。
- `HomeMotionReveal` 改为统一 token、较少错峰、移动简化。
- 建立 `prefers-reduced-motion`、transparency、contrast 的统一 helper/CSS。
- active 反馈在 pointer down 可见；长任务状态不延迟。
- 不引入 motion 库，除非实现过程中出现无法用 CSS/WAAPI满足的连续手势，并先写设计变更记录。

### D. 首页四幕与对象连续性

#### D1. 首页骨架

- `index.vue` 保持单聚合请求。
- 调整顺序为 Hero → Lead Work/精选 → Commission Chapter → Adoption Chapter。
- 每幕独立空态，不因次级数据错误整页 500。
- 页面各幕使用语义 section 和正确 heading 层级。

#### D2. 品牌 Hero

- 调整控制器视觉权重和真实图片局部对比保护。
- 保持横竖独立、10 秒、暂停、hidden、reduced-motion。
- PC 优先完成视觉，390/430 同步完成重排。
- 不一次 eager 加载全部大图。

#### D3. 代表作品

- 第一精选映射为 lead；剩余精选进入次级轨道/网格。
- Lead 图按媒体方向完整展示，不强制海报化裁切。
- 复用“名称 · 物种”与详情链接。
- 移动端主要任务不依赖横向滚动；提供“查看全部作品”。

#### D4. 自设委托幕

- 用现有 commission entry source/variant 建大幅非对称章节。
- 移除 21:9 描边业务卡视觉。
- 只保留一个主 CTA，QQ/邮箱信息留给委托页/关于页。
- 状态、短说明和行动层级清楚。
- 与 `/commission` 使用同源图和相近裁切。

#### D5. 设定领养幕

- 使用当前 available 前两项和既有 cover/design sheet 回落。
- 桌面一大一小/同高有主次；移动纵向。
- 一项/零项受控。
- adopted 不进入此幕，但精选逻辑不受影响。

#### D6. 共享对象渐进增强

- 先保证普通导航、返回、锚点和焦点正确。
- 再为 lead work、commission image、adoption image 添加 View Transition。
- 不支持/减少动效时回退 crossfade。
- 保证同一页面 `view-transition-name` 唯一；分页/搜索变化不产生残留名。
- 逐帧检查白闪、双图、布局跳动和历史导航。

### E. 全站收口与发布

#### E1. 读者/法务一致性 Review

- 对比 `COPY.md`、数据库迁移、页面固定文案、SEO、测试 fixture。
- 删除邮件优先、永久保存、网站不收集设定图、半装带尾巴等旧文案。
- 工作室确认真实经营主体、QQ、邮箱、保修和逐单流程。
- 如需专业法律意见，由工作室另行取得；Agent 不代签。

#### E2. 完整验证

- lint、typecheck、unit、integration、production build、verify。
- 涉及公开 UI 结构时运行完整 E2E，避免只跑 focused spec 漏回归。
- 真实浏览器六档视口、真实手机、键盘、输入法、reduced preferences。
- 媒体焦点/发布/清理、申请版本、PII 泄漏、删除重入和 notices drift 测试。
- 性能检查 LCP/CLS/图片请求/空闲 CPU。

#### E3. 独立 Review 与用户验收

- 独立 Reviewer 只读审查代码、迁移、删除工具、PII、许可证和视觉回归。
- 修复后重跑受影响与完整门禁。
- 王旻安/景宸人工确认首页四幕、真实图裁切、动效、移动端和文案。
- 不由实现 Agent 代签。

#### E4. 生产发布

- 先备份并验证恢复。
- 执行 expand migration，填写真实处理者名称，生成 notices。
- 部署兼容新旧申请的镜像。
- smoke：privacy/service/licenses/apply/home/admin。
- 对隔离/合成申请执行 retention dry-run + delete 演练。
- 记录月度上传清理、半年度申请复核责任人和下次日期。
- 发布后监控错误、图片变体、提交 409、私有预览和页面性能。

## 3. 技术决策

- **不增加首页 CMS 模型**：现有 aggregate + featured order 足以驱动四幕，减少运营负担。
- **焦点复用 asset 字段**：现有 recipe 已将 focal 纳入 gravity 和 identity；只补可理解 UI。
- **只编辑未启用 Hero 焦点**：避免为热变更引入新的跨对象原子切换复杂度。
- **不新增 motion 依赖**：当前主要是滚动揭示、媒体切换和页面连续性，CSS/WAAPI足够；Apple Design Skill 是原则，不是安装清单。
- **View Transitions 渐进增强**：不阻塞基线，不使用 polyfill。
- **确认版本独立**：隐私 policy version + 固定 application notice version，避免普通委托介绍编辑改变法律语义。
- **legacy 明示**：历史申请不回填假确认。
- **人工调度、工具执行**：人的业务判断决定何时删；CLI 保证 DB/OSS 删除完整。
- **accepted 不批量按时间删**：网站没有订单完成时间，禁止猜测。
- **声明生成但不新增 required check**：保持用户确认的仓库治理与流水线成本。
- **免费商用与开源分层**：ZhuoHei Collage 作为授权资产，Noto/包按许可证，FFmpeg按实际内部使用边界。
- **网站一般条款 + QQ 特别约定**：不建设站内合同，但网页必须公平说明一般边界。

## 4. 开放问题（OQ）

无（所有计划 OQ 已答）。
