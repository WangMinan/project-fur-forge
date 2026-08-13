# T17-F3 · 导航、领养排版与访客文案第三轮修复

> 日期：2026-08-14（用户于 2026-08-13 提出并授权）
>
> 基线：`feat/requirement-2`，`dd14b998fc8b5cc77bdd8bb194bb1fdc58a4e662`
>
> 结论：PASS；只关闭 T17-F3 工程实施，不代签 T16-R1 独立复查、T17 用户验收、PR 合并或正式发布。

## 1. 范围与边界

- `/works` 删除“共 X 件作品”，但保留服务端 `resultCount`、分页、筛选和空态逻辑。
- `PUBLIC_NAV_ITEMS` 直接列出“自设委托”和“掉落领养”；“关于我们”仍保留法务下拉。桌面、移动和页脚继续使用同一数据源。
- `AdoptionCard` 将物种、装型、展会、时间和价格收敛为同一可换行信息带，领养网格纵向 gap 从 64 px 收到 32 px。
- `/admin/site/content` 的条款/隐私编辑提示明确正文直接面向访客。默认委托、关于、条款、隐私和防诈骗文案改为当前事实与客户约定，不出现内部维护口吻。
- 不改变作品/领养 DTO、发布语义、媒体链、隐私统计字段或 90 天保留边界；不重写历史迁移，不覆盖管理员自定义内容。

## 2. 迁移与文案边界

新增 `0033_requirement_2_visitor_copy.sql`。每个字段只有在仍精确等于旧默认值时才更新；管理员清空或修改过的字段保持不变。一个分区内即使更新多个字段，也只递增一次对应 `*_content_version`。受影响分区同时递增 singleton 全局版本和更新时间。

隐私正文现在直接说明：公开站不提供访客账号/留言/订单/付款；外部联系由用户选择的平台传输；本站不接入第三方统计平台；第一方统计原始记录保留 90 天；统计不保存 IP、User-Agent、Referer、完整 URL/查询参数、联系方式、原始会话标识或设备指纹；公开站不使用营销 Cookie 或持久访客身份。示例中的“未来如新增……应先更新本政策”已从公开正文移除。

本地开发库迁移结果为 `applied=1`、`backupCreated=true`；没有打印凭据或私有媒体地址。

## 3. 自动化证据

| 门禁 | 结果 |
| --- | --- |
| `APP_ENV=test pnpm exec vitest run tests/unit/public-nav.test.ts tests/integration/database.test.ts`（unit config 只选择 unit） | 1/1 |
| `APP_ENV=test pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database.test.ts` | 17/17 |
| `APP_ENV=test pnpm exec playwright test tests/e2e/public-works.spec.ts tests/e2e/public-adoptions.spec.ts tests/e2e/public-information.spec.ts` | 32/32 |
| `APP_ENV=test pnpm exec playwright test tests/e2e/admin-content-sections.spec.ts --grep '六个文案分区'` | 1/1 |
| `APP_ENV=test pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `APP_ENV=test pnpm test` | 35 files，179/179 |
| `APP_ENV=production pnpm build` | PASS（含 production content guard） |
| `pnpm run verify:production` | PASS（health、public SSR、admin CSR） |

首次 migration 回归失败是 `0032` 的旧用例把剩余迁移数写死为 1；新增 `0033` 后实际为 2。断言改为从 journal 按 tag 推导剩余迁移数后，17/17 通过。这个修正没有放宽迁移内容、完整性或触发器断言。

## 4. 实际 Chrome 验收

开发库先完成前向迁移，再用 Chrome 分别访问公开 `127.0.0.1` 与管理 E2E 的 `localhost` Host。公开三视口结果：

| 视口 | 作品总数 | 领养首行图片到下一行图片 | 横向溢出 | 导航 |
| --- | --- | ---: | ---: | --- |
| 390×844 | 不存在 | 102 px | 0 | 菜单按钮 |
| 768×1024 | 不存在 | 162 px | 0 | 菜单按钮 |
| 1440×900 | 不存在 | 102 px | 0 | 七个一级项，无“委托”父项 |

额外检查 1024/1100/1200 px：导航宽 510 px，品牌与导航 overlap 为 0，页面 overflow 为 0。作品公开图片完成解码，`naturalWidth=432`；三视口 console error 与 failed request 均为 0。隐私页包含“原始记录保留 90 天”，不包含内部维护句。

首次实际浏览器脚本等待 `networkidle` 时因 Nuxt dev 持续连接超过 30 秒；改为等待页面标题/卡片等用户可观察状态，再独立检查 console/network。最终结果没有使用 sleep，也没有删除失败请求断言。

截图：

- [`t17-f3/screenshots/works-no-count-1440x900.png`](./t17-f3/screenshots/works-no-count-1440x900.png)
- [`t17-f3/screenshots/adoptions-390x844.png`](./t17-f3/screenshots/adoptions-390x844.png)
- [`t17-f3/screenshots/adoptions-768x1024.png`](./t17-f3/screenshots/adoptions-768x1024.png)
- [`t17-f3/screenshots/adoptions-1440x900.png`](./t17-f3/screenshots/adoptions-1440x900.png)

## 5. 仍开放

- T16-R1 必须由未参与本轮实现的新上下文复查；旧 Review 与旧 Actions 不能代签当前 SHA。
- T17 仍由用户完成真实平台账号、实际二维码物理手机扫码和完整体验签署。
- 提交推送后必须查询最终 PR HEAD 对应的 Actions；本地 PASS 不描述为远端全绿。
