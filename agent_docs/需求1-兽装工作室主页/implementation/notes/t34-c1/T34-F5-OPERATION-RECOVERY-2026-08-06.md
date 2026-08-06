# T34-F5 · 长任务恢复、上传清扫与限流加固（部分完成）

> 状态：**部分完成，任务保持未勾选。**
> 已完成：过期上传清扫（commit `1ffe68c`）、限流按主体分桶与可信代理边界（commit `bf723ef`）。
> **未完成：operation lease / 心跳 / 启动恢复、真实进程中断测试。**

## 已完成

### 过期上传会话主动清扫

- 迁移 0019 增加 `upload_sessions.cleaned_at`；
- 本地入口 `pnpm media:cleanup-expired-uploads`，容器入口 `node ops/ops.mjs cleanup-expired-uploads`；
- **默认 dry-run**，真正删除必须显式 `--no-dry-run`；可配置 `--limit`（1–1000）；
- 只扫描已过期且未完成的会话（`AWAITING_UPLOAD` 过期 / `FAILED` / `CANCELLED` / `EXPIRED`，且 `asset_id IS NULL`）；
- **基于数据库记录逐个删除精确 Object Key，绝不使用宽泛 prefix delete**；
- 幂等：`cleaned_at` 已写的会话不再重复扫描；`deletePrivate` 对 `NoSuchKey` 静默成功；
- 单个对象失败只计入 `failed` 并继续，可重试；日志只记数量，不记 Key；
- 永久原图（`COMPLETED` 且已转 asset）不在扫描范围内。

未提供 OSS 生命周期规则建议：如后续添加，只能作用于明确临时前缀，不得对永久 `original` 目录设统一过期。

### 限流按主体分桶

改动前是**单一全局固定窗口计数器**，匿名流量可以直接耗尽唯一管理员的窗口。现在按主体分桶：

| 层级 | 分桶主体 | 上限 |
| --- | --- | --- |
| 登录 | 可信客户端 IP 摘要 **+** 用户名摘要 | 30 / 分钟 |
| 已认证管理写 | 管理员 ID | 60 / 分钟 |
| 认证失败的管理探测 | 可信客户端 IP 摘要 | 60 / 分钟 |

用户名维度在登录处理器内解析 body 后追加（中间件阶段拿不到 body），因此 IP 与用户名两个维度都生效。桶数量上限 4096 并顺带清理过期桶，避免伪造大量 subject 撑爆内存。

### 可信代理边界

新增 `server/utils/client-address.ts`：

- **默认不信任任何 `X-Forwarded-For`**；只有直连地址落在明确配置的 `TRUSTED_PROXY_CIDRS` 内才解析转发链；
- 解析时从右向左跳过连续可信代理，取第一个非可信条目；
- 外部客户端把整条链填成内网地址时，结果回落到直连地址，**无法冒充内部代理**；
- 支持 IPv4、IPv6 与 IPv4-mapped；无效 CIDR 条目被忽略，不会意外放宽信任；
- 限流分桶与日志只使用 16 位十六进制摘要，不出现完整地址或用户名；
- 保持为**纯函数**（H3 取值由调用方完成），因此可被纯单元测试直接覆盖。

`TRUSTED_PROXY_CIDRS` 已加入运行时契约、`.env.example`、`config/runtime.example.json` 与 compose 示例（默认 `172.16.0.0/12`，对应 compose 内部网络）。留空表示完全不解析转发链。

## 我自己引入的两个缺陷（均由测试发现，不是靠假设排除）

1. **探测限流误伤已认证流量**：第一版用 `!event.context.adminSession` 作为"未认证"判据，但那个 context 正是由本中间件写入的，进入时永远为空。结果**每个**管理请求（含已认证 GET）都共用一个 60/分钟的 IP 桶，完整 E2E 套件因此失败。改为只在 `requireAdminSession` 抛错时才计入探测桶：已认证流量不受影响，匿名扫描也仍然无法消耗管理员窗口。
2. **模块依赖 Nitro 自动导入**：`client-address.ts` 最初直接用 `getRequestIP` / `getHeader`，纯 vitest 无法加载。改为纯函数后既能测试，设计也更清晰。

## 未完成（后续必须补）

PLAN 8.1 / 8.2 / 8.3 的 **operation lease 与启动恢复全部未做**：

- `attempt` / `lease_owner` / `lease_expires_at` / `heartbeat_at` / `recovery_reason` / `next_retry_at` 字段；
- 事务内取 lease、OSS 操作前后更新心跳、提交阶段按版本与状态条件幂等；
- 启动时扫描非终止 operation、核对业务状态与已生成公开对象、安全续做或转为可恢复失败；
- 真实杀 Node 进程并重启的中断/恢复测试（生成阶段、验证阶段、提交边界各一次）。

当前 Hero 发布、Hero 适配与水印应用仍然只有内存内的顺序执行；进程中断后运行中的 operation 会停留在非终止状态。这是 T34-F5 剩余的主要范围，任务因此保持未勾选。

## 验证

| 项目 | 结果 |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` | 通过 |
| `pnpm build` / `pnpm verify:production` | 通过 |
| secret scan | 通过（378 个受版本控制文件） |
| `pnpm test`（unit） | 20 files / 118 通过（含新增 10 项） |
| `pnpm test:integration` | 13 files / 107 通过 |
| **完整 Playwright 套件** | **210 / 210 通过** |
| 迁移 0019 | 全新库 20 项、`integrity_check ok`、外键 0 违规 |
| 清扫命令真实执行 | dry-run 返回 `{"scanned":0,...,"dryRun":true}` |

新增单元测试覆盖：IPv4/IPv6/IPv4-mapped 解析、CIDR 匹配、无可信代理时忽略伪造头、直连非可信时忽略伪造头、右向左跳过可信跳数、冒充内部代理失败、摘要不可逆且稳定、以及**一个主体用尽不影响另一个主体**。
