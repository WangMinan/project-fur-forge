# 当前状态

> **最后校准**：2026-08-15。
> **状态权威**：任务勾选仍以 [`implementation/TASKS.md`](./implementation/TASKS.md) 为准。  
> **本轮决策记录**：[`implementation/notes/stage-f/PRE-POLICE-LAUNCH-DECISION-2026-08-10.md`](./implementation/notes/stage-f/PRE-POLICE-LAUNCH-DECISION-2026-08-10.md)。

## 当前阶段

阶段 A～D 已完成，T49 独立综合 Review 已通过。当前主流程仍处于：

> **阶段 E 收口：T49-R1 新 SHA CI/独立 Review → T50 最终回归 → GATE-E → T53-F1～F5。**

2026-08-10 用户新增一个现实部署目标：工信部 ICP 已通过，而公安联网备案需要网站先实际提供服务，因此允许在不冒充“正式上线就绪”的前提下先做一次**公安备案前临时上线**。该例外只调整运维时序，不修改应用代码、运行时 Schema、Compose、Nginx/ESA 模板或安全基线。

正式状态仍遵守：只有 TASKS 中 GATE-E 与 T53-F1～F5 全部关闭后，才能签署“正式上线就绪”。

## 2026-08-15 首页与管理端动效、移动导航

T51-F9 工程实现和本地门禁已完成：`/admin/site/home` 的首页/委托大图使用稳定 ID 的 FLIP 重排；管理端 `<1024px` 使用八入口全屏抽屉，1024px 起恢复横向导航；公开首页增加渐进增强的 Hero 错峰、一次性入屏揭示和仅限可点击卡片的精细指针反馈。公开/管理抽屉共用焦点陷阱、Escape、滚动锁定、背景 `inert`、路由关闭和焦点归还，全部动效遵守 `prefers-reduced-motion`，SSR/无 JavaScript 内容默认可见。

本轮未改变数据库、媒体链、HTTP API、排序协议或依赖。lint、typecheck、196 项 unit、62 项相关 E2E 和 production build 已通过；双 Host 的 390/768/1440 与管理 1023/1024 边界已用真实浏览器复验。该工程结论不代签最新 SHA 的远端 CI、T49-R1 独立 Review、用户验收或发布。

## 2026-08-14 全局水印流程与首页精选排序优化

用户确认 T51-F8：`/admin/site/branding` 取消真实水印预览及其应用门槛，改为选择/上传 Logo、调整参数后一次确认“保存并启用水印”或“保存并刷新全站”；作品设定图与出厂照继续在 `/admin/works` 使用活动 profile 做可选真实预览，发布始终自动烘焙当前活动水印。`/admin/works` 增加“全部作品 / 首页精选”二级 Tab，精选顺序改由置顶、上移、下移和置底编排，服务端以完整有序集合和资源版本在单个事务中保存连续 `0..n-1`，不再让管理员维护内部编号。首页已发布精选展示上限从 6 提高到 12，保留现有横向轨道与懒加载策略。

本次不新增迁移、拖拽依赖、一级管理导航或纯 Logo 开屏。按用户本轮明确要求，允许在 `main` 直接实施，不创建分支或 PR；该例外不授权提交、推送或发布。实现自测后仍须以新 SHA 重开 T49-R1 同一 SHA CI、独立 Review、新镜像和 T50/GATE-E 门禁。

## 2026-08-14 管理预览与首页 Hero 媒体修复

用户确认 T51-F7：管理列表/卡片改用 320 px 私有预览，编辑器大预览改用 640 px，永久原图只允许显式点击读取且继续 `no-store`；首页横版 Hero 升级为 `site-display-v2`，增加 2880×1620、3840×2160 并提高 Hero WebP 质量。实现还必须提供默认 dry-run、可在发布镜像一次性容器中运行的旧图升级命令及参数透传测试。该变更产生新的应用/迁移/镜像 SHA，完成工程自测后仍须进入 T49-R1 独立 Review、同 SHA CI 和新镜像门禁。

## 2026-08-11 公共页脚备案布局修复

用户在真实 ICP 备案号写入后确认宽屏页脚三块内容留白失衡，并要求备案号回到主页底部中央。T51-F6 已把公开导航与备案组成中间区，ICP备案号位于导航下方；公安联网备案继续使用既有配置槽，未取得编号前不输出占位。右侧收敛为版权声明和法务/设计署名两行，宽屏列间距对称，窄屏允许安全换行。

