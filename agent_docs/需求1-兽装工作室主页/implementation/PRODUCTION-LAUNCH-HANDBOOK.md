# 有点小狗 · 上线前执行手册

> **用途**：GATE-E 通过后，景宸与远程开发机按顺序执行并粘贴证据的阶段 F 生产上线清单。
> **最后校准**：2026-08-09。
> **状态**：当前**不能直接开始执行**。必须先完成阶段 E 的 T46、T51、T52-E1～E6、T49、T50，并由 GATE-E 冻结唯一上线 SHA/镜像、环境契约和核心运维命令基线。
> **勾选权**：本手册记录操作证据；任务是否完成只在 [`TASKS.md`](./TASKS.md) 勾选。

这是阶段 F Runbook，主体是人工与远程执行，不继续产品开发。GATE-E 前，核心命令、变量和预期结果必须由阶段 E 实现并验证；GATE-E 后，可为实际运维新增或调整独立小脚本及其最小测试/文档。此类脚本不得改变应用源码、迁移、运行时/环境契约、Dockerfile、Compose、Nginx/ACME 冻结模板、公开行为或冻结镜像；超出该边界才停止 F 并返回 E。

章节与任务对应关系：第 0～3 节为 T53-F1，第 4～8 节为 T53-F2，第 9～11 节为 T53-F3，第 12 节为 T53-F4，第 13 节为 T53-F5。前序任务未通过时不得跳到后序任务。

## 0. 使用规则

- [ ] 从最新 `main` 和同一已验证镜像 SHA 开始，不拼接不同 SHA 的门禁结果。
- [ ] 每次只执行当前小节；发现与手册不一致时停止，不猜测控制台字段。
- [ ] 截图、命令输出和日志全部脱敏：不得包含 AK/SK、Session、Cookie、URL 鉴权 Key、私有 Object Key、完整签名 URL 或个人联系方式。
- [ ] 不删除或清空本机 `.env`；生产 `.env` 单独在服务器受控目录创建。
- [ ] 不创建 `v*` tag、不发布正式镜像，直到 T49/T50 完成且用户明确授权。
- [ ] 任何下架/删除只使用数据库保存的精确对象与 CDN URL manifest，不列举前缀后批量删除。
- [ ] 不在服务器或容器内热改文件；运维补充脚本回到仓库单独提交，记录用途、适用目标、dry-run/针对性验证和回滚方法。
- [ ] 运维脚本 commit 不替换 GATE-E 的应用发布 SHA/镜像摘要；两者分别记录。
- [ ] 配置问题留在本手册修正；冻结应用/契约缺陷返回阶段 E。

## 1. 上线参数表

执行前填写；秘密只记录“已设置”，不要把值写进本文。表内 Nginx/ACME/证书预填值来自 2026-08-09 对 `120.26.51.205` 的只读 SSH 检查，阶段 F 必须重新核对；它们不代表任何任务已经完成。

| 项目 | 值/状态 |
| --- | --- |
| ECS 地域 | 华东 1（杭州） |
| OSS 地域 | `oss-cn-hangzhou` |
| 公开站域名 | `[待填写]` |
| 管理端域名 | `[待填写]` |
| CDN 媒体域名 | `[待填写]` |
| 备案网站名称 | `有点小狗` |
| ICP 备案号 | `[审批后填写]` |
| 公安备案 | `[按实际要求填写]` |
| 私有原图 Bucket | 读取生产 `OSS_PRIVATE_BUCKET`，不要手输到证据 |
| 网页衍生 Bucket | 读取生产 `OSS_PUBLIC_BUCKET`，不要手输到证据 |
| URL 鉴权方式 | A |
| URL 有效期 | `86400` 秒 |
| URL 鉴权主 Key | `[已设置/未设置]` |
| URL 鉴权备 Key | `[已设置/未设置]` |
| 月度预算 | `[待填写]` |
| CDN 用量封顶 | `[目标环境实测后填写]` |
| app 宿主机 loopback 端口 | `127.0.0.1:3000` |
| 宿主机 Nginx | `1.30.4；Ubuntu systemd 服务已启用` |
| ACME 客户端 | `acme.sh 3.1.5；复用现有安装` |
| ACME CA | `Let's Encrypt production` |
| ACME 联系邮箱 | `[已存在于 root 限权配置；只核对责任人，不记录值]` |
| 宿主机证书 | `ECDSA P-256；SAN=ditedog.com, *.ditedog.com；2026-11-07 到期` |
| DNS-only RAM Key | `[已存在于 root 限权配置；需核对权限，不记录值]` |
| ACME 调度 | `root cron 每 6 小时执行 acme.sh --cron` |
| 媒体域名 CDN 证书 | `[已配置/未配置；不由宿主机证书服务]` |
| 发布镜像仓库/交付引用与摘要 | `[待填写]` |
| 冻结镜像发布/传送授权 | `[已授权/未授权]` |

