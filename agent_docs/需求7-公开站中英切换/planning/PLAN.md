# 计划：公开站中英切换

## 执行结论

已按确认规格完成主要实现，验证状态见 STATE。先跑通框架与 SSR，再接公开文案和联系分流，价格及 SEO 分别形成可审查的改动；不顺便重构图片系统或后台。

## 执行顺序

### 1. 语言基础与页头入口

- 在 `nuxt.config.ts` 接入 `@nuxtjs/i18n`，采用 `no_prefix`、defaultLocale 中文、浏览器检测 fallback 中文，Vue I18n 缺词回退中文。前序评估的“非支持语言回退英文”及其自定义判断取消。
- 根目录 `i18n/locales/zh-CN.json`、`en.json` 按语义分组，必要的 Vue I18n 配置放 `i18n/i18n.config.ts`。不建通用翻译平台或第二套 store。
- 前序核对的候选版本为 10.6.0；实现时复核实际支持和依赖锁定。先验证现有 Nuxt 4.5.2 / Node 24、直接深链 SSR、页面水合、合法/非法 Cookie 与语言匹配。
- 模块负责语言匹配和 Cookie，切换调用其 API；不自行解析 Accept-Language，不在 onMounted 二次决定首屏语言。
- 实测补充：10.6.0 接受 q=0；增加仅过滤拒绝/非法语言范围的初始化守卫，权重与语言变体匹配仍交给模块。证据见 [实施记录](../implementation/notes/2026-09-12-IMPLEMENTATION.md)。
- 页头复用一个小型语言切换组件：右端图标、点击展开两项、当前项标识、键盘/触控/焦点。优先原生 button 和现有样式，不增加 UI 依赖；若使用 menu 角色，必须完整实现对应键盘行为。
- 窄屏入口与现有菜单按钮并列，处理两个面板的互斥与焦点；管理页及 brandOnly 的使用场景逐一核对，不把公开错误页与后台登录混为同一种语言策略。
- 核对模块语言资源路径是否被管理 Host 白名单阻挡。优先选择满足现有 Host 边界的消息加载方式，只有证明确有需要才调整精确资源路径，不宽泛开放管理 Host。

### 2. 公开文案、状态与 Hero

- 从 `PublicHeader`、`PublicMobileNav`、`PublicFooter`、`public-nav.ts` 和共享公开控件开始，覆盖首页、作品/领养目录与详情、关于/委托、legal/licenses 和错误页面。
- 模板用响应式翻译；导航、返回标签和 SEO 使用计算值/消息键，避免在 setup 初始化时固定译文。共享后台标签保持中文，不全局替换业务枚举文本。
- 英文介绍按实际发布中文事实校对，翻译字段标签但保留作品内容和 alt；不要因切换 locale 更换 fetch key 或重复获取作品。
- `PublicBusinessStatus` 读取当前语言后台标签；空译文回退中文 label。tone 仍为共享状态；修改开放程度时核对各语言文案。UI 语言文件缺词有中文回退。
- `HomeHeroCarousel` 仅调整英文文字层级、居中与字号，保留现有图片和播放状态；现有字体包含候选文案字形，不引入字体依赖。

### 3. 联系分流与表单

- 在后台联系方式中维护唯一 X 地址，公开页通过 DTO 和组件 props 复用；复用 `PublicAction`，不把 X 塞入绑定 QQ 二维码的 CONTACT_PLATFORMS。
- 同步 `HomeBusinessEntries`、`CommissionLead`、委托页底部、关于页和申请直达；联系列表英文展示 X 与真实邮箱。
- `commission/apply.vue` 用语言分支展示英文指引，分支优先于中文政策不可用状态。英文无需挂载可提交表单，事件处理同样避免上传/提交。
- 复用现有页面内 form/file/receiptCode 状态；普通切换不卸载状态所有者，不以 locale 为页面 key。通过最小共享切换约束反映页面 busy，忙碌期间阻止语言切换，避免引入通用脏表单框架。
- 保留中文表单原校验；不增 localStorage 草稿、海外字段、提交 API locale 或通知能力。同步核对条款中的 QQ/X 联系描述。

### 4. 停止公开价格

- 查全 `adoptionItems`、详情、首页聚合等调用链，删除公开金额投影和公开 schema 字段，保持管理模型及数据库不变。
- 移除 `AdoptionCard`、`HomeCurrentAdoptions`、作品详情的价格区域和 SEO 价格文案；只删除无调用的格式化代码，不碰后台复用逻辑。
- 用公开合同检查证明 API/SSR 不含金额，并验证后台数据仍保留。另列图片/文章中的人工内容检查。

### 5. SEO 与错误语言

- 在 public-site repository 复用完整公开快照提供详情路径，sitemap 单次枚举去重，不通过放大 pageSize 或逐页重复生成快照绕过分页。
- 目录 canonical 复用现有 page/query 归一化口径，保留有效 page，去掉第一页冗余、详情来源和 hash；搜索 noindex，不把搜索查询写入 sitemap。
- 在布局/页面集中维护响应式 lang、OG 和 title，保持单个 canonical，避免模块和手写逻辑重复生成标签。
- `server/error.ts` 内部错误请求保留受校验的语言上下文；公开错误页翻译，管理错误固定中文；不转发整份 Cookie，不变更错误信息安全边界。
- 继续使用 SSR/API 共享缓存绕过基线；不对页面开启 prerender/SWR 公共缓存。语言资源缓存和请求行为单独核验。

### 6. 验证与交接

- 每步运行受影响检查；依赖/runtime 改动完成 lint、typecheck、core 与 build，更新第三方依赖声明并检查，使用项目已有测试体系。
- 浏览器至少覆盖 375/390/430、768、1023/1024 与 1440 宽度中的对应布局边界，验证两种语言、透明/普通页头、触控、键盘、文本放大与 reduced motion。保留各媒体初始/当前项，检查 decode、console/network、溢出、LCP/CLS。
- SSR 验证初始深链、无 JS 内容、无语言头、请求头与 Cookie 冲突、错误页和 Host；价格/sitemap 用超过默认分页容量的受控数据验证，避免真实 PII fixture。
- 回写 STATE、TASKS、models、artifacts；实现自检、独立 Review、人工验收、远程 CI、镜像发布和生产部署分别记录。

## 开放问题

无未答技术选型问题。实际模块兼容性、语言资源与 Host、slogan 布局为明确验证任务，不将未运行状态写成已通过；若验证揭示新契约冲突，再记录具体问题。
