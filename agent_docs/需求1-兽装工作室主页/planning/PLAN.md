# 实施计划

> **最后校准**：2026-08-09。
> **目标**：阶段 E 完成全部产品与上线基线开发并冻结可上线 SHA；阶段 F 主要由用户和远程开发机执行 Runbook，并可按实际运维需要补充独立小脚本。

## 1. 稳定技术基线

- 单 Nuxt 4 全栈应用、Node.js 24、Nitro；
- SQLite/Drizzle、单实例/单写者、前向迁移；
- 单管理员、双 Host、Origin/CSRF/Session 防护；
- 私有原图 + 预生成网页衍生图；
- 持久 operation、lease、heartbeat、重试和启动恢复；
- app-only Docker Compose、宿主机 Nginx/systemd、`acme.sh + dns_ali`、非 root app、持久卷和备份入口；
- 两只杭州 OSS Bucket，生产由 CDN 私有回源衍生 Bucket。

不推倒现有媒体链、不增加消息队列、外部数据库、多管理员或通用 CMS。

## 2. 阶段边界

### 阶段 E：开发与冻结

包含所有会改变仓库行为的工作：

- 业务代码、数据库 Schema/迁移、公开/管理 UI；
- 运行时配置 Schema、`.env` 模板、production verify；
- OSS/CDN signer、preflight、刷新 operation 和恢复；
- Dockerfile、app-only Compose、与现有宿主机 Nginx/acme.sh 兼容的配置模板、ops 命令和部署文档；
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

F 中发现问题时先判断边界：可由独立运维脚本在冻结接口内解决的留在 F；需要改变应用代码、迁移、运行时/环境契约、Compose、Nginx/ACME 冻结模板或发布镜像的返回 E，并重新完成 T49/T50/GATE-E。

## 3. 阶段 E 方案

### 3.1 T46 第一方访问统计

最小事件模型只记录规范 route、可选公开实体、时间与域分离 HMAC 会话标识；不保存 IP、UA、Referer、查询串、联系方式或指纹。原始事件保留 90 天，管理端提供有限时间范围和排行，同源上报失败不影响页面。

实施顺序：前向迁移 → repository/service/route → 清理命令 → 公开最佳努力采集 → 管理只读页 → 隐私文案确认 → 自测。独立 Review 并入 T49。

### 3.2 T51 品牌、备案与素材能力

开发不等待 ICP 真实值：

1. 分离公开导航品牌常量并改为“有点小狗”；
2. 为备案号、备案链接、公安备案状态建立严格生产配置和空值隐藏；
3. 保持管理端与法务/作品主体称谓独立；
4. 在 E 完成正式素材选择、必要派生、低分辨率提示和三视口校准；
5. 为未配置/已配置状态补自动化与浏览器测试。

阶段 F 只向远程配置写真实审批值，不再改页面实现。

### 3.3 T52-E1 Endpoint 与配置

三个地址必须分离：

| 用途 | 地址 |
| --- | --- |
| 本机服务端 SDK | 杭州公网 OSS Endpoint |
| 杭州远程机 app/migrate/ops | 杭州内网 OSS Endpoint |
| 浏览器条件 PUT | 私有 Bucket 公网域名 |
| 公开网页媒体 | CDN 自定义域名 |

`OSS_UPLOAD_BASE_URL` 必须真实控制上传签名 Host；`MEDIA_BASE_URL` 生产拒绝 OSS 域名。Schema、模板、runtime example、测试、verify 和文档同一提交完成。应用 OSS/CDN AK/SK 保持现状；T52-E6 的 ACME DNS-only RAM Secret 不进入应用 runtime Schema。

### 3.4 T52-E2 preflight

现有 public-read 预检要在 E 重写为可直接供 F 运行的命令：

- dry-run 与真实验证模式；
- Bucket ACL/BPA、Object ACL/Policy、CORS、生命周期、RAM；
- 原站匿名 403、应用权限、越权拒绝；
- CDN 有效/无效 URL 与仅回源衍生 Bucket；
- 脱敏输出、稳定退出码和明确修复指向。

