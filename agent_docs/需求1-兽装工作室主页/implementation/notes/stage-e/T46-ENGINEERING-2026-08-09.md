# T46 工程记录（2026-08-09）

## 结论

**PASS WITH FOLLOW-UP（实现与自测）**。最小化第一方访问统计已在基线 `f730393e680ecf27db2c074b4d7bd9f4130d67c7` 之上完成；用户仍需确认统计含义与最终隐私政策公开文案，新上下文独立 Review 统一由 T49 执行。本记录不代签任一门禁。

## 范围与非目标

- 新增 `analytics_events` 前向迁移、约束、必要索引、repository/service 与聚合查询；
- 新增同源公开写入口、管理只读入口、浏览器最佳努力采集和 `/admin/analytics`；
- 验证严格事件形状、HMAC、90 天滚动清理、限流、失败不阻断和三固定视口；
- 不建设 visitor/profile、第三方统计、Cookie/localStorage、跨站追踪、实时大屏、导出或任意 BI；
- 不修改未确认的公开隐私政策正文，不执行 T52、T49、T50 或阶段 F。

## 数据与隐私边界

| 持久化 | 明确不持久化 |
| --- | --- |
| 事件时间、枚举 `event_type`、枚举 `route_key`、可选公开实体类型/UUID、可选行动枚举、域分离 `session_hmac` | IP、User-Agent、Referer、原始 URL/查询串、Cookie、原始会话 UUID、联系方式、正文、设备或浏览器指纹 |

客户端随机 UUID 只保存于 `sessionStorage`；请求使用同源 `fetch`、`keepalive`、`credentials: omit` 与 `referrerPolicy: no-referrer`。服务端复用现有认证 Session Secret，以固定域 `fur-forge:analytics-session:v1` 生成 HMAC。每次接受事件时在同一数据库事务内先删除 90 天前原始行；重复清理安全，不增加常驻 worker。

迁移只新增统计表，不改写历史迁移或现有业务数据。回滚时应用版本必须与数据库迁移集合匹配；不要以手工删表替代备份恢复。

## 首次失败与修复

1. 路由归一化最初允许详情 slug 尾随查询字符；收紧为规范 slug 白名单，查询串不进入载荷。
2. 清理集成测试最初把“写入事务已自动清理”误判为显式清理应再次删除；改为同时证明自动清理与后续幂等重放。
3. 首次真实浏览器上报返回 `503`：采集路由只读取了可选自定义 Secret，而 Nuxt 认证正在使用其现有运行时 Session Secret。修复为复用实际认证 Secret，未引入第二把密钥。
4. 首次冷构建外层命令在 60 秒到期，构建进程本身没有产品错误；延长命令时限后完成，随后使用同一构建运行真实 Chrome。
5. 最终隐私断言最初要求 `referer` 请求头完全不存在；真实 Chrome 在 `no-referrer` 下发送空值头。断言改为接受缺失或空字符串，仍严格拒绝任何页面地址值。
6. Playwright 读取页面 `keepalive` 请求的响应 body 时超时；浏览器测试改为断言 `200`、最小请求头/体与数据库落点，响应严格形状由 Zod 单元测试覆盖。

以上是实现自测发现，不是独立 Review findings。

## 验证证据

- `APP_ENV=test pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- `pnpm test`：21 files / 129 tests PASS；
- `pnpm test:integration`：20 files / 162 tests PASS；
- `APP_ENV=production pnpm build`：PASS，production content guard PASS；
- T46 定向单元：3 files / 8 tests PASS；
- T46 定向集成（含 schema/query plan）：18 tests PASS；
- T46 真实 Chrome：3 tests PASS，覆盖最小请求/仅 HMAC 持久化、采集失败不阻断联系方式、外站 Origin 拒绝、每分钟 120 次限流与 `429`、管理页三视口及 console；
- 浏览器请求断言无 Cookie，`referer` 缺失或为空，响应为 `200`；Zod 单元测试确认接受响应只能是 `{ data: { accepted: true } }`。

本地通过不代表 GitHub Actions 全绿；远端同一 SHA 门禁仍由 T49 取得。

## 未关闭门禁

- [ ] 用户确认“近似会话”等统计含义与最终公开隐私政策文案；
- [ ] T49 新上下文独立 Review；
- [ ] T49 同一 SHA 远端 CI。
