# T32 P0 安全门禁

## 初审状态

`NOT PASS`。以下 findings 于代码修复前冻结，后续不得从记录中删除。

## 初始 findings

1. **MUST-FIX · JSON 流式体积边界不完整**：`readAdminJsonBody` 虽检查 `Content-Length` 并在读取后复核字节数，但 chunked 正文会先被完整读入；登录与改密仍直接使用无上限的 `readBody`。所有 JSON 写入口必须共用 H3 原生流式 64 KiB 限制，同时保持图片正文直传 OSS 和 30 MB 产品上限不变。
2. **MUST-FIX · 缺少请求级分层限流**：数据库已有正确账号失败 5 次/30 分钟锁定，但未知用户名仍可持续触发密码校验，已认证写入也没有请求级节流。当前单进程单管理员架构应增加登录与管理写入两层全局固定窗口，返回可识别的 429 与 `Retry-After`；不得用客户端按钮禁用代替服务端限制。

初审未冻结其他代码 finding。Session Cookie、8 小时空闲、`sessionVersion`、改密失效、禁用用户、精确 Host/Origin/CSRF、私有响应 `no-store`、公开 DTO、日志脱敏、双 Bucket 与 profile 原子切换均已有实现和历史自动化，但必须在修复后重新执行本轮真实负路径、secret scan、生产验证与双 Bucket 实测，不能引用历史结论代签。

## 修复边界

- 复用 H3、现有认证中间件、统一正文读取器与错误 Schema；不新增依赖或代理层。
- 全局固定窗口只适用于当前单进程单管理员部署；多实例或多管理员出现时换共享的分主体存储。
- 不记录用户名、密码、正文、Cookie、IP、私有 Key 或 OSS 请求正文。
