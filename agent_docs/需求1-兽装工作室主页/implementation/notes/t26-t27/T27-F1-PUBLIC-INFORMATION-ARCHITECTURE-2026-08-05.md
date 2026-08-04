# T27-F1 公开信息架构、服务条款与隐私政策增量

> 日期：2026-08-05
>
> 结论：实现方自测完成；T27-F1 保持未勾选，等待新上下文独立 Review 与用户验收。本文不改写 T27 已完成的历史 Review。

## 1. 范围与边界

- 页脚删除业务邮箱和 QQ；版权、服务条款、隐私政策、工信部备案入口置于同一右下信息区。当前没有确认备案号，因此只提供 `https://beian.miit.gov.cn/` 入口，不虚构号码。
- “关于我们”桌面导航使用 CSS `:hover` / `:focus-within` 二级菜单，移动导航直接展开三个子项；未增加交互依赖。
- `/about` 合并原 `/contact` 的邮箱行动、QQ、抖音和防诈骗提示，正文宽度从 44rem 放宽至 52rem；`/contact` 301 到 `/about#contact`。
- 原 `basicTerms` 存储/API 字段继续复用，只把可见名称统一为“服务条款”并投影到 `/service`；保留内部字段可避免无价值的数据搬迁。`/terms` 301 到 `/service`。
- `/privacy` 使用新的受限纯文本字段；参考站只用于页面信息结构校准，没有复制其原文或承诺。默认内容按本站当前事实说明无访客账号、表单、订单、付款、营销或分析 Cookie。
- `/adoptions` 在有角色和真实空状态时均显示独立领养营业状态；委托大图上的状态框从胶囊改为 16px 圆角矩形。
- 未新增万能 CMS、访客账号、表单、统计、支付、备案号字段或依赖。

## 2. 契约与迁移

- `0015_t27_f1_privacy_policy.sql` 为 `site_content` 增加 `privacy_policy`：允许 `NULL`，非空时 1–8000 字且拒绝 `<` / `>`。
- 迁移只在新列为 `NULL` 时写入默认值，并递增现有站点内容版本；不会覆盖管理员后续保存内容。
- 管理 DTO、更新事务、公开安全投影、共享 Zod Schema、Drizzle Schema 和表单校验同步接线；公开响应仍不含内容版本、私有联系人、对象 Key 或签名 URL。
- 当前开发库执行 `pnpm db:migrate`：`applied: 1`、`backupCreated: true`。

## 3. 实现

- 新增共享纯文本长文组件与 `/service`、`/privacy` 页面；每个 `useFetch` 使用独立 key，避免 Nuxt 跨页面 transform 冲突。
- `PublicHeader`、`PublicMobileNav` 复用一个层级导航数据源；`PublicFooter` 不再请求首页联系方式。
- `SiteContentCard` 增加“服务条款与隐私政策”分组及隐私政策字段，保存仍走现有乐观锁与 CSRF 保护链。
- `/about` 直接使用现有公开 `contact` 投影和 `ContactEmailActions`，没有建立第二套联系组件。
- `/adoptions` 复用 `PublicBusinessStatus`；`CommissionLead` 只修改状态容器的圆角 token。

## 4. 自动化

| 命令 | 结果 | 覆盖 |
| --- | --- | --- |
| `pnpm lint` | PASS | Vue/TS/CSS/测试静态规则 |
| `pnpm typecheck` | PASS | 新 DTO、页面与组件类型 |
| `pnpm test` | 102 PASS | 完整 unit；含默认 DTO、`/service` 入口与隐私字段纯文本校验 |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database.test.ts tests/integration/auth-api.test.ts` | 17 PASS | 16 项空库迁移、历史库升级、管理保存与公开安全投影 |
| `pnpm exec playwright test tests/e2e/public-information.spec.ts tests/e2e/public-adoptions.spec.ts` | 首轮 7 PASS / 2 FAIL | 首轮保留发现：768px 隐藏二级菜单造成 20px 溢出；委托圆角用例未种委托首图，选到了无图分支 |
| `pnpm exec playwright test tests/e2e/public-adoptions.spec.ts:141 tests/e2e/public-information.spec.ts:41` | 2 PASS | 二级菜单贴右修复、委托首图显式夹具、三视口无溢出与圆角矩形回归；运行过程包含冷生产构建 |

首次失败没有删除：二级菜单原先相对“关于我们”居中，在 768px 下即使隐藏仍把文档宽度扩大 20px；改为相对父项贴右后，`390×844`、`768×1024`、`1440×900` 均无横向溢出。圆角用例改为显式种入委托首图，避免依赖测试库偶然状态。

## 5. 浏览器与视觉

- 公开端：真实 Chrome 访问 `127.0.0.1`；桌面 Hover/焦点二级菜单、服务/隐私页、页脚、301 跳转、移动导航、领养状态和委托圆角均已实际操作。
- 管理端：隔离管理员在 `localhost` 登录，`/admin/site/content` 同时读出服务条款与隐私政策默认值；API 200，页面无横向溢出。
- 本地开发库迁移后，真实 OSS 领养设定图与委托大图均完成解码，`naturalWidth > 0`。公开/管理生产点检 console 为 0 error / 0 warning；开发点检只有 Nuxt `<Suspense>` info，没有 error/warning。
- 单独重启隔离生产输出时不会恢复 E2E 进程内的临时媒体存储，因此最初两张图片样张无效；随后使用迁移后的本地开发库和真实 OSS 重新采集并覆盖同名截图，未把无效样张作为通过证据。

截图：

- `screenshots/t27-f1-about-subnav-1440x900.png`
- `screenshots/t27-f1-privacy-1440x900.png`
- `screenshots/t27-f1-footer-1440x900.png`
- `screenshots/t27-f1-admin-content-1440x900.png`
- `screenshots/t27-f1-admin-legal-fields-1440x900.png`
- `screenshots/t27-f1-adoptions-390x844.png`
- `screenshots/t27-f1-commission-390x844.png`

## 6. 后续门禁

实现方自动化和浏览器点检不能代替独立 Review。后续新上下文需重新核对代码/迁移/API、双 Host SSR、桌面 Hover 与键盘路径、移动导航、三视口、console/network、真实图片、公开 DTO 泄漏和当前开发库页面；用户保留最终视觉与文案验收权。
