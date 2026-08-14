# 设计入口

> **状态**：阶段 D 已由用户完成浏览器验收；阶段 E 完成全部 UI/媒体/配置开发并冻结，阶段 F 只在正式环境复验。当前事实以 `STATE.md`、`SPEC.md` 和 `TASKS.md` 为准。

设计只服务一个核心原则：**兽装图片是主体，品牌、文字、符号和管理能力都只做辅助。**

## 当前文档

- [`public-site/DESIGN_BRIEF.md`](./public-site/DESIGN_BRIEF.md)：公开端视觉和交互边界；
- [`public-site/INFORMATION_ARCHITECTURE.md`](./public-site/INFORMATION_ARCHITECTURE.md)：公开端导航、页面和内容层级；
- [`public-site/DESIGN_TOKENS.md`](./public-site/DESIGN_TOKENS.md)：公开端设计 Token；
- [`public-site/FIGMA-COLLABORATION.md`](./public-site/FIGMA-COLLABORATION.md)：免费 Starter 单文件协作、公开素材边界、设计师交付与实施授权纪律；
- [`admin-console/DESIGN_BRIEF.md`](./admin-console/DESIGN_BRIEF.md)：管理端心智模型和交互边界；
- [`admin-console/INFORMATION_ARCHITECTURE.md`](./admin-console/INFORMATION_ARCHITECTURE.md)：管理端导航、页面和状态层级；
- [`admin-console/DESIGN_TOKENS.md`](./admin-console/DESIGN_TOKENS.md)：管理端设计 Token。

历史原型位于 `planning/prototype-v1/`，仅作阶段 A 记录，不得复制为生产 UI。

## 已锁定的公开端结构

- 当前分支一级导航：`首页 → 作品展示 → 返图墙 → 自设委托 → 设定领养 → 最新动态 → 关于我们`；该增量由 [`../../需求2-站点导航与内容增强/requirements/SPEC.md`](../../需求2-站点导航与内容增强/requirements/SPEC.md) 的 FR-01/FR-09 覆盖，`/commission` 与 `/adoptions` 路由不变；
- 公开导航条品牌文字固定为 **“有点小狗”**，不带“工作室”；管理端名称和正式主体名称不因此全局替换；
- 首页轮播固定开启、10 秒一张，并尊重 `prefers-reduced-motion`；
- 首页“最新动态”固定在“当前领养”之后、页脚之前；首页各模块标题使用同一字号、字重、行高和标题基线；
- `/returns` 每张返图独立平铺、每次请求随机、无名称和说明文字；点击进入 `/returns/{slug}`；
- 返图以“设定 + 多张照片”为心智模型，关联作品可选，公开资格不依赖作品；
- `/works`、`/adoptions`、`/returns` 复用同一 `PublicCatalogSearch`，只按当前目录的设定名称搜索；输入、提交和清除控件使用同一字体尺度与圆角，不建设全站搜索；
- 三个目录从搜索/筛选区底部到首张图片统一使用 `var(--space-6)`（32 px），窄屏换行不能改变该段间距；
- `/works` 与 `/adoptions` 按发布时间倒序；人工 `sort_order` 只影响首页精选；
- `/works` 固定每页 12 件、`/adoptions` 固定每页 8 个，页底复用同一套编号分页；当前筛选有结果时单页也显示分页栏并禁用两端；筛选链接回到第一页，分页链接保留筛选；
- `/works` 页名与筛选条保持紧凑，不用大段空白拆断作品浏览节奏；
- T52-E3 完成后公开页面只消费稳定的 ESA 媒体 URL，不暴露原始 OSS 地址或私有 Object Key。

## 已锁定的管理端结构

- 作品、返图设定、最新动态、首页与委托大图、文案、品牌水印是主要对象；
- “动态管理”位于“返图管理”之后，使用独立 `/admin/updates` 逐条维护纯文本动态；不混入 `site_content` 或预建富文本 CMS；
- 阶段 E 已增加只读“访问概览”，位置靠后，不能变成首页仪表盘或抢占内容管理；
- 返图列表一行一个设定，编辑页管理多张照片、圆形主图、可选作品关联和设定级私有授权记录；
- 公私预览、发布、下架、失败恢复和删除影响必须用清楚中文说明；
- 低分辨率设定图允许保存和发布；设定图区与发布区持续提示 FFmpeg 只做尺寸适配、不恢复细节、完整原图保留；
- 低分辨率出厂照同样允许保存和发布；出厂照区与发布区使用同一诚实提示，不显示像素不足的硬阻断；
- 竖版出厂照的公开详情、3:4 作品卡和后台公开水印预览使用相同的相对水印尺寸；横版详情与设定图版式保持各自既定规则；
- 大文件私有预处理、Hero/设定图/出厂照适配和处理重试都显示同一套 FFmpeg 动态等待进度、当前阶段与已等待时间；静态图没有可信连续百分比时不伪造数值，不能只禁用按钮；
- 不向管理员显示 Object Key、内部任务号、数据库术语或原始中英混杂错误。

## 阶段 E 开发与阶段 F 复验约束

1. 访问统计只回答访问量、热门页面、来源概况等必要问题，不收集指纹或长期唯一访客标识。
2. ESA URL 的签名和变化不应出现在用户界面；浏览器只看到可解码图片。
3. 下架后页面立即移除，管理端应将 ESA purge 表现为处理中；完成时间由目标环境实测，也不承诺客户端已经保存的副本消失。
4. 所有页面、状态和错误反馈在阶段 E 实现并通过受控浏览器测试；阶段 F 只按 [`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 在正式域名复验，不能现场改 UI。

## 设计变更纪律

- 新需求先进入 `SPEC.md`、`PLAN.md`、`TASKS.md`，再调整此目录；
- Figma 的 `Current UI` 只记录指定 SHA 的现状，`Proposed` 只作为候选；未经用户确认并同步活文档，不得据此修改实现；
- 不因分析能力增加公开端密度；
- 不预建已取消任务的导航、空页面或通用 CMS；
- 日期记录和历史截图只能说明当时事实，不能覆盖活文档。
