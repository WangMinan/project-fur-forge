# T17-F4 · 目录节奏与领养命名统一

> **日期**：2026-08-14
> **任务**：T17-F4
> **起点**：`6b51627`
> **状态**：PASS WITH FOLLOW-UP；本记录不代签 T16-R1 独立复查、T17 用户验收或 PR 合并。

## 用户反馈与契约

1. `/works` 的图片需要上移，使搜索/筛选区到首张图片的距离与 `/returns`、`/adoptions` 一致；
2. 公开导航的“掉落领养”改为“设定领养”，并与 `/adoptions` 的公开标题保持一致。

本轮只修改公开命名、作品网格顶部节奏和相应测试/文档。不改变 `/adoptions` 路由、常规领养/展会掉落筛选、数据模型、发布规则、卡片图片比例或历史实施记录。

## 实施前证据

使用本地 Chrome 在 1440×900 测量控件区边界与首个内容容器边界：

| 页面 | 实施前距离 |
| --- | ---: |
| `/works` | 64 px |
| `/adoptions` | 32 px |
| `/returns` | 32 px |

根因是 `.works-grid` 使用 `margin-top: var(--space-8)`，另外两页已使用 `var(--space-6)`。因此本轮复用已有 token，不增加新的间距值。

## 实施

- `PUBLIC_NAV_ITEMS` 与 `/adoptions` 的 H1、SEO、错误状态和分页可访问名称统一为“设定领养”；
- `.works-grid` 顶部间距改用 `var(--space-6)`；作品列数、网格行距和图片 3:4 比例保持不变；
- `public-search.spec.ts` 新增跨页几何用例，固定种入作品、领养和返图，在三个视口逐页比较控件区底部与首个内容容器顶部；
- `auth-api`、`contact-qr-media`、`public-site-contracts` 三处测试不再写死迁移前版本，改为读取迁移后的真实分区/首页版本后继续验证 CAS。

## GitHub Actions 失败与修复

上一提交 `6b51627` 的 quality run [`31719392357`](https://github.com/WangMinan/project-fur-forge/actions/runs/31719392357) 在 integration 阶段 3 项失败：

1. auth API 仍预期各内容分区版本为 1；
2. contact QR 上传仍以 `expectedVersion=1` 创建会话；
3. 首页媒体契约仍预期总版本为 3。

`0033_requirement_2_visitor_copy.sql` 会按实际命中的五个默认文案分区分别递增分区版本和兼容总版本，因此新库得到 contact/commission/about/terms/privacy 版本 2、首页兼容版本 8 是正确行为。修复只消除测试对历史迁移数量的耦合，没有改动版本检查或放宽 409 冲突。

## 验证

- 首次跨页 E2E 因新夹具 slug 未满足 `e2e-public-` 前缀守卫返回 400；修正夹具名后 1/1 通过；
- 相关公开 E2E：37/37；
- 远端原失败的三个 integration spec：18/18；完整 integration：190/190；
- unit：179/179；lint、typecheck、`APP_ENV=production pnpm build`、`pnpm run verify:production` 通过；
- 本地 Chrome 截图：[`t17-f4/screenshots/`](./t17-f4/screenshots/)；作品、领养、返图首图间距均为 32 px，首图完成解码且页面无横向溢出。

结论为 **PASS WITH FOLLOW-UP**：工程实现与本地门禁完成；新 PR HEAD 的 GitHub Actions、T16-R1 独立复查和 T17 用户验收仍须分别完成。
