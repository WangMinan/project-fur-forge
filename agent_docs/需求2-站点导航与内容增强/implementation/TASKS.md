# 任务清单：站点导航与内容增强

> **角色**：PLAN 的可勾选垂直切片；每个任务应在一个实现会话内完成并留下可运行验证。
> **状态**：实施中；动态方案已锁定，`GATE-01` 与 T01～T09 已完成工程实现，下一项为 T10-B。
> **规则**：方案 B 是唯一动态实现路径；任务勾选只代表其定义完成，不代签后续独立 Review、用户验收或 PR 合并。

## 当前目标

复用现有导航、文案、媒体、筛选和分页能力，完成五组增量功能；不引入 SMTP、通用 CMS、搜索服务或第二套上传/发布链。

## 决策门禁

- [x] **GATE-01 · 锁定最新动态后台方案**：用户于 2026-08-12 选择 B（独立 `/admin/updates` + `updates` 表）；PLAN、STATE、models 与 TASKS 已同步，方案 A 取消且不实施。 _文档决策已完成。_

## 导航

- [x] **T01 · 合并委托导航垂直切片**：修改 `PUBLIC_NAV_ITEMS`，让“委托”复用现有 children 下拉包含“自设委托”和“掉落领养”；验证父项激活、`var(--radius-lg)`、桌面 hover/focus 与移动菜单，路由保持不变。 _复用：`PublicHeader`、`PublicMobileNav`；修改：导航数据与定向测试；不新建组件。实现 `e573760`，E2E 修复 `a38c295`；该 SHA 的 Actions run `31515689322` 已通过 checks/image-build/e2e。实现记录：[`notes/T01-NAVIGATION-2026-08-12.md`](./notes/T01-NAVIGATION-2026-08-12.md)。_

## 联系方式

- [x] **T02 · 五平台 contact 契约与前向迁移**：扩展 contact Schema、管理 DTO、兼容公开 DTO、类型、service 和 `site_content` 持久结构为五个平台记录，保留邮箱并迁移已有 QQ/抖音；复用现有 contact 版本列与 409 行为，不新增第二个版本列。T03 前二维码 SourceSet 为空、不生成新平台卡，既有公开联系投影保持可用。 _修改：现有 contact 分区；新建：一条前向迁移；依赖：无。实现记录：[`notes/T02-CONTACT-CONTRACT-2026-08-12.md`](./notes/T02-CONTACT-CONTRACT-2026-08-12.md)。_
- [x] **T03 · 二维码媒体垂直切片**：在现有上传/资产/派生链增加 `contact_qr` 与 `contact-qr`，限定 `site/contact`、方形 PNG、contain、无裁切、无水印和 READY 才公开；完成私有源图、不可变公开 Key、失败/重试和泄漏测试，并从此阶段开始向公开 DTO 输出 READY 二维码 SourceSet。 _复用：现有 upload/asset/variant 基础设施；修改：媒体 Schema/recipe/runner；不新建上传器。迁移：`0028_requirement_2_contact_qr.sql`；实现记录：[`notes/T03-CONTACT-QR-MEDIA-2026-08-12.md`](./notes/T03-CONTACT-QR-MEDIA-2026-08-12.md)。_
- [x] **T04 · 后台五平台编辑体验**：扩展 `SiteOfficialChannelsCard`，以单一平台数组渲染五行账号与二维码上传/替换/预览，显示不完整原因并保留 contact 局部保存、草稿和 409 对比。 _修改：现有 Card/composable；复用：上传会话、条件 PUT、处理重试与分区 Card；依赖：T02、T03。实现记录：[`notes/T04-CONTACT-ADMIN-2026-08-12.md`](./notes/T04-CONTACT-ADMIN-2026-08-12.md)。_
- [x] **T05 · 公开渠道卡片**：新增 `ContactChannelGrid`，从公开 DTO 横向渲染 Logo/名称、二维码与账号；保留顶部邮箱操作，响应式换行且不出现嵌套卡片或溢出。登记五个平台官方 Logo 来源与商标说明。 _新组件；修改：`about.vue`、共享平台元数据与静态平台资源；依赖：T02、T03。实现记录：[`notes/T05-CONTACT-PUBLIC-2026-08-12.md`](./notes/T05-CONTACT-PUBLIC-2026-08-12.md)。_

## 委托 FAQ

- [x] **T06 · 迁移追加邮件估价模板**：新增前向 SQLite 迁移，以固定 UUID 幂等追加“邮件估价咨询可以按什么格式填写？”及资料清单；不覆盖已有 FAQ，必要时同步提高 FAQ 数量上限、管理提示和 Schema 测试。 _复用：现有 FAQ Card/公开投影；新增：`0029_requirement_2_commission_email_faq.sql` 与定向测试；上限 8 → 9；不创建 SMTP/UI。实现记录：[`notes/T06-COMMISSION-EMAIL-FAQ-2026-08-12.md`](./notes/T06-COMMISSION-EMAIL-FAQ-2026-08-12.md)。_

