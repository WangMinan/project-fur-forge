# 设计入口

> **状态**：阶段 D 已由用户完成浏览器验收；阶段 E 完成全部 UI/媒体/配置开发并冻结，阶段 F 只在正式环境复验。当前事实以 `STATE.md`、`SPEC.md` 和 `TASKS.md` 为准。

设计只服务一个核心原则：**兽装图片是主体，品牌、文字、符号和管理能力都只做辅助。**

## 当前文档

- [`public-site/DESIGN_BRIEF.md`](./public-site/DESIGN_BRIEF.md)：公开端视觉和交互边界；
- [`public-site/INFORMATION_ARCHITECTURE.md`](./public-site/INFORMATION_ARCHITECTURE.md)：公开端导航、页面和内容层级；
- [`public-site/DESIGN_TOKENS.md`](./public-site/DESIGN_TOKENS.md)：公开端设计 Token；
- [`admin-console/DESIGN_BRIEF.md`](./admin-console/DESIGN_BRIEF.md)：管理端心智模型和交互边界；
- [`admin-console/INFORMATION_ARCHITECTURE.md`](./admin-console/INFORMATION_ARCHITECTURE.md)：管理端导航、页面和状态层级；
- [`admin-console/DESIGN_TOKENS.md`](./admin-console/DESIGN_TOKENS.md)：管理端设计 Token。

历史原型位于 `planning/prototype-v1/`，仅作阶段 A 记录，不得复制为生产 UI。

## 已锁定的公开端结构

- 一级导航：`首页 → 作品展示 → 返图墙 → 自设委托 → 角色领养 → 关于我们`；
- 公开导航条品牌文字固定为 **“有点小狗”**，不带“工作室”；管理端名称和正式主体名称不因此全局替换；
- 首页轮播固定开启、10 秒一张，并尊重 `prefers-reduced-motion`；
- `/returns` 每张返图独立平铺、每次请求随机、无名称和说明文字；点击进入 `/returns/{slug}`；
- 返图以“设定 + 多张照片”为心智模型，关联作品可选，公开资格不依赖作品；
- `/works` 与 `/adoptions` 按发布时间倒序；人工 `sort_order` 只影响首页精选；
- T52-E3 完成后公开页面只消费 CDN 鉴权 URL，不暴露 OSS 原站地址。

## 已锁定的管理端结构

- 作品、返图设定、首页与委托大图、文案、品牌水印是主要对象；
- 阶段 E 增加只读“访问统计”，位置靠后，不能变成首页仪表盘或抢占内容管理；
- 返图列表一行一个设定，编辑页管理多张照片、圆形主图、可选作品关联和设定级私有授权记录；
- 公私预览、发布、下架、失败恢复和删除影响必须用清楚中文说明；
- 不向管理员显示 Object Key、内部任务号、数据库术语或原始中英混杂错误。

## 阶段 E 开发与阶段 F 复验约束

1. 访问统计只回答访问量、热门页面、来源概况等必要问题，不收集指纹或长期唯一访客标识。
2. CDN URL 的签名和变化不应出现在用户界面；浏览器只看到可解码图片。
3. 下架后页面立即移除，管理端应将 CDN 撤销表现为短暂处理中；服务端目标约 5～6 分钟，不承诺客户端已经保存的副本消失。
4. 所有页面、状态和错误反馈在阶段 E 实现并通过受控浏览器测试；阶段 F 只按 [`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 在正式域名复验，不能现场改 UI。

## 设计变更纪律

- 新需求先进入 `SPEC.md`、`PLAN.md`、`TASKS.md`，再调整此目录；
- 不因分析能力增加公开端密度；
- 不预建已取消任务的导航、空页面或通用 CMS；
- 日期记录和历史截图只能说明当时事实，不能覆盖活文档。
