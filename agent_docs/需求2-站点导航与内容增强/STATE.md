# 当前状态

> **最后校准**：2026-08-13。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **范围边界**：本目录是对“需求1-兽装工作室主页”的增量需求，不覆盖其生产、媒体与安全基线。

## 当前阶段

阶段 5 · 动态后台方案锁定为 B，T01～T16、用户预验收修正 T15-F1～T15-F4、T17-F1 与 T17-F2 已完成。PR 合并、T16-R1 新 SHA 独立复查和 T17 最终用户签署尚未完成。

T03 已接入 `site/contact` 私有二维码上传、`contact-qr-v1` 无水印方形 PNG 公开派生、失败重试与 READY 公开投影。

T04 已把 `/admin/site/content` 的 contact Card 扩展为固定五平台账号与二维码编辑，包含浏览器前置校验、上传/替换、私有预览、失败重试、完整性提示、局部保存和 409 草稿保留。

T05 已在 `/about#contact` 增加公开渠道网格，只循环渲染公开 DTO 中账号和 READY 二维码均完整的平台；平台 Logo、固定名称和路径由共享枚举元数据映射。

T06 已新增 `0029_requirement_2_commission_email_faq.sql`，以固定 UUID 向既有 FAQ 追加邮件估价资料模板；FAQ 上限同步从 8 提高到 9，不覆盖已有内容。

T07 已统一后台作品与三个公开 repository 的名称包含匹配；公开 `q` 契约统一为 trim 后 1～100 字，作品/领养在分页前按 `characterName` 过滤，返图按设定名称过滤后再按 seed 随机分页。

T08/T09 已把共用原生 GET 搜索表单接入作品、领养和返图页；筛选与分页保留有效 `q`，新查询清除旧页码/返图 seed，并完成无匹配、非法查询、三视口键盘与浏览器回归。

T10-B 已新增 `updates` 独立表、严格契约、repository/service/管理 API 与 `/admin/updates`，支持逐条草稿、编辑、发布、下架、删除、审计及 409 本地草稿保留；T11 已完成对应公开投影与页面。

T11 已新增 published-only 公开 DTO/API、`/updates` 纯文本列表页、受控状态、SEO/canonical 与 sitemap；草稿和下架记录在 SQL 层排除。

T12 已把最近 3 条 published 动态接入可单独降级的 home aggregate；T15-F2 将首页摘要固定在“当前领养”之后、页脚之前，并统一首页模块标题层级；“最新动态”已加入桌面/移动共用导航、页脚及 analytics route key，SQLite 白名单由前向迁移扩展。

T13 已完成空库/既有库迁移、foreign key/integrity、严格 Schema、二维码私有边界、动态公开投影和 Host/Origin/CSRF 定向回归；新增 `0031` 既有事件保留测试，并修正 T06 FAQ 迁移后过期的版本 fixture。

T14 已通过全量 unit 177/177、integration 188/188、lint、typecheck、production build 与生产内容防泄漏守卫；没有删除或放宽既有断言。

T15 已在 Edge 真实进程中完成公开 `127.0.0.1` / 管理 `localhost` 双 Host、390×844 / 768×1024 / 1440×900 三视口验收准备；相关导航、联系配置、动态管理和总体验收 24/24 通过。二维码测试已由普通方形图升级为固定真实 QR PNG，公开派生字节、五平台三视口显示和截图均保留 QR 模块；物理手机扫码仍由 T17 用户验收完成。

2026-08-13 用户预验收四项修正已完成：Hero hover/focus 不再隐式暂停；最新动态移到当前领养后并统一标题层级；二维码接受 PNG/JPEG/WebP、任意比例和 64 px 最小边，使用 FFmpeg Lanczos 自动补白到 640×640 私有适配源；两条 E2E 根因已修复。Edge 相关 spec 47/47、全量 239/239，unit 179/179、integration 189/189、lint、typecheck、production build 均通过。

T16 已在独立上下文对实现基线 `19af5878e4bc5c2b01316f9cb89082b90cce0e46` 完成代码、功能、视觉与文档 Review：首次结论 `NOT PASS`，仅发现 `.design` 信息架构、SPEC 验收证据和进度/Review 文档三组不一致；用户授权后已修复并复查，最终结论为 `PASS WITH USER FOLLOW-UP`。功能与安全未发现新的阻断问题，T17 继续保留真实账号和物理手机扫码验收。

T17 首轮用户验收新增六组明确修复：Hero 自动与手动切换需要平滑过渡；首页入口标题改为“委托投递”；当前领养/最新动态的“查看全部”统一品牌蓝；关于页防诈骗提示回归正文排版；首页与动态页统一圆角动态卡片并增加类型筛选；作品/领养宽屏搜索与筛选同排且三个目录删除搜索框上方冗余可见标题。上述改变不修改媒体、动态数据模型、发布状态或公开 DTO。旧 T16 与 `19af587` Actions 不能代签修复后的新 SHA。

