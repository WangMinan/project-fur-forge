# T21 人工验收 UI 回归修复

> 日期：2026-08-02
> 范围：管理入口命名、首页 Hero 安全边距、作品筛选视觉、公开页脚联系方式配置、已保存轮播原图预览。
> 状态：实现、完整门禁与用户验收完成；用户于 2026-08-02 明确确认 T21 收口。

## 1. 验收反馈与根因

1. 管理端导航顺序和短标签与用户使用顺序不符；
2. `HomeHeroCarousel` 的 `padding` 引用了未定义的 `--space-16`，CSS shorthand 整条失效，导致工作室英文名、中文名、口号和主行动左边距归零，主行动也贴住 Hero 底边；
3. `WorkFilterBar` 引用了未定义的 `--public-border-subtle`、`--public-border-strong`、`--public-surface-strong`，当前项因此成为透明底白字，视觉上像“全部用途/全部装型”被隐藏；T20 页面同时遗漏了作品内容容器的横向安全边距；
4. 页脚官方联系方式原先来自视觉 fixture；T19/T20 收口删除 fixture 时把已确认的官方 QQ/邮箱一并删除，并把“作品私有联系人不得公开”错误扩大为“任何官方联系信息不得公开”。

## 2. 修复

- 管理入口最终固定为“首页管理 → 全局水印 → 作品管理 → 修改密码”，导航、页面一级标题和浏览器标签页标题保持一致；
- Hero 仅使用现有设计 Token，恢复 16 / 24 / 57.6 px 三视口左安全边距和 96 px 主行动底距；
- `/works` 恢复响应式内容边距，两个筛选组改为原生链接组成的分段选择框：组容器、当前按钮均有边界和轻量底部阴影；
- 官方邮箱与 QQ 最初由项目常量恢复；第二轮反馈后改为 `site_content` 版本化字段，由首页设置 API 统一维护并进入公开首页投影，页脚不再读取硬编码常量；作品私有联系人仍不进入公开 DTO、列表、详情、日志或 URL；
- 删除本轮触达路径内全部未定义设计 Token 引用，没有增加依赖或新组件。

## 3. 首页底部空置结论

当前开发库 `GET /api/public/v1/works/featured` 返回 `items: []`、`resultCount: 0`。`FeaturedWorks` 按 T20 契约在没有精选作品时隐藏整个轨道，因此 Hero 与 Footer 之间只剩 Footer 的 `--space-9`（96 px）区块间距。这是当前数据与阶段下的预期结果，不是图片或接口加载失败；T22 才提供完整精选维护字段，T28 才补齐首页后续内容顺序，本轮不提前实现。

## 4. 验证

