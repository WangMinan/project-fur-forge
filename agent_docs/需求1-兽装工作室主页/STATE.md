# 当前状态

> **最后校准**：2026-08-10。  
> **状态权威**：任务勾选仍以 [`implementation/TASKS.md`](./implementation/TASKS.md) 为准。  
> **本轮决策记录**：[`implementation/notes/stage-f/PRE-POLICE-LAUNCH-DECISION-2026-08-10.md`](./implementation/notes/stage-f/PRE-POLICE-LAUNCH-DECISION-2026-08-10.md)。

## 当前阶段

阶段 A～D 已完成，T49 独立综合 Review 已通过。当前主流程仍处于：

> **阶段 E 收口：T50 最终回归 → GATE-E → T53-F1～F5。**

2026-08-10 用户新增一个现实部署目标：工信部 ICP 已通过，而公安联网备案需要网站先实际提供服务，因此允许在不冒充“正式上线就绪”的前提下先做一次**公安备案前临时上线**。该例外只调整运维时序，不修改应用代码、运行时 Schema、Compose、Nginx/ESA 模板或安全基线。

正式状态仍遵守：只有 TASKS 中 GATE-E 与 T53-F1～F5 全部关闭后，才能签署“正式上线就绪”。

## 代码与 CI 基线

- 当前生产实现基于 Nuxt/Nitro 单 app、SQLite/Drizzle、双私有 OSS Bucket、ESA 媒体回源、宿主机 systemd Nginx HTTP/80 origin。
- T49 最终独立 Review 记录在 `implementation/notes/stage-e/T49-INDEPENDENT-REVIEW-2026-08-10.md`。
- 2026-08-10 最新实现又加入真实 ICP 配置：`浙ICP备2026062899号`，公安备案状态保持 `unconfigured`；对应最新 `quality` 的 `checks`、`image-build`、`e2e` 均成功。
- `release-image` 为手动工作流；它直接使用 ref 选择器对应的 `GITHUB_SHA`，无需重复输入 40 位 Git SHA；每次发布可识别标签、短 SHA 标签和便捷 `latest`，并在 Summary/证据中直接输出可复制的冻结 SHA 与 `APP_IMAGE_REF=repository@sha256:digest`。

## 当前已确认生产参数

| 项目 | 当前状态 |
| --- | --- |
| 公开 Host | `ditedog.com` |
| 管理 Host | `admin.ditedog.com` |
| `www` | CNAME 到 `ditedog.com` |
| 公开媒体 Host | `public-media.ditedog.com` |
| ECS origin | `120.26.51.205:80`，HTTP |
| app upstream | `127.0.0.1:3000` |
| 私有原图 Bucket | `project-furry-forge-private`，private |
| 网页衍生 Bucket | `project-furry-forge-public`，private |
| ESA 媒体回源 | 同账号私有 OSS，托管 STS 已可用 |
| ECS OSS Endpoint | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| OSS / ESA API 凭据 | 共用现有同一套阿里云 AK/SK |
| ICP | `浙ICP备2026062899号`，已通过 |
| 公安备案 | 尚未完成，运行时保持 `unconfigured` |

## 2026-08-10 ESA / DNS 现状

用户已完成：

- 删除 wildcard `*` DNS；
- `@` 使用 ESA 代理加速指向 ECS；
- `www` CNAME 到 `ditedog.com` 并经 ESA；
- `public-media` 经 ESA 回源私有 OSS；
- `/api/**` 已配置缓存旁路；
- 用户意图是让管理 Host 全站不缓存。

但最新截图同时显示一个需要修正的控制台状态：

> `admin.ditedog.com -> 120.26.51.205` 当前为 **“仅 DNS”**，HTTPS 证书列为 `-`。

这不是正确的“关闭缓存”方式。管理 Host 必须继续经过 ESA，由 ESA 提供边缘 HTTPS；只需要在缓存规则层面对整个管理 Host 做 bypass。宿主机已经按既定拓扑关闭 443，如果 `admin` 保持“仅 DNS”，会绕过 ESA 并破坏管理端 HTTPS/源站隔离设计。

因此部署前的云侧唯一明确修正项是：

1. 把 `admin.ditedog.com` 恢复为 ESA 代理加速；
2. 确认 ESA 边缘证书覆盖该 Host；
3. 保持管理 Host 全站 cache bypass；
4. 不恢复 ECS 443，不开放 3000。

## 用户明确接受的备案前临时例外