## 公开搜索

- [x] **T07 · 统一名称包含匹配**：抽取一个 shared 搜索规范化纯函数，回接后台作品筛选，并为 works/adoptions/returns 查询 Schema 与 repository 增加 `q`；在分页前过滤，返图在筛选后按 seed 随机。 _复用并修改：后台搜索规则、公开 repository；新建：共享纯函数；不引入依赖。实现记录：[`notes/T07-PUBLIC-SEARCH-CONTRACT-2026-08-12.md`](./notes/T07-PUBLIC-SEARCH-CONTRACT-2026-08-12.md)。_
- [x] **T08 · 三页共用搜索界面**：新增 `PublicCatalogSearch` GET 表单并接入 `/works`、`/adoptions`、`/returns`；筛选与分页保留 `q`，新查询回第一页，返图新查询不带旧 seed，补无匹配与清除搜索。 _新组件；修改：三个页面、筛选链接与分页参数；依赖：T07。实现记录：[`notes/T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md`](./notes/T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md)。_
- [x] **T09 · 搜索契约与浏览器验证**：覆盖中英文大小写、首尾空白、空值、超长/数组参数、组合筛选、越界页、返图多照片与 seed；确认搜索词不进入 analytics、日志或错误，三视口键盘可用。 _修改：unit/integration/E2E；依赖：T08。实现记录：[`notes/T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md`](./notes/T08-T09-PUBLIC-SEARCH-UI-2026-08-12.md)。_

## 最新动态（方案 B）

- **T10-A · 已取消，不实施**：不增加 `site_content.updates_json`、动态文案 Card 或第二套写入口。
- [ ] **T10-B · 独立动态模型与后台**：新增最小 `updates` 表、repository/service/route 和 `/admin/updates` 管理入口，支持逐条新增、编辑、发布、下架、删除与版本冲突；首版无媒体、slug、详情页或定时发布。 _新模型与管理页面；复用：admin list/form/status patterns；依赖：已关闭的 GATE-01。_
- [ ] **T11 · 最新动态公开页**：建立统一公开 DTO/API 和 `/updates`，只显示 published 记录，按发布时间倒序呈现类型、标题、正文和时间；补 loading/error/empty、安全纯文本、SEO 与 sitemap。 _新页面/API/展示组件；复用：公开页壳和空态；依赖：T10-B。_
- [ ] **T12 · 首页动态摘要与导航入口**：给 home aggregate 增加可降级 `latestUpdates`，首页显示最近 3 条；页面可用后再把“最新动态”加入桌面/移动导航和 analytics route key。 _修改：首页聚合/首页/导航/统计白名单；新建：`HomeLatestUpdates`；依赖：T11。_

## 验证与评审

- [ ] **T13 · 数据与安全回归**：执行新迁移的空库/既有库验证、foreign key/integrity、Schema strict、私有二维码不可读、公开 DTO 无 Key/签名 URL、草稿/下架动态不可见和 Host/Origin/CSRF 回归。 _修改：定向 integration；依赖：T02～T12 中已选择并完成的任务。_
- [ ] **T14 · 质量门禁**：运行相关 unit/integration、`pnpm lint`、`pnpm typecheck`、`APP_ENV=production pnpm build`；不得删除或放宽既有断言。 _复用：现有质量脚本；依赖：T13。_
- [ ] **T15 · 三视口真实浏览器验收准备**：分别以公开 `127.0.0.1` 和管理 `localhost` 验证 390×844、768×1024、1440×900；检查 hover/focus、移动菜单、账号溢出、二维码解码/扫码、搜索组合、动态发布/下架、console/network。 _复用：Playwright 与现有 E2E helper；依赖：T14。_
- [ ] **T16 · 新上下文独立 Review**：核对 SPEC → PLAN → TASKS → 代码、迁移、媒体和公开投影，记录首次 findings 与修复重测；实现者不得代签。 _新 review 记录；依赖：T15。_
- [ ] **T17 · 用户验收与闭环**：用户确认导航、联系方式、模板、搜索和动态发布体验；更新 STATE、ARTIFACTS、models、REVIEW 与任务勾选。 _文档闭环；依赖：T16。_

## 闭环结论

- `GATE-01`、T01～T09 已关闭；下一项为 T10-B。
- PR #10 仍未合入 `main`；T16 独立 Review、T17 用户验收保持未勾选。
