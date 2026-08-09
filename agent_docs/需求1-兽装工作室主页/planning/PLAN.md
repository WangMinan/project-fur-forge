# 实施计划

> **角色**：描述当前阶段仍有效的技术方案、执行顺序与边界。
> **最后更新**：2026-08-09。
> **当前阶段**：阶段 E；阶段 D 已经用户验收，独立综合 Review 合并到 T49。

## 1. 稳定技术基线

- Nuxt 4、Vue 3、Nitro、Node.js 24、pnpm 11；
- SQLite + Drizzle，单实例、单写者；
- 公开 Host 与管理 Host 隔离；
- 现有两只杭州 OSS Bucket：永久私有源与网页衍生物职责分离；
- 浏览器条件 PUT，服务端重验摘要/MIME/尺寸/角色；
- 公开图预生成、验证、不可变 Key，页面不使用 `x-oss-process` 动态加工；
- `server/utils/{repository,service,runner,recipe,route}/` 五层边界；
- operation 的 attempt、lease、heartbeat、失败清理和启动恢复；
- 资源版本和 409，不静默覆盖；
- 前向迁移、验证备份、readiness 与 migration hash；
- Node 24 镜像、Compose/Nginx 和 GitHub Actions 骨架。

阶段 D 的返图与展会模型不再重新设计。详细现状见 [`../models/README.md`](../models/README.md)。

## 2. 阶段 E 方案

### 2.1 T46 第一方访问统计

目标是回答“最近有多少浏览、哪些内容被看、哪些官方联系入口被点击”，不建设用户画像、营销归因或通用 BI。

#### 数据

新增一张最小事件表：

```text
analytics_events
  id
  occurred_at
  event_type
  route_key
  entity_type nullable
  entity_id   nullable
  action_key  nullable
  session_hmac
```

约束：

- `event_type` 只允许页面浏览与官方联系行动；作品/返图详情通过白名单 `route_key` + 公开实体 ID 表达；
- 客户端每个浏览器会话在 `sessionStorage` 生成随机 ID；服务端使用现有 Session Secret 做带固定域分离前缀的 HMAC，只保存摘要；
- 不保存 IP、UA、Referer、原始 URL、查询串、Cookie、联系方式或设备指纹；
- 原始事件滚动保留 90 天；不增加常驻 worker，使用受控运维命令或低频幂等清理；
- 所有分组查询使用索引并限制 1/7/30 天窗口，避免全表无界扫描。

#### 写入与统计

- 公开同源 endpoint 接受严格小体积 JSON；
- 客户端使用 `sendBeacon`，不可用时使用 `fetch(..., { keepalive: true })`；失败静默，不阻断主路径；
- 管理 API 返回页面浏览、近似会话、热门页面/作品/返图和联系行动；
- “会话”是 sessionStorage 生命周期的近似，不称为精确独立访客；
- 登录/管理访问、健康检查、媒体请求和机器人 SSR 不进入业务访问统计；
- 公共写入复用安全错误、body limit 和专用限流。

#### UI 与隐私

- `/admin/analytics` 只提供今日、7 天、30 天三档；
- 使用少量数字、表格或简图，不建立筛选器构造器、导出、实时大屏或公开排行榜；
- 统计 UI 不抢占作品/返图管理主流程；
- `/privacy` 的最终公开文案必须由用户确认，准确描述第一方字段、用途与 90 天保留，不凭文档作者自行生成法律承诺。

### 2.2 T49 CI 与独立综合 Review

T49 在最新 `main`：

1. 复现历史 `checks` Production build 失败；
2. 修复而不删除测试/放宽门禁；
3. 取得 `checks`、`image-build`、`e2e` 同一 SHA 全绿；
4. 在新的独立上下文 Review 阶段 D 最终实现和 T46；
5. 冻结初始 finding，修复后逐项重测；
6. 输出可被 T50/T52 复用的同一 SHA 与 artifact 清单。

用户阶段 D 验收与 T49 独立 Review 是两个结论，不能互相代签。

### 2.3 T50 全站最终回归

- 管理/公开 Host 分离；
- 三固定视口；
- 作品、返图、领养、Hero、文案、品牌、统计；
- 成功、409、失败、恢复、重载、图片解码、键盘/焦点、减少动效；
- publication、profile、reconcile、return 与新增清理的进程中断/重复重启；
- 公开 DTO/HTML/日志中的私有字段和 Secret 扫描。

T50 仍是本地/受控环境最终回归，不替代 T52 的目标云环境演练。

## 3. 阶段 F 生产媒体架构

### 3.1 存储职责

