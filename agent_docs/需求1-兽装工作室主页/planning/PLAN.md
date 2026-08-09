# 实施计划

> **最后校准**：2026-08-09。
> **目标**：阶段 E 完成全部产品与上线基线开发并冻结可上线 SHA；阶段 F 主要由用户和远程开发机执行 Runbook，并可按实际运维需要补充独立小脚本。

## 1. 稳定技术基线

- 单 Nuxt 4 全栈应用、Node.js 24、Nitro；
- SQLite/Drizzle、单实例/单写者、前向迁移；
- 单管理员、双 Host、Origin/CSRF/Session 防护；
- 私有原图 + 预生成网页衍生图；
- 持久 operation、lease、heartbeat、重试和启动恢复；
- app-only Docker Compose、宿主机 HTTP-only Nginx/systemd、ESA 边缘 TLS、非 root app、持久卷和备份入口；
- 两只杭州 OSS Bucket，生产由 ESA 同账号私有回源衍生 Bucket。

不推倒现有媒体链、不增加消息队列、外部数据库、多管理员或通用 CMS。

## 2. 阶段边界

### 阶段 E：开发与冻结

包含所有会改变仓库行为的工作：

- 业务代码、数据库 Schema/迁移、公开/管理 UI；
- 运行时配置 Schema、`.env` 模板、production verify；
- OSS/ESA preflight、purge operation 和恢复；
- Dockerfile、app-only Compose、宿主机 HTTP-only Nginx 配置模板、ops 命令和部署文档；
- unit/integration/E2E、真实受控媒体测试、CI 和独立 Review。

阶段 E 输出：唯一上线 commit、镜像摘要、完整环境变量清单、具备核心命令/停止条件/回滚入口的 Handbook、回滚镜像和验证证据。

### 阶段 F：用户与远程机执行

只包含：

- 用户提供真实域名、备案、素材、Secret、预算和阈值；
- 用户操作阿里云控制台；
- 远程开发机填写生产 `.env`、拉取冻结镜像并运行命令；
- 必要时补充诊断、检查、备份/恢复包装或证据采集类运维脚本及最小验证，但不改冻结应用产物；
- 正式域名验证、恢复/回滚演练和用户验收；
- 追加脱敏证据与状态记录。

F 中发现问题时先判断边界：可由独立运维脚本在冻结接口内解决的留在 F；需要改变应用代码、迁移、运行时/环境契约、Compose、Nginx/ESA 冻结模板或发布镜像的返回 E，并重新完成 T49/T50/GATE-E。

## 3. 阶段 E 方案

### 3.1 T46 第一方访问统计

最小事件模型只记录规范 route、可选公开实体、时间与域分离 HMAC 会话标识；不保存 IP、UA、Referer、查询串、联系方式或指纹。原始事件保留 90 天，管理端提供有限时间范围和排行，同源上报失败不影响页面。

已按以下顺序落地：前向迁移 → repository/service/route → 写入事务内幂等清理 → 公开 `fetch keepalive` 最佳努力采集 → 管理只读页 → 单元/集成/真实浏览器自测。客户端原始 UUID 只放 `sessionStorage`，服务端只保留现有 Session Secret 派生的域分离 HMAC。用户隐私文案确认仍开放；独立 Review 并入 T49。

### 3.2 T51 品牌、备案与素材能力

已在不等待 ICP 真实值的前提下完成：

1. 分离公开导航品牌常量并改为“有点小狗”；
2. 为备案号、备案链接、公安备案状态建立严格生产配置和空值隐藏；
3. 保持管理端与法务/作品主体称谓独立；
4. 完成 tracked 素材尺寸/比例、安全区、确定性品牌派生和三视口校准；正式素材选择、独立竖版 Hero 与低分辨率设定图替换仍是用户门禁；
5. 为未配置/已配置状态补自动化与浏览器测试。

阶段 F 只向远程配置写真实审批值，不再改页面实现。

### 3.2.1 T51-F1 作品页间距与低分辨率设定图适配

用户在阶段 E 人工查看中补充两项修复：

1. `/works` 复用现有紧凑页名和筛选组件，只收紧两者之间的外部间距；
2. 低分辨率设定图继续走现有条件直传、作品关系和 publication operation，不新增上传器或第二套状态机；发布检查返回非阻断适配提示，operation 在 `PREPARING_SOURCE` 阶段按当前用途计算最小几何尺寸，用内嵌 FFmpeg Lanczos 生成保持比例的私有处理源，再进入现有 `recipe-v2` 水印链；
3. 私有处理源使用独立不可变身份，永久原图不覆盖；适配失败保存稳定失败码，管理端说明原图已保留并允许重新发布重试；
4. 补充纯函数/FFmpeg、publication integration、管理真实浏览器和 `/works` 间距回归。

### 3.2.2 T51-F2 公开作品与领养列表分页

用户在阶段 E 人工查看中补充公开列表分页：

