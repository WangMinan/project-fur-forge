# 状态：ESA 故障维护页

## 当前阶段

5 评审：2026-10-09 已在用户授权窗口补齐容器停机兜底。Nginx 自身代理失败返回带专用标记的 503，ESA 转换为现有维护页；Nginx 与 ESA 均保留业务 500/502/503/504。保留 ESA 521/522、网络异常与 10 秒等待。未变更函数套餐。

## 云端身份（2026-10-09）

- 站点：ditedog.com，SiteId `171890925863148`。
- 函数：`ditedog-fallback`，正式代码版本 `1791515574146244862`；上一版 `1790312541006856651` 保留可回滚。
- 发布包 SHA-256：`ee51749e93b4439018fd17ad40c788896bd3708a3c1fe04c04b3ab81c2948360`，已下载云端代码比对。
- 部署源码：`e5894eb602e2fed22922c30bdc3f0844000ed4a2`；Nginx 渲染配置 SHA-256：`be800d1003938338ae76695d70ac80fa01f1d6cdba07509adb24bf92769d6d09`。应用镜像及服务器应用仓库未变更，宿主机配置版本单独记录。
- 路由：`ditedog_html_fallback`，ConfigId `520942283501568`，on，Bypass off，Fallback off，Timeout 30（脚本自身等待 10 秒）。
- 精确范围与表达式见 [维护说明](../../deploy/esa/MAINTENANCE.md)。

## 本次验证证据（2026-10-09）

- Node 边界检查、lint、typecheck、deployment-contract 9 项测试通过。
- 同机独立 loopback Nginx 54 组实测通过：两个 Host、GET/HEAD/POST、正常响应/302/业务 500/502/503/504/连接拒绝/断流/超时；验证业务正文、Cookie、Location 保留，应用同名故障标记剥离。
- 临时函数与正式函数各 42 组真实 ESA → Nginx 隔离路径实测通过：连接故障得到 503 HTML、`X-Ditedog-Fallback: backend-unavailable`、no-store、Retry-After 60；业务错误原样，HEAD 无正文，API/POST/非 HTML 排除。
- Chrome 桌面与 390×844 视口显示现有维护页，无横向溢出；Tab/Enter 可通过“重试首页”回到正常首页。唯一控制台错误是预期的主文档 HTTP 503。
- Nginx 配置校验与平滑 reload 成功，宿主机验证全 PASS；首页/作品/管理登录/JS/公开 WebP 为 200，管理根路径 302、健康路径 404。
- 临时函数 `ditedog-probe-20261009`、路由 `523469125181440`、临时 Nginx 路径及独立进程已清理；两个域名测试路径恢复 404，正式路由仍为 Sequence 1/on/Bypass off/Fallback off/Timeout 30。
- 生产应用未停止、未重建；启动时间仍为 `2026-10-09T02:58:20.653969653Z`，镜像 digest `62f2e4203e563300e37b42e6d0bab3d4c94c7105bdd6924b375ffe8acf5092cf`，healthy。
- [本次交接与回滚](implementation/notes/2026-10-09-NGINX-FALLBACK.md)；脱敏结果及截图在本地忽略目录 `.cache/esa-origin-fallback/20261009/`。独立 Review、整机重启或生产容器停机演练未执行。

## 历史验证证据（2026-09-25）

- Node 检查通过：遍历 500–599，只有 521/522 返回维护页，其余响应对象原样保留；重定向与 Cookie、网络异常、6.1 秒慢请求成功、10 秒超时、HEAD 无正文、API/POST/资源排除、恢复。
- 新版在临时函数及正式函数上分别验证真实回源 521：两个域名 HTML GET 返回 1819 字节维护页、503、origin-521、no-store、Retry-After 60；HEAD 无正文；非 HTML 请求仍返回原 521。测试通过独立路径临时回源至未监听端口 65534，不改变业务路径；测试后删除回源规则 520945982871552、函数路由 520946062573568 和 ditedog-probe。522 转换已在本地验证，本次没有再次执行真实整机重启或真实连接超时测试。
- lint、typecheck 通过；没有修改 Nuxt/runtime/config，没有重建 Docker 镜像。
- 上一轮独立测试函数 ditedog-probe 在两个域名分别验证：HTTP 503 原正文和探测标记保留；6.20/6.14 秒慢请求返回 200；网络异常返回 connection-failed 维护页；无响应约 10.43/10.08 秒返回 origin-timeout 维护页。这是边缘运行时隔离模拟，不是实际生产断网/停机，也没有证明真实回源错误下 Fallback=on 的行为。
- 正式函数从干净源码构建，无测试注入代码；旧模拟 URL 回归源站 404。
- 生产首页、作品页、管理登录页均 200；两侧 /api/health 保持既有 404；抽查 Nuxt JS 与 OSS 公开 WebP 均 200，无维护标记。
- 旧 maintenance_api / maintenance_site 规则（520938233901056 / 520938309400576）及对应页面（50003714 / 50003713）已删除，列表复查均为 0。
- 首轮临时路由 520941805346816、注入测试代码版本 1790310270552095676 已删除。本轮临时函数 ditedog-probe / 路由 520943896219648 也已删除；最终复核只有一个函数和一条正式路由，公开首页、作品页与管理登录页均 200。
- 本地改动已迁移到 main；删除本任务本地 codex 分支，并清理两个与同名远端引用完全一致的旧本地 codex 分支，保留其远端副本。
- 旧配置备份、隔离探测和正常请求结果位于本地忽略目录 .cache/esa-origin-fallback/。没有将 OAuth 或上传临时凭据写入 Git。

## 历史更正

此前仅注入 Promise/Response 的测试没有覆盖真实回源连接失败。2026-09-25 用户自行重启时遇到空白 522，证实“所有 HTTP 5xx 透传”会漏掉 ESA 连接错误。官方将 521/522 定义为拒绝连接/连接超时；本次独立路径回源到未监听端口，实际得到 521（proxy-status: connection_refused）。诊断函数确认内部已转为 503，但路由 Fallback=on 会再次回源并返回空白 521；切为 off 才保留维护页，重新开启又复现。仅增加状态判断不够，必须同时关闭异常回源。没有重启或停止生产 ECS。

此前用户反馈约 24 小时审核后生效；本次 CLI 实查两份旧自定义页面仍为 Moderation=pending。不能将早先反馈当作已验证审核完成。旧页面审核与错误的无条件 503 规则是两件独立问题；现已由函数内嵌页面替代。

## 当前约束

仅 HTML GET/HEAD 页面导航转换维护页；API 业务错误原样，代理故障返回不含内网信息的纯文本 503。未改 DNS、源站安全组、镜像或数据库；未停止生产服务做测试。

## 下一步

保持正式函数路由启用、Fallback=off；关闭异常回源后，函数自身故障不再自动绕过函数。独立 Review、认证后的管理操作、修正后真实生产停机/重启演练未执行。紧急撤回可运行 `aliyun esa update-routine-route --site-id 171890925863148 --config-id 520942283501568 --route-enable off --region cn-hangzhou`。
