# 评审记录：需求4

> **角色**：记录 SPEC ↔ COPY ↔ design ↔ models ↔ PLAN ↔ TASKS ↔ 当前代码的一致性与风险。
> **状态**：2026-08-19 完成文档级预实施 Review；代码实现后的独立 Review 仍未执行。
> **基线**：`main@913d257281e0b6a7ca60711cc62b78534904c6bd`。

## 1. 评审对象

- 需求4全部文档；
- `agent_docs/_template` 结构与阶段门禁；
- 需求1的 Host、媒体、安全、发布、恢复和部署基线；
- 需求3当前 Hero、works/adoption、commission、默认文案和 licenses 实现；
- 首页与公开 CSS/组件；
- `assets.focal_x/focal_y`、site-display recipe 与 publication operation；
- commission submission/upload Schema 和当前隐私/服务条款；
- Apple、渔屋、万物通行与 Apple Design Skill 的适用边界。

## 2. 已确认结论

- Requirement 4 作为新的活跃增量，只覆盖视觉、文案、申请确认、人工删除和第三方声明；未覆盖的需求1～3基线继续有效。
- `DITE DOG`、表单投递、QQ 私聊优先、邮箱备用、QQ群非默认订单确认在所有文档中一致。
- 首页不是“减少业务”，而是用四幕覆盖完整核心业务并建立不等视觉权重。
- Apple Design Skill 有参考价值，但连续手势/弹簧/动量只在真实直接操控时适用；当前页面揭示和导航无需新增 motion 依赖。
- 当前资产模型和配方已经支持 focal → gravity → recipe identity；新增焦点表会重复，九宫格应复用现有字段。
- 既有首页聚合足以驱动 lead/commission/adoption 四幕，不需要新增只为版式存在的 CMS 表。
- 申请当前缺少成年、政策版本和非接单确认；需求4采用 v2 contract，legacy 不回填假事实。
- “人工清理”已经被明确拆成“人工调度/判断 + 受控 CLI 完整删除”，避免既引入 scheduler 又避免手工 SQL/漏删 OSS。
- accepted 无可靠订单完成时间，禁止按创建时间批量删除；只允许人工确认显式 ID。
- 网站一般条款和 QQ 逐单特别约定分层，没有把 QQ 聊天抓取进系统。
- FFmpeg 当前是服务器内部工具，不描述为向访客分发；ZhuoHei Collage 按免费商用授权资产留档，不误标开源。
- 仓库 Actions/main 规则保持现状；文档没有引入 required check 或新的重型 workflow。

## 3. 预实施 Review 中已修正

1. **避免新建 Hero focal 表**：改为复用 `assets.focal_x/focal_y`，九宫格仅是后台表达层。
2. **避免把首页变成极简空壳**：四幕保留作品、委托和领养完整业务入口。
3. **避免“PC 优先=移动兜底”**：每个组件同步验收 390/430，移动保持原生纵向滚动。
4. **避免永久无条件保留**：改为业务必要期限 + 人工周期复核；不建设自动调度。
5. **避免“人工清理=无删除工程”**：保留 dry-run、强确认、DB/OSS 一体删除和重入。
6. **避免 legacy 假确认**：历史申请字段 NULL，管理端明确历史状态。
7. **避免以服务条款替代逐单确认**：价格、付款、排期和特殊约定继续在官方 QQ。
8. **避免单方著作权兜底**：COPY 拆分角色设定、实体、工艺/版型、照片、维修和商业复刻边界。
9. **避免许可证事实漂移**：生产依赖改为生成，FFmpeg/字体通过人工 registry。
10. **避免动效“为了 Apple 而弹”**：普通过渡使用统一 token；物理手势另行触发设计变更。

## 4. 主要风险与缓解

### 4.1 法务成文仍需经营者确认

风险：文案虽已按真实功能重写，但经营主体、实际付款/取消习惯和争议处理无法由代码仓库证明。

缓解：

- 生产启用前填写真实处理者名称；
- 王旻安/景宸逐段核对 `COPY.md` 与实际流程；
- 必要时取得专业法律意见；
- Agent 不把文档 Review 写成法律合规保证。

### 4.2 人工周期可能漏执行

风险：没有 scheduler 时，责任人忘记月度/半年度复核。

缓解：

- 发布门禁登记责任人和下一次日期；
- CLI 输出脱敏结果；
- STATE/运维交接记录上次/下次执行；
- 用户删除请求不等待批次。

### 4.3 共享 Hero asset 的焦点语义

风险：同一 asset 若被多个 placement/orientation item 复用，却需要不同焦点，asset 级 focal 无法表达。

缓解：

- 首版检测并阻断冲突；
- 建议上传独立横/竖资产；
- 不在本轮静默复制或引入 item focal；
- 真实业务出现后再单独变更模型。

### 4.4 首页大图性能

风险：四幕升级后大图请求、LCP、decode 或 GPU 效果拖慢页面。

缓解：

- Hero 第一帧唯一高优先级；
- 后续幕 lazy/按视口预取；
- 变体尺寸与 sizes 精确；
- 禁止全屏持续 filter/blur/rAF；
- 真实网络测试 LCP/CLS/空闲 CPU。

### 4.5 View Transitions 兼容

风险：共享对象在不同浏览器、back/forward 或重复卡图时出现双图/闪烁。

缓解：

- 渐进增强；
- 同页 name 唯一；
- reduced-motion/不支持时普通 crossfade；
- 先通过原生导航、焦点和历史门禁，再启用共享对象。

### 4.6 默认文案迁移保护

风险：历史默认全文存在多个版本，错误匹配可能覆盖管理员真实改写或漏更新旧文案。

缓解：

- 精确 allowlist；
- 测试每个已知历史全文和任意管理员文本；
- 未命中进入人工 Review；
- 不使用宽泛 `replace()` 清理法律文本。

### 4.7 删除与备份

风险：数据库和当前对象已删除，但旧备份仍含申请；灾备恢复后数据重新出现。

缓解：

- 政策明确受限备份轮换；
- 备份不作日常查询；
- 恢复后开放服务前重跑删除/保留复核；
- 不创建新的长期 PII 导出。

## 5. 后续评审点

- Schema/迁移是否只前向且兼容 legacy；
- intake metadata/config 缺失时是否 fail closed；
- 409 是否保留表单和可用 upload；
- CLI 是否精确覆盖 current/version/delete marker/preview；
- production notices 是否真的覆盖 lockfile 与实际静态资产；
- 九宫格是否使用目标裁切预览；
- 首页真实图片是否达到“一屏一重点”而不是换皮卡片；
- 390/430 输入法、触控和 reduced preferences；
- 服务条款与工作室实际 QQ 确认流程；
- 生产处理者配置、人工清理责任人与下次日期。

## 6. 预实施放行结论

文档之间未发现阻止进入 T04 的未决矛盾。放行仅表示需求与计划可以实施，不表示代码、法务、视觉、生产或数据清理已经通过。

## 7. 子代理/资料评审记录

- 2026-08-19：使用 GPT-5.6 Pro 进行代码与跨文档只读 Review，按当前 main 修正焦点复用、首页聚合、legacy、删除和许可证边界。
- 2026-08-19：阅读 `emilkowalski/skills` Apple Design Skill，采纳即时反馈、空间一致性、克制材料、可中断直接操作、排版和 reduced preferences；排除无真实手势的强行 spring。
- 代码实现后的 independent Reviewer：待执行。
