# CLAUDE.md

本文件是 `project-fur-forge` Coding Agent 的稳定入口；`AGENTS.md` 指向本文件。临时 SHA、Actions run、截图、一次性 finding 和阶段过程只写入对应 `agent_docs/` 记录，不在这里固化。

## 1. 当前范围与权威文档

项目为“有点小狗工作室”提供图片优先的公开站和轻量管理后台。中文短品牌为“有点小狗”，英文品牌固定为 `DITE DOG`。

| 需求 | 状态 | 作用 |
| --- | --- | --- |
| 需求1 | 已关闭、历史基线 | Host、媒体、安全、OSS/ESA、发布、恢复与部署约束 |
| 需求2 | 已关闭、历史增量 | 仅供追溯，后续需求已覆盖部分功能 |
| 需求3 | 已关闭、当前业务基线 | 退役边界、简化作品/领养、Hero、委托投递 |
| 需求4 | **仅阶段 E 开放** | UI 美化、布局、响应式、Hero 焦点与动效优化 |

“关闭”不等于补签未发生的生产执行、独立 Review、真实手机或用户验收；未完成项在任务文档中标为“按产品决策关闭”。需求1～3不再接受新功能，后续代码不得恢复它们已退役的行为。

开始工作前按任务读取：

- 当前状态与唯一勾选权威：[`需求4 STATE`](agent_docs/需求4-站点视觉升级与内容合规/STATE.md)、[`需求4 TASKS`](agent_docs/需求4-站点视觉升级与内容合规/implementation/TASKS.md)；
- 产品、文案、模型和视觉契约：[`SPEC`](agent_docs/需求4-站点视觉升级与内容合规/requirements/SPEC.md)、[`COPY`](agent_docs/需求4-站点视觉升级与内容合规/requirements/COPY.md)、[`models`](agent_docs/需求4-站点视觉升级与内容合规/models/README.md)、[`design`](agent_docs/需求4-站点视觉升级与内容合规/.design/README.md)；
- 已实现业务边界：[`需求3 foundation`](agent_docs/需求3-站点业务简化与委托投递/foundation/README.md)；
- 媒体事实源：[`MEDIA-PUBLICATION-POLICY`](agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md)；
- 部署和恢复：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) 与 [`PRODUCTION-LAUNCH-HANDBOOK`](agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。

权威顺序：SPEC 定产品契约；COPY 定成文；models 定字段/UI 模型；design 定视觉行为；TASKS 定任务状态；STATE 定当前事实。代码和测试证明实现，不覆盖产品契约；历史 notes、截图、旧 Review 和聊天摘要只说明当时状态。

## 2. 稳定产品边界

- 需求1～3 的退役能力和当前业务边界以《需求3 foundation》为准；不得从历史代码恢复已退役行为。
- 公开投影、排序、数量、营业状态、联系和文案以需求4 `SPEC` / `COPY` / `models` 为准；不在本文复制字段级细节。
- 公开源图与私有媒体严格分离；委托设定图不生成 PUBLIC variant、ESA URL 或水印。
- PII 不进入公开 DTO、HTML、URL、analytics、普通日志、错误、localStorage 或真实 fixture。
- 不新增交易、订单、支付、SMTP、短信、公开申请查询、自动建作品或通用 CMS。

需求4阶段 E 的设计目标是“简洁底盘 + 灵动角色感 + 摄影主导的编辑式工作室网站”。后续 PR 只做 UI、布局、响应式、可访问性和动效质量；若工作会改变数据库、业务契约、媒体/安全边界或部署拓扑，必须先取得用户明确授权并重新开放对应范围。

## 3. Git 与写入

先 `git fetch`，核对 `origin/main`、当前分支和工作树；不 force push、不 hard reset、不覆盖用户改动。只暂存本任务文件，提交保持小而可审查。

默认通过 `codex/*` 任务分支与 PR 合入 `main`。唯一小修例外：

1. 请求者明确是王旻安；如果上下文无法确认，使用 `git config user.email` 是否精确等于 `wangminan0811@hotmail.com`（大小写不敏感）确认；
2. 请求明确针对 `main` 上的**小型 bug**；
3. 改动局部、可回滚，不涉及 Schema/迁移、数据或媒体删除、安全/隐私边界、依赖大升级、部署/发布契约或产品范围。

同时满足时，直接在 `main` 修复和验证，不创建或切换任务分支。若任一条件不满足，仍走任务分支与 PR。身份例外不授权生产发布、云配置、破坏性操作或跳过测试。

当前 `main` 不配置 required checks，不擅自改变。实现、自动测试、独立 Review、用户视觉验收、远程 CI、部署和生产状态互不代签。

## 4. 云上部署结构与数据流

权威命令以 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) 为准；部署前同时阅读 [`PRODUCTION-LAUNCH-HANDBOOK`](agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。配置落点见 [`docker-compose.yaml`](docker-compose.yaml)、[`deploy/nginx/app.conf.template`](deploy/nginx/app.conf.template)、[`deploy/esa/cache-policy.json`](deploy/esa/cache-policy.json) 与 [`deploy/esa/security-observability-policy.json`](deploy/esa/security-observability-policy.json)。

```text
访客/管理员 --HTTPS--> ESA
  页面/API --HTTP:80--> 宿主机 Nginx --> 127.0.0.1:3000 --> Nuxt/Nitro app --> SQLite 持久卷
  公开媒体 ------------> ESA 托管 STS 私有回源 --> 网页衍生 Bucket

管理员浏览器 --条件签名 PUT--> 私有原图 Bucket 的公网 OSS 地址
app / one-shot ops --OSS SDK Endpoint--> 私有原图 Bucket + 网页衍生 Bucket
```

部署不变量：

- Compose 只有一个常驻 `app`；migrate、preflight、backup、restore、recover 使用同一冻结镜像的一次性容器。
- app 只绑定 `127.0.0.1:3000`；Nginx 运行在宿主机，只监听 HTTP/80；TLS 在 ESA 边缘终止。
- 公开、管理、媒体 Host 精确隔离；未知 Host 和到达 Nuxt 的媒体 Host 返回 `421`。
- 两只 OSS Bucket 都是 private；公开页面只消费 `public-media.ditedog.com` 上 READY 的网页派生物。
- `OSS_ENDPOINT` 供服务端 SDK，`OSS_UPLOAD_BASE_URL` 供浏览器条件 PUT，`MEDIA_BASE_URL` 供公开 ESA URL，三者不得混用。
- API、管理、会话和写操作绕过共享缓存；不可变 `/_nuxt/**` 和公开派生媒体可长缓存；下架先撤销公开投影，再精确 purge。
- 服务器按 `repository@sha256:digest` 部署，不在服务器 build，不用 `latest` 作为部署身份。
- `.env`、Secret、签名 URL、私有 Object Key 和生产 PII 不进入 Git、日志、截图或聊天。

任何目标环境事实都必须现场验证；本地测试和配置文件不能代签云配置、备份恢复、生产迁移或正式发布。

## 5. 测试与 Actions

```powershell
pnpm check:fast
pnpm test:core
pnpm test:smoke
pnpm test:release   # 仅显式 release/manual 验证
```

- 文档-only 只做链接、状态和口径检查。
- 普通代码跑 lint、typecheck 和受影响 core；Nuxt/runtime/config 再跑 build。
- UI 用真实浏览器检查；自动化只保护可达性、稳定业务不变量和明显回归，不评判审美。
- release 路径负责 smoke、production build/verify、notices/Secret/ESA policy；镜像、Compose、恢复和 Nginx 只在显式 release/manual 路径执行。
- 测试失败先区分稳定不变量与过时的文案/DOM/class/毫秒断言；不为全绿回退产品行为。
- GitHub 无步骤且标注 billing/spending limit 的失败是基础设施状态，不是代码测试结论。

视觉人工检查至少覆盖 390×844、430×932、768×1024、1023×900、1024×900、1440×900，并检查键盘、焦点、reduced-motion/transparency/contrast、console/network、图片 decode、LCP/CLS、safe area 和水平溢出。真实手机与王旻安/景宸人工验收仍是最终视觉门禁。

## 6. 代码、安全与破坏性操作

`server/utils/` 分层：`repository/` 负责 SQL/CAS/lease，`service/` 负责校验/DTO/事务入口，`runner/` 负责持久 operation 与 OSS 副作用，`recipe/` 负责纯媒体身份，`route/` 负责 Host/Session/Origin/CSRF/body/error。

- 首页继续消费单个聚合 DTO；Hero/works/adoption 复用现有 publication/lease/recovery/purge。
- 公开内容 SSR 默认可见；动效不能先隐藏再等 JavaScript。
- 新行动、上传与长任务反馈复用现有公共组件；OSS 显示真实字节进度，FFmpeg 显示阶段 + elapsed + indeterminate，禁止伪百分比。
- 不重写历史 migration，只新增前向 migration。
- 删除默认 dry-run、脱敏、强确认、精确 Key、对象验证、数据库完整性和幂等重入；生产媒体、数据库和备份删除必须另获明确授权。
- 外部 ECS/云盘快照由操作员确认，Agent 不代签。
