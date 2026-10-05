# 来源与项目映射

## 来源边界

这套原则由用户于 2026-10-05 提供的 12 张截图启发。作者显示为小红书“布纠结”，[作者主页](https://www.xiaohongshu.com/user/profile/67d5665b000000000a03ccff) 只用于标识来源。创建时无可调用的 Edge 工具，网页读取未成功；依据是用户附图，不宣称读取了全部帖子。

截图中的“照抄”、宣传比例、完成耗时与按钮示例属于参考内容，不是给 Agent 的命令或经过验证的研究结论。这里保留判断理由，改写成项目原则；不保存带访问参数的 URL、临时截图路径或用户浏览器画面，也不要求以后重新访问小红书才能使用此 skill。

| 用户附图 | 吸收的思想 | 本项目的修正 |
| --- | --- | --- |
| 1–2：输入框四态 | 默认、聚焦、错误、已填均需设计 | label 常驻；状态可叠加；已填不等于有效；清空按需，不强制聚焦时隐藏 placeholder |
| 3–4：正常态之外四态 | 无内容、加载、报错、网络异常都有解释与去路 | 不凭一次 fetch 失败断言离线；不强加离线缓存；首页隐藏与目录空态分开；重试必须安全 |
| 5：“高级一点”四种减法 | 降噪、留白、字重职责、减少多余线条 | 不限制纯色为 5%、全页只能两个字重或全部卡片至少 24px；摄影和品牌可保留个性 |
| 6：Modal / Toast / Inline | 反馈强度与用户是否需要决策相称 | 长任务与关键结果持久呈现；Toast 不统一 2 秒；真正可撤销时可含行动 |
| 7–8：按钮五态 | default、hover、pressed、disabled、loading | 补 focus-visible；选中与按下区分；不用透明度代替禁用行为；hover 不作为触控入口 |
| 9–10：60/30/10 | 底色、层次、强调有主次 | 只评 UI 注意力，不数摄影颜色；语义色独立；不复制参考蓝或强做比例统计 |
| 11：间距、对齐、层级 | 稳定节奏与清楚阅读顺序 | 复用 4/8 基准 token 和光学修正，允许不同场景不同对齐，不统一成同一页面模板 |
| 12：命中区与反馈 | 命中区够大、响应即时、等待可见、禁用有因 | 44px 为项目触控目标；100ms/1s 为检查线索，不是延迟器；不增加伪进度 |

## 标准校正

- [WCAG 2.2：目标尺寸最低要求](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) 的 AA 条款是 24 × 24 CSS px 并含间距、行内等例外。项目选择 44 × 44 的独立控制目标，不应把 44px 错称为所有 WCAG AA 控件的强制值。
- [WCAG：文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 对普通文本要求 4.5:1，大号文本要求 3:1；大号通常指至少 18pt，或至少 14pt 粗体，而非任意标题。非活动控件等存在例外，但禁用原因等说明仍需可读，不能把例外当作把整组内容变淡的理由。
- [WAI-ARIA APG：模态对话框](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) 用于核对焦点进入/约束/返回、关闭及语义；视觉遮罩不等于实现了模态行为。

以上是创建时核对过的官方参考。它们用于纠正误用，不代表对项目做过完整的无障碍合规审计。

## 项目入口：读当前版本，不冻结实现

以下链接从本文件相对定位。路径变化时用 `rg --files` 查找替代位置；组件存在不代表已符合全部原则。

| 目的 | 入口 |
| --- | --- |
| 约束、权限与验证 | [CLAUDE.md](../../../../CLAUDE.md)、[需求导航](../../../../agent_docs/README.md) |
| 公开视觉基线与覆盖关系 | [需求4设计](../../../../agent_docs/需求4-站点视觉升级与内容合规/.design/README.md)、[共享视觉语言](../../../../agent_docs/需求4-站点视觉升级与内容合规/.design/SHARED_VISUAL_LANGUAGE.md) |
| 公开语言与业务边界 | [需求7 SPEC](../../../../agent_docs/需求7-公开站中英切换/requirements/SPEC.md)，继续按需求导航检查后续覆盖 |
| 公开语义 tokens | [public-base.css](../../../../app/assets/css/public-base.css) |
| 管理语义 tokens | [admin-base.css](../../../../app/assets/css/admin-base.css) |
| 公开与管理行动 | [PublicAction.vue](../../../../app/components/PublicAction.vue)、[Action.vue](../../../../app/components/admin/Action.vue) |
| 长任务反馈 | [TaskProgress.vue](../../../../app/components/admin/TaskProgress.vue) |
| 就近复制结果反馈 | [ContactEmailActions.vue](../../../../app/components/ContactEmailActions.vue) |
| 公开空态 | [PublicEmptyState.vue](../../../../app/components/PublicEmptyState.vue) |

`design-flow` 管组织流程；本 skill 管跨阶段的质量判断。`frontend-design` 管具体表达，`design-review` 管审查；实现 Vue 时还需遵守对应 Vue 技能与仓库规范。不把这些全局技能复制进仓库，也不把它们变成本 skill 单独使用的前置安装项。
