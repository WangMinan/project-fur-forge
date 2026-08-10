# 公安备案前临时上线与镜像发布决策

> 日期：2026-08-10  
> 性质：用户明确决策与目标环境现状记录。  
> 边界：本记录允许为公安联网备案审核先提供可访问服务，但不把尚未关闭的 T50、GATE-E、T53-F2～F5 冒充为“正式上线就绪”。应用代码、运行时 Schema、Compose、Nginx/ESA 模板和安全基线在本次提交中均不修改。

## 1. 本轮用户决策

1. 工信部 ICP 备案已通过，备案号为 `浙ICP备2026062899号`，生产配置继续显示该备案号并链接工信部备案系统；公安备案状态保持 `unconfigured`，不得提前展示公安备案号。
2. 当前页脚 ICP 展示位置不在本轮修改。用户接受该展示位置可能带来的备案审核风险；只有公安备案审核提出整改要求时，再单独修改页脚布局。本记录只记载风险接受，不对现有布局作合规结论。
3. 为尽快让网站在线并提交公安备案，ESA 暂时继续使用当前免费版；用户决定在公安备案完成后再升级基础版并收口正式套餐、源站保护、预算/告警等事项。这是备案前临时上线例外，不关闭 `deploy/esa/security-observability-policy.json` 中 `productionPlanRequired` / `originProtection.requiredForProduction` 对正式生产状态的要求。
4. 两只 OSS Bucket 已切为私有读写，`public-media.ditedog.com` 的 ESA 托管 STS 私有 OSS 回源可用；应用仍使用同一套阿里云 AK/SK 访问 OSS 与 ESA API。
5. 用户已按当前策略处理 `/api/**` 缓存旁路，并希望管理 Host 全站不进入共享缓存。

## 2. 2026-08-10 DNS 截图复核

当前截图可确认：

- wildcard `*` 记录已经删除；
- `@ -> 120.26.51.205` 为 ESA 代理加速；
- `www -> ditedog.com` 为 CNAME 且开启 ESA 代理加速；
- `public-media -> project-furry-forge-public.oss-cn-hangzhou...` 为 ESA 代理加速；
- `admin -> 120.26.51.205` 当前显示为 **“仅 DNS”**，并且 HTTPS 证书列为 `-`。

这里有一个必须在管理站上线前修正的配置误区：**“管理 Host 不缓存”不等于“管理 Host 仅 DNS”。**

正式拓扑要求 `admin.ditedog.com` 仍经过 ESA：浏览器 HTTPS 在 ESA 边缘终止，ESA 再以 HTTP/80 回源 ECS。宿主机已经不监听 443，因此 `admin` 若保持“仅 DNS”，会绕过 ESA、直接暴露源站，并且无法获得当前设计中的 ESA 边缘 HTTPS。

因此管理 Host 的正确目标状态是：

1. `admin.ditedog.com` 开启 ESA 代理加速；
2. ESA 边缘证书覆盖 `admin.ditedog.com`；
3. 通过缓存规则把该 Host 的全部路径设为 bypass / 不缓存；
4. ECS 仍只监听 HTTP/80 origin，app 仍只绑定 `127.0.0.1:3000`。

该项修正不需要改代码，也不需要恢复宿主机 443。

## 3. 备案前临时上线边界

为满足“网站先实际提供服务，再提交公安联网备案审核”的现实顺序，本项目允许一次备案前临时上线，但至少满足以下条件：

- 公开 Host、管理 Host、媒体 Host 均为精确记录，不恢复 wildcard；
- 公开/管理请求都经 ESA，管理 Host 只做缓存 bypass，不能使用“仅 DNS”绕过 ESA；
- 客户端 HTTPS 只在 ESA 终止；ECS 不开放 443，3000 只绑定 loopback；
- `/api/**`、管理 Host、登录/会话与写操作不进入共享缓存；
- 两只 OSS Bucket 保持 private，不能为排障退回 public-read；
- `public-media` 继续使用 ESA 托管 STS 私有 OSS 回源；
- 生产 `.env` 不含占位符，`TRUSTED_PROXY_CIDRS`、Session Secret、AK/SK、Host、Endpoint 和备案状态通过 production runtime/preflight；
- 使用发布工作流生成镜像并在服务器按不可变镜像摘要部署；不在 ECS 现场 `docker build`；
- migrate、preflight、init-admin、ready、Nginx `nginx -t`、首次备份和正式域名最小浏览器验证通过。