- [ ] 用户已选择并明确授权 GATE-E 冻结镜像的发布/传送方式；未授权时不得进入第 10 节。

## 2. 生产拓扑核对

```text
公开浏览器 ──HTTPS──> 宿主机 Nginx ──loopback──> 唯一常驻 Nuxt/Nitro app 容器
     │
     └──约 24h 签名 URL──> CDN 媒体域名 ──同账号私有回源──> 网页衍生 Bucket（private + BPA）

管理浏览器 ──HTTPS──> 宿主机 Nginx ──loopback──> 同一 Nuxt/Nitro app ──生成条件 PUT 签名
     └──公网条件 PUT──> 私有原图 Bucket（private + BPA，精确 CORS）

杭州 ECS/Nuxt ──杭州内网 Endpoint──> 两只 OSS Bucket

宿主机 acme.sh ──dns_ali / DNS-01──> 阿里云 DNS
      └──install-cert + config test/reload──> 宿主机 Nginx
```

- [ ] CDN 只回源网页衍生 Bucket，绝不回源私有原图 Bucket。
- [ ] 两只 Bucket 都是 private，名称不同；网页衍生 Bucket 内没有原图、处理源、Logo 候选、管理预览或授权附件。
- [ ] 浏览器上传使用公网 Bucket 域名，不出现 `-internal`。
- [ ] ECS 服务端 OSS 请求使用杭州内网 Endpoint。
- [ ] 公开图片只出现 CDN 媒体域名，不出现任一 OSS Bucket 域名。
- [ ] Compose 只有一个常驻 app；没有 Nginx 容器或常驻 migrate 服务。
- [ ] app 端口只绑定宿主机 loopback；安全组没有该端口入站规则。
- [ ] 公开/管理 TLS 由宿主机 acme.sh 维护；媒体域名 TLS 在阿里云 CDN 侧终止。

