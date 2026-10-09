# Nginx 与 ESA 容器停机兜底衔接

## 授权与根因

用户在镜像更新期间看到 `ditedog backend is not running on 127.0.0.1:3000`，明确同意修复方案并授权当前现网操作窗口。

2026-10-09 10:57:39–10:57:52（Asia/Shanghai），Nginx 记录连接本机 3000 被拒绝；首页 503 正文为 49 字节，与截图一致。10:58:48 已恢复 200。旧函数只处理 ESA 521/522、网络异常和超时，因此透传了 Nginx 的 503。另发现 Nginx `proxy_intercept_errors on` 会将应用业务 502/503/504 同样替换为该纯文本。

## 本次修改

- `proxy_intercept_errors off` 保留应用错误；`error_page` 继续处理 Nginx 自身的代理故障。
- Nginx 去掉应用响应的 `X-Ditedog-Origin-Failure`，仅在自身故障处理 location 生成 `backend-unavailable` 标记、503、no-store、Retry-After 60，并保留安全响应头。
- ESA 仅对 503 且响应标记精确匹配时返回既有维护页；普通业务 5xx 透传。请求标记不能触发兜底。
- API、POST 与非 HTML 请求不转换为维护页；代理失败得到简短的纯文本 503，避免泄露本机地址。

## 冻结身份与实际部署

| 项目 | 身份 |
| --- | --- |
| 源码提交 | `e5894eb602e2fed22922c30bdc3f0844000ed4a2` |
| 新正式函数版本 | `1791515574146244862` |
| 上一正式函数版本 | `1790312541006856651` |
| 新函数包 SHA-256 | `ee51749e93b4439018fd17ad40c788896bd3708a3c1fe04c04b3ab81c2948360` |
| 正式函数路由 | `520942283501568`，Sequence 1，on，Bypass off，Fallback off，Timeout 30 |
| 新 Nginx 配置 SHA-256 | `be800d1003938338ae76695d70ac80fa01f1d6cdba07509adb24bf92769d6d09` |
| 旧 Nginx 配置 SHA-256 | `d876a84d48159a4bf28223d12afb3d66585ddc98a5575cc576de7e1a4a8f6a66` |
| 服务器 Nginx 版本 | `1.30.5`，现场已安装，本次未升级 |
| 配置备份 | `/var/backups/project-fur-forge/esa-nginx-20261009/ditedog.conf` |
| 服务器部署清单 | `/var/backups/project-fur-forge/esa-nginx-20261009/deployment.json` |

先在临时函数验证，再发布正式函数，随后安装已验证的 Nginx 候选配置并平滑 reload。云端下载代码与本地构建哈希一致；清理测试路径后的 Nginx 配置与渲染候选哈希一致。

[PR #42](https://github.com/WangMinan/project-fur-forge/pull/42) 于 2026-10-09 11:19:14（Asia/Shanghai）合入 main，合并提交 `40d1d46c4d0098deffb1a4998082f376994f31c9`。源码提交、main 合并提交与云端函数版本分别记录，不把合并提交当作应用镜像已经发布。

应用镜像仍为 `wangminan/project-fur-forge@sha256:62f2e4203e563300e37b42e6d0bab3d4c94c7105bdd6924b375ffe8acf5092cf`，容器启动时间仍为 `2026-10-09T02:58:20.653969653Z`，healthy。未重建镜像、重启容器、改数据库/媒体/凭据，服务器应用工作树维持原冻结版本。宿主机配置独立发布；后续应用部署须使用包含本修复的配置，避免旧模板覆盖。

## 验证与清理

- Node 可执行检查覆盖 500–599 普通错误透传、标记状态组合、请求头伪造、两个 Host、HEAD、作用域、超时和恢复。
- lint、typecheck、部署契约 9 项测试通过；本次不涉及 Nuxt/runtime 配置，未运行应用 build 或镜像发布。
- [PR quality](https://github.com/WangMinan/project-fur-forge/actions/runs/37878544230) 与 [main quality](https://github.com/WangMinan/project-fur-forge/actions/runs/37878728836) 的 checks 均通过（lint、typecheck、完整 core）；image-build 均为 skipped，不能作为镜像构建或发布证据。PR 的 GitGuardian 安全扫描通过。
- 真实 Nginx 独立实例在 loopback 18080、合成后端在 18081：54 组断言通过，覆盖两个域名 × GET/HEAD/POST × 200/302/500/502/503/504/拒绝连接/提前断流/超时。18082 无监听用于连接拒绝，超时测试 location 使用 1 秒读取上限；正式 Nginx 超时未改。
- 临时函数和正式函数各 42 组 ESA 实测通过。覆盖两个 Host 的 GET/HEAD、业务原文/Cookie/Location、三类代理失败、API/POST/非 HTML 排除。测试使用隔离前缀 `/__esa-fallback-20261009-a8f3/` 与 `/api/__esa-fallback-20261009-a8f3/`，正常业务路径未改指向。
- Chrome 桌面 1280×720 与移动视口 390×844 显示维护页，无横向溢出；Tab 聚焦首页链接、Enter 后进入正常首页。只有预期的主文档 503 控制台提示。
- 正常首页、作品、管理登录、Nuxt JS、公开 WebP 200；管理根路径 302、两端健康 API 404；宿主机验证脚本 PASS。
- 已删除测试路由 `523469125181440` 与函数 `ditedog-probe-20261009`（测试版本 `1791515374686725035`），移除生产 Nginx 两个隔离 location，停止本次独立 Nginx/合成后端；测试端口无监听，两端隔离页面恢复 404。
- 本地忽略证据目录 `.cache/esa-origin-fallback/20261009/`：`nginx-results.json`、`isolated-results.json`、`production-results.json`、`normal-results.json`、桌面/移动截图、旧函数包和路由备份。服务器保留仅本次测试脚本/结果 `/root/esa-nginx-probe-20261009/`，无常驻测试进程。

这些是实际代理失败的隔离验证，不代签整机重启、生产容器停机、认证后的写操作或人工验收。

## Review 与文档同步

GitHub 自动代码 Review 于 PR 合并后完成，审查提交为 `21abcf12d9aa96b8afb5c0333114a90caffee297`，状态为 COMMENTED。[唯一 P2 意见](https://github.com/WangMinan/project-fur-forge/pull/42#discussion_r4226303963)指出两个部署手册仍要求 `nginx/1.30.4`，会在已核实为 1.30.5 的生产机上误报版本漂移。

用户授权本轮文档直接 main 更新。再次只读核验现网 `nginx -v` 为 1.30.5、配置哈希与上表一致后，将两个可执行版本检查对齐 1.30.5；首次上线前的 1.30.4 快照保留并明确日期。同时补齐通用部署入口对独立 Nginx/ESA 发布的说明、路由临时绕过与完整回滚的区别，以及测试路由实际执行顺序核对。这是文档修正，没有再改生产配置或安装/降级 Nginx。

## 精确回滚

1. 在 `root@120.26.51.205` 核对当前配置仍为上述新哈希，保存当前配置后恢复上述备份文件到 `/etc/nginx/conf.d/ditedog.conf`。
2. `nginx -t` 通过后执行 `systemctl reload nginx`；失败则恢复保存的新配置，不继续发布旧函数。
3. 使用 Aliyun CLI：`aliyun esa publish-routine-code-version --name ditedog-fallback --env production --code-version 1790312541006856651 --region cn-hangzhou`。
4. 核对函数生产版本、路由开关和正常公开/管理访问。旧配置的容器停机纯文本 503 与业务错误拦截会重新出现；回滚不能算本问题已解决。

本次无需数据库恢复或切换应用镜像。
