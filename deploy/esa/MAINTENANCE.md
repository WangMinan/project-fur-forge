# ESA 源站故障维护页

当前使用边缘函数与普通函数路由：先访问源站，在 ESA 返回 521（拒绝连接）、522（连接超时）、Nginx 返回带 `X-Ditedog-Origin-Failure: backend-unavailable` 的 503、fetch 抛出网络异常或 10 秒内未获得响应时返回维护页。其他 HTTP 响应（包括业务 500/502/503/504）原样保留。历史“自定义响应码”规则是无条件手动开关，已退役。

## 源文件与检查

- [origin-fallback.mjs](origin-fallback.mjs)：函数入口。
- [maintenance.html](maintenance.html)：内嵌页面；无脚本、外部图片/字体/接口请求，不需要上传 OSS，不依赖浏览器缓存。
- [origin-fallback.check.mjs](origin-fallback.check.mjs)：Node 可执行边界检查。

```powershell
node deploy/esa/origin-fallback.check.mjs
pnpm exec esbuild deploy/esa/origin-fallback.mjs --bundle --format=esm --loader:.html=text --outfile=.cache/esa-origin-fallback/index.js
```

构建后的 index.js 才是 ESA 上传文件；不能将带 HTML import 的源文件直接粘贴到单文件编辑器。源码修改、Git 推送、应用 Docker 发布均不会自动更新边缘函数。

## 路由与运行边界

站点下使用普通函数路由，路由等待 30 秒，为脚本自身的 10 秒等待留出余量。兜底返回 503、`Cache-Control: no-store`、`Retry-After: 60`；`X-Ditedog-Fallback` 区分 `origin-521`、`origin-522`、`backend-unavailable`、`connection-failed` 和 `origin-timeout`，HEAD 无正文。60 秒只是建议重试间隔。

旁路 `Bypass=off`，**函数异常回源 `Fallback=off`**。2026-09-25 在独立路径将回源端口改为未监听端口，真实收到 521；函数内部已生成 503 维护页，但 `Fallback=on` 时客户端仍收到再次回源后的空白 521。关闭后客户端收到内嵌维护页，重新开启又复现 521。不要依据开关名称假定它只处理 JavaScript 异常。

实际经 ESA 编译通过的表达式：

```text
(http.host in {"ditedog.com" "admin.ditedog.com"} and http.request.method in {"GET" "HEAD"} and http.request.headers["accept"] contains "text/html" and http.request.uri.path ne "/api" and not starts_with(http.request.uri.path, "/api/"))
```

ESA 此次拒绝 `not (A or B)` 的写法；这里用两个否定条件连接，勿直接套用其他厂商的 `any(headers[*])` 语法。

- 仅接管两个精确 Host 上的 HTML GET/HEAD 页面导航；API、写请求和非 HTML 资源不进入此函数。
- OSS 媒体 Host、浏览器上传域名、认证同源图片 API 保留原链路。没有修改 DNS、缓存策略、源站安全组、应用镜像或数据库。
- 正常请求使用原 Request、`redirect: manual`、`decompress: manual`，不主动改 Cookie、Location 或已压缩正文。
- 已打开页面的 API 请求失败不会自动替换整个页面；认证后的写操作和真实生产停机演练仍需单独验收。
- 10 秒限制是停止等待上游响应，未取消底层 I/O；因此只作用于读取页面。响应头/正文已经开始发送后的中途断流不保证能改成维护页。
- ECS/Nginx 不可达产生的 ESA 521/522 由本函数处理；Nginx 可达但应用容器连接失败，由 Nginx 生成带专用标记的 503，再由函数转换为同一维护页。未带标记的 503 仍透传。ESA 文档将 520–599 用作平台细分错误，业务不应使用该范围；若业务将来自行返回 521/522，函数无法仅凭状态码区分来源。
- Nginx 必须使用 `proxy_intercept_errors off`，保留应用返回的业务错误；`error_page` 仅处理 Nginx 自身产生的代理故障。`proxy_hide_header X-Ditedog-Origin-Failure` 去掉应用响应中的同名标记，只有 `@backend_unavailable` 添加标记、no-store 和 Retry-After。请求头不作为故障依据。API/写请求/非 HTML 资源在代理故障时收到简短纯文本 503，不转换为 HTML。
- 关闭函数异常回源后，函数自身未捕获异常/平台故障会显示平台错误，不再自动回源。这是保留函数主动返回的 503 维护页所需的取舍；紧急撤回时关闭整条函数路由。

## CLI 发布流程

使用已有 OAuth profile；ESA endpoint 位于 cn-hangzhou。每个 API 先读取 `aliyun esa <command> --help`。操作前只读核对函数、路由和当前正式版本，保留回滚信息。

1. 构建并运行本地检查。
2. `get-routine-staging-code-upload-info` 获取临时上传信息，凭据只放进程内存；使用返回的 HTTPS OSS 地址，以 multipart POST 上传 JS，携带返回的表单字段及映射后的 `x-oss-security-token`。
3. 上传回调成功后运行 `commit-routine-staging-code`，检查新版本 `Available`。
4. 在独立测试路由验证，再用 `publish-routine-code-version` 发布正式版本；核对新版本已实际生效后才更改生产路由。云端变更可能有传播延迟，API 成功不等于每个边缘节点已更新。
5. 复核正常首页、管理登录、3xx、API 与媒体，再清理无引用的测试资源。

涉及 Nginx 故障标记的更新需同时部署仓库模板：先备份线上配置，核对目标版本，使用独立 loopback Nginx 验证连接拒绝、断流、超时和业务 5xx；再在隔离路径验证 ESA。先发布兼容旧 Nginx 的函数，再安装候选 Nginx 配置，`nginx -t` 通过后平滑 reload。不需要重建应用镜像或修改数据库。添加 location 级 `add_header` 时须保留安全响应头，避免覆盖继承。

回滚本次衔接修改时，先恢复备份 Nginx 配置并校验/reload，再发布记录的旧函数版本；两端分别记录验证结果。旧配置在容器停机时会恢复纯文本 503，这是回滚后的已知限制。

HTTP multipart 上传使用 curl 时，可通过 `--config -` 从标准输入传递临时签名表单，避免密钥进入命令行、日志或 Git。不要将上传配置和完整响应头打印到聊天中。

## 回退

只需关闭本需求的函数路由，流量恢复现有 ESA → Nginx → 应用流程；不要开启旧强制 503 规则作为回退。具体函数名、版本和 ConfigId 见[当前需求状态](../../agent_docs/需求8-ESA故障维护页/STATE.md)。

## 官方依据

- [HTTP 状态码：ESA 520–599 与 521/522 定义](https://help.aliyun.com/zh/edge-security-acceleration/esa/support/http-status-code-description)
- [522：源站连接超时](https://help.aliyun.com/zh/edge-security-acceleration/esa/support/522-error-origin-connection-timeout)
- [函数路由与旁路模式](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/trigger)
- [Fetch API](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/fetch-1)
- [CLI 上传信息接口](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-getroutinestagingcodeuploadinfo)
- [提交函数版本](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-commitroutinestagingcode)
