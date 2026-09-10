# CLAUDE.md

本文件是 `project-fur-forge` 开发与远端部署共用的稳定入口；`AGENTS.md` 指向本文件。项目为“有点小狗工作室”提供图片优先的公开站与轻量管理后台，中文短品牌为“有点小狗”，英文为 `DITE DOG`。本文件保留通用规则、部署结构与关键不变量，具体需求和逐步操作放在链接文档中。

## 1. 先读什么

- 从 [需求导航](agent_docs/README.md) 找到本次任务对应的需求；先读其 `STATE.md`、`requirements/SPEC.md` 与 `implementation/TASKS.md`，再按任务读取 foundation、planning、models、COPY、design 和最新交接。
- 产品、文案、模型与视觉行为分别以对应 SPEC、COPY、models、design 为准；TASKS 是任务勾选权威，STATE 记录当前事实。后续需求只覆盖明确列出的旧条款；未覆盖的基线继续有效。
- 媒体处理与访问读取 [媒体策略](agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md)，并按需求导航核对后续覆盖条款，勿恢复历史退役行为。
- 部署与恢复先读本文第4节，再读取 [DEPLOYMENT](docs/DEPLOYMENT.md) 和 [生产发布手册](agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)；具体环境值与逐步命令以目标版本文档和现场核验为准。
- 新需求从 [模板](agent_docs/_template/) 建立。阶段状态、验收矩阵、临时 SHA、Actions run、截图和 finding 只写入对应需求记录，不在本入口固化。

用户本轮及此前明确授权共同决定工作范围；不把某个历史阶段的限制扩大为全仓库永久限制，也不把需求确认等同于生产执行授权。

## 2. Git 与环境

Windows 使用已安装的 PowerShell 7（`pwsh`），不要使用 Windows PowerShell 5。

先 `git fetch`，核对 `origin/main`、当前分支与工作树；不 force push、不 hard reset、不覆盖用户改动。只暂存本任务文件，提交保持小而可审查。

默认使用 `codex/*` 任务分支，经 PR 合入 `main`。直接在 main 修复的小修例外必须同时满足：

1. 请求者明确是王旻安；无法从上下文确认时，用 `git config user.email` 是否精确等于 `wangminan0811@hotmail.com`（大小写不敏感）确认；
2. 请求明确针对 main 上的小型 bug；
3. 改动局部、可回滚，不涉及 Schema/迁移、数据或媒体删除、安全/隐私、依赖大升级、部署/发布契约或产品范围。

满足时直接在 main 修复和验证；否则走任务分支与 PR。身份例外不授权生产发布、云配置、破坏性操作或跳过测试。不擅自改变仓库 required checks。

## 3. 实现与安全

- 遵守对应需求的业务与退役边界，不新增未经授权的产品能力。
- 复用现有组件、服务与 publication/lease/recovery/purge 链路；`server/utils/` 中 repository 管 SQL/CAS/lease，service 管校验/DTO/事务入口，runner 管持久操作与副作用，recipe 管媒体身份，route 管请求安全边界。
- 公开页面只消费 READY 的公开派生物；原图、私有附件与管理预览保持私有。管理图片沿用认证同源字节接口，不向浏览器签发私有 OSS GET 地址。具体尺寸、会话和缓存规则见媒体策略与部署文档。
- PII 不进入公开 DTO、HTML、URL、analytics、普通日志、错误、localStorage 或真实 fixture；凭据、签名 URL、私有 Object Key 与生产 PII 不进入 Git、截图或聊天。
- 公开内容 SSR 默认可见；动效不以 JavaScript 到达为内容可见前提。反馈使用真实字节进度或阶段、elapsed 与 indeterminate，不伪造百分比。
- 不重写历史 migration，只新增前向迁移。公开像素变化生成新不可变对象，不覆盖已发布 Key。
- 生产媒体、数据库与备份删除必须另获明确授权；执行遵守 dry-run、脱敏、强确认、精确对象验证、完整性检查与幂等重入。
- 目标环境事实必须现场验证；外部 ECS/云盘快照由操作员确认，不由 Agent 代签。

## 4. 远端部署与恢复

开发和部署使用同一仓库，但服务器运行冻结镜像，不从工作树构建应用。部署前同时读取 [DEPLOYMENT](docs/DEPLOYMENT.md)、[生产发布手册](agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md) 与本次版本的迁移/交接记录；历史阶段编号、服务器快照与“尚未上线”等状态须结合对应 STATE 和当前授权核对，不能当成永久结论。

### 拓扑与配置落点

```text
访客/管理员 --HTTPS--> ESA
  页面/API --HTTP:80--> 宿主机 Nginx --> 127.0.0.1:3000 --> Nuxt/Nitro app --> SQLite 持久卷
  公开媒体 ------------> ESA 托管 STS 私有回源 --> 网页衍生 Bucket

管理员浏览器 --条件签名 PUT--> 私有原图 Bucket 的公网 OSS 地址
管理员浏览器 --认证同源图片 GET--> ESA/Nginx --> app --> 私有原图 Bucket（原图/OSS 缩略图）
app / one-shot ops --OSS SDK Endpoint--> 私有原图 Bucket + 网页衍生 Bucket
```

