# 任务清单：兽装工作室主页

> **角色**：当前唯一可勾选实施分解。
> **最后校准**：2026-08-10。
> **规则**：用户验收由用户签署；独立 Review 只能由未参与该实现的新上下文签署。已取消任务的勾选表示范围决策关闭，不表示功能曾实现。

## 当前目标与阶段边界

阶段 A–D 已完成，阶段 D 用户门禁于 2026-08-09 关闭；阶段 D/E 的独立综合 Review 仍由 T49 执行。

当前进入：

> **阶段 E · 完成全部产品与上线基线开发并冻结可上线 SHA。**
>
> T46 访问统计 → T51/T51-F1～F4 公开体验与媒体修复 → T52-E1～E6 生产媒体与部署能力 → T49 同一 SHA CI/独立 Review → T50 最终受控环境回归 → GATE-E。

GATE-E 通过后才进入：

> **阶段 F · 用户和远程开发机执行。**
>
> T53-F1 参数确认 → F2 阿里云控制台 → F3 远程机部署/恢复演练 → F4 正式域名验收 → F5 用户签署与证据闭环。

阶段 F 不再开发应用源码、迁移、Dockerfile、Compose、Nginx/ESA 冻结模板、运行时 Schema 或发布镜像。实际运维需要时，允许新增或调整独立小型运维脚本及其最小测试/文档；若必须改变应用、数据模型、公开行为或冻结契约，则停止 F、重新打开对应阶段 E 任务，修复后重跑 T49、T50 和 GATE-E。

生产媒体规则以 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源。阶段 F 人工步骤以 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md) 为执行清单。

## 执行规则

- 写入前读取远端最新 `main`，所有写入串行完成；
- 不 force push、不硬 reset、不删除或清空 `.env`；
- 不重写已经执行的迁移，只新增前向迁移；
- 当前两只 OSS Bucket 可以直接切换权限，不保留旧匿名 URL 或开发站前向兼容；
- 生产 Endpoint、浏览器上传 Endpoint 与 ESA 媒体 origin 分场景；
- 下架、发布、ESA purge 和清理使用持久状态与精确 manifest；
- 阶段 E 负责所有产品代码、发布模板、核心命令、产品测试和 Review；阶段 F 主要填写目标环境值、运行入口、操作控制台和记录证据，可按前述边界补充独立运维脚本；
- UI、媒体和公开投影必须做真实浏览器、三视口、console/network 与图片解码检查；
- dated notes 记录事实与首次失败，不覆盖当前 SPEC、PLAN、TASKS 或 STATE；
- 不为已取消任务预建表、路由、页面、导航或通用框架。

## 已完成阶段（简表）

### 门禁

- [x] **GATE-01～GATE-07**：需求、技术、设计、实施授权、管理员认证、双 Bucket 和作品水印基础门禁。
- [x] **EXT-01～EXT-02**：正式素材登记与历史 OSS 能力预检。
- [x] **GATE-C1**：阶段 C 产品与工程收口；2026-08-07 用户浏览器验收通过，发布级 CI 与正式环境门禁后置。

### A. T01–T09 · 设计与工程底座

- [x] 双访问面、运行配置、共享契约、公开/管理视觉基线和基础 Review 已完成。

### B. T10–T21 · 第一件作品垂直切片

- [x] SQLite/Drizzle、唯一管理员、角色化条件直传、媒体核验/派生、作品 CRUD、发布/下架、SSR 详情和首页/列表已完成。

### C/C.1. T22–T34-F8 · 核心产品与工程收口

- [x] 完整作品与领养、首页、委托、关于/政策、SEO、备份恢复、安全、性能和三视口已完成。
- [x] 站点无水印/作品水印媒体身份、文案分区并发、五层后端边界、operation lease/heartbeat/recovery、Node 24 镜像、Compose/Nginx 与 CI 结构已完成。
- [x] 阶段 C 用户验收已完成；同一 SHA 发布级 CI 仍由 T49 收口。

### D. T35–T42 · 返图与轻量展会掉落