1. `/works` 固定每页 12 件，`/adoptions` 固定每页 8 个，分别对应桌面三列/双列的四行图片浏览节奏；公开端不提供每页数量选择；
2. 扩展现有公开列表 DTO 与查询契约，返回 `page`、`pageSize`、`pageCount` 和筛选后的 `resultCount`；分页发生在筛选之后，排序仍按发布时间倒序；
3. 复用现有 `PublicPagination`，统一为克制的品牌蓝当前页、编号与上一页/下一页，并在手机端收紧可见页码；有结果时单页也固定显示分页栏并禁用两端；全部使用普通链接，保留当前筛选，筛选变化回到第一页；
4. 非法页码收敛为第一页，超出末页显示受控空态；补充 repository/API 契约、SSR、无私有字段、筛选组合、键盘和三视口浏览器回归。

### 3.3 T52-E1 Endpoint 与配置

三个地址必须分离：

| 用途 | 地址 |
| --- | --- |
| 本机服务端 SDK | 杭州公网 OSS Endpoint |
| 杭州远程机 app/migrate/ops | 杭州内网 OSS Endpoint |
| 浏览器条件 PUT | 私有 Bucket 公网域名 |
| 公开网页媒体 | `https://public-media.ditedog.com`（ESA） |

`OSS_UPLOAD_BASE_URL` 必须真实控制上传签名 Host，且只能是私有 Bucket 原始公网 OSS 域名。`MEDIA_BASE_URL` 生产固定为 `https://public-media.ditedog.com` 并拒绝原始 OSS 域名。Schema、模板、runtime example、测试、verify 和文档同一提交完成。应用继续使用静态服务端 RAM 凭据：OSS 凭据维持现状，ESA purge 使用独立最小权限凭据，不引入 ECS RAM Role。

### 3.4 T52-E2 preflight

现有 public-read 预检要在 E 重写为可直接供 F 运行的命令：

- dry-run 与真实验证模式；
- Bucket ACL/BPA、Object ACL/Policy、CORS、生命周期、RAM；
- 原站匿名 403、应用权限、越权拒绝；
- ESA 已发布媒体 URL、purge API 与衍生 Bucket 内容边界；
- 脱敏输出、稳定退出码和明确修复指向。

阶段 F 原则上运行该冻结入口；若目标环境需要补充诊断或证据采集包装器，可在不改变 preflight 判定契约的前提下追加运维脚本并做最小验证。

### 3.5 T52-E3 ESA 同账号私有 OSS 回源

- 阿里云自动使用 STS 临时令牌和回源 `Authorization`；业务应用不实现、保存或轮换 STS；
- 首版不做自定义边缘 URL 鉴权，不增加 signer、鉴权 Key、TTL 或边缘函数；
- 所有公开 SourceSet 使用稳定的 `public-media` ESA HTTPS URL；
- 原始 OSS 匿名拒绝，已发布 ESA 媒体可读；
- 网页衍生 Bucket 只保存验证完成、允许公开的派生物；
- 管理端现有登录、Session、Host/Origin/CSRF 认证契约保持不变。

### 3.6 T52-E4 下架与强制刷新

下架 operation 在 E 完整实现：

1. 事务撤销公开投影；
2. 固化精确 OSS Key 与 ESA File URL；
3. 删除不再引用的衍生对象；
4. `PurgeCaches(Type=file)`；
5. 保存 ESA `TaskId`，并用 `DescribePurgeTasks` 收敛；
6. 失败、重试、进程中断和重复重启保持唯一业务终态。

UI 区分“页面已下架”“ESA 缓存清除中”“已撤销”“撤销失败”。T53 记录目标环境 warm cache 的实际完成时间。

### 3.7 T52-E5 成本与可观测性准备

E 提供测量与验证能力，不虚构生产阈值：

- 页面总字节、冷/热缓存、请求量和峰值测量入口；
- 参数收敛、404 缓存和 stale 禁用验证；
- ESA 套餐/流量/源站保护/WAF、边缘证书、4xx/5xx、缓存命中、purge、ECS/磁盘、Nginx config/reload、容器/ready 告警清单；
- 预算与用量封顶的证据模板和停止条件。

用户在 F 根据远程实测填写预算与阈值。

### 3.8 T52-E6 远程部署包

在 E 完成并验证：

- 正式 `docker-compose.yaml` 只有一个常驻 Nuxt/Nitro app；migrate/ops 复用同一冻结镜像的一次性容器；
- app 只发布到 `127.0.0.1:3000`，宿主机 systemd Nginx upstream 固定代理该地址，安全组不开放 3000；
- 记录并兼容宿主机 Nginx `1.30.4`、systemd 服务、配置目录和升级/回滚入口，不依赖第三方动态模块；
- Nginx 只监听 HTTP/80，不配置 443、证书或 HTTP→HTTPS 跳转；客户端 HTTPS 强制和证书由 ESA 边缘承担；
- ESA 到 ECS 固定 HTTP/80；Nginx 向 app 传递受控 `X-Forwarded-Proto=https`，app 只信任冻结的本机代理链；
- 正式 Nginx `server_name` 只列公开/管理精确域名，媒体 Host 和未知 Host 返回 `421`；不保留 wildcard 路由；
- 部署包不得包含 acme.sh、Certbot、DNS API Secret、证书目录、续期 cron/timer 或证书 reload 逻辑；
- 持久卷、单实例、健康检查和宿主机/容器两层回滚；
- migrate、init-admin、preflight、backup、restore-verify、recover；
- 空卷、重启、升级、旧镜像回滚、恢复到新路径、Nginx config test/reload 失败演练；
- 远程 `.env` 全量字段与 Secret 边界；
- 每步命令、预期、失败停止条件和回滚方法。

