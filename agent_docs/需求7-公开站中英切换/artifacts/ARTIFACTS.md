# 产物索引

## 文档产物

| 产物 | 路径 | 状态 |
| --- | --- | --- |
| 当前状态 | [STATE](../STATE.md) | 本地已实现，自动验证完成 |
| 地基 | [foundation](../foundation/README.md) | 已整理 |
| 规格 | [SPEC](../requirements/SPEC.md) | 已整理用户决策与验收契约 |
| 计划 | [PLAN](../planning/PLAN.md) | 已实施，验证见 STATE |
| 任务 | [TASKS](../implementation/TASKS.md) | 按实际实现/验证勾选 |
| 模型 | [models](../models/README.md) | 已实施；新增 0054 文案翻译迁移 |
| 实施备注 | [notes](../implementation/notes/README.md) | 初始化记录 |
| 评审 | [REVIEW](../review/REVIEW.md) | 文档自检，独立实现评审未执行 |

## 用户提供的参考图

原图来自本任务 2026-09-12 用户附件，按原字节复制；仅参考按钮形式和位置，不引入参考站的其他语言、价格、作品、品牌或页面布局。

| 资料 | 用途 |
| --- | --- |
| [渔屋语言图标](references/yuwu-language-button.png) | 右上角紧凑语言图标 |
| [渔屋展开面板](references/yuwu-language-menu.png) | 展开形式和当前项；本项目只有中文/English |
| [本站位置标注](references/dite-dog-header-position.png) | 本站页头“关于我们”右侧的位置 |

## 前序讨论与技术依据

- [i18n只读评估](chatgpt-conversation://6aa26943-891c-83e8-81ed-250bc66fcc25)：讨论背景。最终契约以本任务用户补充与 SPEC 为准，尤其 fallback 已统一中文。
- [Nuxt I18n 路由策略](https://i18n.nuxtjs.org/docs/guide/) 与 [浏览器检测](https://i18n.nuxtjs.org/docs/guide/browser-language-detection)：前序评估核对 no_prefix、Cookie/浏览器匹配，具体接入版本实现时再验证。
- [Google 自适应语言页面](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages)、[分页规范](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)：单 URL 的索引限制与各分页独立 canonical。

## 本地实现证据

- [实施与验证记录](../implementation/notes/2026-09-12-IMPLEMENTATION.md)：接入问题、翻译来源、Linux 声明及验证范围。
- [窄屏语言菜单](screenshots/language-menu-390.png)、[桌面语言菜单](screenshots/language-menu-1440.png)。
- [窄屏英文 Hero](screenshots/english-hero-390.png)、[桌面英文 Hero](screenshots/english-hero-1440.png)。

截图为受控测试内容，用于布局与交互核验，不代表生产照片的人工视觉验收。CI、镜像和生产部署未执行。

## 后台配置扩展

- [后台配置交接](../implementation/notes/2026-09-12-ADMIN-COPY.md)
- [生产迁移说明](../implementation/PRODUCTION-MIGRATION.md)
- [390px 后台](screenshots/admin-copy-390.png)、[768px 后台](screenshots/admin-copy-768.png)、[1440px 后台](screenshots/admin-copy-1440.png)

- [390px 委托分段导航](screenshots/admin-commissions-390.png)、[1440px 委托分段导航](screenshots/admin-commissions-1440.png)

- [英文委托 390px](screenshots/commission-english-390.png)、[英文委托 1440px](screenshots/commission-english-1440.png)：标题/媒体不重叠的合成媒体布局证据。
