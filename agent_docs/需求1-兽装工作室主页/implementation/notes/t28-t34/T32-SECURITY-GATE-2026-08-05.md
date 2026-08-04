# T32 P0 安全门禁

## 初审状态

`NOT PASS`。以下 findings 于代码修复前冻结，后续不得从记录中删除。

## 初始 findings

1. **MUST-FIX · JSON 流式体积边界不完整**：`readAdminJsonBody` 虽检查 `Content-Length` 并在读取后复核字节数，但 chunked 正文会先被完整读入；登录与改密仍直接使用无上限的 `readBody`。所有 JSON 写入口必须共用 Nitro Node 请求流的 64 KiB 限制，同时保持图片正文直传 OSS 和 30 MB 产品上限不变。
2. **MUST-FIX · 缺少请求级分层限流**：数据库已有正确账号失败 5 次/30 分钟锁定，但未知用户名仍可持续触发密码校验，已认证写入也没有请求级节流。当前单进程单管理员架构应增加登录与管理写入两层全局固定窗口，返回可识别的 429 与 `Retry-After`；不得用客户端按钮禁用代替服务端限制。

初审未冻结其他代码 finding。Session Cookie、8 小时空闲、`sessionVersion`、改密失效、禁用用户、精确 Host/Origin/CSRF、私有响应 `no-store`、公开 DTO、日志脱敏、双 Bucket 与 profile 原子切换均已有实现和历史自动化，但必须在修复后重新执行本轮真实负路径、secret scan、生产验证与双 Bucket 实测，不能引用历史结论代签。

## 修复边界

- 复用 H3、现有认证中间件、统一正文读取器与错误 Schema；不新增依赖或代理层。
- 全局固定窗口只适用于当前单进程单管理员部署；多实例或多管理员出现时换共享的分主体存储。
- 不记录用户名、密码、正文、Cookie、IP、私有 Key 或 OSS 请求正文。

## 实现方修复与验证

- 登录、改密和全部管理 JSON 写入口统一经过 64 KiB 流式正文读取器；`Content-Length` 与 chunked 正文都在解析前受限，图片仍由浏览器直传 OSS。
- 登录在精确 Origin 校验后执行 30 次/分钟全局窗口；已认证管理写入在 Session、Origin、CSRF 校验后执行 60 次/分钟全局窗口。超限统一返回 `429 RATE_LIMITED` 与 `Retry-After`。
- `pnpm test`：17 个文件、103 项通过；`pnpm test:integration`：12 个文件、102 项通过；`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm verify:production` 全部通过。
- `pnpm exec playwright test tests/e2e/admin-auth.spec.ts tests/e2e/access-surfaces.spec.ts`：27 项通过，覆盖真实浏览器 Session Cookie、Host/Origin/CSRF、未认证与公开 Host 隔离。
- 本轮 secret scan：跟踪文件模式命中 0；本机 2 项 OSS 秘密逐值核对后，跟踪文件与 `.output` 命中均为 0；秘密文件和生成目录均未进入 Git。
- `pnpm preflight:oss`：运行 `t10-20260804T203740Z-4682338f` 共 27 项通过；私有匿名 GET 为 403，公开水印衍生图可读，4 个对象均从精确 `test/<run-id>/` 前缀删除，证据未记录凭据。

当前为实现方自测通过，等待新上下文独立 Review；不得用本节代替最终结论。

## 新上下文独立初审

基线 `aa557c3` 结论为 `NOT PASS`；以下 findings 已在修复前冻结：

1. **MUST-FIX · 中断正文不收口**：统一读取器仅监听 `data/end/error`。独立 EventEmitter 复现触发 `aborted` 后 200 ms 仍保持未决，且三个监听器都未移除。
2. **MUST-FIX · 认证日志写明文用户名**：真实 Chrome 输出包含 `e2e-admin` 与 `no-such-admin`；通用日志脱敏未把 `username` 视为敏感键，违背本轮“不记录用户名”边界。

其余独立证据：安全单元 37 项、认证/Host/CSRF/body 集成 17 项、真实 Chrome 27 项均通过；隔离 production build/content guard 通过；本机秘密逐值扫描和通用模式扫描均为 0 命中；真实 OSS 证据 27 项及 4 个对象精确清理通过。

## 独立 findings 修复

- 统一读取器同时监听 `aborted` 与未完整请求的 `close`，所有成功、错误、超限和中断出口都移除 `data/end/error/aborted/close` 监听器；新增无文件回归检查，验证中断后返回 400 且监听器归零。
- 复用现有 `safeLog` 根边界，把所有 `username` 键统一替换为 `[REDACTED]`，未逐调用点打补丁。真实 Chrome 输出只出现脱敏值。

修复后：安全单元 6 项、认证/Host/CSRF/body 集成 17 项、真实 Chrome 27 项、lint、typecheck、production build/content guard 和 `verify:production` 均通过。等待同一独立审查上下文复验两项 finding 后再给 T32 最终结论。
