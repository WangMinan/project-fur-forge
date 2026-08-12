# 当前状态

> **最后校准**：2026-08-12。
> **任务权威**：[`implementation/TASKS.md`](./implementation/TASKS.md)。
> **范围边界**：本目录是对“需求1-兽装工作室主页”的增量需求，不覆盖其生产、媒体与安全基线。

## 当前阶段

阶段 4 · 已进入串行实现，动态后台方案锁定为 B，T01～T10-B 已完成；PR 合并、独立 Review 和用户验收尚未完成。

T03 已接入 `site/contact` 私有二维码上传、`contact-qr-v1` 无水印方形 PNG 公开派生、失败重试与 READY 公开投影。

T04 已把 `/admin/site/content` 的 contact Card 扩展为固定五平台账号与二维码编辑，包含浏览器前置校验、上传/替换、私有预览、失败重试、完整性提示、局部保存和 409 草稿保留。

T05 已在 `/about#contact` 增加公开渠道网格，只循环渲染公开 DTO 中账号和 READY 二维码均完整的平台；平台 Logo、固定名称和路径由共享枚举元数据映射。

T06 已新增 `0029_requirement_2_commission_email_faq.sql`，以固定 UUID 向既有 FAQ 追加邮件估价资料模板；FAQ 上限同步从 8 提高到 9，不覆盖已有内容。

T07 已统一后台作品与三个公开 repository 的名称包含匹配；公开 `q` 契约统一为 trim 后 1～100 字，作品/领养在分页前按 `characterName` 过滤，返图按设定名称过滤后再按 seed 随机分页。

T08/T09 已把共用原生 GET 搜索表单接入作品、领养和返图页；筛选与分页保留有效 `q`，新查询清除旧页码/返图 seed，并完成无匹配、非法查询、三视口键盘与浏览器回归。

T10-B 已新增 `updates` 独立表、严格契约、repository/service/管理 API 与 `/admin/updates`，支持逐条草稿、编辑、发布、下架、删除、审计及 409 本地草稿保留；公开页尚由 T11 接续。

当前分支为 `feat/requirement-2`。T01 实现代码 SHA `a38c295` 的 GitHub Actions run [`31515689322`](https://github.com/WangMinan/project-fur-forge/actions/runs/31515689322) 已取得 `checks`、`image-build`、`e2e` 全部成功；该结果只绑定该 SHA，包含 T02 的后续 HEAD 须重新查询远端检查。PR [#10](https://github.com/WangMinan/project-fur-forge/pull/10) 仍为 open，尚未合入 `main`。工程证据不代签 T16 独立 Review 或 T17 用户验收。

## 已确认结论

- 桌面导航已有通用 `children` 下拉结构；“关于我们”的圆角下拉可原样复用。
- `/works`、`/adoptions`、`/returns` 已支持按设定名称搜索、原生 GET 表单、查询保留、搜索空态与清除入口。
- 后台作品列表已有名称/物种包含匹配；后台返图列表已有名称/昵称包含匹配。
- 联系方式已由 `site_content.official_channels_json` 保存固定五平台数组；旧 QQ/抖音完成迁移，二维码媒体链、完整五行管理界面及公开 Logo/二维码卡片已实现，真实账号补齐与手机扫码验收尚未完成。
- 委托 FAQ 已由 `/admin/site/content` 管理，并保存在 `commission_faq_json`；邮件估价标准模板已通过前向 SQLite 迁移追加，不包含 SMTP。
- 项目已有“最新动态”独立数据模型与管理入口；公开页、首页区块和公开导航尚未接入。
- 公开导航已把“自设委托”和“角色领养”合并为“委托”，桌面下拉与移动菜单继续复用现有组件。
- “掉落领养”只是 `/adoptions` 的新导航标签；页面仍同时展示常规领养与展会掉落，没有改变筛选、数据模型或发布语义。

## 当前约束

- 只按 TASKS 串行实施；当前 `GATE-01`、T01～T10-B 已勾选。
- T01 后续文档或代码若产生新 SHA，必须重新查询该 SHA 的远端检查，不沿用 `a38c295` 的结果。
- 不重写历史迁移，只能新增前向迁移。
- 保留现有邮箱联系方式；五个平台卡片是新增，不是删除邮箱。
- 联系方式、二维码和动态正文必须来自后台数据，不在公开页面模板中写死业务值。
- 不引入 SMTP、站内表单、自动报价、富文本 CMS 或新的前端依赖。
- 动态后台固定采用独立 `/admin/updates` 与最小 `updates` 表；方案 A 取消且不实施。

## 已锁定决策

- `PLAN:OQ-001` 已于 2026-08-12 回答：选择方案 B，即独立 `/admin/updates` 与最小 `updates` 表。
- 首版只包含纯文本动态、逐条发布/下架和版本冲突；不包含媒体、富文本、详情页或定时发布。

## 下一步交接

1. 按 T11 实现公开动态投影、API 与 `/updates`；
2. 完成后进入 T12 首页摘要与导航/统计接入；
3. 保持 T16 独立 Review、T17 用户验收开放，不能用早期 SHA 的 CI 结果提前关闭。