阶段 F 原则上运行该冻结入口；若目标环境需要补充诊断或证据采集包装器，可在不改变 preflight 判定契约的前提下追加运维脚本并做最小验证。

### 3.5 T52-E3 CDN URL 鉴权

- 单一服务端方式 A signer；
- 主/备 Key、active slot 和 `86400` 秒 TTL；
- CDN 参数不持久化、不进入日志；
- 所有公开 SourceSet 在响应时动态签名；
- 有效、过期、篡改、缺签名、轮换和 SSR 测试；
- CDN 私有 OSS 回源仅指向衍生 Bucket。

### 3.6 T52-E4 下架与强制刷新

下架 operation 在 E 完整实现：

1. 事务撤销公开投影；
2. 固化精确 OSS Key 与无鉴权参数 CDN File URL；
3. 删除不再引用的衍生对象；
4. `RefreshObjectCaches(Force=true, ObjectType=File)`；
5. 保存任务 ID，并用 `DescribeRefreshTasks` 收敛；
6. 失败、重试、进程中断和重复重启保持唯一业务终态。

UI 区分“页面已下架”“CDN 刷新中”“已撤销”“撤销失败”。

### 3.7 T52-E5 成本与可观测性准备

E 提供测量与验证能力，不虚构生产阈值：

- 页面总字节、冷/热缓存、请求量和峰值测量入口；
- URL 鉴权、Referer、参数收敛、404 缓存和 stale 禁用验证；
- CDN/ECS/磁盘/证书到期、acme.sh cron/续期、Nginx config/reload、容器/ready 告警清单；
- 预算与用量封顶的证据模板和停止条件。

用户在 F 根据远程实测填写预算与阈值。

### 3.8 T52-E6 远程部署包

在 E 完成并验证：

