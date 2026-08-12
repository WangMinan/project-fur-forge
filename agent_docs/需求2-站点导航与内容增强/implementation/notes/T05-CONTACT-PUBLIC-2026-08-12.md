# T05 · 公开渠道卡片

## 基线与范围

- 基线：`a047406 feat: add official channel QR editor`。
- 在 `/about#contact` 保留现有邮箱操作，以新 `ContactChannelGrid` 展示公开 DTO 中完整的平台渠道。
- 不修改 contact Schema、持久模型或媒体链，不补造真实账号/二维码，不代替 T15/T17 的真实手机扫码与用户验收。

## 实现

- `ContactChannelGrid` 只接收 `PublicOfficialChannel[]`，循环渲染平台 Logo + 名称、READY PNG 二维码和账号；空数组不生成空容器。
- 390、768、1024 以上分别使用 2、3、5 列，卡片使用紧凑边框与 `var(--radius-sm)`，二维码保持稳定 1:1，长账号可断行。
- Logo 为装饰性空 `alt`，旁边保留文字平台名；二维码使用“扫描{平台}官方二维码”的可访问名称。
- `CONTACT_PLATFORM_LOGO_PATHS` 与现有平台名称、顺序放在同一共享元数据文件；公开模板不写账号、二维码 URL 或五段重复业务结构。

## Logo 来源与商标边界

- QQ、QQ群、小红书、Bilibili：路径取自 Simple Icons `16.10.0` 的 `qq.svg`、`xiaohongshu.svg`、`bilibili.svg`；Simple Icons 图形数据以 CC0-1.0 提供。QQ群复用 QQ 标志，不维护重复文件。
- 抖音：取自字节跳动官方 CDN 的 `logo-horizontal.svg` 音符部分，保留原始青、红、黑配色；来源由 Wikimedia Commons `File:Douyin wordmark.svg` 元数据指向该官方文件。
- 静态快照只用于识别本站列出的官方平台渠道，不表示平台赞助或背书。QQ、抖音、小红书、Bilibili 名称与标志仍分别属于其权利人；CC0/公有领域声明不授予商标权。

## 验证

- `pnpm test -- tests/unit/site-content.test.ts`：3/3。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 默认 Chrome 定向 E2E 未进入用例：本机没有仓库配置要求的 Chrome，启动时报 `Chromium distribution 'chrome' is not found`。
- 使用未提交的临时 Edge 配置运行单渠道公开投影：用例主体 `ok`（2.5s），上传保存后公开页只出现完整 QQ 渠道，Logo 路径和 READY PNG `srcset` 正确且图片完成解码。
- 使用同一临时 Edge 配置运行五平台三视口用例：用例主体 `ok`（3.4s），确认固定顺序、Logo、二维码解码、长账号及 390×844 / 768×1024 / 1440×900 的 2/3/5 列与无横向溢出。
- 两次 Edge 命令均在用例输出 `ok` 后卡在 Windows Playwright webServer 清理并最终超时，因此不把命令退出状态记为完整绿灯；正式清理由 T15 再验证。
- `git diff --check`：通过。

## 结论

`PASS WITH FOLLOW-UP`。T05 公开组件与定向浏览器用例主体完成；真实五平台数据、手机扫码、正式 E2E 清理、T16 独立 Review 和 T17 用户验收保持开放。
