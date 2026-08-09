# 任务清单：兽装工作室主页

> **角色**：当前唯一可勾选实施分解。
> **最后校准**：2026-08-09。
> **规则**：用户验收由用户签署；独立 Review 只能由未参与该实现的新上下文签署。已取消任务的勾选表示范围决策关闭，不表示功能曾实现。

## 当前目标

阶段 A–C 与 C.1 已完成。阶段 D 的工程、两轮修复和用户人工 Review 已合入并推送；用户于 2026-08-09 明确以本轮人工 Review 关闭 T42，原定逐任务独立 Review 合并到 T49，不得把用户验收冒充为独立 Review。

当前进入：

> **阶段 E：T46 最小访问统计 → T49 CI 与独立综合 Review → T50 全站最终回归。**
>
> 随后进入 **阶段 F：T51 正式品牌/备案 → T52 生产媒体、CDN 与部署 → T53 真实使用验收。**

最新已知 GitHub Actions 仍不得描述为全绿：历史证据是 `image-build` 成功、`checks` 在 Production build 失败、`e2e` 跳过。T49 必须在届时最新 `main` 的同一 SHA 重新取得完整结果。

生产媒体规则以 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源。云上人工步骤以 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md) 为执行清单。

## 执行规则

- 写入前读取远端最新 `main`，所有写入串行完成；
- 不 force push、不硬 reset、不删除或清空 `.env`；
- 不重写已经执行的迁移，只新增前向迁移；
- 当前两只 OSS Bucket 可以直接切换权限，不保留旧匿名 URL 或开发站前向兼容；
- 生产 Endpoint、浏览器上传 Endpoint 与 CDN 媒体 origin 必须分场景，不能共用一个值；
- 下架、发布、CDN 刷新和清理使用持久状态与精确 manifest；
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

- [x] **T35/T35-F1 · 返图领域最终模型**：`return_characters` 设定 + 多张 `return_photos`；作品关联可选、`ON DELETE SET NULL`，返图发布不依赖作品；迁移 0022/0024 与共享契约、服务、测试完成。
- [x] **T36/T35-F2/F3 · 返图媒体与页面**：私有 `return_photo` 上传、`return-display-v1` 无水印派生、持久发布/下架、设定管理、多图/主图、随机纯图片 `/returns` 和 `/returns/{slug}` 完成。
- [x] **T37 · 轻量展会掉落**：`purpose=adoption` + `adoption_method=event_drop`、展会名称/时间、管理四选项、领养筛选、首页/详情完成。
- [x] **T35-F4～F7 · 两轮用户 Review 修复**：公开倒序、首页精选顺序、视觉与文案、管理列表共用外壳、删除、委托页、许可证页完成并推送。
- [x] **T38**：取消更多站点文案字段；未实施。
- [x] **T39**：当前版本取消 slug 改址历史；移入未来迭代。
- [x] **T40**：取消 30 天回收站；未实施。
- [x] **T41**：取消独立手机后台任务；必要能力已并入 D。
- [x] **T42 · 阶段 D 用户门禁**：用户于 2026-08-09 以人工 Review 确认阶段 D 可以关闭；独立 Review 明确移交 T49。记录见 [`notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](./notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。

## E. P2 最小增量与发布级工程收口

### 已关闭范围决策

- [x] **T43 · 取消邮件找回密码**：继续使用 `auth:reset-password` 离线单管理员重置，不配置 SMTP。
- [x] **T44 · 取消 CSV 导出中心**：当前没有真实业务需求，不建设导出 DSL、后台任务或隐私审批流。
- [x] **T45 · 取消永久原图档案 UI**：永久原图继续保留在资产模型与备份边界中，不增加低频管理页面。
- [x] **T47 · 取消高级媒体恢复/批量运维 UI**：保留现有 operation 状态、精确恢复和受控 CLI；上线低频操作写入 Handbook。
- [x] **T48 · 阿里云 CDN 与生产隔离范围确认**：官方调研、两只现有 Bucket 复用、URL 鉴权与撤销语义已确定；实现拆到 T52-F1～F5。调研见 [`../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)。

### T46 · 最小化第一方访问统计

