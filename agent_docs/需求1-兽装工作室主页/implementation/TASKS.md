# 任务清单：兽装工作室主页

> **角色**：当前唯一可勾选实施分解。
> **最后校准**：2026-08-09。
> **规则**：用户验收由用户签署；独立 Review 只能由未参与该实现的新上下文签署。已取消任务的勾选表示范围决策关闭，不表示功能曾实现。

## 当前目标与阶段边界

阶段 A–D 已完成，阶段 D 用户门禁于 2026-08-09 关闭；阶段 D/E 的独立综合 Review 仍由 T49 执行。

当前进入：

> **阶段 E · 完成全部产品与上线基线开发并冻结可上线 SHA。**
>
> T46 访问统计 → T51 品牌/备案展示能力 → T52-E1～E6 生产媒体与部署能力 → T49 同一 SHA CI/独立 Review → T50 最终受控环境回归 → GATE-E。

GATE-E 通过后才进入：

> **阶段 F · 用户和远程开发机执行。**
>
> T53-F1 参数确认 → F2 阿里云控制台 → F3 远程机部署/恢复演练 → F4 正式域名验收 → F5 用户签署与证据闭环。

阶段 F 不再开发应用源码、迁移、Dockerfile、Compose、Nginx/ACME 冻结模板、运行时 Schema 或发布镜像。实际运维需要时，允许新增或调整独立小型运维脚本及其最小测试/文档；若必须改变应用、数据模型、公开行为或冻结契约，则停止 F、重新打开对应阶段 E 任务，修复后重跑 T49、T50 和 GATE-E。

生产媒体规则以 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源。阶段 F 人工步骤以 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md) 为执行清单。

## 执行规则

- 写入前读取远端最新 `main`，所有写入串行完成；
- 不 force push、不硬 reset、不删除或清空 `.env`；
- 不重写已经执行的迁移，只新增前向迁移；
- 当前两只 OSS Bucket 可以直接切换权限，不保留旧匿名 URL 或开发站前向兼容；
- 生产 Endpoint、浏览器上传 Endpoint 与 CDN 媒体 origin 分场景；
- 下架、发布、CDN 刷新和清理使用持久状态与精确 manifest；
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
- [x] **T48**：完成阿里云 CDN 与生产隔离调研；实现全部纳入阶段 E 的 T52-E1～E6。

### T46 · 最小化第一方访问统计

- [ ] **T46-B · 后端与数据契约**：
  - [ ] 新前向迁移建立最小事件表和必要索引；
  - [ ] 白名单事件只含页面浏览、作品详情、返图设定页和官方联系行动；
  - [ ] 只保存规范 route key、可选公开实体 ID、事件时间和域分离 HMAC 会话标识；
  - [ ] 不保存 IP、User-Agent、Referer、原始 URL/查询串、Cookie、联系方式或指纹；
  - [ ] 原始事件滚动保留 90 天，清理幂等且不增加常驻 worker；
  - [ ] 管理 API 提供今日/7 天/30 天、页面/内容排行与联系行动计数；
  - [ ] 公开写入有严格 Schema、body limit、速率限制和安全错误。

- [ ] **T46-F/V · 管理端、公开采集与实现验证**：
  - [ ] 增加 `/admin/analytics`，保持低频只读，不引入通用 BI；
  - [ ] 公开端用同源 `sendBeacon`/`fetch keepalive` 最佳努力上报，失败不阻断页面；
  - [ ] 不引入第三方统计、Cookie、localStorage、跨站追踪或浏览器指纹；
  - [ ] 完成迁移、清理、HMAC、限流、隐私泄漏、三视口和失败路径测试；
  - [ ] 用户确认统计含义和最终隐私文案；独立 Review 统一在 T49。
_依赖：T42。_

### T51 · 品牌、备案展示能力与正式素材开发

本任务不等待真实备案号才开始开发；空值必须真实隐藏，实际值在阶段 F 写入远程环境。

