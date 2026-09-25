# 状态：ESA 故障维护页

## 当前阶段

5 评审：已通过 Aliyun CLI 发布并启用页面兜底。按用户最新要求，所有 HTTP 响应（含 5xx）原样透传，仅网络异常或 10 秒未获得响应时显示维护页。免费函数服务 er_freemode，未升级付费计划。

## 云端身份（2026-09-25）

- 站点：ditedog.com，SiteId `171890925863148`。
- 函数：`ditedog-fallback`，正式代码版本 `1790311626600040546`。
- 发布包 SHA-256：`729e9ad3f3fd4696b8fa15169d3c6f6963f61fab88d4e0d18e9ff79935352e06`。
- 路由：`ditedog_html_fallback`，ConfigId `520942283501568`，on，Bypass off，Fallback on，Timeout 30（脚本自身等待 10 秒）。
- 精确范围与表达式见 [维护说明](../../deploy/esa/MAINTENANCE.md)。

## 验证证据

- Node 检查通过：所有 HTTP 状态透传、重定向与 Cookie、网络异常、6.1 秒慢请求成功、10 秒超时、HEAD 无正文、API/POST/资源排除、恢复。
- lint、typecheck 通过；没有修改 Nuxt/runtime/config，没有重建 Docker 镜像。
- 独立测试函数 ditedog-probe 在两个域名分别验证：HTTP 503 原正文和探测标记保留；6.20/6.14 秒慢请求返回 200；网络异常返回 connection-failed 维护页；无响应约 10.43/10.08 秒返回 origin-timeout 维护页。这是边缘运行时隔离模拟，不是实际生产断网/停机。
- 正式函数从干净源码构建，无测试注入代码；旧模拟 URL 回归源站 404。
- 生产首页、作品页、管理登录页均 200；两侧 /api/health 保持既有 404；抽查 Nuxt JS 与 OSS 公开 WebP 均 200，无维护标记。
- 旧 maintenance_api / maintenance_site 规则（520938233901056 / 520938309400576）及对应页面（50003714 / 50003713）已删除，列表复查均为 0。
- 首轮临时路由 520941805346816、注入测试代码版本 1790310270552095676 已删除。本轮临时函数 ditedog-probe / 路由 520943896219648 也已删除；最终复核只有一个函数和一条正式路由，公开首页、作品页与管理登录页均 200。
- 本地改动已迁移到 main；删除本任务本地 codex 分支，并清理两个与同名远端引用完全一致的旧本地 codex 分支，保留其远端副本。
- 旧配置备份、隔离探测和正常请求结果位于本地忽略目录 .cache/esa-origin-fallback/。没有将 OAuth 或上传临时凭据写入 Git。

## 历史更正

此前用户反馈约 24 小时审核后生效；本次 CLI 实查两份旧自定义页面仍为 Moderation=pending。不能将早先反馈当作已验证审核完成。旧页面审核与错误的无条件 503 规则是两件独立问题；现已由函数内嵌页面替代。

## 当前约束

仅 HTML GET/HEAD 页面导航；不改 API、DNS、源站安全组、镜像或数据库；不停止生产服务做测试。

## 下一步

保持正式函数路由启用；独立 Review、认证后的管理操作、真实生产停机/重启演练未执行。紧急撤回可运行 `aliyun esa update-routine-route --site-id 171890925863148 --config-id 520942283501568 --route-enable off --region cn-hangzhou`。
