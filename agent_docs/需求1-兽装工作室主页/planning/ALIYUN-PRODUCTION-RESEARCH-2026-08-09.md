# 阿里云生产媒体与成本边界调研（2026-08-09）

> **性质**：官方文档调研与方案依据，不是控制台执行记录。
> **最终执行入口**：[`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。
> **当前契约**：[`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)。

## 1. 结论摘要

当前两只杭州 OSS Bucket 可以继续复用，不需要再创建开发/生产 Bucket。上线前把两只 Bucket 都改为私有并开启 Block Public Access；公开衍生物由阿里云 CDN 同账号私有回源读取。公开页面只下发约 24 小时有效的 CDN 鉴权 URL。

代价与边界：

- CDN 同账号私有回源获得源 Bucket 全部资源的读取能力，CDN 侧不能再按前缀缩小。因此衍生 Bucket 只能放“即使被 CDN 读取也允许作为网页媒体发布”的对象，永久原图绝不能进入；
- 删除 OSS 源对象不会自动删除 CDN 边缘缓存。下架必须同时撤销数据库公开投影、删除精确源对象并通过 API/SDK 对精确 CDN URL 提交 `Force=true` 强制刷新；
- URL 鉴权和 Referer 拦截失败仍会产生少量 CDN 流量，HTTPS 请求也可能计费，因此还要配置用量封顶和费用预算；
- CDN 用量监测大约有 10 分钟延迟，封顶不是零损失开关；预算预警只通知，不会停止资源；
- 杭州内网 OSS Endpoint 只适用于同地域 ECS。浏览器上传和本地开发必须使用公网 Endpoint；
- 当前不做异地灾备，不购买 DDoS 高防，不引入 ESA，也不改变应用 AK/SK 方案。

## 2. OSS 访问与权限

### 2.1 Endpoint 分场景

阿里云把 Endpoint 定义为 SDK/工具连接 OSS 的服务地址，把 Bucket 域名定义为浏览器访问、签名 URL 等具体资源地址。杭州场景：

| 场景 | 目标地址 |
| --- | --- |
| 杭州 ECS 内的服务端 SDK | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 本地开发机的服务端 SDK | `https://oss-cn-hangzhou.aliyuncs.com` |
| 管理端浏览器条件 PUT | `https://<private-bucket>.oss-cn-hangzhou.aliyuncs.com` |
| 公开网页图片 | `https://<media-domain>/...`，不得使用 OSS 域名 |

同地域 ECS 通过内网 Endpoint 访问 OSS 不经过公网，也不产生 OSS 公网流出流量。内网地址不能从普通互联网客户端访问。

官方文档：