- [ ] **T46-B · 后端与数据契约**：
  - [ ] 新前向迁移建立最小事件表和必要索引，不修改历史迁移；
  - [ ] 只接受白名单事件：页面浏览、作品详情、返图设定页和官方联系行动；
  - [ ] 只保存规范 route key、可选公开实体 ID、事件时间和 HMAC 后的会话标识；
  - [ ] 不保存 IP、User-Agent、Referer、原始 URL/查询串、Cookie、联系方式或指纹；
  - [ ] 客户端随机会话 ID 仅放 `sessionStorage`，服务端用现有 Secret 做域分离 HMAC，不存原值；
  - [ ] 原始事件滚动保留 90 天，清理幂等且不增加常驻 worker；
  - [ ] 管理 API 提供今日/7 天/30 天、页面/内容排行与联系行动计数；
  - [ ] 公开写入有严格 Schema、body limit、速率限制和安全错误。

- [ ] **T46-F · 管理端与公开采集**：
  - [ ] 增加 `/admin/analytics`，保持 Quiet Editorial Tool，不引入通用 BI 或公开统计；
  - [ ] 只显示访问量、近似会话、热门页面/作品/返图和联系行动，不宣称精确独立访客或转化归因；
  - [ ] 公开端用同源 `sendBeacon`/`fetch keepalive` 最佳努力上报；失败不得阻断导航或图片；
  - [ ] 不引入第三方统计、Cookie、localStorage、跨站追踪或浏览器指纹；
  - [ ] 隐私政策必须由用户确认后再发布，准确说明第一方统计、字段和 90 天保留期。

- [ ] **T46-V · 实现验证与用户确认**：
  - [ ] 迁移、90 天清理、HMAC、枚举、重复/并发、限流和负路径测试；
  - [ ] 公开 DTO、HTML、日志和错误中无原始会话 ID、IP、UA、Referer、查询串或联系人；
  - [ ] 三视口下管理统计清楚、手机可查看，公开页面在采集失败时正常工作；
  - [ ] 保存实现自测结果；新上下文独立 Review 统一由 T49 执行，不在此处重复签署；
  - [ ] 用户确认统计含义和最终隐私文案。
  _依赖：T42。_

### T49 · CI 修复与独立综合 Review

- [ ] 以执行时最新 `main` 复现 GitHub Actions 历史失败，不依据旧摘要猜根因。
- [ ] 修复 `quality`，完整执行 frozen install、lint、typecheck、unit、integration、production build、production verify、secret/content scan 与 Compose 静态检查。
- [ ] `checks`、`image-build`、`e2e` 在同一个最新 main SHA 全部成功；`skipped` 不算成功。
- [ ] 在新的独立上下文 Review 阶段 D 最终代码；用户验收不替代这项 Review。
- [ ] 独立 Review T46 的统计、隐私、保留期和限流。
- [ ] 保留首次 finding 和 NOT PASS 历史，修复后逐项重测，不由实现者代签。
- [ ] 不删除测试、不放宽类型、安全、媒体、隐私或 E2E 断言。
_依赖：T46、T48。_

### T50 · 全站最终 E2E 与浏览器回归

- [ ] 管理 `localhost` / 生产管理 Host 与公开 `127.0.0.1` / 生产公开 Host 分开验证。
- [ ] `390×844`、`768×1024`、`1440×900` 覆盖全部公开页和主要管理流程。
- [ ] 覆盖成功、409、失败、恢复、重载、图片解码、横竖图、键盘/焦点、减少动效、console/network。
- [ ] 重放作品、返图、Hero、profile 和 reconcile 的进程中断/重复重启；CDN 刷新待 T52-F4 实现后在 T52-F7 验证。
- [ ] 确认没有私有 Object Key、私有签名 URL、授权记录、统计隐私字段或 Secret 泄漏。
- [ ] 形成同一 SHA 的 Review 记录与 artifact 清单。
_依赖：T49。_

## F. 正式品牌、生产媒体与目标环境

### T51 · 正式品牌、素材与备案校准