不新增 Bucket，直接复用当前两只：

| 存储 | ACL/BPA | 允许内容 | 禁止内容 |
| --- | --- | --- | --- |
| 私有原图 Bucket | private + Bucket BPA | 原图、处理源、Logo 候选、管理预览、临时对象 | CDN 回源、匿名访问 |
| 网页衍生 Bucket | private + Bucket BPA | READY 网页衍生物 | 原图、处理源、Logo、授权附件、任意私有数据 |

CDN 同账号私有回源会获得网页衍生 Bucket 的全量读取能力，不能在 CDN 侧再按前缀缩小。因此存储职责隔离是硬安全边界。上线 preflight 必须验证内容类别与数据库可追溯性。

用户允许直接切现有 Bucket ACL；不建设旧 public-read URL 的双读、301、代理或兼容窗口。回滚也不能把 Bucket 改回 public-read。

### 3.2 三种访问地址

| 使用者 | 配置 | 地址 |
| --- | --- | --- |
| 杭州 ECS 中的 OSS SDK | `OSS_ENDPOINT` | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 本地服务端 OSS SDK | `OSS_ENDPOINT` | `https://oss-cn-hangzhou.aliyuncs.com` |
| 管理浏览器条件 PUT | `OSS_UPLOAD_BASE_URL` | 私有 Bucket 杭州公网域名 |
| 公开页面媒体 | `MEDIA_BASE_URL` | 正式 CDN 媒体 origin |

当前代码虽然加载 `OSS_UPLOAD_BASE_URL`，条件 PUT 签名实际仍从 `OSS_ENDPOINT` 客户端生成。T52-F1 必须把上传签名客户端/URL 与服务端内网客户端拆开，并测试最终返回 Host；只修改模板变量不足以完成任务。

同步范围：生产 `.env`、`.env.example`、`.env.compose.example`、`config/runtime.example.json`、runtime Schema/测试、production verify、OSS preflight 与 `docs/DEPLOYMENT.md`。

### 3.3 URL 鉴权

- CDN 鉴权方式 A；
- 主/备 Key；
- 有效期 `86400` 秒；
- 应用在组装公开 SourceSet 时签名，不在数据库保存完整签名 URL；
- 数据库继续保存不可变对象身份和相对路径；
- 鉴权 Key 只存在生产 Secret 与 CDN 控制台；
- 公开 HTML/DTO 可以包含供当前页面加载的 CDN 签名 URL，但日志、错误、审计和 artifact 不记录完整 URL；
- 分享、长期 URL、海报和二维码后置。

URL 签名服务应是单一纯函数/服务，供首页、作品、领养、返图和站点 Hero 共用；不得在各 repository 中复制签名算法。

### 3.4 查询与缓存

- URL 鉴权先执行；
- CDN 忽略全部查询参数、不保留回源参数；
- 任意 `x-oss-process` 不到达 OSS；
- 数据库不可变 Key是缓存身份，不能靠 query `v=` 管版本；
- CDN 节点使用长缓存；CDN 出站响应头把浏览器缓存限制到最长 86400 秒；
- 404 初始缓存 60 秒，目标环境观察后再改；
- 不开启响应过期缓存，避免已经下架的旧图在回源异常时重新被提供。

### 3.5 下架与撤销

下架顺序：

1. SQLite 短事务立即撤销公开状态/投影；
2. 固化精确 OSS Object Key 和未签名 CDN 原始 URL manifest；
3. 删除不再被引用的衍生对象；
4. 用 CDN API 对精确 File URL 提交 `RefreshObjectCaches`，`Force=true`；
5. 保存任务 ID并通过 `DescribeRefreshTasks` 查询；
6. `Complete` 后 operation 收敛；失败/超时保留 manifest 和稳定 reason，允许重试；
7. 启动恢复扫描继续未终止任务，不能重复破坏业务状态。

公开页面在第 1 步后立即不再显示。用户接受已经签发/缓存的媒体由 CDN 服务器侧通常约 5～6 分钟完成撤销。应用必须如实显示刷新中或失败，不能把“已下架”冒充“CDN 已全网撤销”。

使用现有应用 AK/SK，并给同一 RAM 身份增加最小 CDN 刷新/查询动作；不引入第二套密钥。具体权限与操作见 Handbook。

## 4. 防盗刷、成本与可观测性

初始防线：

1. URL 鉴权；
2. Referer 白名单（正式浏览器验证后默认不允许空 Referer）；
3. 忽略随机查询参数；
4. CDN 用量封顶；
5. 费用预算/预警；
6. CDN 与 ECS 技术监控。