- [ ] 新增独立导航品牌常量：公开桌面、移动导航和复用公开壳的登录页精确为“有点小狗”；
- [ ] 不连带修改 `ownerDisplay`、条款版权主体、工作室介绍或其他已确认正文；
- [ ] 为 ICP 备案号、备案链接及公安备案状态建立明确、可校验、空值隐藏的生产配置，不编造占位内容；
- [ ] 页脚、SEO 和法务投影在未配置/已配置状态均有自动测试；
- [ ] 用户确认 EXT-01 素材是否为正式上线素材；替换项、低分辨率提示和三视口视觉校准在 E 完成；
- [ ] 公开导航、页脚、正式素材和许可证链接完成浏览器回归。
_依赖：T46；T46 执行期间只允许只读盘点，不得提前写入 T51。实际备案值不阻断开发。_

### T52 · 生产媒体与远程部署能力开发

#### T52-E1 · Endpoint 与运行时配置

- [ ] `OSS_ENDPOINT` 只供服务端 SDK：杭州远程机为内网 Endpoint，本地为公网 Endpoint；
- [ ] `OSS_UPLOAD_BASE_URL` 真正控制浏览器条件 PUT Host，不能含 `-internal`；
- [ ] `MEDIA_BASE_URL` 在 production 只接受 CDN origin，拒绝原始 OSS Bucket 域名；
- [ ] 同步 `.env.example`、`.env.compose.example`、`config/runtime.example.json`、Schema、测试、production verify 和部署文档；
- [ ] 保持应用静态 OSS/CDN AK/SK，不增加 ECS RAM Role 或客户端 STS；T52-E6 的 ACME DNS-only RAM Key 是宿主机独立 Secret，不属于应用 runtime。

#### T52-E2 · OSS/CDN preflight 与权限验证程序

- [ ] 重写受控 preflight，不再要求 public-read 或原站匿名 200；
- [ ] 自动检查两只原始 OSS 域名匿名 403、应用权限通过、越权拒绝、CDN 有效 URL 200；
- [ ] 检查 Bucket ACL/BPA、Object ACL/Policy、CORS、生命周期和 CDN 只回源衍生 Bucket；
- [ ] 提供 dry-run、脱敏输出和非零退出码；阶段 F 可补诊断/证据采集包装器，但不得改变该入口的判定契约。

#### T52-E3 · CDN 私有回源与约 24 小时 URL 鉴权

- [ ] 实现鉴权方式 A 的单一服务端 signer；
- [ ] 实现 `CDN_URL_AUTH_ACTIVE_KEY`、`PRIMARY_KEY`、`SECONDARY_KEY`、`TTL_SECONDS=86400` 及轮换校验；
- [ ] 所有公开 SourceSet/SSR/API 动态生成 CDN URL，不返回永久 OSS URL；
- [ ] 有效、过期、篡改、缺签名和日志脱敏测试齐全；
- [ ] 分享和永久 URL 明确后置。

#### T52-E4 · 缓存、下架与 CDN 强制撤销

- [ ] 固化查询参数、缓存、404 短缓存和禁用 stale 的目标配置及验证入口；
- [ ] 下架先立即撤销页面投影，再精确删除 OSS 对象并提交 `RefreshObjectCaches`；
- [ ] `Force=true`、`ObjectType=File`，持久保存无鉴权参数的精确 URL、任务 ID、状态和失败；
- [ ] 使用 `DescribeRefreshTasks` 收敛，失败可重试，重启不丢 manifest；
- [ ] 自动/集成测试区分页面立即下架、刷新中、已撤销和撤销失败。

#### T52-E5 · 防盗刷、预算与可观测性准备

- [ ] 固化 URL 鉴权为主、Referer 为辅的配置清单和验证脚本；
- [ ] 提供页面字节数、冷/热缓存、请求量和峰值的测量入口，阶段 F 只填写实测阈值；
- [ ] 准备 CDN/ECS/磁盘/证书/容器/ready 告警检查表与脱敏证据模板；
- [ ] 证书监控必须覆盖到期时间、acme.sh root cron 存在性与最近续期结果、DNS 清理、Nginx config test 与 reload 失败；不得只监控证书文件存在；
- [ ] 明确预算只通知、用量封顶有延迟、当前不购买高防或 ESA；
- [ ] 不在代码中硬编码未经目标环境测量的费用阈值。

