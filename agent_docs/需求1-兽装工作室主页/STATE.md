# 当前状态

> **最后校准**：2026-08-10。
> **状态权威**：任务勾选以 [`implementation/TASKS.md`](./implementation/TASKS.md) 为准。

## 当前阶段

阶段 C/C.1 已完成。阶段 D 的返图、轻量展会掉落和两轮修复已落地并推送；用户于 2026-08-09 关闭 T42 人工验收，阶段 D/E 独立综合 Review 保留到 T49。

当前为：

> **阶段 E · 全部产品/上线基线开发、自动化门禁与可上线代码冻结。T52-E1～E6 与 T51-F3 工程完成；下一步进入 T49 新上下文独立综合 Review。**

阶段 E 包含所有剩余应用代码、数据库迁移、运行时配置 Schema、媒体/ESA 核心实现、部署/恢复基线、app-only Compose 与宿主机 HTTP-only Nginx 模板、自动化测试、浏览器回归和独立 Review。阶段 E 结束时必须形成唯一、不在阶段 F 改写的上线 SHA/镜像。

阶段 F 主要由用户和远程开发机执行：填写真实环境值、操作阿里云控制台、部署冻结镜像、演练恢复/回滚、做正式域名验收并签署。为适配实际运维，可以新增或调整独立小型运维脚本及其最小测试/文档；脚本不得改变应用代码、数据库 Schema、公开契约、运行时配置契约或冻结镜像。

本次边界调整见 [`implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md`](./implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md)。

## 已完成产品基线

- 独立公开端与管理端、Host/Origin/CSRF/Session 安全边界；
- 作品、领养、展会掉落、返图设定与多照片；
- 首页、委托、关于/政策/许可证、固定文案和品牌水印；
- 私有原图、公开衍生图、持久 operation 和恢复；
- Node 24、SQLite/Drizzle、Docker/Compose/Nginx 基础；
- 阶段 D 用户浏览器验收。