Handbook 在 GATE-E 前必须具备最小可上线命令、预期与回滚基线；阶段 F 可以补充便利性或现场诊断脚本，但不能以此掩盖缺失的核心部署能力。

### 3.9 T49 CI 与独立综合 Review

T49 在 T46、T51、T52-E1～E6 全部完成后执行。以同一最新 SHA 取得 frozen install、lint、typecheck、unit、integration、build、production verify、secret scan、Compose、image-build 和 E2E 完整结果。

新上下文 Review 阶段 D 最终实现与全部阶段 E 变更；冻结首次 finding，修复后重跑受影响门禁。任何修复仍属于 E。

### 3.10 T50 最终回归与 GATE-E

T50 覆盖三视口、双 Host、全业务流程、ESA 媒体访问、上传 Endpoint、下架刷新、进程恢复、部署命令、备份/恢复、回滚和隐私泄漏。

GATE-E 只在以下条件签署：

- T46/T51/T52-E1～E6/T49/T50 全部关闭；
- 本地、跟踪、远端 SHA 与镜像摘要唯一；
- 环境变量契约、Handbook/preflight 核心基线和回滚入口已冻结；
- 阶段 F 无需产品开发或补齐核心发布能力；现场独立运维辅助脚本不影响该门禁。

## 4. 阶段 F 执行计划

### 4.1 T53-F1 参数冻结

用户填写真实公开/管理域名、ICP备案、公安备案状态、正式素材、ESA Site 与 purge API 最小权限凭据、OSS AK/SK、Session Secret、正式套餐、预算和封顶原则，并选择、明确授权 GATE-E 冻结镜像的发布/传送方式。仓库不保存任何 Secret。

### 4.2 T53-F2 阿里云控制台

按 Handbook 把 wildcard DNS 收敛为公开/管理精确记录，复核已经生效的 ECS HTTP/80 回源与边缘 HTTPS；复核 `public-media` 同账号私有 OSS 回源，并配置缓存、源站保护/WAF、保守初始用量封顶、告警、两只 Bucket private+BPA、ACL/Policy/CORS 和最小权限 RAM。已经提前存在的 NS/CNAME/A 记录只作为现状复核，不提前关闭 F2。目标环境实测后的阈值校准在 F3 完成。

### 4.3 T53-F3 远程开发机

远程执行者先写生产 `.env` 并通过冻结配置校验，再按 F1 授权和 T52-E6 冻结入口发布/传送镜像；远程拉取/载入后核对摘要且不重建。复核 Nginx HTTP-only 配置、公网 80、关闭的 443、app loopback 端口和精确 Host；确认服务器没有 ACME/证书/续期残留。部署唯一常驻 app 容器后运行 migrate、preflight、init、ready、目标环境测量/阈值校准、备份、恢复、升级、回滚和 operation recovery。可在仓库中受控新增或调整不进入镜像的运维脚本，要求默认 dry-run、脱敏、目标明确、可回滚，提交后做针对性验证；禁止直接热改应用源码、冻结模板或容器内文件。

### 4.4 T53-F4 正式验证

验证原始 OSS 403、已发布 ESA 媒体可读、参数收敛、上传 CORS、页面立即下架与目标环境 purge 实际时长、宿主机 HTTP-only Nginx、app 仅 loopback、ESA 边缘 TLS、源站保护、安全 reload、三视口、业务操作、告警、预算、恢复和回滚。

### 4.5 T53-F5 用户验收

用户真实使用并确认品牌、素材、备案、统计、隐私和媒体撤销语义。只在全部证据通过后关闭发布门禁。

## 5. 回退原则

- F 中配置错误：按 Handbook 回滚配置/镜像，仍留在 F；
- F 中发现冻结应用/契约缺陷：停止 F，回到 E，新增修复提交并重跑 T49/T50/GATE-E；
- F 中仅缺运维包装、诊断、备份/恢复辅助或证据采集：可留在 F 补脚本并记录独立 commit/验证；
- 不把 Bucket 改回 public-read；
- 不在线覆盖活动数据库，恢复到新路径；
- 不用未提交脚本或远程热改掩盖应用/契约缺口。

## 6. 非目标

- 新 Bucket 或异地灾备；
- ECS RAM Role/业务侧 ESA 回源 STS；
- DDoS 高防、跨云多边缘或自建 DNS；
- 分享永久 URL、OG 海报、二维码；
- 多实例、队列、外部数据库；
- 交易、支付、订单、通用 CMS 或社交能力。

## 7. 当前顺序

`T46 → T51 → T51-F1 → T51-F2 → T52-E1～E6 → T49 → T50 → GATE-E → T53-F1～F5`

阶段 D 已完成；只有 GATE-E 和阶段 F 全部关闭后，才可声明正式上线就绪。