本次改动会产生新的应用 SHA；此前 Actions 结果不能代签该 SHA。按用户明确要求，本机不运行测试，由 push 后的远端流水线验证，用户负责跟进结果。

## 2026-08-10 远端部署停止与 E 级修复

备案前临时上线首次执行在 live preflight 前安全停止：27 个迁移和 dry-run
preflight 已通过，但 `@alicloud/esa20240910` 在 Node 24 原生 ESM 下的默认
导出是 CommonJS 模块对象，冻结代码却把它直接当构造器使用。失败发生在任何
OSS/ESA 写入之前，没有创建测试对象；app、管理员和 Nginx 切换均未开始。

实现提交 `70538e0` 已完成以下修复：

- `scripts/oss-preflight.mjs` 与 Nitro 的 `public-media-cache` 共用同一 SDK
  namespace 归一化入口，兼容默认导出为类或 CommonJS 模块对象；
- Node 24 原生 ESM 子进程真实构造 ESA client、purge request 和 describe
  request；Docker 构建守卫也从“只 import 包”加强为实际构造；
- 本地 lint、typecheck、167 项 unit、172 项串行 integration、production
  build/guard、Nitro 产物导入检查、production verify、ESA/observability
  policy 和 Secret scan 均通过。
- 包含实现与修复记录的 SHA `4e24916` 对应 Actions run `31392080770`
  已取得 `checks`、`image-build`、`e2e` 全部成功。

该提交改变应用与发布镜像，因此旧 T49/Actions/镜像证据不能代签新 SHA。
当前必须等待 T49-R1 新上下文独立 Review 和新镜像发布后，才能从 live
preflight 重新开始；不得热改旧容器或绕过 preflight。

## 2026-08-10 live preflight 判定契约调整

后续 live preflight 证明代码已运行到 Bucket 只读边界，但因三项既有严格
规则停止：私有 Bucket CORS 不是精确单一规则、衍生 Bucket 存在 CORS、
衍生 Bucket 中本地测试旧对象未登记在当前生产数据库。用户明确决定排障期
保持通配 CORS，并保留这些本地测试对象、不执行清理。

本次提交因此把 CORS 门禁收敛为“管理 Origin 的条件 PUT 能力可用”，不再
检查衍生 Bucket CORS；同时删除衍生 Bucket 全量对象与当前生产数据库的双向
一致性阻断。两只 Bucket 的 private+BPA、Policy/逐对象 ACL、生命周期、原站
匿名 403、条件签名失败面、本次 run 精确清理、ESA 读取和精确 purge 仍保留。

该调整会进入发布镜像中的预检脚本，所以 `4e24916` 的既有 Actions 与镜像仍
不能代签本次新 SHA；提交后必须重新取得 CI、独立 Review 和不可变镜像，远端
才可重新运行 live preflight。决策与验证见
`implementation/notes/stage-e/T52-E2-PREFLIGHT-RELAXATION-2026-08-10.md`。

## 2026-08-10 HTTP origin 预检与本地 dev 修复

目标宿主机继续严格保持 HTTP/80 origin：客户端 HTTPS 只在 ESA 边缘终止，
ECS/Nginx 不得监听 443，Nginx 不得引用证书。宿主机检查器此前同时扫描
`systemctl --all` 与证书目录，因而把停用的 Certbot unit 和未被引用的
Let’s Encrypt 账户文件误判为运行时 FAIL。当前契约改为只阻断活动的 ACME
timer/service/process；历史停用 unit 与未引用文件不参与运行时，不检查、
不删除。

本地 Nuxt dev 还会把未内联的 `scripts/esa-sdk.mjs` 生成成越过仓库根目录的
相对导入，最终错误解析为 `D:\scripts\esa-sdk.mjs`。修复必须把该本地模块与
既有 FFmpeg 运行时一样加入 Nitro `externals.inline`，并以真实 3000 启动和
健康请求验证，而不是改成宿主机 443 或复制第二份 SDK 实现。

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
| T49 | 新修复 SHA CI 已通过；T49-R1 Review 待执行 | 新上下文独立 Review 后重新发布镜像 |
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