T17-F1 已完成并以应用实现 commit `f3df1be` 推送到 PR #10：Hero 过渡期间 DOM 数量由 1 到 2 再回到 1，计算时长 680 ms；首页/动态页复用白底圆角卡片并保留类型文字；动态页提供五项普通链接筛选；搜索重复标题节点已删除且 `aria-label` 保留；作品/领养桌面工具栏 y 偏差为 0；关于页防诈骗区回归透明正文。Edge 三视口无 console error 或失败请求，证据见 `implementation/notes/T17-F1-USER-REVIEW-FIXES-2026-08-13.md`。

T17-F2 已完成：动态后台并发用例在 A 端 `click()` 后等待表单复位与列表正文更新，再提交 B 端陈旧版本，修复后连续 25/25、相关 12/12 与全量 240/240 E2E 通过；防诈骗提示已提升为关于页同级 section，直接复用正文标题和 64 px 模块间距，390/768/1440 三视口计算样式一致且无 console error/失败请求。根目录 `CLAUDE.md` 已清理旧项目名、旧 SHA/run 和阶段进度，重组为稳定纪律入口，并写明 `git pull --rebase`、Playwright `--` 误跑全量陷阱与 Vue 异步保存的可观察等待规则。证据见 `implementation/notes/T17-F2-E2E-DOCS-ABOUT-2026-08-13.md`。

当前分支为 `feat/requirement-2`。应用实现基线 `19af5878e4bc5c2b01316f9cb89082b90cce0e46` 的 GitHub Actions run [`31628640863`](https://github.com/WangMinan/project-fur-forge/actions/runs/31628640863) 已取得 `checks`、`image-build`、`e2e` 全部成功；该结果只绑定该 SHA，T16 文档修复形成的新 PR HEAD 仍须在合并前重新查询实际检查。PR [#10](https://github.com/WangMinan/project-fur-forge/pull/10) 仍未合入 `main`。工程证据与独立 Review 均不代签 T17 用户验收。

## 已确认结论

- 桌面导航已有通用 `children` 下拉结构；“关于我们”的圆角下拉可原样复用。
- `/works`、`/adoptions`、`/returns` 已支持按设定名称搜索、原生 GET 表单、查询保留、搜索空态与清除入口。
- 后台作品列表已有名称/物种包含匹配；后台返图列表已有名称/昵称包含匹配。
- 联系方式已由 `site_content.official_channels_json` 保存固定五平台数组；旧 QQ/抖音完成迁移，二维码媒体链、完整五行管理界面及公开 Logo/二维码卡片已实现，真实账号补齐与手机扫码验收尚未完成。
- 委托 FAQ 已由 `/admin/site/content` 管理，并保存在 `commission_faq_json`；邮件估价标准模板已通过前向 SQLite 迁移追加，不包含 SMTP。
- 项目已有“最新动态”独立数据模型、管理入口、公开列表页、首页最近三条摘要和公开导航入口。
- 公开导航已把“自设委托”和“角色领养”合并为“委托”，桌面下拉与移动菜单继续复用现有组件。
- “掉落领养”只是 `/adoptions` 的新导航标签；页面仍同时展示常规领养与展会掉落，没有改变筛选、数据模型或发布语义。

## 当前约束

- 只按 TASKS 串行实施；当前 `GATE-01`、T01～T16、T15-F1～T15-F4、T17-F1 与 T17-F2 已勾选，T16-R1 与 T17 保持开放。
- 后续文档或代码若产生新 SHA，必须重新查询该 SHA 的远端检查，不沿用 `19af587` 的结果。
- 不重写历史迁移，只能新增前向迁移。
- 保留现有邮箱联系方式；五个平台卡片是新增，不是删除邮箱。
- 联系方式、二维码和动态正文必须来自后台数据，不在公开页面模板中写死业务值。
- 不引入 SMTP、站内表单、自动报价、富文本 CMS 或新的前端依赖。
- 动态后台固定采用独立 `/admin/updates` 与最小 `updates` 表；方案 A 取消且不实施。

## 已锁定决策

- `PLAN:OQ-001` 已于 2026-08-12 回答：选择方案 B，即独立 `/admin/updates` 与最小 `updates` 表。
- 首版只包含纯文本动态、逐条发布/下架和版本冲突；不包含媒体、富文本、详情页或定时发布。

## 下一步交接

1. 提交并推送 T17-F2 到 PR #10，查询最终 PR HEAD 的远端检查；
2. 由新上下文完成 T16-R1 独立复查；
3. 由用户继续 T17 真实平台账号、实际二维码物理手机扫码和完整体验验收；只有 T17 取得用户确认后才能考虑合并 PR。