- [ ] 备案审批完成后记录真实 ICP 备案号、主体/网站名称和展示要求。
- [ ] 新增独立导航品牌常量：公开桌面导航、移动导航和复用公开壳的登录页中文名精确为“有点小狗”，不得带“工作室”。
- [ ] 不连带修改 `ownerDisplay`、条款版权主体、工作室介绍或其他已确认正文；如需改动另行取得用户确认。
- [ ] 使用正式 Logo、Hero、作品和返图做二次视觉/媒体校准；低分辨率风险继续诚实提示。
- [ ] 用户确认 EXT-01 已登记素材是否就是本次正式上线素材；如不是，只补交替换项，不把旧登记自动视为最终确认。
- [ ] 页脚 ICP、许可证和法务链接在三视口可见、正确、不过度抢夺图片视觉层级。
- [ ] 用户完成品牌、素材和备案展示验收。
_依赖：T50、备案审批。_

### T52 · 生产媒体边界与目标环境发布

- [ ] **T52-F1 · Endpoint 与配置职责拆分**：
  - [ ] `OSS_ENDPOINT` 只供服务端 SDK：杭州生产为 `https://oss-cn-hangzhou-internal.aliyuncs.com`，本地开发为杭州公网 Endpoint；
  - [ ] `OSS_UPLOAD_BASE_URL` 真正接入条件 PUT 签名，浏览器 URL 必须是私有 Bucket 公网域名且不能含 `-internal`；
  - [ ] `MEDIA_BASE_URL` 只接受 CDN 媒体 origin，生产校验拒绝原始 OSS Bucket 域名；
  - [ ] 同步 `.env` 的生产实例、`.env.example`、`.env.compose.example`、`config/runtime.example.json`、runtime Schema/测试、`docs/DEPLOYMENT.md`、production verify 与 preflight；
  - [ ] 保持当前 AK/SK 方案，不增加 ECS RAM Role 或客户端 STS。

- [ ] **T52-F2 · 两只现有 Bucket 生产隔离与 preflight 重写**：
  - [ ] 本项分两次执行：先重写代码/preflight 但不勾选 F2；待 F3/F4 应用能力和 Handbook 第 5 节 CDN 配置就绪后，再按第 6 节切 ACL/BPA 并完成云上验证，最后勾选 F2；
  - [ ] 不新增 Bucket、不保留旧匿名 URL 或双读兼容；
  - [ ] 两只 Bucket ACL 均为 private，Bucket 级 Block Public Access 均开启；
  - [ ] 审计历史 Object ACL/Bucket Policy，无 public-read/public-read-write；
  - [ ] 私有 Bucket CORS 只允许正式管理 origin 的条件 PUT；衍生 Bucket无上传 CORS；
  - [ ] RAM 继续精确到生产前缀，CDN 只回源衍生 Bucket；
  - [ ] 重写 `oss-preflight`：两个原始 OSS 域名匿名 403、应用权限通过、越权拒绝、CDN 有效 URL 200；
  - [ ] 开发站因 ACL 切换暂时失效可以接受，门禁不得要求旧 public-read 行为。

- [ ] **T52-F3 · CDN 私有回源与约 24 小时 URL 鉴权**：
  - [ ] 同账号私有 OSS 回源使用阿里云推荐 STS；确认 CDN 获得的是衍生 Bucket 全量读取而不是原图 Bucket；
  - [ ] 选择鉴权方式 A、主/备 Key、`86400` 秒；实现 `CDN_URL_AUTH_ACTIVE_KEY`、`CDN_URL_AUTH_PRIMARY_KEY`、`CDN_URL_AUTH_SECONDARY_KEY`、`CDN_URL_AUTH_TTL_SECONDS`，Key 只在服务端 Secret；
  - [ ] 所有公开 SourceSet/SSR/API 动态生成 CDN 签名 URL，不返回永久 OSS URL；
  - [ ] 有效、过期、篡改、缺签名 URL 测试齐全；完整签名 URL 不进入日志；
  - [ ] 分享和永久 URL 明确后置，不为此增加兼容层。