阈值不在没有数据时硬编码。T52-F5 先测目标环境页面总字节数、冷/热缓存、并发和正常峰值，再由用户填写月度预算和最大异常容忍，随后设置带宽、流量和 HTTPS 请求数封顶。

阿里云用量数据约有 10 分钟延迟，封顶延迟期照常计费；预算只通知、不限制资源。文档和 UI 必须保持这两个事实。

当前只核对 ECS 默认 DDoS 基础防护实际阈值，不购买高防；只有真实攻击或可用性目标证明 CDN 基础能力不足时再评估 ESA/高防。

## 5. 品牌与备案实施

新增“导航品牌”概念，不粗暴全局替换：

```text
PROJECT_NAV_NAME = 有点小狗
PROJECT_NAME     = 现有完整工作室称呼（暂不自动修改）
PROJECT_ENGLISH_NAME = DITE DOG
```

`PROJECT_NAV_NAME` 只用于公开桌面导航、移动导航和复用公开壳的登录页。作品主人预设、条款版权主体、关于文案、SEO 组织名和页脚完整称呼是否更改，需要逐项业务确认。

备案完成后再填真实 ICP 号；不得把占位号发布。中国内地/全球 CDN 域名等待备案数据同步后添加。

## 6. 目标环境与回滚

### 配置与镜像

- 正式镜像必须来自 T49 同一 SHA；
- production `.env` 在服务器受控目录创建，不进入镜像/Git；
- Compose 先 migrate，再 init-admin，再 app/nginx；
- app 不发布宿主机端口，Nginx 双 Host/未知 Host拒绝；
- 空卷、ready、持久卷、非 root runtime 和动态生产依赖真实验证。

### 数据

- 切换前验证备份；
- 恢复只写新路径并通过 integrity/foreign key/migration hash；
- 不在线覆盖活动数据库；
- 不硬回滚已经执行的前向迁移；
- 旧镜像回滚使用兼容的数据库副本，并记录实际 RTO。

### 云资源

- 应用回滚不改变 Bucket private+BPA；
- CDN 故障不允许回退到永久 OSS URL；
- 必要时隐藏媒体/页面并修复；
- DNS/CNAME 修改前备份旧值，在低流量窗口切换并观察 TTL。

## 7. 执行顺序

1. T46 后端 → 前端 → 实现验证 → 用户隐私文案确认；独立 Review 统一在 T49；
2. T49 最新 main CI 修复 + 阶段 D/E 新上下文综合 Review；
3. T50 全站最终回归；
4. T51 备案、导航品牌与正式素材；
5. T52-F1 Endpoint/配置拆分；
6. T52-F2a 重写 preflight 和权限校验代码，此时不切 ACL、不勾选 F2；
7. T52-F3 CDN 私有回源和 URL 鉴权应用能力；
8. T52-F4 缓存、下架强制刷新与恢复应用能力；
9. 按 Handbook 第 5 节先配置 CDN，再按第 6 节执行 T52-F2b：两只 Bucket 私有化/BPA 与真实 preflight，完成后勾选 F2；
10. T52-F5 防盗刷、封顶、预算和监控；
11. T52-F6 正式 Compose、TLS、空卷、备份、升级、回滚；
12. T52-F7 按 Handbook 全链演练和独立 Review；
13. T53 用户真实使用验收与文档闭环。

配置代码与云控制台不能分开验收：F2a、F3、F4 可以先在受控测试环境实现；F2 只有在 F2b 的真实 ACL/BPA 与 preflight 通过后才可勾选。正式 Bucket ACL/CNAME 切换必须等 T49/T50 与备案准备满足 Handbook 前置条件。

## 8. 非目标

- 邮件找回密码、CSV 导出、原图档案 UI、高级批量运维 UI；
- 新建生产/开发 Bucket或异地灾备；
- 永久匿名 OSS URL、公开读 Bucket、双读兼容；
- ECS RAM Role、客户端 STS 上传或新增密钥服务；
- 分享海报、二维码和长期公开图片 URL；
- DDoS 高防、ESA、SLS 实时日志平台；
- 多管理员、RBAC、消息队列、常驻 worker 或通用 CMS。

## 9. 证据与完成边界

- 阿里云研究依据：[`ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](./ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)；
- 用户操作清单：[`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md)；
- 唯一可勾选任务：[`../implementation/TASKS.md`](../implementation/TASKS.md)；
- 当前状态：[`../STATE.md`](../STATE.md)。

阶段 D 已完成；正式上线结论仍依赖 T49、T50、T51、T52、T53。