依据：[OSS 访问域名](https://help.aliyun.com/zh/oss/user-guide/access-oss-via-bucket-domain-name)、[CDN 私有 OSS 回源](https://help.aliyun.com/zh/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets)。

## 3. GATE-E 与发布门禁

切换云资源前全部满足：

- [ ] T46、T51、T52-E1～E6 全部完成。
- [ ] T49 在新的独立上下文完成阶段 D/E 综合 Review，`checks`、`image-build`、`e2e` 在同一 `main` SHA 全绿。
- [ ] T50 三视口、双 Host、CDN、下架、进程、部署和恢复最终回归通过。
- [ ] GATE-E 已记录唯一 commit SHA、镜像摘要、回滚镜像和 artifact 清单。
- [ ] 生产 `.env` 所需变量名、类型、必填条件、Secret 边界和 verify 均已冻结。
- [ ] `preflight`、migrate、init、backup、restore、recover 和 rollback 都已有可运行的核心基线；阶段 F 不靠补脚本填补缺失的核心发布能力。
- [ ] app-only Compose、与现有宿主机 Nginx/acme.sh 兼容的配置、DNS-only RAM 策略、root cron、稳定证书路径和安全 reload 均已冻结。
- [ ] 部署产物确认不存在 Nginx 容器、Certbot/`nginx-module-acme` 集成或第二份续期调度；宿主机残留但未启用的 Certbot 二进制是可选清理项，不阻断部署。
- [ ] 导航“有点小狗”、备案空值/有值状态、正式素材和 SourceSet 已在阶段 E 验证。
- [ ] 生产构建扫描确认客户端产物不含 AK/SK、URL 鉴权 Key、私有 Object Key 或内部 Endpoint。

任一项未完成：**停止，不进入阶段 F，不改 ACL。**

## 4. 备案、域名与 TLS

### 4.1 备案与三个 origin

- [ ] ICP 审批完成，备案网站名称显示“有点小狗”。
- [ ] 等待工信部/阿里云侧备案数据同步；阿里云建议新备案约 8 小时后再添加中国内地 CDN 域名。
- [ ] 公开、管理、媒体使用三个不同 HTTPS origin。
- [ ] DNS 记录当前值和 TTL 已备份。
- [ ] CDN 添加媒体域名，业务类型选择“图片小文件”，加速区域按当前中国内地方案选择。
- [ ] CDN 分配的 CNAME 已记录；正式切换前先完成模拟访问测试。
- [ ] 媒体域名证书链、有效期和 CDN 侧续期责任已单独核对；它不使用宿主机 Nginx 证书。
- [ ] 页面页脚显示真实 ICP 备案号并链接工信部备案系统；审批前不伪造号码。
- [ ] 公安备案不由本文自行判断是否适用；T53-F1 必须由用户记录“已完成 / 不适用 / 待办及期限”之一。若主管部门要求先完成，则升级为上线阻断，不用占位值冒充。

### 4.2 公开/管理域名 ACME 基线

- [ ] 复核现有 acme.sh `3.1.5`、`dns_ali` 与 Let's Encrypt production 配置；当前证书有效时不重装客户端、不重新签发。
- [ ] 复核现有 ECDSA P-256 证书 SAN 为 `ditedog.com` 与 `*.ditedog.com`，证书链、私钥匹配和有效期正常。
- [ ] wildcard 只用于证书覆盖；Nginx 正式 `server_name` 只列公开/管理精确域名，其他 Host/SNI 由默认 server 拒绝。
- [ ] 当前流程不使用 Certbot 或 `nginx-module-acme`；宿主机 Certbot timer 必须保持未启用，残留二进制可在用户另行确认后清理。
- [ ] DNS-01 签发不依赖 80；80 如开放只用于正常 HTTP→HTTPS 跳转。

### 4.3 DNS-only RAM 与 Secret

- [ ] 核对现有 ACME RAM 身份是否专用且不复用应用 OSS/CDN AK/SK；不满足时再收紧或新建。
- [ ] 自定义策略只允许承载公开/管理域名的 DNS zone 上执行：`alidns:DescribeDomainRecords`、`alidns:AddDomainRecord`、`alidns:DeleteDomainRecord`；若两个域名跨 zone，逐个列出，不写全账号 `*`。
- [ ] 不授予 `AliyunDNSFullAccess`、`alidns:*`、OSS 或 CDN 权限。
- [ ] 已准备宿主机 root 限权的 acme.sh config-home；目录目标 `0700`、Secret 文件目标 `0600`。
- [ ] 现有 `account.conf` 已保存 `Ali_Key` / `Ali_Secret`；因此它们不进入应用 `.env`、Compose、容器、仓库、镜像、截图或普通日志。

### 4.4 现有证书与续期基线

本小节复用现有配置，不要求重新安装或重新签发：

- [ ] key/fullchain 稳定路径继续使用 `/etc/nginx/ssl/ditedog.com/privkey.pem` 与 `/etc/nginx/ssl/ditedog.com/fullchain.pem`；Nginx 不读取 acme.sh 内部证书目录。
- [ ] 通过 `--install-cert --ecc` 把现有 reload command 收紧为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`；失败必须非零退出并触发告警。
- [ ] 复用现有每 6 小时运行 `acme.sh --cron` 的 root cron；确认没有第二份 cron 或 systemd timer。
- [ ] 记录证书到期时间、最近一次续期结果和失败告警入口；当前 cron 丢弃标准输出，不能把“cron 存在”当作续期成功证据。

官方文档：

- [添加 CDN 域名与备案要求](https://help.aliyun.com/zh/cdn/add-a-domain-name)
- [阿里云 CDN 的 ICP 备案要求](https://help.aliyun.com/zh/icp-filing/basic-icp-service/product-overview/use-alibaba-cloud-cdn)
- [配置 CDN CNAME](https://help.aliyun.com/zh/cdn/add-a-cname-record-for-a-domain-name)
- [acme.sh 的 Aliyun DNS API 配置](https://github.com/acmesh-official/acme.sh/wiki/dnsapi#11-use-aliyun-domain-api-to-automatically-issue-cert)
- [acme.sh 证书安装与 Nginx reload](https://github.com/acmesh-official/acme.sh#3-install-the-cert-to-apachenginx)
- [阿里云 DNS RAM 动作与资源授权](https://help.aliyun.com/zh/dns/api-alidns-2015-01-09-ram)

## 5. CDN 先行配置

在修改 Bucket ACL 前先把 CDN 配置完整，但先不切正式 CNAME。

### 5.1 源站与私有回源

- [ ] 源站类型选择阿里云 OSS，指向网页衍生 Bucket。
- [ ] 开启“阿里云 OSS 私有 Bucket 回源”。
- [ ] CDN 与 OSS 同账号，回源类型选择同账号推荐方式，由阿里云使用 STS 临时令牌。
- [ ] 确认 CDN 未指向私有原图 Bucket。
- [ ] 记录风险：CDN 可读取该衍生 Bucket 的全部对象，不能在 CDN 侧按前缀再缩权。

官方文档：[CDN 私有 OSS Bucket 回源](https://help.aliyun.com/zh/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets)。

### 5.2 URL 鉴权

- [ ] 开启 URL 鉴权，选择方式 A。
- [ ] 生成高强度主 Key 与备 Key；只保存在 CDN 控制台和生产 Secret。
- [ ] 生产应用使用阶段 E 已冻结的固定变量：`CDN_URL_AUTH_ACTIVE_KEY=primary|secondary`、`CDN_URL_AUTH_PRIMARY_KEY`、`CDN_URL_AUTH_SECONDARY_KEY`、`CDN_URL_AUTH_TTL_SECONDS=86400`。
- [ ] 轮换时先把新值写入未激活槽并同步 CDN，验证两槽都可用；再切 `ACTIVE_KEY` 并部署，最后才替换旧槽。不得在同一步骤同时删除旧 Key 和切应用。
- [ ] 鉴权有效时长设置为 `86400` 秒。
- [ ] 使用 CDN 控制台鉴权 URL 生成工具，与应用输出对同一路径交叉校验。
- [ ] 有效 URL 返回 200；篡改摘要、篡改时间、过期 URL 均返回 403。
- [ ] 日志和错误响应不记录完整鉴权 URL。

官方文档：[配置 URL 鉴权](https://help.aliyun.com/zh/cdn/user-guide/configure-url-signing/)、[鉴权方式 A](https://help.aliyun.com/zh/cdn/user-guide/type-a-signing)。

### 5.3 查询参数与缓存

- [ ] 配置“忽略全部参数”。
- [ ] “保留指定参数”留空。
- [ ] “保留回源参数”设为否。
- [ ] 确认 URL 鉴权先执行，鉴权通过后参数不进入缓存 Key 和回源 URL。
- [ ] 使用随机参数访问同一图片，验证命中同一缓存对象。
- [ ] 使用 `x-oss-process` 参数访问，确认没有把处理指令传到 OSS，也没有产生另一份像素结果。
- [ ] 不同时开启冲突的自定义 Cache Key 查询参数规则。
- [ ] 不开启“响应过期缓存”。

初始缓存策略：

- [ ] 图片不可变 Key 在 CDN 节点配置长缓存（最长不超过 1 年；任何修改生成新 Key）。
- [ ] CDN 出站响应头把浏览器 `Cache-Control` 收敛到最长 `86400` 秒；确认这不会改变 CDN 节点缓存策略。
- [ ] 为 404 配置短状态码缓存，初始 `60` 秒；上线观察后再调整。
- [ ] 配置变化后刷新测试 URL，确认旧规则不再命中。

官方文档：

- [忽略参数](https://help.aliyun.com/zh/cdn/user-guide/ignore-parameters/)
- [缓存过期时间](https://help.aliyun.com/zh/cdn/user-guide/configure-the-cdn-cache-expiration-time)
- [状态码缓存](https://help.aliyun.com/zh/cdn/user-guide/create-a-cache-rule-for-http-status-codes)
- [缓存出站响应头](https://help.aliyun.com/zh/cdn/user-guide/create-a-custom-http-response-header/)
- [响应过期缓存](https://help.aliyun.com/zh/cdn/user-guide/serve-stale-content)

### 5.4 Referer 防盗链

- [ ] URL 鉴权先通过后，再启用 Referer 白名单。
- [ ] 白名单只填写正式公开站域名，按需勾选忽略 Scheme。
- [ ] 初始不允许空 Referer，因为当前阶段不承诺复制图片 URL 直接访问。
- [ ] 在 Chrome/Edge、三视口和隐私模式中验证公开页图片没有误伤。
- [ ] 若正常浏览器确有空 Referer，再由用户决定放宽；不能静默放宽后仍宣称同等保护。

官方文档：[Referer 防盗链](https://help.aliyun.com/zh/cdn/user-guide/configure-a-referer-whitelist-or-blacklist-to-enable-hotlink-protection)。

## 6. OSS 权限切换

### 6.1 切换前保护

- [ ] 暂停管理员发布、下架、上传和媒体 reconcile。
- [ ] 创建 SQLite 验证备份，并在新路径通过 integrity、foreign key、migration hash 和 ready 校验。
- [ ] 导出现有两只 Bucket 的 ACL、BPA、Bucket Policy、CORS 和生命周期配置截图。
- [ ] 由数据库生成衍生 Bucket 精确对象清单，确认没有数据库未知对象后再处理；不要使用未验证的全 Bucket 列举结果直接删除。
- [ ] 抽样核对衍生 Bucket 对象均可追溯到 `asset_variants` 和公开用途。
- [ ] 确认私有 Bucket 的永久原图前缀不受生命周期删除规则影响。

### 6.2 ACL 与 Block Public Access

对**两只现有 Bucket**分别执行：

- [ ] Bucket ACL 改为 `private`。
- [ ] Bucket 级 Block Public Access 开启。
- [ ] 审计并移除公共 Bucket Policy。
- [ ] 审计历史 Object ACL；不保留 `public-read` / `public-read-write`。
- [ ] 原始 Bucket 域名匿名 GET 返回 403。
- [ ] 使用应用 RAM 身份按精确前缀执行必要的 GET/PUT/DELETE，超范围请求拒绝。

该切换不保留旧匿名 URL 兼容，开发站直接 OSS URL 失效是已接受结果。

官方文档：[Block Public Access](https://help.aliyun.com/zh/oss/user-guide/block-public-access/)、[Object ACL](https://help.aliyun.com/zh/oss/user-guide/object-acl)。

### 6.3 私有 Bucket CORS

- [ ] Allowed Origin 只保留正式管理端 HTTPS origin。
- [ ] Allowed Method 只保留 `PUT`。
- [ ] Allowed Headers 至少精确包含 `content-type`、`content-md5`、`x-oss-meta-sha256`、`x-oss-forbid-overwrite`。
- [ ] Expose Headers 只保留前端实际需要的 `ETag`、`x-oss-request-id`。
- [ ] 删除历史 `Origin: *`、`Headers: *` 和不需要的 GET/POST/DELETE 规则。
- [ ] 网页衍生 Bucket 不配置浏览器上传 CORS。
- [ ] 从正式管理端执行 OPTIONS 与一次条件 PUT，重复 Key 被拒绝。

## 7. RAM 最小权限

### 7.1 应用 OSS 权限

- [ ] 继续使用当前应用 AK/SK，不新建客户端 STS 流程。
- [ ] OSS 对象权限仅覆盖生产的私有原图/处理前缀与衍生网页前缀。
- [ ] 不授予 `oss:*`、`AliyunOSSFullAccess` 或列表后模糊删除能力。
- [ ] Bucket 级能力只保留运行与 preflight 确实需要的读取/处理动作。

### 7.2 CDN 刷新权限

在同一应用 RAM 身份上增加本阶段必要的最小 CDN 动作，不增加第二套 AK/SK：

```text
cdn:RefreshObjectCaches
cdn:DescribeRefreshTasks
cdn:DescribeRefreshQuota
```

- [ ] 资源尽可能限制到正式媒体域名；若控制台/API 对某动作不支持更细粒度，记录原因后才使用相应通配资源。
- [ ] 不授予 CDN FullAccess。
- [ ] 应用能提交精确 File 刷新并查询完成；不能修改 CDN 计费方式、域名或其他配置。

官方文档：[CDN 自定义权限策略](https://help.aliyun.com/zh/cdn/user-guide/authorize-a-ram-user-to-prefetch-and-refresh-resources/)、[RefreshObjectCaches](https://help.aliyun.com/zh/cdn/developer-reference/api-cdn-2018-05-10-refreshobjectcaches/)、[DescribeRefreshTasks](https://help.aliyun.com/zh/cdn/developer-reference/api-cdn-2018-05-10-describerefreshtasks)。

### 7.3 ACME DNS 权限

该身份与 7.1/7.2 的应用身份分离：

```text
alidns:DescribeDomainRecords
alidns:AddDomainRecord
alidns:DeleteDomainRecord
```

- [ ] Resource 只覆盖承载公开/管理域名的 DNS zone（跨 zone 时逐个列出），不使用 `*` 代替可用的 domain ARN。
- [ ] Key 只保存在宿主机 acme.sh config-home；应用容器与生产 `.env` 中不存在 `Ali_Key` / `Ali_Secret`。
- [ ] 在下一次正常续期或受控权限核对中确认审计只出现 `_acme-challenge` TXT 查询/新增/删除，没有触碰其他记录或 zone；不为获取证据强制重签当前有效证书。
- [ ] 记录剩余风险：AliDNS 对这三个动作支持 domain 资源级授权，但不能把 `AddDomainRecord` / `DeleteDomainRecord` 再限制为只操作 TXT；因此专用 zone 范围、专用 Key、宿主机限权和监控都是必要边界。
- [ ] 轮换时先验证新 Key 能完成受控 DNS-01 流程，再禁用旧 Key；不同时删除唯一可用 Key 和触发生产续期。

## 8. CDN 用量封顶、预算与监控初始保护

在部署前先建立不会依赖公开流量的保护基线；目标环境实测与阈值校准在第 10 节完成，正式 DNS 在此后才允许切换。

- [ ] 用户填写可接受月度预算和一次异常事件的最大容忍费用。
- [ ] 根据 T52-E5 的受控测量基线和用户最大容忍费用设置保守的初始带宽/流量/HTTPS 请求数封顶；标记为“待目标环境校准”。
- [ ] CDN 用量封顶启用，并确认触发后整个媒体域名会下线。
- [ ] 费用与成本中心开通月度预算，设置多级实际费用与预测费用预警。
- [ ] 预警联系人、手机、邮件和站内信均为当前可达。
- [ ] 明确预算只通知、不停止资源；CDN 用量封顶才是服务侧限制，但也有约 10 分钟监控延迟。
- [ ] 配置 CDN 带宽/流量/请求数、命中率、回源流量、4xx/5xx 与域名状态监控。
- [ ] 准备 ECS CPU、内存、磁盘、网络、进程/容器重启和证书到期监控；实例部署后在第 10 节验证。
- [ ] 增加 root cron 存在性、最近续期结果、证书剩余天数、残留 `_acme-challenge`、Nginx `configtest`/reload 失败监控；不得只监控“证书文件存在”。
- [ ] 查看并记录 ECS DDoS 基础防护的实际清洗与黑洞阈值；当前不购买高防。

官方文档：

- [CDN 用量封顶](https://help.aliyun.com/zh/cdn/user-guide/configure-usage-cap)
- [阿里云预算管理](https://help.aliyun.com/zh/user-center/how-to-manage-a-budget)
- [防范 CDN 流量盗刷](https://help.aliyun.com/zh/cdn/use-cases/best-practices-for-preventing-traffic-theft)
- [DDoS 基础防护](https://help.aliyun.com/zh/anti-ddos/basic-ddos-protection/product-overview/what-is-anti-ddos-basic)

## 9. 生产环境配置

### 9.1 场景矩阵

| 配置 | 本地开发 `.env` | 杭州生产 `.env` |
| --- | --- | --- |
| `OSS_ENDPOINT` | `https://oss-cn-hangzhou.aliyuncs.com` | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| `OSS_UPLOAD_BASE_URL` | 私有 Bucket 杭州公网域名 | 私有 Bucket 杭州公网域名 |
| `MEDIA_BASE_URL` | 测试媒体 origin；ACL 切换后旧 OSS 开发地址可失效 | 正式 CDN 媒体 origin |
| `OSS_PRIVATE_BUCKET` | 现有私有 Bucket | 同一现有私有 Bucket |
| `OSS_PUBLIC_BUCKET` | 现有衍生 Bucket | 同一现有衍生 Bucket |
| AK/SK | 本机受控 Secret | 服务器受控 Secret |
| `CDN_URL_AUTH_ACTIVE_KEY` | 受控测试可用 `primary` | `primary` 或 `secondary`，只切槽位不复制 Key |
| `CDN_URL_AUTH_PRIMARY_KEY` / `SECONDARY_KEY` | 受控测试 Secret | 与 CDN 控制台主/备 Key 一致的服务器 Secret |
| `CDN_URL_AUTH_TTL_SECONDS` | `86400` | `86400` |

`Ali_Key` / `Ali_Secret` **不属于上表和应用运行时契约**。它们只用于宿主机 acme.sh 的 `dns_ali`，由 root 限权 config-home 保存；不得为了“统一配置”加入 `.env.example`、`.env.compose.example`、Nuxt runtime config 或容器环境。

生产示意（不要把占位符原样使用）：

```dotenv
APP_ENV=production
PUBLIC_BASE_URL=https://<public-domain>
ADMIN_BASE_URL=https://<admin-domain>
MEDIA_BASE_URL=https://<media-domain>
OSS_UPLOAD_BASE_URL=https://<private-bucket>.oss-cn-hangzhou.aliyuncs.com
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou-internal.aliyuncs.com
OSS_PRIVATE_BUCKET=<private-bucket>
OSS_PUBLIC_BUCKET=<derivative-bucket>
CDN_URL_AUTH_ACTIVE_KEY=primary
CDN_URL_AUTH_PRIMARY_KEY=<primary-secret>
CDN_URL_AUTH_SECONDARY_KEY=<secondary-secret>
CDN_URL_AUTH_TTL_SECONDS=86400
```

- [ ] 生产 `.env` 权限只允许部署账户/容器读取，未进入镜像和 Git。
- [ ] `.env.example` 清楚说明本地公网 Endpoint 与变量职责。
- [ ] `.env.compose.example` 使用杭州生产内网 Endpoint，上传地址仍是公网 Bucket 域名。
- [ ] `config/runtime.example.json`、运行 Schema、单元测试、`docs/DEPLOYMENT.md`、OSS preflight 和 production verify 同步。
- [ ] production verify 拒绝：`MEDIA_BASE_URL` 为 OSS 域名、`OSS_ENDPOINT` 非杭州内网、上传 URL 包含 `-internal`、三个公开 origin 重复。
- [ ] 实际创建上传会话，返回 URL Host 是公网私有 Bucket 域名；不能仅检查变量存在。
- [ ] 实际执行服务端 HEAD/处理/保存，确认 ECS 到 OSS 走内网 Endpoint。

## 10. 空卷部署与数据恢复

- [ ] 第 9 节生产 `.env` 已填写并通过冻结配置校验。
- [ ] 按 T52-E6 冻结入口发布或传送 GATE-E 镜像；远程只拉取/载入，不重新构建。
- [ ] 远程镜像摘要与第 3 节 GATE-E 记录完全一致；运维脚本 commit 不改变该摘要。
- [ ] 复核而非重装宿主机 Nginx `1.30.4` 与 acme.sh `3.1.5`；记录 `nginx -t`、systemd active/enabled 和现有配置文件位置。
- [ ] 复核现有 Let's Encrypt 证书链、SAN、私钥匹配、稳定 key/fullchain 路径，以及 acme.sh config-home `0700`、`account.conf`/Secret `0600`；不输出 Secret。
- [ ] 确认 `Le_Webroot=dns_ali`、CA 为 Let's Encrypt production、root cron 每 6 小时执行且没有第二份调度；当前证书有效时不强制重签。
- [ ] 通过受控 `--install-cert --ecc` 更新现有 reload command 为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`；验证失败不会替换正常 worker。
- [ ] 将 Nginx 正式 `server_name` 从 wildcard 路由收敛为公开/管理精确域名；保留默认 421 server，证书本身可继续使用 wildcard。
- [ ] `docker compose config --services` 只显示 app；`docker compose ps` 只有一个常驻 Nuxt/Nitro app，不存在 Nginx 或 migrate 容器。
- [ ] 固定将 SQLite、备份和必要运行数据挂到持久卷；单实例、单写者不变。
- [ ] 以同一冻结 app 镜像的一次性容器在空数据卷运行 migrate，迁移数量、顺序、folderMillis 与 hash 完整匹配。
- [ ] 运行 init-admin；确认容器重启不会重置密码。
- [ ] `/api/health/live` 在进程存活时通过；`ready` 只在数据库、迁移和基础记录真实就绪后通过。
- [ ] Nginx 不向公网暴露健康端点；app 只发布到 `127.0.0.1:3000`，3000 从 ECS 公网和安全组外部探测均不可达。
- [ ] Nginx 到 loopback app 可达，proxy Host/scheme/client IP 与 `TRUSTED_PROXY_CIDRS` 的冻结契约一致；未知 Host/SNI 拒绝。
- [ ] 恢复备份只写新路径；验证后通过受控停机切换，不在线覆盖活动数据库。
- [ ] 用旧镜像 + 对应数据库副本完成一次回滚演练，不硬回滚已经执行的前向迁移。
- [ ] 演练无效 Nginx 配置：`nginx -t` 失败时旧 worker/旧证书继续服务，reload 非零且告警可见；修复后再 reload。
- [ ] 记录 RTO、实际耗时、失败点和恢复负责人。

在不切正式 DNS 的目标环境完成测量与校准：

- [ ] 测量首页、作品列表、详情、领养、返图墙首屏和整页的图片总字节数。
- [ ] 记录单访客冷缓存流量、热缓存流量、预期并发和正常峰值带宽。
- [ ] 根据实测峰值与用户费用边界调整第 8 节初始 CDN 封顶，不使用拍脑袋阈值。
- [ ] 把约 10 分钟监控延迟计入异常窗口费用，并记录调整理由。
- [ ] 验证 CDN 与 ECS 告警、联系人和测试通知真实可达。

部署命令以 [`../../../docs/DEPLOYMENT.md`](../../../docs/DEPLOYMENT.md) 为准；该文件必须在 T52-E6 与 GATE-E 冻结后再执行。

## 11. 切换顺序

- [ ] 确认从第 6 节开始的管理写入暂停仍然有效；如中途解除过，则在切换窗口重新暂停。
- [ ] 再次核对数据库验证备份和当前镜像 SHA。
- [ ] 部署已通过 T49/T50 的镜像和生产 `.env`，先不切正式 DNS。
- [ ] 通过 Host 解析/模拟访问验证公开站、管理端和 CDN。
- [ ] 公开/管理 production 证书链、SAN、有效期、稳定路径、root cron 和 Nginx 安全 reload 已验证；若 A 记录已提前指向 ECS，明确记录现状，不把它误写成正式切换已完成。
- [ ] 确认第 6 节已完成：两只 Bucket 仍为 private + BPA，历史 ACL/Policy 没有重新引入公共访问。
- [ ] 验证原始 OSS 匿名 403、有效 CDN URL 200、浏览器条件 PUT 成功。
- [ ] 核对/完成公开与管理 DNS 与媒体 CNAME；若公开 A 记录已提前指向 ECS，则记录其当前值与 TTL，不重复切换，也不把预先存在误写为本步骤已完成。
- [ ] 观察至少一个 DNS TTL + CDN 配置传播窗口。
- [ ] 解除管理写入暂停。
- [ ] 完成第 12 节全链验证后才宣布上线。

回滚原则：

- 不把 Bucket 改回 public-read 作为回滚手段；
- 应用故障回滚镜像/配置，媒体继续保持 private + CDN；
- CDN 故障可临时隐藏公开图片/页面并修复，不能暴露 OSS 原始域名；
- 数据问题从已验证副本恢复到新路径；
- 每次回滚保留故障和首次 NOT PASS 证据。

## 12. 上线验收矩阵

### 12.1 媒体安全

- [ ] 私有原图 Bucket 任意匿名 GET 403。
- [ ] 网页衍生 Bucket 原始 OSS 域名匿名 GET 403。
- [ ] 有效 CDN 签名 URL 200，图片 MIME、尺寸与摘要正确。
- [ ] 过期、篡改、缺签名 CDN URL 403。
- [ ] 公开 HTML/DTO 只有 CDN URL，没有 OSS 域名、私有 Object Key 或私有 OSS 签名 URL。
- [ ] `x-oss-process`、随机查询和未知路径不能制造动态源图处理或无限回源。
- [ ] CDN 回源权限不包含私有原图 Bucket。

### 12.2 下架与强制刷新演练

选一张专用测试衍生图：

- [ ] 先访问并确认 CDN 已缓存。
- [ ] 在管理端下架；公开列表/详情立即不再出现。
- [ ] operation 保存精确 CDN URL、刷新任务 ID 和状态，不记录鉴权 Key。
- [ ] 应用调用 `RefreshObjectCaches`，`Force=true`，`ObjectType=File`。
- [ ] 轮询 `DescribeRefreshTasks` 到 `Complete`；失败/超时进入可恢复状态。
- [ ] 在 5～6 分钟目标窗口后，旧 URL 不能由 CDN 继续返回图片；最终状态与源站删除一致。
- [ ] 重启应用后未完成刷新可以继续收敛，不产生重复对象或丢失 manifest。

官方文档：[刷新 CDN 缓存](https://help.aliyun.com/zh/cdn/user-guide/refresh-and-prefetch-resources)。

### 12.3 页面与操作

在 `390×844`、`768×1024`、`1440×900` 检查：

- [ ] 桌面与移动导航中文品牌精确为“有点小狗”，无“工作室”。
- [ ] 首页、作品、详情、领养、返图、委托、关于、服务、隐私、许可证页无坏图或横向溢出。
- [ ] 管理登录、作品/返图上传、发布、下架、冲突、失败、刷新和恢复可用。
- [ ] 管理 Host 与公开 Host 隔离；未知 Host 拒绝。
- [ ] 图片方向、固有尺寸、水印/无水印用途、EXIF 和 alt 正确。
- [ ] keyboard、focus、减少动效、console、network 和图片解码通过。
- [ ] analytics 不设置第三方 Cookie，不发送 IP、UA、Referer、查询串或联系方式；后台 1/7/30 天统计合理。

### 12.4 宿主机 Nginx 与 TLS

- [ ] 公共互联网只能访问 80/443；app 的 `127.0.0.1:3000` 从公网不可达，Nginx 到 app 正常。
- [ ] 80 仅重定向到相同 Host 的 HTTPS；ACME 签发/续期使用 DNS-01，不依赖 80。
- [ ] 公开/管理域名返回现有 Let's Encrypt production 证书，SAN 覆盖 `ditedog.com` 与 `*.ditedog.com`，链完整、SNI 正确。
- [ ] 媒体域名返回 CDN 侧证书，不错误回落到宿主机 SAN 证书。
- [ ] acme.sh config-home 权限正确，应用 `.env`、容器环境和客户端 bundle 中没有 `Ali_Key` / `Ali_Secret`。
- [ ] root cron 是唯一续期调度；最近一次续期结果和证书剩余天数可见，失败能告警。
- [ ] `_acme-challenge` TXT 没有遗留挑战记录；AliDNS 审计没有误删既有业务记录。
- [ ] 续期部署使用稳定证书路径；`nginx -t` 失败时不 reload，成功时平滑 reload 且连接不中断。
- [ ] 没有活动的 Certbot timer 或 `nginx-module-acme` 集成；残留 Certbot 二进制不参与续期，可在用户另行确认后清理。

### 12.5 运维与成本

- [ ] 备份、恢复、升级、旧镜像回滚各演练一次。
- [ ] 长任务在生成、验证、提交和 CDN 刷新边界中断后可恢复。
- [ ] CDN 用量封顶在测试域名/受控阈值下完成触发与恢复演练，不在正式高峰首次试验。
- [ ] 预算和技术告警各触发一次测试通知。
- [ ] CDN Top URL/IP/UA/Referer、命中率和回源流量可查看。
- [ ] ECS DDoS 基础防护、磁盘、证书、acme.sh cron、Nginx config/reload、容器和 ready 告警可查看。

## 13. 最终签署

| 门禁 | 负责人 | 日期 | 证据位置 | 结论 |
| --- | --- | --- | --- | --- |
| GATE-E 开发冻结 | REVIEW |  |  |  |
| T53-F1 参数与人工确认 | 用户 |  |  |  |
| T53-F2 阿里云控制台 | 用户 |  |  |  |
| T53-F3 远程开发机部署/恢复 | 执行者 + 用户 |  |  |  |
| T53-F4 正式全链验证 | REVIEW + 用户 |  |  |  |
| T53-F5 真实使用验收 | 用户 |  |  |  |

只有全部为 PASS，且没有未接受的 P0/P1 finding，才能在 STATE 中写“正式上线就绪”。
