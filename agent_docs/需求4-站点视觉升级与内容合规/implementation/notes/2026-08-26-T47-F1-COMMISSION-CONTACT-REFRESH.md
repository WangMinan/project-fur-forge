# T47-F1 Handoff · Commission / Contact Refresh

## Completed

- 重写三段委托默认文案；0048 只替换空值或精确历史默认，管理员自定义文案保留。
- 退役全局领养营业状态、`limited` 委托状态与独立 `detail`；委托只保留开放/暂停和单条公开标签。
- 引入 `jsqr@1.4.0`，使用既有 FFmpeg 将 READY 官方二维码转为 RGBA 后解码；只存储精确 `https://qm.qq.com/q/*` 短链。管理端不接受手填 `qrLinkUrl`。
- `/commission` 与 `/about` 复用 `ContactChannelList`；QQ/QQ 群按钮白底等大、QQ Logo 前缀，fine pointer hover/focus 显示二维码，触控端有直达链接时只保留按钮。
- About 联系区改为白底；复制邮箱保持按钮文案不变，使用绝对定位的 status/alert 浮层反馈。
- 代表作品的选择、服务端校验、公开投影与前端上限统一提高到 5；READY 竖版出厂照资格不变。
- `CLAUDE.md`、STATE、TASKS、SPEC、COPY、models、design 与 foundation 已同步。

## Locked Decisions

- QQ 直达链接是二维码的服务端派生值，不是新的管理端手填字段。
- 同一二维码资产复用上次解析结果（包括 `null`）；换图才重新解析，避免普通文案保存反复读 OSS/跑 FFmpeg。
- 解析失败时不猜测 URL；页面保留官方二维码作为扫码兜底。
- 公开领养仍以作品自身 `available/adopted` 状态决定投影；本任务只退役独立的全局营业状态。

## Validation

- `pnpm check:fast`：54 files / 319 tests 通过，含 ESLint、Nuxt typecheck、数据库/投影/鉴权/QR 回归。
- `pnpm test:smoke`：11/11 通过。同步修正一条与当前契约冲突的旧断言：`/adoptions` 只展示 `available`，不展示 `adopted`。
- `pnpm build`：Nuxt client/SSR/Nitro 和 production content guard 通过。
- `pnpm notices:check` 与 `git diff --check` 通过；`jsqr` MIT 声明已进入生成快照。
- 本地 `.data/dev.db` 已应用 1 条前向迁移并自动生成迁移前备份；当前 49 条迁移，`integrity_check=ok`，`foreign_key_check=[]`。既有自定义委托标签“欢迎投递委托”保留。
- Playwright 浏览器：1440×900 下 QQ/QQ 群按钮均为 136×44 且白底，hover 二维码可见；粗指针 393px 环境两张二维码均 `display:none`，按钮保留 44px 高。About 联系区计算背景为白色，复制前后按钮坐标不变；两页无 console error 或水平溢出。

## Open Issues

- 真实 iOS/Android 与最终人工观感仍由 GATE-E 验收；本交接不代签真机、远程 CI、部署或生产状态。

## Regression Risks

- 如某张二维码在上次解析时记录为 `null`，后续需更换/重新上传该资产才会触发重新解析；这是为避免每次保存重试的明确取舍。
- 代表作品 3～5 项复用现有循环切换和编号布局；自动化已覆盖 5 项服务端上限，最终内容密度仍应随真实五件作品由用户视觉复核。

## Next Task

- 由用户在当前本地数据上复核 `/`、`/commission`、`/about` 与 `/admin/site/content`。

## Do Not Start Yet

- 不因本任务自动启动远程部署、生产迁移、发布或 GATE-E 代签。