- 正式 `docker-compose.yaml` 只有一个常驻 Nuxt/Nitro app；migrate/ops 复用同一冻结镜像的一次性容器；
- app 只发布到 `127.0.0.1:3000`，宿主机 systemd Nginx upstream 固定代理该地址，安全组不开放 3000；
- 记录并兼容宿主机现有 Nginx `1.30.4`、systemd 服务、配置目录和升级/回滚入口，不依赖第三方动态模块，也不要求为了 GATE-E 重装；
- 复用 acme.sh `3.1.5`、`dns_ali`、Let's Encrypt DNS-01 和现有 `ditedog.com` / `*.ditedog.com` ECDSA 证书；不改用 Certbot 或 `nginx-module-acme`，不因方案整理而重签；
- 复用现有每 6 小时执行 `acme.sh --cron` 的 root cron，不增加第二份调度器，也不强制迁移到 systemd timer；
- `--install-cert --ecc` 继续把 key/fullchain 写入 `/etc/nginx/ssl/ditedog.com/`；reload command 唯一语义为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`，Nginx 不直接读取 acme.sh 内部目录；
- 通配符只用于证书覆盖；正式 Nginx `server_name` 只列公开/管理精确域名，其他 Host/SNI 由默认 server 拒绝；
- ACME 使用独立 DNS-only RAM Key，仅覆盖承载公开/管理域名的 DNS zone（跨 zone 时逐个列出）的记录查询/新增/删除，config-home root 限权且不进入应用 `.env`/Compose/容器；
- 媒体域名继续在阿里云 CDN 终止 TLS；80 端口只承担 HTTP 跳转，DNS-01 不依赖它或提前切 A 记录；
- 持久卷、单实例、健康检查和宿主机/容器两层回滚；
- migrate、init-admin、preflight、backup、restore-verify、recover；
- 空卷、重启、升级、旧镜像回滚、恢复到新路径、Nginx config test 和证书 reload 失败演练；
- 远程 `.env` 全量字段与 Secret 边界；
- 每步命令、预期、失败停止条件和回滚方法。

Handbook 在 GATE-E 前必须具备最小可上线命令、预期与回滚基线；阶段 F 可以补充便利性或现场诊断脚本，但不能以此掩盖缺失的核心部署能力。

### 3.9 T49 CI 与独立综合 Review

T49 在 T46、T51、T52-E1～E6 全部完成后执行。以同一最新 SHA 取得 frozen install、lint、typecheck、unit、integration、build、production verify、secret scan、Compose、image-build 和 E2E 完整结果。

新上下文 Review 阶段 D 最终实现与全部阶段 E 变更；冻结首次 finding，修复后重跑受影响门禁。任何修复仍属于 E。

### 3.10 T50 最终回归与 GATE-E

T50 覆盖三视口、双 Host、全业务流程、媒体签名、上传 Endpoint、下架刷新、进程恢复、部署命令、备份/恢复、回滚和隐私泄漏。

GATE-E 只在以下条件签署：

- T46/T51/T52-E1～E6/T49/T50 全部关闭；
- 本地、跟踪、远端 SHA 与镜像摘要唯一；
- 环境变量契约、Handbook/preflight 核心基线和回滚入口已冻结；
- 阶段 F 无需产品开发或补齐核心发布能力；现场独立运维辅助脚本不影响该门禁。

## 4. 阶段 F 执行计划

### 4.1 T53-F1 参数冻结

用户填写真实域名、ICP备案、公安备案状态、正式素材、CDN 主/备 Key、应用 AK/SK、Session Secret、预算和封顶原则，并选择、明确授权 GATE-E 冻结镜像的发布/传送方式。另核对现有 ACME 联系邮箱、DNS-only RAM 权限、Secret 可恢复位置和轮换责任；现有 ACME Secret 不进入应用 `.env`，仓库不保存任何 Secret。

### 4.2 T53-F2 阿里云控制台

按 Handbook 配置 CDN 私有回源、URL 鉴权、查询参数、缓存、Referer、保守初始用量封顶、告警、两只 Bucket private+BPA、ACL/Policy/CORS/应用 RAM；核对现有 ACME RAM 身份只拥有承载公开/管理域名 DNS zone（跨 zone 时逐个列出）的 `DescribeDomainRecords`、`AddDomainRecord`、`DeleteDomainRecord`，不满足时再收紧或新建；随后核对/完成公开与管理 DNS、媒体 CNAME 和 CDN 媒体证书。已经提前存在的 A 记录只作为现状复核，不提前关闭 F2。目标环境实测后的阈值校准在 F3 完成。

### 4.3 T53-F3 远程开发机

远程执行者先写生产 `.env` 并通过冻结配置校验，再按 F1 授权和 T52-E6 冻结入口发布/传送镜像；远程拉取/载入后核对摘要且不重建。复核现有 Nginx、证书、`dns_ali`、root cron、目录权限和公网 80/443/app 端口边界；只把续期 reload 收紧为 `nginx -t` 成功后 reload，并把 Nginx 正式 `server_name` 收敛到公开/管理精确域名，不重装、不重签、不迁移调度器。部署唯一常驻 app 容器后运行 migrate、preflight、init、ready、目标环境测量/阈值校准、备份、恢复、升级、回滚和 operation recovery。可在仓库中受控新增或调整不进入镜像的运维脚本，要求默认 dry-run、脱敏、目标明确、可回滚，提交后做针对性验证；禁止直接热改应用源码、冻结模板或容器内文件。

### 4.4 T53-F4 正式验证

验证原站 403、CDN 鉴权、参数收敛、上传 CORS、页面立即下架/约 5～6 分钟撤销、宿主机 Nginx、app 仅 loopback、TLS 链/SAN/到期时间、acme.sh cron/TXT 清理/安全 reload、三视口、业务操作、告警、预算、恢复和回滚。

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
- ECS RAM Role/客户端 STS；
- DDoS 高防或 ESA；
- 分享永久 URL、OG 海报、二维码；
- 多实例、队列、外部数据库；
- 交易、支付、订单、通用 CMS 或社交能力。

## 7. 当前顺序

`T46 → T51 → T52-E1～E6 → T49 → T50 → GATE-E → T53-F1～F5`

阶段 D 已完成；只有 GATE-E 和阶段 F 全部关闭后，才可声明正式上线就绪。