阶段 D 用户门禁见 [`implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](./implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。

T46/T51/T51-F1～F3 与 T52-E1～E6 已完成各自工程实现和相关本地自动验证；工程证据见 `implementation/notes/stage-e/` 对应记录。T51-F3 已取消出厂照像素硬阻断，并复用作品 publication operation 生成私有 FFmpeg Lanczos 适配源；用户在 2026-08-10 当前交互中确认浏览器行为可用。T52-E2 只冻结 preflight 实现和判定契约，尚未使用真实生产凭据运行 live 模式；T52-E3 已把公开 SourceSet/SSR/API 收敛到稳定 ESA URL；T52-E4 已实现精确 file purge、持久状态/重试/恢复和缓存策略校验入口；T52-E5 已冻结防盗刷/告警基线、实测入口、主机验证和脱敏证据模板；T52-E6 已交付 app-only Compose、目标机匹配的 HTTP-only Nginx/运维基线与直接面向部署人的顺序清单。实现 SHA `fcb99f4` 的 Actions run `31329958587` 中 `checks`、`image-build`、`e2e` 均成功。真实控制台缓存、warm-cache 撤销时限、生产套餐、预算和阈值仍由 T53 实测。这些结果不是 T49 独立 Review，也不关闭 T46 隐私文案或 T51 正式素材的用户确认项。

## 阶段 E 已锁定范围

1. **T46**：最小化第一方访问统计；
2. **T51/T51-F1～F3**：公开导航“有点小狗”、备案展示配置、正式素材、浏览器校准，以及低分辨率设定图/出厂照的非阻断 FFmpeg 适配；
3. **T51-F2**：公开作品与领养列表固定数量编号分页；
4. **T52-E1～E6**：Endpoint/配置、preflight、ESA 托管私有 OSS 回源、SDK 精确 purge、成本/监控准备，以及 app-only Compose + 宿主机 HTTP-only Nginx 远程部署包；
5. **T49**：同一 SHA CI 全绿与阶段 D/E 新上下文独立综合 Review；
6. **T50**：代码冻结前全站、媒体、进程、部署和恢复最终回归；
7. **GATE-E**：冻结唯一上线 SHA/镜像、环境变量契约、Handbook 核心命令基线和回滚入口。

T43、T44、T45、T47 已取消；T48 调研完成。所有生产能力的开发工作都在 E 完成，不进入 F。

## 阶段 F 已锁定范围

阶段 F 只有 T53-F1～F5：

- **F1**：用户填写域名、备案、素材、现有阿里云 AK/SK、Session Secret、正式套餐与预算等真实参数，并授权冻结镜像的发布/传送方式；
- **F2**：用户在 ESA/OSS 控制台收敛 wildcard DNS、复核 ECS `HTTP/80` 回源与边缘 HTTPS、配置缓存、源站保护/WAF、初始用量封顶和告警，并把两只 Bucket 切为 private + BPA；
- **F3**：远程执行者先填写并校验生产 `.env`，再发布/传送、拉取/载入并核对冻结镜像摘要，随后部署唯一常驻 Nuxt 容器，把宿主机 Nginx 收敛为公开/管理精确 Host 的 HTTP-only origin，执行迁移、preflight、测量校准、备份/恢复和回滚；
- **F4**：正式域名做媒体安全、ESA 边缘 TLS/源站保护/purge、HTTP-only Nginx、loopback 隔离、三视口、业务操作、监控和恢复全链验证；
- **F5**：用户真实使用验收和证据闭环。

F 允许的仓库写入包括验收 note、证据索引、checkbox、STATE 状态同步，以及必要的独立运维脚本/包装器与最小验证。运维脚本应默认 dry-run、输出脱敏、目标明确、可回滚，并单独记录 commit 与验证结果；若需要改应用源码、迁移、运行时 Schema、环境变量契约、Dockerfile、Compose、Nginx/ESA 冻结模板、自动化产品测试或发布镜像，GATE-E 失效，必须返回阶段 E。

## 生产事实

### 品牌与备案

- 备案网站名称为“有点小狗”；
- 公开桌面/移动导航和复用公开壳的登录页精确显示“有点小狗”，不带“工作室”；
- 管理端、作品主人、工作室介绍、服务条款和 SEO 组织名称不机械全局替换；
- 阶段 E 实现空值隐藏和生产配置；阶段 F 才写入审批后的真实备案值。

### OSS 与 ESA

- 复用现有私有源图 Bucket 与网页衍生 Bucket，不创建额外生产 Bucket；
- 目标状态是两只 Bucket 均 private + Bucket 级 BPA；
- `public-media.ditedog.com` 同账号私有回源衍生 Bucket；ESA 到 OSS 的 STS 鉴权由阿里云自动完成，业务侧不实现 STS；
- 首版不做自定义边缘 URL 鉴权；公开页只使用稳定的 ESA HTTPS 媒体 URL；
- 下架页面立即移除，服务端通过官方 SDK 对精确 URL 调用 `PurgeCaches(Type=file)`，保存 `TaskId` 并追踪 `DescribePurgeTasks`；完成时限由 T53 目标环境实测；
- 阶段 E 完成相关实现与自动验证；阶段 F 执行真实控制台切换和远程验证。

### Endpoint 与凭据

- 本机开发服务端：杭州公网 OSS Endpoint；
- 杭州远程机上的 app/migrate/ops：杭州内网 Endpoint；
- 浏览器条件 PUT：私有 Bucket 公网域名；
- ESA 回源：`public-media.ditedog.com` 对网页衍生 Bucket 的同账号私有 OSS 源站；
- 公开图片：ESA 公开媒体域名；
- 应用继续使用 `.env` 中现有一套静态阿里云 AK/SK，OSS 与 ESA API 共用；不再要求或保存第二套 ESA 凭据。该凭据权限较大，Secret 不进入客户端、仓库、日志或截图；
- 浏览器条件 PUT 仍使用私有 Bucket 原始公网域名，不经过 ESA。

### ESA、宿主机 Nginx 与 TLS

- Nginx 独立安装在 ECS 宿主机并由 systemd 管理；Compose 唯一常驻服务是 Nuxt/Nitro app，migrate/ops 使用同一冻结镜像的一次性容器；
- app 端口固定只发布到 `127.0.0.1:3000`，安全组不开放 3000；宿主机 Nginx upstream 固定为该地址；
- `ditedog.com` 已切 ESA NS；客户端 TLS 由 ESA 托管边缘证书终止，ESA 到 ECS 固定使用 HTTP/80；
- 2026-08-09 已按用户授权卸载宿主机 acme.sh、root 续期 cron 和 `/etc/nginx/ssl`，关闭 443；该机只保留 systemd Nginx 的 HTTP/80 origin；
- ESA 边缘强制 HTTPS；正式 DNS 与 Nginx `server_name` 只列公开/管理精确域名，未知 Host 返回拒绝。当前 wildcard 只作为临时预部署状态，T53 必须收敛；
- 生产应启用 ESA 源站保护，把 ECS 80 限制为仅 ESA 回源 IP；3000 仍只绑定 loopback；
- `/_nuxt/**` 等不可变静态资源可长缓存，管理 Host、`/api/**`、登录/会话与写操作绕过共享缓存，公开 SSR HTML 在实测前默认绕过缓存。

当前 ESA 决策见 [`planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](./planning/ESA-PRODUCTION-DECISION-2026-08-09.md)，服务器执行证据见 [`implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md`](./implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md)。较早的 ACME note 只保留为历史盘点。

## 任务状态

| 任务 | 状态 | 下一步 |
| --- | --- | --- |
| T42 | 用户门禁已关闭 | 独立 Review 移交 T49 |
| T43/T44/T45/T47 | 已取消 | 不建设 |
| T48 | 调研/契约完成 | 实现已纳入 T52-E1～E6 |
| T46 | 工程完成，用户文案确认待关闭 | T49 独立 Review；用户确认统计含义与最终隐私文案 |
| T51 | 工程完成，正式素材确认待关闭 | 用户选择正式素材/独立竖版 Hero；低分辨率设定图可自动适配，仅可因清晰度自愿替换 |
| T51-F1 | 工程完成 | T49 新上下文独立 Review |
| T51-F2 | 工程完成 | T49 新上下文独立 Review |
| T51-F3 | 工程完成；用户已确认当前浏览器行为 | T49 新上下文独立 Review |
| T52-E1 | 工程完成 | T49 新上下文独立 Review |
| T52-E2 | 工程完成；目标环境 live 待 T53 | T49 新上下文独立 Review |
| T52-E3 | 工程完成；目标环境 ESA/OSS live 待 T53 | T49 新上下文独立 Review |
| T52-E4 | 工程完成；目标环境缓存/purge 实测待 T53 | T49 新上下文独立 Review |
| T52-E5 | 工程完成；目标环境套餐/预算/阈值/告警待 T53 | T49 新上下文独立 Review |
| T52-E6 | 工程完成 | T49 新上下文独立 Review |
| T49 | 待独立 Review | 保留历史 NOT PASS，在新上下文重放同一 SHA 自动化与综合 Review |
| T50 | 等待 T49 | 最终回归与冻结证据 |
| GATE-E | 等待 T50 | 允许进入阶段 F |
| T53-F1～F5 | 等待 GATE-E | 用户与远程机执行 |

## 不阻断阶段 E 的用户输入

- ICP 审批结果、备案号与平台同步时间；
- 正式公开、管理域名；公开媒体域名已确定为 `public-media.ditedog.com`；
- ESA Site/API Endpoint 与现有阿里云 AK/SK 的实际值；
- ESA 正式套餐、源站保护/WAF策略、月度预算和目标环境实测后的用量封顶数值；
- EXT-01 素材是否直接作为正式素材，以及替换项。

阶段 E 必须先把这些输入建成明确的配置槽、校验和空值行为，不能等待真实值才开发。真实值在 T53-F1 写入远程 Secret/环境，不进入仓库。

## GitHub Actions 已知边界

历史 Actions 的多次 failure/cancelled/skipped 已原样保留在 T52-E6 工程记录。实现 SHA `fcb99f4` 的最新完整证据是 quality run `31329958587` success：`checks`、`image-build`、`e2e` 三项均实际执行并成功。该结果关闭 T52-E6 工程，不代签 T49 新上下文独立 Review；T49 仍须基于其实际审阅的最新 `main` 核对同一 SHA Actions。

## 下一步顺序

1. T49；
2. T50；
3. GATE-E；
4. T53-F1～F5。

## 当前发布边界

- 当前未取得正式上线结论；
- 阶段 E 不创建未授权 `v*` tag、不提前切 Bucket ACL；用户已提前切换 ESA NS、配置临时 DNS/边缘证书/同账号私有 OSS 回源并限制 ECS origin 为 HTTP/80，服务器也已按授权改为 HTTP-only origin；这些只记作预检现状，不视为 T52/T53 或正式切换完成；
- 阶段 F 不修改冻结应用产物；仅允许受控补充独立运维脚本；
- 只有 GATE-E 和 T53-F1～F5 全部关闭后，才可声明“正式上线就绪”。