#### T52-E6 · app-only Compose、宿主机 Nginx/ACME 与运维命令

- [ ] 把正式 Compose 收敛为唯一常驻 Nuxt/Nitro `app`；migrate、preflight、init、backup、restore 和 recover 使用同一冻结镜像的一次性容器，不运行 Nginx 容器或常驻 migrate 服务；
- [ ] app 端口固定只绑定 `127.0.0.1:3000`，宿主机 Nginx upstream 固定代理该地址，安全组不开放 3000；保留单实例、非 root、持久卷和健康检查；
- [ ] 记录并兼容宿主机现有 Nginx `1.30.4`、systemd 服务、配置目录和安装/升级/回滚入口；不依赖第三方动态模块，也不要求重装；
- [ ] 记录并复用 acme.sh `3.1.5`、Let's Encrypt、`dns_ali` 和现有 `ditedog.com` / `*.ditedog.com` ECDSA 证书；不改用 Certbot 或 `nginx-module-acme`，不要求重新签发当前有效证书；
- [ ] 复用现有每 6 小时执行 `acme.sh --cron` 的 root cron；确认只有一份调度，不新增 systemd timer；
- [ ] 继续通过 `--install-cert --ecc` 使用 `/etc/nginx/ssl/ditedog.com/` 稳定 key/fullchain 路径；reload command 唯一语义为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`，Nginx 不读取 acme.sh 内部证书目录；
- [ ] 通配符只用于证书覆盖；正式 Nginx `server_name` 只列公开/管理精确域名，其他 Host/SNI 由默认 server 拒绝；
- [ ] 为 ACME 定义独立 DNS-only RAM 权限模板：只在承载公开/管理域名的 DNS zone（跨 zone 时逐个列出）允许 `alidns:DescribeDomainRecords`、`alidns:AddDomainRecord`、`alidns:DeleteDomainRecord`；`Ali_Key`/`Ali_Secret` 只进入 root 限权 config-home，不进入应用 `.env`、Compose、容器或证据；
- [ ] 记录 AliDNS 不能把新增/删除进一步限制为 TXT 的剩余风险，并用专用 Key、最小 zone、DNS 审计和异常监控收敛；不得为省事扩大到 AliDNS FullAccess；
- [ ] 媒体域名 TLS 明确由阿里云 CDN 单独终止；DNS-01 不要求开放 80 或提前切公开/管理 A 记录，80 仅作正常 HTTP→HTTPS 跳转；
- [ ] 完成 migrate、init-admin、preflight、backup、restore-verify、recover、升级和回滚命令；
- [ ] 准备用户授权后发布/传送冻结镜像的唯一入口，能够在远程拉取/载入前核对镜像摘要且不远程重建；
- [ ] 在本地/受控环境完成空卷、迁移、重启、备份到新路径、恢复验证、旧镜像回滚、Host/proxy header、loopback 隔离、Nginx config test 和证书 reload 失败演练；
- [ ] Handbook 中每个核心远程步骤都有基线命令、预期结果、停止条件和回滚入口；便利性或目标环境诊断脚本可在阶段 F 补充；
- [ ] 不创建 `v*` tag，不在阶段 E 未授权发布正式镜像。

### T49 · 同一 SHA CI 与独立综合 Review

- [ ] 基于届时最新 `main` 复现历史 Actions 失败并修复；
- [ ] frozen install、lint、typecheck、unit、integration、production build、production verify、secret scan、app-only Compose、宿主机 Nginx/ACME 部署契约静态检查全部通过；
- [ ] 检查部署产物不含 Nginx 容器、Certbot/`nginx-module-acme` 集成、ACME Secret、第二份续期调度或直接读取 acme.sh 内部证书目录；
- [ ] `checks`、`image-build`、`e2e` 在同一个最新 SHA 成功，`skipped` 不算成功；
- [ ] 新上下文独立 Review 阶段 D 最终代码以及 T46、T51、T52-E1～E6；
- [ ] 保留首次 finding/NOT PASS，修复后逐项重测，不由实现者代签；
- [ ] 不删除测试或放宽类型、安全、媒体、隐私、部署断言。
_依赖：T46、T51、T52-E1～E6。_

### T50 · 代码冻结前最终回归

- [ ] 管理 `localhost` / 公开 `127.0.0.1` 与等价预览 Host 分开验证；
- [ ] 三固定视口覆盖全部公开页和主要管理流程；
- [ ] 覆盖成功、409、失败、恢复、重载、图片解码、横竖图、键盘/焦点、减少动效、console/network；
- [ ] 重放作品、返图、Hero、profile、reconcile 和 CDN refresh 的中断/重复重启；
- [ ] 验证 Endpoint 拆分、CDN 签名、下架状态、app loopback、宿主机 Nginx 代理、acme.sh cron/稳定证书路径/安全 reload、部署命令、备份/恢复和无敏感泄漏；
- [ ] 形成同一 SHA 的 Review 记录和 artifact 清单。
_依赖：T49。_

### GATE-E · 可上线开发冻结

- [ ] T46、T51、T52-E1～E6、T49、T50 全部关闭；
- [ ] 远程 `.env` 所需变量名、类型、必填条件和 Secret 边界均已冻结；
- [ ] 现有 Nginx/acme.sh 兼容基线、Let's Encrypt server、DNS-only RAM 权限、config-home/稳定证书路径、root cron 和安全 reload 均已记录，真实 ACME Secret 不进入 artifact；
- [ ] Handbook 不再包含“待开发”“以后补命令”或要求用户现场写代码的步骤；
- [ ] 目标发布 SHA、镜像摘要、回滚镜像和 artifact 清单唯一；
- [ ] 工作区、跟踪分支和远端 SHA 一致，发布产物守卫干净；
- [ ] REVIEW 签署“可以进入阶段 F”，但不得提前签署“正式上线就绪”。

## F. 用户与远程开发机执行

### T53-F1 · 上线参数与人工确认

- [ ] 用户填写真实公开/管理/媒体域名、ICP备案号/链接和公安备案状态；
- [ ] 用户确认正式 Logo、Hero、作品、返图和备案显示；
- [ ] 用户在阿里云/远程 Secret 中创建并保存 CDN 主/备 Key、应用 AK/SK、Session Secret；另核对现有 ACME 联系邮箱、DNS-only RAM Secret 的宿主机保存位置与轮换责任；
- [ ] 用户确认月度预算、异常费用容忍和待实测的封顶原则；
- [ ] 用户选择并明确授权 GATE-E 冻结镜像的发布/传送方式；未授权时不得进入 F3；
- [ ] 核对发布 SHA/镜像摘要，阶段 F 不切换到未通过 GATE-E 的构建。
_依赖：GATE-E、备案审批/同步。_

### T53-F2 · 阿里云控制台人工配置

- [ ] 用户按 Handbook 配置 CDN 私有 OSS 回源、URL 鉴权、查询参数、缓存、Referer、保守初始用量封顶和告警；F3 目标环境实测后再校准阈值；
- [ ] 用户把两只现有 Bucket 改为 private + BPA，核对 Object ACL/Policy、CORS、生命周期和 RAM；
- [ ] 用户核对现有 ACME RAM 身份；只给承载公开/管理域名的 DNS zone（跨 zone 时逐个列出）的 `DescribeDomainRecords`、`AddDomainRecord`、`DeleteDomainRecord`，若不满足再收紧或新建，不得复用应用 AK/SK 或授予 AliDNS FullAccess；
- [ ] 用户核对/完成公开与管理 DNS、媒体 CNAME/CDN 侧证书和 DDoS 基础防护观察项；已提前存在的 `ditedog.com A` 只作为现状复核，不提前关闭本任务；DNS-01 挑战记录由 acme.sh 自动创建/删除，不手工长期保留；
- [ ] 每步保留脱敏截图/任务 ID，不把“已提交”写成“已完成”。
_依赖：T53-F1。_

### T53-F3 · 远程开发机部署与恢复演练

- [ ] 在远程开发机填写生产 `.env`，只使用 GATE-E 冻结的变量；
- [ ] 按 F1 授权和 T52-E6 冻结入口发布/传送镜像；远程拉取/载入后核对摘要，不重新构建；
- [ ] 使用该固定镜像执行 migrate、preflight、init-admin、启动和 ready；
- [ ] 复核现有 Nginx `1.30.4`、acme.sh `3.1.5`、Let's Encrypt wildcard 证书、`dns_ali` 和稳定证书路径；当前证书有效时不重装、不重签；
- [ ] 验证现有每 6 小时 root cron 是唯一调度，config-home 为 root `0700`、Secret 文件 `0600`；把续期 reload command 收紧为先 `nginx -t` 再 reload，并增加证书到期/续期失败可见性；
- [ ] 把正式 Nginx `server_name` 收敛到公开/管理精确域名；其他 Host/SNI 由默认 server 拒绝，证书可继续使用 wildcard；
- [ ] Compose 只有一个常驻 app，`127.0.0.1:3000` 可被宿主机 Nginx 访问但不能从公网访问；80 只重定向 HTTPS，ACME 不依赖 80；
- [ ] 在不切正式 DNS 的目标环境测量冷/热缓存、页面字节数和峰值，据此校准 F2 初始用量封顶与告警；
- [ ] 完成空卷、持久卷、备份、恢复到新路径、升级、旧镜像回滚和进程恢复演练；
- [ ] 验证 ECS 服务端走杭州内网 Endpoint，浏览器 PUT 仍走公网 Bucket 域名；
- [ ] 若实际运维需要，受控新增/调整独立小脚本及最小测试/文档：默认 dry-run、脱敏、目标明确、可回滚，单独提交并记录验证；
- [ ] 不热改应用源码、容器内文件、迁移、运行时契约、Compose、Nginx/ACME 冻结模板或发布镜像。
_依赖：T53-F2。_

### T53-F4 · 正式域名全链验证

- [ ] 原始 OSS 匿名 403、有效 CDN 200、过期/篡改/缺签名 403；
- [ ] 查询参数收敛、Referer、CORS 条件 PUT、页面立即下架和约 5～6 分钟强制刷新通过；
- [ ] 三视口、双 Host、全部公开页、主要管理流程、统计隐私、console/network 通过；
- [ ] 公开/管理 TLS 链、SAN、有效期与 SNI 正确；app 端口公网不可达，未知 Host/SNI 拒绝；acme.sh cron、最近续期结果、TXT 清理、稳定证书路径和 Nginx 安全 reload 监控通过；
- [ ] 告警、预算通知、用量封顶、备份/恢复和回滚证据齐全；
- [ ] 发现冻结应用/契约缺陷时停止 F，退回 E 修复并重跑 T49/T50/GATE-E；仅运维脚本缺口可留在 F 受控补充。
_依赖：T53-F3。_

### T53-F5 · 用户验收与文档闭环

- [ ] 用户在正式域名完成浏览、上传、发布、下架、冲突、失败和恢复操作；
- [ ] 用户确认“有点小狗”导航、正式素材、备案、统计含义和隐私文案；
- [ ] 用户确认约 24 小时签名 URL 与约 5～6 分钟服务器侧撤销语义；
- [ ] 未关闭 P0/P1 finding 为 0，接受的 follow-up 明确登记；
- [ ] 更新验收证据、checkbox、STATE 和历史 notes；允许单独记录运维脚本提交，若需产品/应用代码或冻结契约变更则返回 E；
- [ ] 用户签署“正式上线就绪”。
_依赖：T53-F4。_

## 每项完成定义

阶段 E 实施任务至少留下范围、非目标、迁移/回滚边界、实际门禁、浏览器/媒体证据、失败历史、独立 Review 和同步活文档。

阶段 F 留下脱敏云配置、远程命令结果、恢复演练、正式浏览器证据和用户签署；如补充运维脚本，还必须留下独立 commit、适用范围、dry-run/针对性验证和回滚说明，不得混入产品开发提交。

阶段 D 已完成不等于正式上线就绪。只有 GATE-E 与 T53-F1～F5 全部关闭，才能宣布发布完成。