- [ ] **T52-F4 · 缓存、下架与 CDN 强制撤销**：
  - [ ] CDN 先鉴权，再忽略全部查询参数且不保留回源参数；`x-oss-process` 不能到达源站；
  - [ ] 不可变媒体 Key 在 CDN 长缓存，浏览器缓存最长 86400 秒，404 初始短缓存；
  - [ ] 媒体域名不开启响应过期缓存；
  - [ ] 下架先立即撤销页面投影，再删除精确 OSS 对象并调用 `RefreshObjectCaches`，`Force=true`、`ObjectType=File`；
  - [ ] operation 保存精确 CDN URL、任务 ID、状态和重试原因，使用 `DescribeRefreshTasks` 收敛；
  - [ ] 页面立即下架、CDN 服务器侧通常约 5～6 分钟撤销；失败可见、可重试，重启不丢 manifest。

- [ ] **T52-F5 · 防盗刷、用量封顶与监控**：
  - [ ] URL 鉴权为主，Referer 白名单为辅；正式浏览器验证后默认不允许空 Referer；
  - [ ] 基于目标环境实测峰值和用户月度预算设置 CDN 带宽/流量/HTTPS 请求数封顶；
  - [ ] 记录约 10 分钟监控延迟和延迟窗口费用，不能宣称零损失；
  - [ ] 费用预算与多级预警已配置，但文档明确预算只通知、不停资源；
  - [ ] CDN 命中率、回源、4xx/5xx、Top URL/IP/UA/Referer、域名状态与 ECS/磁盘/证书/DDoS 基础防护可观测；
  - [ ] 当前不购买高防、不引入 ESA；有真实证据再升级。

- [ ] **T52-F6 · 正式 Compose、空卷、TLS、备份、升级与回滚**：
  - [ ] 备案同步、三域名、证书、DNS/CNAME 与 Nginx 双 Host 完成；
  - [ ] 空卷 migrate/init/ready、持久卷、单实例和非 root 容器通过；
  - [ ] 备份、恢复到新路径、升级、旧镜像回滚和 migration 边界完成演练；
  - [ ] 不把 Bucket 改回 public-read 作为回滚方案；
  - [ ] 正式镜像由授权流程发布，不在未授权时创建 `v*` tag。

- [ ] **T52-F7 · Handbook 全链演练**：
  - [ ] 按 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md) 逐项执行并粘贴脱敏证据；
  - [ ] 真实验证原始 OSS 403、有效 CDN 200、过期/篡改 403、查询参数收敛、下架强制刷新、CORS 条件 PUT；
  - [ ] 三视口、Host、统计隐私、长任务中断、告警、用量封顶、备份恢复和回滚全部通过；
  - [ ] 新上下文独立 Review 生产配置与证据，结果为 PASS。
_依赖：T49、T50；T52-F6 的正式域名展示依赖 T51。_

### T53 · 真实使用验收与文档闭环

- [ ] 用户在正式公开/管理域名完成浏览、上传、发布、下架、冲突、失败和恢复操作。
- [ ] 用户确认“有点小狗”导航、正式素材、备案、统计含义和公开隐私文案。
- [ ] 用户确认 CDN 一日签名 URL 与 5～6 分钟服务器侧撤销语义符合预期。
- [ ] T49–T52 的未关闭 P0/P1 finding 为 0；被接受的 follow-up 明确登记。
- [ ] 同步 STATE、SPEC、PLAN、TASKS、模型、媒体策略、设计、产物、notes 索引、`CLAUDE.md` 与部署文档。
- [ ] 用户签署“正式上线就绪”；在此之前不得使用该表述。
_依赖：T51、T52。_

## 每项完成定义

每个实施任务至少留下：

- 范围、非目标、迁移/兼容/回滚边界；
- 实际 lint/typecheck/build/unit/integration/E2E 结果；
- UI/媒体任务的真实浏览器与三视口证据；
- 冲突、失败、进程中断、重复重启、隐私与成本负路径；
- 独立 Review 的初始 finding、修复和复测；
- `implementation/notes/` 实施/Review 记录与当前活文档同步；
- 用户门禁的明确确认。

阶段 D 已完成不等于正式上线就绪。只有 T49、T50、T51、T52、T53 全部关闭，才能宣布发布完成。