### ICP 页脚

当前不修改 ICP 页脚布局。用户决定只有公安备案审核明确要求调整时再改。该选择作为风险接受记录，不视为对现有页脚位置作合规结论。

### ESA 套餐与源站保护

用户决定公安备案完成后再升级 ESA 基础版。备案前临时上线期间可以继续当前免费版，但这**不关闭**正式生产基线中的以下事项：

- `deploy/esa/security-observability-policy.json` 的 `productionPlanRequired`；
- 正式环境的 ESA 源站保护；
- 正式套餐/配额、预算通知、告警与实测阈值收口。

这些事项在公安备案完成后继续 T53-F2/F4/F5，不能因为网站已经可访问而自动记为完成。

## 镜像发布策略

当前项目比既有仓库更严格：

- `WangMinan/arktouros`：push `v*` tag 后发布版本 tag 与 `latest`；
- `WangMinan/flink-docker`：push `master` 后直接覆盖固定语义 tag；
- `project-fur-forge`：手动发布、重跑 quality、直接使用所选 ref 的精确 Git SHA、生成不可变 registry digest，服务器按 digest 部署。

后续提交已按本轮建议简化 workflow：直接使用 `${GITHUB_SHA}`，只保留人类可读 `image_tag` 和发布授权；每次发布同时更新 `latest`，但它只用于便捷查看/拉取。**服务器按 `repository@sha256:digest` 部署这一层继续保留**，Actions Summary 和证据会直接提供完整 `APP_IMAGE_REF`，避免人工拼接，同时保留明确回滚点。

完整比较与建议见本轮决策 note。

## 当前任务状态摘要

| 任务 | 状态 | 下一步 |
| --- | --- | --- |
| T46/T51/T52-E1～E6 | 工程完成 | 用户输入与目标环境证据继续在 T53 收口 |
| T49 | 已通过 | 保留既有独立 Review 证据 |
| T50 | 未关闭 | 最终回归与冻结证据 |
| GATE-E | 未关闭 | 正式流程的唯一 SHA/镜像冻结 |
| T53-F1 | 部分真实参数已明确 | 远程 `.env`、素材/隐私/预算等仍按 TASKS 收口 |
| T53-F2 | 部分控制台配置已完成 | 先修正 `admin` 仅 DNS；正式套餐/源站保护延后至公安备案后 |
| T53-F3 | 未执行 | 发布镜像、migrate/preflight/init、启动、Nginx、备份/恢复 |
| T53-F4 | 未执行 | 正式域名全链验证 |
| T53-F5 | 未执行 | 用户最终签署 |

## 备案前临时上线最低门槛

临时上线不是跳过运行安全检查。开始服务器部署前至少确认：

- `admin.ditedog.com` 已重新经过 ESA 且缓存 bypass；
- 公开/管理/媒体均为精确 Host，不恢复 wildcard；
- 两只 Bucket 继续 private，`public-media` STS 私有回源正常；
- `/api/**`、管理 Host、会话和写操作不共享缓存；
- 生产 `.env` 已替换全部占位值，Secret 不进仓库/日志/截图；
- `TRUSTED_PROXY_CIDRS`、Host、Endpoint、备案状态通过 production runtime/preflight；
- 发布工作流成功并取得不可变 `repository@sha256:digest`；
- ECS 不开放 443/3000，app 只绑定 `127.0.0.1:3000`；
- migrate、live preflight、init-admin、ready、Nginx `nginx -t`、首次备份与正式域名最小验证全部通过。

执行命令继续以根目录 [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) 和 [`implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](./implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 为准；本轮 note 只记录用户接受的备案前时序例外与最新控制台事实。

## 下一步顺序

1. 修正 `admin.ditedog.com`：ESA 代理加速开启 + 全站 cache bypass + 边缘证书正常；
2. 确认最终候选 `main` 的 quality 全绿；
3. 按正式流程则先完成 T50/GATE-E；若采用备案前临时上线例外，则仍锁定唯一候选 SHA并保留发布证据；
4. 手动运行 `release-image`，保存 `image-release-evidence.json` 与 `repository@sha256:digest`；
5. 严格按 `docs/DEPLOYMENT.md` 部署、preflight、备份并验证正式域名；
6. 网站稳定提供服务后提交公安联网备案；
7. 公安备案完成后升级 ESA 基础版并收口源站保护、正式套餐/预算/告警及本轮延期项。