- [x] **T35/T35-F1**：`return_characters` 设定 + 多张 `return_photos`；作品关联可选，返图发布不依赖作品。
- [x] **T36/T35-F2/F3**：私有返图上传、无水印派生、持久发布/下架、设定管理、随机 `/returns` 和设定页。
- [x] **T37**：复用 adoption 的 `event_drop`、展会名称/时间、公开筛选、首页和详情。
- [x] **T35-F4～F7**：公开倒序、首页精选顺序、管理列表共用外壳、删除、委托页和许可证页修复。
- [x] **T38/T39/T40/T41**：按用户决策取消或并入，不建设额外文案、slug 历史、回收站或独立手机后台。
- [x] **T42**：用户人工验收关闭；独立 Review 移交 T49。记录见 [`notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](./notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。

## E. 全部产品/上线基线开发、自动化门禁与代码冻结

### 已关闭范围决策

- [x] **T43**：取消邮件找回密码，保留离线单管理员重置。
- [x] **T44**：取消 CSV 导出中心。
- [x] **T45**：取消永久原图档案 UI。
- [x] **T47**：取消高级媒体恢复/批量运维 UI，保留受控 CLI。
- [x] **T48**：完成阿里云生产边缘与隔离调研；当前 ESA 实现全部纳入 T52-E1～E6。

### T46 · 最小化第一方访问统计

- [x] **T46-B · 后端与数据契约**：
  - [x] 新前向迁移建立最小事件表和必要索引；
  - [x] 白名单事件只含页面浏览、作品详情、返图设定页和官方联系行动；
  - [x] 只保存规范 route key、可选公开实体 ID、事件时间和域分离 HMAC 会话标识；
  - [x] 不保存 IP、User-Agent、Referer、原始 URL/查询串、Cookie、联系方式或指纹；
  - [x] 原始事件滚动保留 90 天，清理幂等且不增加常驻 worker；
  - [x] 管理 API 提供今日/7 天/30 天、页面/内容排行与联系行动计数；
  - [x] 公开写入有严格 Schema、body limit、速率限制和安全错误。

- [x] **T46-F/V · 管理端、公开采集与实现验证**：
  - [x] 增加 `/admin/analytics`，保持低频只读，不引入通用 BI；
  - [x] 公开端用同源 `fetch keepalive` 最佳努力上报，失败不阻断页面；
  - [x] 不引入第三方统计、Cookie、localStorage、跨站追踪或浏览器指纹；
  - [x] 完成迁移、清理、HMAC、限流、隐私泄漏、三视口和失败路径测试。
- [ ] **T46-U · 用户确认统计含义和最终隐私文案**；独立 Review 统一在 T49，不由实现自测代签。
_依赖：T42。_

### T51 · 品牌、备案展示能力与正式素材开发

本任务不等待真实备案号才开始开发；空值必须真实隐藏，实际值在阶段 F 写入远程环境。

- [x] 新增独立导航品牌常量：公开桌面、移动导航和复用公开壳的登录页精确为“有点小狗”；
- [x] 不连带修改 `ownerDisplay`、条款版权主体、工作室介绍或其他已确认正文；
- [x] 为 ICP 备案号、备案链接及公安备案状态建立明确、可校验、空值隐藏的生产配置，不编造占位内容；
- [x] 页脚、SEO 和法务投影在未配置/已配置状态均有自动测试；
- [x] 完成当前 tracked 素材的分辨率、比例、品牌衍生、安全区、三视口和低分辨率风险审计；
- [ ] 用户确认 EXT-01 中哪些素材作为正式上线素材，并提供/选择独立竖版 Hero 与需替换的低分辨率设定图；
- [x] 公开导航、页脚、当前素材投影和许可证链接完成浏览器回归。
_依赖：T46；T46 执行期间只允许只读盘点，不得提前写入 T51。实际备案值不阻断开发。_

### T51-F1 · 作品页间距与低分辨率设定图适配修复

- [x] `/works` 页名与筛选条间距收紧，并以浏览器几何断言防止回归；
- [x] 低分辨率 `design_sheet` 允许上传、保存和开始发布，不再返回笼统尺寸阻断；
- [x] 复用现有 publication operation，在 `PREPARING_SOURCE` 阶段用内嵌 FFmpeg Lanczos 生成保持比例、不裁主体的私有适配源；
- [x] 私有适配源使用独立不可变配方身份，永久原图不覆盖，当前公开 `recipe-v3` 只消费验证完成的处理源；
- [x] 设定图区和发布区持续提示“不会恢复细节、原图保留”，适配失败提供稳定中文反馈和重新发布重试路径；
- [x] 完成 unit/integration、管理浏览器发布流程及必要 lint/typecheck/build 门禁；实现自测不代签 T49 独立 Review。
_依赖：T51 工程基线；完成后继续 T51-F2。_

### T51-F2 · 公开作品与领养列表分页

- [x] `/works` 在筛选后按发布时间倒序分页，每页固定 12 件；`/adoptions` 每页固定 8 个；公开端不提供每页数量选择；
- [x] 两个公开列表 DTO 返回 `page`、`pageSize`、`pageCount` 与筛选后的 `resultCount`，第一页省略 `page`，分页链接保留当前筛选，筛选变化回到第一页；
- [x] 复用并统一 `PublicPagination` 的公开图片型页面样式，桌面显示编号与上一页/下一页，手机收紧可见页码；有结果时单页仍显示分页栏并禁用两端，当前页、键盘焦点和触控尺寸明确；
- [x] 非法页码收敛为第一页，超出末页显示可回到当前筛选第一页的受控空态，不抛 500；
- [x] 完成 repository/API 契约、SSR、筛选组合、无私有字段与三固定视口浏览器回归；实现自测不代签 T49 独立 Review。
_依赖：T51-F1；完成后继续 T52-E1。_

### T51-F3 · 低分辨率出厂照非阻断适配

- [x] 低分辨率 `studio_photo` 允许上传、保存和开始发布，发布检查不再返回尺寸硬阻断；
- [x] 复用现有 publication operation，在 `PREPARING_SOURCE` 阶段按 `detail` / 主图 `work-card` 用途计算最小几何尺寸，并用内嵌 FFmpeg Lanczos 生成保持比例的私有适配源；
- [x] 私有适配源使用独立不可变 `studio-photo-upscale-lanczos-v1` 身份，永久原图不覆盖，当前公开 `recipe-v3` 与卡片裁切消费验证完成处理源的实际尺寸；
- [x] 出厂照区和发布区持续提示“不会恢复细节、原图保留”，适配失败提供稳定中文反馈和重新发布重试路径；
- [x] 同步共享 Schema、unit/integration、管理浏览器流程及必要 lint/typecheck/build 门禁；实现自测不代签 T49 独立 Review。
_依赖：T52-E1～E6 工程基线；完成后进入 T51-F4。_

### T51-F4 · 管理端 FFmpeg 可见进度与作品竖图水印

- [x] 管理端所有 FFmpeg 入口显示与 OSS 上传同等醒目的动态等待进度、当前阶段和已等待时间，不再只有禁用按钮；
- [x] 覆盖大文件上传私有预处理、Hero 放大、设定图/出厂照发布适配和失败后的处理重试；持久 Hero operation 在刷新后恢复阶段，作品发布在当前请求期间持续反馈；
- [x] 单张静态图不伪造连续百分比；FFmpeg 使用不定量进度，OSS 字节上传与公开变体继续显示各自真实计数；
- [x] 内嵌 FFmpeg 改为异步子进程，保持固定 binary、120 秒上限、30 MB 输出上限和安全错误，处理期间 Nitro 可继续响应轮询；
- [x] 作品公开配方升级为 `recipe-v3`：3:4 卡片和竖版出厂照详情的单居中水印随输出宽度等比放大；横版详情与设定图左右双水印保持不变；
- [x] 新配方使用新不可变 Key，公开投影优先完整 `recipe-v3` 并只整体回退完整 `recipe-v2` / `recipe-v1`；补充 unit/integration、管理浏览器及必要 lint/typecheck/build 门禁；实现自测不代签 T49 独立 Review。
_依赖：T51-F3；完成后进入 T49。_

### T52 · 生产媒体与远程部署能力开发

#### T52-E0 · ESA 方案重定向与服务器基础设施基线

- [x] 根据用户选择把正式边缘方案收敛为 ESA NS、ESA 边缘 TLS、ESA 私有 OSS 回源和 ECS HTTP/80 origin；
- [x] 完成官方文档核对并同步活文档、历史覆盖关系和 T52/T53 任务边界；
- [x] 按用户明确授权卸载 `120.26.51.205` 的 acme.sh/续期 cron/本地证书目录，关闭 Nginx 443，把宿主机收敛为 HTTP/80 origin，并完成 `nginx -t`、service、端口与 Host 拒绝验证；
- [x] 用户已配置 `public-media.ditedog.com` 同账号私有 OSS 回源，并已把 ECS origin 限制为 HTTP/80；业务侧不实现阿里云托管的回源 STS。

#### T52-E1 · Endpoint 与运行时配置

- [x] `OSS_ENDPOINT` 只供服务端 SDK：杭州远程机为内网 Endpoint，本地为公网 Endpoint；
- [x] `OSS_UPLOAD_BASE_URL` 真正控制浏览器条件 PUT Host，不能含 `-internal`；
- [x] `MEDIA_BASE_URL` 在 production 固定为/只接受 `https://public-media.ditedog.com`，拒绝原始 OSS Bucket 域名；
- [x] 同步 `.env.example`、`.env.compose.example`、`config/runtime.example.json`、Schema、测试、production verify 和部署文档；
- [x] 增加 ESA Site/API Endpoint 配置；OSS 与 ESA API 按用户真实部署共用 `.env` 中现有一套静态阿里云 AK/SK，不增加 ECS RAM Role，也不在业务侧实现 ESA 回源 STS。

#### T52-E2 · OSS/ESA preflight 与权限验证程序

- [x] 重写受控 preflight，不再要求 public-read 或原站匿名 200；
- [x] 自动检查两只原始 OSS 域名匿名 403、共享阿里云凭据业务能力、条件上传失败面、已发布 ESA 媒体 URL 200；
- [x] 检查 Bucket ACL/BPA、Object ACL/Policy、CORS、生命周期和 ESA 只回源衍生 Bucket；
- [x] 检查网页衍生 Bucket 只含允许公开展示的对象；检查现有阿里云 AK/SK 具备 purge/查询和 OSS 所需能力，不再把控制面越权拒绝作为门禁；
- [x] 提供 dry-run、脱敏输出和非零退出码；阶段 F 可补诊断/证据采集包装器，但不得改变该入口的判定契约。

#### T52-E3 · ESA 同账号私有 OSS 回源

- [x] 范围确认：阿里云自动使用 STS 临时令牌和回源 `Authorization`，业务应用不申请、不保存、不轮换 STS；
- [x] 范围确认：首版不做自定义边缘 URL 鉴权，后续需要时作为独立迭代；
- [x] 所有公开 SourceSet/SSR/API 使用稳定的 `public-media` ESA HTTPS URL，不返回原始 OSS URL 或私有 Object Key；
- [x] 固化网页衍生 Bucket 只保存已验证公开派生物的门禁，并验证原始 OSS 匿名拒绝、ESA 已发布媒体可读；
- [x] 同步 runtime、preflight、production verify、测试与控制台说明，不增加媒体鉴权 Key/TTL 配置；
- [x] 管理端登录、Session、Host/Origin/CSRF 等应用认证保持现有契约。

#### T52-E4 · 缓存、下架与 ESA 强制撤销

- [x] 固化 `/_nuxt/**` 长缓存、管理/API/会话绕过、SSR HTML 初始绕过、媒体查询参数/长缓存、404 短缓存和禁用 stale 的 ESA 配置及验证入口；
- [x] 下架先立即撤销页面投影，再精确删除 OSS 对象并提交 `PurgeCaches(Type=file)`；
- [x] 持久保存精确 `public-media` URL、ESA `TaskId`、状态和稳定失败 reason；
- [x] 使用 `DescribePurgeTasks` 收敛，失败可重试，重启不丢 manifest；不做全站 purge 或前缀列举删除；
- [x] 自动/集成测试区分页面立即下架、purge 中、已撤销和撤销失败；撤销完成时间留给 T53 目标环境实测，不承诺 5～6 分钟。

#### T52-E5 · 防盗刷、预算与可观测性准备

- [x] 固化 WAF/速率限制、源站保护和 HTTPS 强制的配置清单与验证脚本；
- [x] 提供页面字节数、冷/热缓存、请求量和峰值的测量入口，阶段 F 只填写实测阈值；
- [x] 准备 ESA 套餐/流量/源站 5xx/边缘 4xx/5xx/缓存命中/purge/边缘证书、ECS/磁盘/Nginx/容器/ready 告警检查表与脱敏证据模板；
- [x] 证书监控只针对 ESA 托管边缘证书与实际公开 Host；宿主机必须验证无 443、无 ACME 调度、Nginx config test/reload 和 HTTP origin 可用；
- [x] 明确 Free 只用于开发/验证，正式套餐与配额在 T53-F1/F2 当日确认；预算只通知、任何用量封顶/套餐配额都可能有统计延迟；
- [x] 不在代码中硬编码未经目标环境测量的费用阈值。

#### T52-E6 · app-only Compose、宿主机 HTTP-only Nginx 与运维命令

- [x] 把正式 Compose 收敛为唯一常驻 Nuxt/Nitro `app`；migrate、preflight、init、backup、restore 和 recover 使用同一冻结镜像的一次性容器，不运行 Nginx 容器或常驻 migrate 服务；
- [x] app 端口固定只绑定 `127.0.0.1:3000`，宿主机 Nginx upstream 固定代理该地址，安全组不开放 3000；保留单实例、非 root、持久卷和健康检查；
- [x] 固化宿主机 Nginx `1.30.4`、systemd 服务、配置目录和安装/升级/回滚入口；不依赖第三方动态模块；
- [x] Nginx 只监听 HTTP/80，不配置 443、证书或 HTTP→HTTPS 跳转；ESA 到 ECS 固定 HTTP/80，客户端 HTTPS 强制和证书由 ESA 边缘承担；
- [x] 正式 `server_name` 只列公开/管理精确域名，媒体 Host 和未知 Host 返回 `421`；移除 wildcard 路由；
- [x] 代理头冻结为客户端 scheme `https`，只信任受控 Nginx/ESA 代理链；验证 Host/Origin/CSRF/Session 在 ESA 后不被错误改写；
- [x] 部署产物不包含 acme.sh、Certbot、DNS API Secret、证书目录、续期 cron/timer 或证书 reload 逻辑；
- [x] 完成 migrate、init-admin、preflight、backup、restore-verify、recover、升级和回滚命令；
- [x] 准备用户授权后发布/传送冻结镜像的唯一入口，能够在远程拉取/载入前核对镜像摘要且不远程重建；
- [x] 在本地/受控环境完成空卷、迁移、重启、备份到新路径、恢复验证、旧镜像回滚、Host/proxy header、loopback 隔离、Nginx config test/reload 和 443 关闭验证；
- [x] Handbook 中每个核心远程步骤都有基线命令、预期结果、停止条件和回滚入口；便利性或目标环境诊断脚本可在阶段 F 补充；
- [x] 不创建 `v*` tag，不在阶段 E 未授权发布正式镜像。

### T49 · 同一 SHA CI 与独立综合 Review

- [x] 基于届时最新 `main` 复现历史 Actions 失败并修复；
- [x] frozen install、lint、typecheck、unit、integration、production build、production verify、secret scan、app-only Compose、宿主机 HTTP-only Nginx/ESA 部署契约静态检查全部通过；
- [x] 检查部署产物不含 Nginx 容器、acme.sh、Certbot、证书/ACME Secret 或续期调度；
- [x] `checks`、`image-build`、`e2e` 在同一个最新 SHA 成功，`skipped` 不算成功；
- [x] 新上下文独立 Review 阶段 D 最终代码以及 T46、T51、T52-E1～E6；
- [x] 保留首次 finding/NOT PASS 并逐项修复、重测；最后一项修复按用户 2026-08-10 明确授权不再追加 fresh reviewer，例外与证据见 T49 Review note；
- [x] 不删除测试或放宽类型、安全、媒体、隐私、部署断言。
_依赖：T46、T51、T51-F1～F4、T52-E1～E6。_

#### T49-R1 · 远端 Node ESM 缺陷修复后的重新门禁

- [x] 在 Node 24 原生 ESM 下复现 `@alicloud/esa20240910` 默认导出为
  CommonJS 模块对象，确认 live preflight 在任何云写入前停止；
- [x] 用同一 namespace 归一化入口修复 preflight 和 Nitro ESA purge，
  不热改旧容器、不放宽 preflight；
- [x] 增加原生 Node ESM client/request 构造回归，并把 Docker 依赖守卫从
  “只 import”提升为实际构造；
- [x] 本地完成 lint、typecheck、unit、串行 integration、production
  build/guard、Nitro 产物导入检查、production verify、ESA/observability
  policy 与 Secret scan；
- [x] 包含实现与修复记录的 SHA `4e24916` 已在 Actions run
  `31392080770` 取得 `checks`、`image-build`、`e2e` 全部成功；
- [ ] 新上下文独立 Review preflight、Nitro 产物、Docker 守卫及停止/恢复
  边界；实现者不得代签。
- [ ] Review 通过后重新发布不可变镜像，保存新的
  `repository@sha256:digest`，远端不得继续使用旧镜像。
_依赖：实现提交 `70538e0`；完成后才可继续 T50/GATE-E 或远端 live preflight。_

### T50 · 代码冻结前最终回归

- [ ] 管理 `localhost` / 公开 `127.0.0.1` 与等价预览 Host 分开验证；
- [ ] 三固定视口覆盖全部公开页和主要管理流程；
- [ ] 覆盖成功、409、失败、恢复、重载、图片解码、横竖图、键盘/焦点、减少动效、console/network；
- [ ] 重放作品、返图、Hero、profile、reconcile 和 ESA purge 的中断/重复重启；
- [ ] 验证 Endpoint 拆分、ESA 媒体访问、下架状态、app loopback、宿主机 HTTP-only Nginx 代理、边缘 TLS/源站保护契约、安全 reload、部署命令、备份/恢复和无敏感泄漏；
- [ ] 形成同一 SHA 的 Review 记录和 artifact 清单。
_依赖：T49。_

### GATE-E · 可上线开发冻结

- [ ] T46、T51、T52-E1～E6、T49、T50 全部关闭；
- [ ] 远程 `.env` 所需变量名、类型、必填条件和 Secret 边界均已冻结；
- [ ] ESA NS/边缘 TLS/HTTP origin、精确 Host、源站保护、宿主机无 ACME/443 和安全 reload 基线均已记录；
- [ ] Handbook 不再包含“待开发”“以后补命令”或要求用户现场写代码的步骤；
- [ ] 目标发布 SHA、镜像摘要、回滚镜像和 artifact 清单唯一；
- [ ] 工作区、跟踪分支和远端 SHA 一致，发布产物守卫干净；
- [ ] REVIEW 签署“可以进入阶段 F”，但不得提前签署“正式上线就绪”。

## F. 用户与远程开发机执行

### T53-F1 · 上线参数与人工确认

- [ ] 用户填写真实公开/管理域名、ICP备案号/链接和公安备案状态；公开媒体域名固定为 `public-media.ditedog.com`；
- [ ] 用户确认正式 Logo、Hero、作品、返图和备案显示；
- [ ] 用户在远程 `.env` 中保存 ESA Site/API Endpoint、现有一套阿里云 AK/SK 和 Session Secret；OSS 与 ESA API 共用该 AK/SK；
- [ ] 用户确认月度预算、异常费用容忍和待实测的封顶原则；
- [ ] 用户选择并明确授权 GATE-E 冻结镜像的发布/传送方式；未授权时不得进入 F3；
- [ ] 核对发布 SHA/镜像摘要，阶段 F 不切换到未通过 GATE-E 的构建。
_依赖：GATE-E、备案审批/同步。_

### T53-F2 · 阿里云控制台人工配置

- [ ] 用户把 wildcard DNS 收敛为公开/管理精确记录，复核已经生效的 ECS HTTP/80 回源和 ESA 边缘 HTTPS；
- [ ] 用户按 Handbook 复核 `public-media` 同账号私有 OSS 回源，并配置缓存、源站保护/WAF、正式套餐、保守初始用量封顶和告警；F3 目标环境实测后再校准阈值；
- [ ] 用户把两只现有 Bucket 改为 private + BPA，核对 Object ACL/Policy、CORS、生命周期和 RAM；
- [ ] 用户确认现有全权限阿里云 AK/SK 可用于 OSS 与 ESA purge/查询，并记录该权限边界与 Secret 保管方式；本版本不再建立第二套 ESA 凭据；
- [ ] 用户核对/完成公开与管理 DNS、`public-media` CNAME、ESA 边缘证书和基础防护；已提前存在的 NS/CNAME/A 只作为现状复核，不提前关闭本任务；
- [ ] 每步保留脱敏截图/任务 ID，不把“已提交”写成“已完成”。
_依赖：T53-F1。_

### T53-F3 · 远程开发机部署与恢复演练

- [ ] 在远程开发机填写生产 `.env`，只使用 GATE-E 冻结的变量；
- [ ] 按 F1 授权和 T52-E6 冻结入口发布/传送镜像；远程拉取/载入后核对摘要，不重新构建；
- [ ] 使用该固定镜像执行 migrate、preflight、init-admin、启动和 ready；
- [ ] 复核 Nginx `1.30.4` 的 HTTP-only 配置、systemd 状态、无 acme.sh/证书/续期 cron、80 监听和 443 关闭；
- [ ] 把正式 Nginx `server_name` 收敛到公开/管理精确域名；其他 Host 以及媒体 Host 由默认/专用 server 拒绝；
- [ ] Compose 只有一个常驻 app，`127.0.0.1:3000` 可被宿主机 Nginx 访问但不能从公网访问；ESA 通过 80 回源，客户端 HTTPS 只在边缘终止；
- [ ] 在不切正式 DNS 的目标环境测量冷/热缓存、页面字节数和峰值，据此校准 F2 初始用量封顶与告警；
- [ ] 完成空卷、持久卷、备份、恢复到新路径、升级、旧镜像回滚和进程恢复演练；
- [ ] 验证 ECS 服务端走杭州内网 Endpoint，浏览器 PUT 仍走公网 Bucket 域名；
- [ ] 若实际运维需要，受控新增/调整独立小脚本及最小测试/文档：默认 dry-run、脱敏、目标明确、可回滚，单独提交并记录验证；
- [ ] 不热改应用源码、容器内文件、迁移、运行时契约、Compose、Nginx/ESA 冻结模板或发布镜像。
_依赖：T53-F2。_

### T53-F4 · 正式域名全链验证

- [ ] 原始 OSS 匿名 403，已发布 ESA 媒体 200，未发布/已撤销媒体不可读；
- [ ] 查询参数收敛、CORS 条件 PUT、页面立即下架和 ESA purge 目标环境实测通过并记录完成时长；
- [ ] 三视口、双 Host、全部公开页、主要管理流程、统计隐私、console/network 通过；
- [ ] ESA 公开/管理/媒体边缘 TLS 链、SAN 与有效期正确；ECS 443/app 端口公网不可达，未知 Host 拒绝，源站保护和 Nginx 安全 reload 监控通过；
- [ ] 告警、预算通知、用量封顶、备份/恢复和回滚证据齐全；
- [ ] 发现冻结应用/契约缺陷时停止 F，退回 E 修复并重跑 T49/T50/GATE-E；仅运维脚本缺口可留在 F 受控补充。
_依赖：T53-F3。_

### T53-F5 · 用户验收与文档闭环

- [ ] 用户在正式域名完成浏览、上传、发布、下架、冲突、失败和恢复操作；
- [ ] 用户确认“有点小狗”导航、正式素材、备案、统计含义和隐私文案；
- [ ] 用户确认稳定 ESA 媒体 URL、页面立即下架与 T53 实测的 ESA 服务器侧撤销语义；
- [ ] 未关闭 P0/P1 finding 为 0，接受的 follow-up 明确登记；
- [ ] 更新验收证据、checkbox、STATE 和历史 notes；允许单独记录运维脚本提交，若需产品/应用代码或冻结契约变更则返回 E；
- [ ] 用户签署“正式上线就绪”。
_依赖：T53-F4。_

## 每项完成定义

阶段 E 实施任务至少留下范围、非目标、迁移/回滚边界、实际门禁、浏览器/媒体证据、失败历史、独立 Review 和同步活文档。

阶段 F 留下脱敏云配置、远程命令结果、恢复演练、正式浏览器证据和用户签署；如补充运维脚本，还必须留下独立 commit、适用范围、dry-run/针对性验证和回滚说明，不得混入产品开发提交。

阶段 D 已完成不等于正式上线就绪。只有 GATE-E 与 T53-F1～F5 全部关闭，才能宣布发布完成。