- [OSS 访问域名与网络连通性](https://help.aliyun.com/en/oss/user-guide/access-and-network-overview)
- [通过 Endpoint 和 Bucket 域名访问 OSS](https://help.aliyun.com/zh/oss/user-guide/access-oss-via-bucket-domain-name)

### 2.2 两只 Bucket 都必须私有

Object ACL 优先级高于 Bucket ACL：仅把 Bucket ACL 改为 private，并不能自动消除历史 `public-read` Object ACL。Block Public Access 开启后会阻止公共 ACL 或公共策略继续产生匿名访问，因此上线清单同时要求：

1. 两只 Bucket ACL 均为 private；
2. 两只 Bucket 的 Bucket 级 Block Public Access 均开启；
3. 审计历史 Object ACL 与 Bucket Policy，不保留公共授权；
4. 原始 OSS Bucket 域名匿名 GET 必须返回 403。

官方文档：

- [开启 OSS Block Public Access](https://help.aliyun.com/zh/oss/user-guide/block-public-access/)
- [Object ACL 及其优先级](https://help.aliyun.com/zh/oss/user-guide/object-acl)

## 3. CDN 私有回源与 URL 鉴权

同账号 OSS 源站应使用 CDN 的同账号私有 Bucket 回源，阿里云推荐由系统使用 STS 临时令牌完成回源鉴权。该 STS 仅用于 CDN 到 OSS，不改变当前应用服务端 AK/SK。

CDN 回源授权不能在 CDN 侧限制到 Bucket 的部分前缀。因此本项目保留两只 Bucket 的职责隔离：CDN 只指向衍生 Bucket，不得指向私有原图 Bucket。

官方文档：

- [CDN 回源私有 OSS Bucket](https://help.aliyun.com/zh/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets)

URL 鉴权由应用服务端按 CDN 规则签名，CDN 节点先校验签名，再去除鉴权参数、生成缓存 Key并在需要时回源。当前选择鉴权方式 A、主/备 Key、有效期 `86400` 秒。鉴权 Key 只能保存在 CDN 控制台与生产 Secret 中。

官方文档：

- [配置 CDN URL 鉴权](https://help.aliyun.com/zh/cdn/user-guide/configure-url-signing/)
- [鉴权方式 A](https://help.aliyun.com/zh/cdn/user-guide/type-a-signing)

## 4. 查询参数、缓存与撤销

所有媒体像素已经预生成，公开 URL 不需要任何动态图片处理参数。CDN 应配置“忽略全部参数、不保留回源参数”：URL 鉴权优先完成，随后鉴权参数不进入缓存身份，也不把任意 `x-oss-process` 或随机参数传给 OSS。

官方文档：[CDN 忽略参数](https://help.aliyun.com/zh/cdn/user-guide/ignore-parameters/)

不可变 Key 允许边缘节点使用长缓存，但浏览器缓存不应超过签名 URL 的一天有效期。CDN 自定义出站响应头只影响浏览器，不影响 CDN 节点缓存，因此可以把两者分开：

- CDN 节点：不可变图片长缓存；
- 浏览器：`Cache-Control` 最长 86400 秒；
- 404 等负状态码：初始短缓存，防止随机 Key 反复回源；
- 不开启“响应过期缓存”，避免源站 404/故障时继续返回已经下架的旧图片。

官方文档：

- [配置 CDN 缓存过期时间](https://help.aliyun.com/zh/cdn/user-guide/configure-the-cdn-cache-expiration-time)
- [配置状态码缓存过期时间](https://help.aliyun.com/zh/cdn/user-guide/create-a-cache-rule-for-http-status-codes)
- [配置缓存出站响应头](https://help.aliyun.com/zh/cdn/user-guide/create-a-custom-http-response-header/)
- [响应过期缓存](https://help.aliyun.com/zh/cdn/user-guide/serve-stale-content)

删除 OSS 源文件不会清除边缘副本。阿里云说明刷新任务通常需要 5～6 分钟全网生效；控制台不能提交 `Force=true`，必须使用 API/SDK。应用的下架 operation 因此要保存待刷新 CDN URL 清单、任务 ID、查询结果和重试状态。

官方文档：[刷新和预热 CDN 缓存](https://help.aliyun.com/zh/cdn/user-guide/refresh-and-prefetch-resources)

## 5. 防盗刷与成本

初始组合：

- URL 鉴权为主；
- Referer 白名单只允许正式公开站域名，默认不允许空 Referer，正式浏览器回归通过后再切换；
- 忽略随机查询参数，避免通过参数制造大量不同缓存 Key；
- CDN 用量封顶至少覆盖带宽、流量和 HTTPS 请求数；
- 费用与成本中心配置月度预算和多级预警；
- 监控命中率、回源流量、4xx/5xx、Top URL/IP/UA/Referer 和 CDN 下线事件。

Referer 可被伪造，且空 Referer 可能由隐私工具产生，所以它只是第二层控制，不能替代 URL 鉴权。

阿里云用量封顶约有 10 分钟监测延迟，达到阈值后的延迟期资源仍计费；配置针对整个域名，不能细化到单一 IP。预算预警也只通知，不限制资源。手册不虚构阈值，要求在目标环境压力与页面总量实测后填写。

官方文档：

- [CDN Referer 防盗链](https://help.aliyun.com/zh/cdn/user-guide/configure-a-referer-whitelist-or-blacklist-to-enable-hotlink-protection)
- [配置 CDN 用量封顶](https://help.aliyun.com/zh/cdn/user-guide/configure-usage-cap)
- [预算管理](https://help.aliyun.com/zh/user-center/how-to-manage-a-budget)
- [防范 CDN 流量盗刷](https://help.aliyun.com/zh/cdn/use-cases/best-practices-for-preventing-traffic-theft)

若未来出现频繁换 IP、自动化盗刷且基础 CDN 规则不足，再评估 ESA。当前不为尚未出现的攻击增加产品和部署复杂度。

## 6. 备案、域名与 DDoS

CDN 加速区域为中国内地或全球时，加速域名必须完成 ICP 备案；官方建议备案完成并同步约 8 小时后再添加域名。本项目等待当前备案完成，不使用“全球（不含中国内地）”临时绕过正式上线门禁。

官方文档：

- [添加 CDN 加速域名](https://help.aliyun.com/zh/cdn/add-a-domain-name)
- [阿里云 CDN 的 ICP 备案要求](https://help.aliyun.com/zh/icp-filing/basic-icp-service/product-overview/use-alibaba-cloud-cdn)
- [配置 CDN CNAME](https://help.aliyun.com/zh/cdn/add-a-cname-record-for-a-domain-name)

ECS 公网 IP 默认有 DDoS 基础防护，具体清洗/黑洞阈值取决于资产与地域。当前先核对并记录控制台实际阈值，不购买 DDoS 高防；只有真实威胁、合规或可用性目标证明基础能力不足时再升级。

官方文档：[DDoS 基础防护](https://help.aliyun.com/zh/anti-ddos/basic-ddos-protection/product-overview/what-is-anti-ddos-basic)

## 7. 明确不采用

- 不新建第三只或第四只 Bucket；
- 不保留 public-read Bucket、public-read Object ACL 或永久匿名 OSS URL；
- 不让 CDN 回源私有原图 Bucket；
- 不使用 OSS `x-oss-process` 作为公开页面动态处理方案；
- 不在 CDN 和应用端同时保留两套互不一致的 URL 鉴权；
- 不开启媒体响应过期缓存；
- 不把预算预警误写成费用硬上限；
- 不在本阶段引入异地灾备、DDoS 高防、ESA、ECS RAM Role 或客户端 STS 上传。