备案前临时上线可以暂缓 ESA 基础版/源站保护和 ICP 页脚位置调整，但这些暂缓项必须留在正式上线闭环中，公安备案完成后重新收口。临时上线不等于 T53-F5 的“正式上线就绪”签署。

## 4. 镜像发布策略复核

本轮只修改文档，不修改 `.github/workflows/release-image.yml`。现有流程中有两个容易混淆的标识：

- `frozen_sha` 是 **40 位 Git commit SHA**，工作流要求它精确等于本次 workflow checkout 的 `GITHUB_SHA`；
- 服务器 `.env` 使用的 `APP_IMAGE_REF` 是 **Docker/OCI 镜像 `sha256` digest**，形式为 `repository@sha256:<64 hex>`。

因此当前“严格”实际上分成两层：手工再次输入 Git SHA，以及最终按镜像 digest 部署。两者的价值不同。

### 4.1 与既有项目对比

`WangMinan/arktouros` 的现行发布工作流更偏传统版本发布：push `v*` tag 后构建，Docker Hub 同时推送版本 tag 与 `latest`；部署侧没有强制使用 registry digest。

`WangMinan/flink-docker` 的 `flink_1.20-java21.yaml` 更简单：每次 push `master` 自动构建并覆盖一个固定语义 tag `flink:1.20.5-scala_2.12-java21`，同样没有部署侧 digest 固定。

相比之下，`project-fur-forge` 的第一次生产部署刻意更保守：手动触发、完整 quality、显式发布授权、不可变 digest、服务器禁止现场构建。这使回滚和“部署的究竟是哪一份镜像”更容易审计，但手工输入 40 位 Git SHA 的确增加了操作成本。

### 4.2 后续建议

可以在首次上线稳定后单独简化 `release-image` 的交互，而不牺牲 digest 部署：

- 保留 `workflow_dispatch` 和 `main` 限制；
- 由工作流直接使用 `${GITHUB_SHA}`，删除手工 `frozen_sha` 输入；
- 保留一个明确的 `image_tag` 作为人类可读标签；
- 可保留一次显式确认，或改成 GitHub Environment approval；
- 构建成功后继续输出 `repository@sha256:digest`；
- 服务器仍按 digest 拉取和回滚，不使用 `latest` 作为部署依据。

这比完全复制 Arktouros 的 `v* + latest` 或 flink-docker 的固定可变 tag 更适合当前单实例 SQLite 站点：发布操作更轻，但仍保留不可变镜像和明确回滚点。

## 5. 当前下一步

1. 把 `admin.ditedog.com` 从“仅 DNS”恢复为 ESA 代理加速，并用 Host 级缓存 bypass 达成“不缓存”；确认边缘证书生效。
2. 基于最终准备部署的 `main` 确认 quality 全绿；T50/GATE-E 若继续按正式流程执行，则先关闭后再发布。若为了公安备案采用本记录的临时上线例外，也必须把该 SHA 作为唯一候选并留下发布证据。
3. 手动运行 `release-image`，取得 `image-release-evidence.json` 中的 `repository@sha256:digest`。
4. 按 `docs/DEPLOYMENT.md` 在 ECS 创建生产 `.env`、拉取 digest、执行 migrate/preflight/init-admin、启动 app、收敛 Nginx、备份并做正式域名验证。
5. 网站可稳定访问后提交公安联网备案；公安备案完成后升级 ESA 基础版并重新收口源站保护、正式套餐/预算/告警，以及本轮明确接受的 ICP 页脚 follow-up。