| 配置 | 权威文件 |
| --- | --- |
| app、环境注入、持久卷与一次性运维容器 | [docker-compose.yaml](docker-compose.yaml) |
| 宿主机 Nginx、Host 与反向代理 | [app.conf.template](deploy/nginx/app.conf.template) |
| ESA 缓存、绕过与撤销规则 | [cache-policy.json](deploy/esa/cache-policy.json) |
| ESA 源站保护、防护与可观测性 | [security-observability-policy.json](deploy/esa/security-observability-policy.json) |

### 部署不变量

- Compose 只有一个常驻 `app`；migrate、preflight、init、backup、restore、recover 复用同一冻结镜像，以一次性容器执行。SQLite 数据与备份保存在持久卷，不随 app 容器重建丢失。
- 宿主机只将 app 端口映射到 `127.0.0.1:3000`；Nginx 在宿主机运行，只监听 HTTP/80；TLS 在 ESA 边缘终止。不要通过开放公网3000、增加宿主机TLS或把Nginx搬进Compose绕过故障。
- 公开、管理、媒体 Host 精确隔离；未知 Host 和到达 Nuxt 的媒体 Host 返回 `421`。生产源站80只允许当前 ESA 回源地址；受信代理范围按现场网络核验，不照搬历史 CIDR。
- 两只 OSS Bucket 都是 private；公开页面只消费 `public-media.ditedog.com` 上 READY 的网页派生物。ESA 私有回源的 STS 由阿里云托管，应用不保存或刷新 STS，不以开放 Bucket 公读解决访问失败。
- `OSS_ENDPOINT` 供服务端 SDK，`OSS_UPLOAD_BASE_URL` 供浏览器条件 PUT，`MEDIA_BASE_URL` 供公开 ESA URL，三者不得混用。
- 管理图片由认证同源接口返回字节，不向浏览器签发私有 OSS GET 地址或302跳转。列表/卡片320、出厂照640、Hero编辑/作品设定图/领养封面/委托详情1280；原图由管理员显式点击后在新窗口内联预览。图片与被动会话检查不延长八小时闲置有效期。
- API、管理、会话和写操作绕过共享缓存；不可变 `/_nuxt/**` 和公开派生媒体可长缓存，具体规则按ESA配置文件。下架先撤销公开投影，再精确purge；两者分别验证。
- 服务器按 `repository@sha256:digest` 部署，不在服务器build，不用 `latest` 或可变tag作为部署身份。仓库中的Compose、运维脚本与文档须与目标冻结SHA匹配，不能用最新main替代已选定版本。
- 目标环境 `.env`、Secret 和 SMTP 等配置按部署文档维护，不覆盖已有值、不打印完整配置或执行 `source .env`。环境修改后按文档重建容器，并验证实际生效，不能只检查文件文本。

### 每次部署的核验顺序

1. 确认本次授权范围、目标主机/目录、冻结SHA、已发布镜像digest与回滚依据；本地提交、工作流已启动和镜像已发布是不同状态。
2. 只读核对服务器工作树、当前镜像、持久卷、端口、Nginx、ESA/OSS及配置；保护已有修改和Secret，不用通用安装器覆盖现有环境。
3. 按目标版本Runbook执行停写要求、备份与迁移前检查，再用同一冻结镜像运行迁移、preflight和必要的一次性操作；生产删除、恢复覆盖及外部快照遵守各自授权和确认要求。
4. 核验拉取镜像摘要，启动/重建app；检查ready、精确Host、公开页面、管理同源预览、公开媒体与缓存，并记录目标环境证据。
5. 异常时按恢复手册处理；先核对数据库兼容性与备份，不能把换回旧镜像当成数据库已恢复。分别记录迁移、服务恢复、缓存撤销及最终生产状态。

## 5. 验证与交接

- 文档-only：检查链接、状态、术语和跨文档一致性。
- 普通代码：lint、typecheck、受影响 core；Nuxt/runtime/config 变更追加 build。常用命令为 `pnpm check:fast`、`pnpm test:core`、`pnpm test:smoke`。
- UI 使用真实浏览器，覆盖对应需求的响应式、键盘/焦点、触控、prefers-*、图片 decode、console/network、性能和溢出验收；自动化不代签审美与真实手机验收。
- `pnpm test:release`、镜像、Compose、恢复和 Nginx 检查仅在明确的 release/manual 范围执行。
- 测试失败先区分稳定不变量与过时文案/DOM/class/时序断言；不为全绿回退产品行为。Actions 无步骤且标注 billing/spending limit 的失败属于基础设施状态。
- 实现、自动测试、独立 Review、人工验收、远程 CI、镜像发布与生产部署分别记录；历史任务关闭不补签未执行事项。