- `pnpm lint`：通过；
- `pnpm typecheck`：通过；
- `pnpm test`：69 / 69 通过；
- `pnpm test:integration`：77 / 77 通过；
- 定向 Playwright：4 / 4 通过，覆盖管理导航顺序、首页 SSR/官方联系方式、作品筛选视觉、作品列表 SSR/私有字段边界；
- `pnpm build`：通过，生产内容守卫通过；
- `pnpm verify:production`：通过，health、公开 SSR、管理 CSR 正常；
- 390×844、768×1024、1440×900：Hero 左边距分别为 16 / 24 / 57.6 px，主行动底距均为 96 px，首页与作品页横向溢出均为 0；
- 新截图保存在 `C:\Users\wangm\.codex\visualizations\2026\08\02\019fc29b-f563-70d1-a8bd-a18e3ebda575\`，没有覆盖 T19/T20 历史证据。

| 截图 | SHA-256 |
| --- | --- |
| `home-390x844.png` | `79E3EB355B26491F98918C50F7C96E5A535019BBE562F80196821AB4CCDEB01B` |
| `home-768x1024.png` | `6C063C1BC7D8E0F916E1AC6B444A7F0345C5347B3558C2C9FBC643F03E6B6742` |
| `home-1440x900.png` | `C608AFDB3BAC3FD78B6F7F9FF643AA6226CAB3131041465528B0508B2E4275DD` |
| `works-390x844.png` | `0EB88501433229FD49E20F8DDEAB732D6FC82CF91F2FD177AB9BDA4B0E6B1CAD` |
| `works-768x1024.png` | `D72F900B241C3150D0876380BF85332542F22CED4E9D1C230ECFB5F35014231E` |
| `works-1440x900.png` | `F11F116DF23D4773E267A6FA5A519D7DCF60BD6C26CCB479F04D419A2C3C8D32` |

隔离 E2E 构建仍会报告 `/commission`、`/adoptions`、`/returns`、`/about`、`/contact` 尚无路由；这些页面属于后续任务，本轮不越过 T21 修复。

## 5. 第二轮人工反馈

- `/admin/site/home` 原先只把新上传、尚未重载的 object URL 放进比例框；服务端返回的已保存资产 DTO 只有 assetId 与尺寸，组件没有复用已经存在的同源鉴权原图接口，因此刷新后退回灰色占位。现已在横版/竖版框中直接读取 `/api/admin/v1/media/assets/{assetId}/preview`，并保留原图尺寸摘要；浏览器仍不接收私有 Object Key、Bucket 地址或签名 URL。
- 下方“活动水印预览”保持原有真实烘焙链路；它用于检查当前活动水印，不由上述无水印原图预览代替。
- `/api/public/v1/works/featured` 的仓储查询、公开 API、SSR 首页消费和无结果隐藏均已在 T20 实现。当前管理作品创建/编辑尚无 `featured` 写入字段，这是 TASKS 已明确归入 T22 的阶段边界；因此当前开发库作品默认 `featured = false`，接口返回空数组不是读取实现遗漏。本轮不越过未通过的 T21 提前实施 T22。
- 本轮增量验证：`pnpm lint`、`pnpm typecheck` 通过；`tests/e2e/admin-home.spec.ts` 11 / 11 通过，覆盖已保存横竖原图真实解码、活动水印预览、启用态不显示预览按钮、停用后恢复按钮、启停、排序与三视口无溢出；`tests/integration/public-site-contracts.test.ts` 3 / 3 通过，精选读取投影保持正常。
- 完整首页管理 E2E 刷新了 `implementation/notes/t19-t22/t19-t20/screenshots/admin-home-{390x844,768x1024,1440x900}.png`，三张均显示已保存原图，不出现灰色占位。
- 后续现场复核确认，唯一轮播项为已启用状态，而服务端的活动水印预览契约只接受未启用项；页面却始终渲染预览按钮，并把“请先停用”的 409 统一翻译为版本/水印变化。现已让未启用项保留按钮，已启用项改为“当前公开图已使用活动水印”，不再发出必然失败的请求；该修复不需要数据库迁移或服务重启。

## 6. 第三轮人工反馈

- 四个管理入口改为完整名称，并用浏览器用例逐项验证导航文字、一级标题和标签页标题一致；
- `site_content` 新增 `contact_email`、`contact_qq`，迁移保留原有官方值；首页设置 PUT 继续使用同一 `expectedVersion`，邮箱和 QQ 分别在共享 Schema 中校验；
- `/api/public/v1/home` 返回当前联系方式，`PublicFooter` 复用 `public-home` 数据键，首页不重复建立设置链，其他公开页也能 SSR 输出最新值；
- `pnpm lint`、`pnpm typecheck`、`pnpm build` 通过；69 / 69 单元、77 / 77 集成、管理端认证/全局水印/首页管理/导航一致性/布局定向 E2E 70 / 70 通过；本地开发库应用第 11 个迁移并自动生成迁移前备份，三视口截图确认字段和完整导航无横向溢出。

## 7. T21 最终收口

- 用户于 2026-08-02 明确确认“我确认 T21 收口”，`ACCEPTANCE` 权限已完成最终签收；
- `TASKS.md` 据此勾选 T21，下一任务切换为 T22；
- 首次独立审查的 NOT PASS 结论及 findings 原样保留为历史事实；本记录不虚构未实际形成的第二份独立复审报告；
- 最终完成态由首次审查、findings 修复证据、人工验收回归、完整自动化门禁和用户明确确认共同构成。
- 最终发布前门禁全部通过：`pnpm lint`、`pnpm typecheck`、69 / 69 单元测试、77 / 77 集成测试、166 / 166 E2E、`pnpm build` 与 `pnpm verify:production`。
